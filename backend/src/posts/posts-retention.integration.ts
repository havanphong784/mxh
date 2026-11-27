import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Temporal } from "@js-temporal/polyfill";
import { ForbiddenException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { MediaService } from "../media/media.service.js";

const databaseUrl = process.env.POSTS_TEST_DATABASE_URL;
if (!databaseUrl || process.env.NODE_ENV === "production")
  throw new Error("Set POSTS_TEST_DATABASE_URL to a migrated local test DB.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname))
  throw new Error("Posts integration requires a loopback DB.");
process.env.DATABASE_URL = databaseUrl;
globalThis.Temporal = Temporal;
const { PrismaService } = await import("../prisma/prisma.service.js");
const { UsersRepository } = await import("../users/users.repository.js");
const { UsersService } = await import("../users/users.service.js");
const { PostsRepository } = await import("./posts.repository.js");
const { PostsService } = await import("./posts.service.js");
const { executePurgeRetention } = await import("../scripts/purge-retention.js");
const prisma = new PrismaService();
await prisma.onModuleInit();
const users = new UsersRepository(prisma);
const repository = new PostsRepository(prisma);
const media = {
  verifyMediaItems() {
    return [];
  },
  async deleteFile() {
    throw new Error("Unexpected cloud call");
  },
} as unknown as MediaService;
const events = new EventEmitter2();
const service = new PostsService(repository, media, events, new UsersService(users, media, events));
const createdUsers: string[] = [];
async function account() {
  const name = `ret_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const user = await prisma.client.orm.public.User.create({
    username: name,
    email: `${name}@example.test`,
    displayName: name,
    passwordHash: "fixture",
    isEmailVerified: true,
  });
  createdUsers.push(user.id);
  return user;
}
const [rootAuthor, middleAuthor, leafAuthor, viewer] = await Promise.all(
  Array.from({ length: 4 }, account),
);
await users.createFollow(viewer.id, leafAuthor.id);
await users.createFollow(middleAuthor.id, rootAuthor.id);
await users.createFollow(leafAuthor.id, rootAuthor.id);
const row = (id: string) => prisma.client.orm.public.Post.where({ id }).first();
const post = (authorId: string, parentId?: string) =>
  service.createPost(authorId, {
    content: "retention fixture",
    ...(parentId ? { parentId } : { visibility: "FOLLOWERS" as const }),
  });
async function tree() {
  const root = await post(rootAuthor.id);
  const middle = await post(middleAuthor.id, root.id);
  const leaf = await post(leafAuthor.id, middle.id);
  return { root, middle, leaf };
}
async function assertProtected(rootId: string, leafId: string, parentId: string) {
  assert.ok(await row(rootId), "thread root must survive");
  const leaf = await row(leafId);
  assert.ok(leaf);
  assert.equal(leaf.rootId, rootId);
  assert.equal(leaf.parentId, parentId);
  await assert.rejects(service.getPostById(leafId, viewer.id), ForbiddenException);
  assert.equal((await service.getPostById(leafId, rootAuthor.id)).id, leafId);
}

after(async () => {
  for (const id of createdUsers) await users.deleteUserById(id);
  await prisma.onModuleDestroy();
});

test("delete middle → reconcile → delete root → purge preserves thread and root permissions", async () => {
  const { root, middle, leaf } = await tree();
  await service.deletePost(middle.id, middleAuthor.id);
  await service.reconcileCounters(root.id);
  await service.deletePost(root.id, rootAuthor.id);
  await executePurgeRetention(prisma);
  await assertProtected(root.id, leaf.id, middle.id);
  assert.equal((await row(root.id))?.replyCount, 1);
  assert.equal((await repository.countPostRelations(root.id)).replyCount, 1);
  assert.equal(
    (await repository.countPostRelationsForPosts([root.id])).get(root.id)?.replyCount,
    1,
  );
});

test("stale zero counters and sibling deletion cannot remove retained ancestors", async () => {
  const { root, middle, leaf } = await tree();
  const sibling = await post(middleAuthor.id, root.id);
  await service.deletePost(middle.id, middleAuthor.id);
  await service.deletePost(root.id, rootAuthor.id);
  await prisma.client.orm.public.Post.where({ id: root.id }).update({ replyCount: 0 });
  await service.deletePost(sibling.id, middleAuthor.id);
  await executePurgeRetention(prisma);
  await assertProtected(root.id, leaf.id, middle.id);
  await service.reconcileCounters(root.id);
  assert.equal((await row(root.id))?.replyCount, 1, "reconciliation includes retained tombstones");
});

test("deep tombstones survive until the final descendant is removed", async () => {
  const { root, middle, leaf } = await tree();
  const fourth = await post(leafAuthor.id, leaf.id);
  const fifth = await post(leafAuthor.id, fourth.id);
  for (const [id, author] of [
    [middle.id, middleAuthor.id],
    [leaf.id, leafAuthor.id],
    [fourth.id, leafAuthor.id],
    [root.id, rootAuthor.id],
  ])
    await service.deletePost(id, author);
  await executePurgeRetention(prisma);
  await assertProtected(root.id, fifth.id, fourth.id);
  await service.deletePost(fifth.id, leafAuthor.id);
  for (const id of [root.id, middle.id, leaf.id, fourth.id, fifth.id])
    assert.equal(await row(id), null);
});

test("root-only references protect legacy thread context despite a zero counter", async () => {
  const root = await post(rootAuthor.id);
  const child = await prisma.client.orm.public.Post.create({
    authorId: leafAuthor.id,
    rootId: root.id,
    parentId: null,
    visibility: "FOLLOWERS",
    content: "legacy descendant",
  });
  await service.deletePost(root.id, rootAuthor.id);
  await executePurgeRetention(prisma);
  assert.ok(await row(root.id));
  assert.equal((await row(child.id))?.rootId, root.id);
  await assert.rejects(service.getPostById(child.id, viewer.id), ForbiddenException);
});

test("a concurrent committed reply retains its parent and root instead of becoming orphaned", async () => {
  const root = await post(rootAuthor.id);
  let inserted!: () => void;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    inserted = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const insertion = prisma.client.transaction(async (tx) => {
    const child = await tx.orm.public.Post.create({
      authorId: leafAuthor.id,
      parentId: root.id,
      rootId: root.id,
      visibility: "FOLLOWERS",
      content: "concurrent child",
    });
    inserted();
    await gate;
    return child;
  });
  await ready;
  const deletion = service.deletePost(root.id, rootAuthor.id);
  await delay(40);
  release();
  const [child] = await Promise.all([insertion, deletion]);
  await executePurgeRetention(prisma);
  await assertProtected(root.id, child.id, root.id);
});

test("purge does not delete a new tombstone outside its locked candidate set", async () => {
  const root = await post(rootAuthor.id);
  let resumePurge!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => {
    resumePurge = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const wrapped = {
    client: {
      raw: prisma.client.raw,
      transaction: (callback: Parameters<typeof prisma.client.transaction>[0]) =>
        prisma.client.transaction(async (tx) => {
          const proxy = new Proxy(tx, {
            get(target, property) {
              if (property !== "query") return Reflect.get(target, property);
              return async (...args: Parameters<typeof tx.query>) => {
                const result = await tx.query(...args);
                locked();
                await gate;
                return result;
              };
            },
          });
          return callback(proxy);
        }),
    },
  } as unknown as InstanceType<typeof PrismaService>;
  const purge = executePurgeRetention(wrapped);
  await ready;
  await prisma.client.orm.public.Post.where({ id: root.id }).update({
    isDeleted: true,
    content: null,
  });
  let childReady!: () => void;
  let releaseChild!: () => void;
  const inserted = new Promise<void>((resolve) => {
    childReady = resolve;
  });
  const childGate = new Promise<void>((resolve) => {
    releaseChild = resolve;
  });
  const insertion = prisma.client.transaction(async (tx) => {
    const child = await tx.orm.public.Post.create({
      authorId: leafAuthor.id,
      parentId: root.id,
      rootId: root.id,
      visibility: "FOLLOWERS",
      content: "concurrent purge child",
    });
    childReady();
    await childGate;
    return child;
  });
  await inserted;
  resumePurge();
  await delay(40);
  releaseChild();
  const [child] = await Promise.all([insertion, purge]);
  await assertProtected(root.id, child.id, root.id);
});

test("purge removes actual orphan tombstones even with a stale positive counter", async () => {
  const root = await post(rootAuthor.id);
  await prisma.client.orm.public.Post.where({ id: root.id }).update({
    isDeleted: true,
    content: null,
    replyCount: 99,
  });
  await executePurgeRetention(prisma);
  assert.equal(await row(root.id), null);
});
