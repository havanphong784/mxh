import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsListener } from "./notifications.listener.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { NotificationResponseMapper } from "./dto/notification-response.dto.js";
import { PostsService } from "../posts/posts.service.js";
import type { PostsRepository } from "../posts/posts.repository.js";
import type { UsersService } from "../users/users.service.js";
import type { EventsGateway } from "../gateway/events.gateway.js";
import type { MediaService } from "../media/media.service.js";
import type { EventEmitter2 } from "@nestjs/event-emitter";

const author = {
  id: "author",
  username: "author",
  displayName: "Author",
  isActive: true,
  isEmailVerified: true,
};
const post = {
  id: "quote",
  content: "PRIVATE_QUOTE_CONTENT",
  authorId: "author",
  author,
  visibility: "PUBLIC",
  isDeleted: false,
  rootId: null as string | null,
};

for (const transport of ["REST", "realtime"] as const) {
  for (const scenario of [
    { name: "private quote", post: { ...post, visibility: "PRIVATE" }, visible: false },
    {
      name: "private quote owned by the recipient",
      post: { ...post, authorId: "recipient", visibility: "PRIVATE" },
      visible: true,
    },
    { name: "public quote", post: { ...post }, visible: true },
    {
      name: "followers-only quote without a follow",
      post: { ...post, visibility: "FOLLOWERS" },
      visible: false,
    },
    {
      name: "followers-only quote with a follow",
      post: { ...post, visibility: "FOLLOWERS" },
      follows: ["author"],
      visible: true,
    },
    { name: "deleted quote", post: { ...post, isDeleted: true }, visible: false },
    {
      name: "inactive quote author",
      post: { ...post, author: { ...author, isActive: false } },
      visible: false,
    },
    {
      name: "public reply in a private thread",
      post: { ...post, rootId: "private-root" },
      visible: false,
    },
  ]) {
    test(`${transport} notification respects current access to a ${scenario.name}`, async () => {
      const roots = [{ ...post, id: "private-root", visibility: "PRIVATE" }];
      const posts = new PostsService(
        { findManyWithAuthors: async () => roots } as unknown as PostsRepository,
        {} as MediaService,
        {} as EventEmitter2,
        { getFollowedIds: async () => scenario.follows ?? [] } as unknown as UsersService,
      );
      const notification = {
        id: "notice",
        type: "QUOTE",
        actor: author,
        recipientId: "recipient",
        isRead: false,
        createdAt: "2026-11-25T00:00:00Z",
        post: scenario.post,
      };
      const repository = {
        findManyWithCursor: async () => [notification],
        createNotification: async () => ({ id: "notice" }),
        findByIdWithDetails: async () => notification,
        countUnread: async () => 1,
      } as unknown as NotificationsRepository;
      const sent: { event: string; data: unknown }[] = [];
      const gateway = {
        pushToUser: (_userId: string, event: string, data: unknown) => sent.push({ event, data }),
      } as unknown as EventsGateway;
      let dto;
      if (transport === "REST") {
        dto = (
          await new NotificationsService(repository, gateway, posts).getNotifications("recipient", {
            limit: 20,
          })
        ).data[0];
      } else {
        const listener = new NotificationsListener(repository, gateway, {} as UsersService, posts);
        await listener.handlePostQuoted({
          actorId: "author",
          postId: "quote",
          quotedPostId: "original",
          quotedPostAuthorId: "recipient",
        });
        dto = sent.find((item) => item.event === "notification:new")?.data as ReturnType<
          typeof NotificationResponseMapper.toItemDto
        >;
        assert.ok(dto);
      }
      assert.equal(dto.post?.content ?? null, scenario.visible ? post.content : null);
      if (!scenario.visible) assert.ok(!JSON.stringify(dto).includes(post.content));
    });
  }

  test(`${transport} redacts an existing notification after the quote becomes private`, async () => {
    const currentPost = { ...post };
    const posts = new PostsService(
      { findManyWithAuthors: async () => [] } as unknown as PostsRepository,
      {} as MediaService,
      {} as EventEmitter2,
      {} as UsersService,
    );
    const notification = { id: "notice", type: "QUOTE", actor: author, post: currentPost };
    const repository = {
      findManyWithCursor: async () => [notification],
      findByIdWithDetails: async () => notification,
      createNotification: async () => ({ id: "notice" }),
      countUnread: async () => 1,
    } as unknown as NotificationsRepository;
    const sent: unknown[] = [];
    const gateway = {
      pushToUser: (_id: string, event: string, data: unknown) => {
        if (event === "notification:new") sent.push(data);
      },
    } as unknown as EventsGateway;
    const service = new NotificationsService(repository, gateway, posts);
    const listener = new NotificationsListener(repository, gateway, {} as UsersService, posts);
    const read = async () => {
      if (transport === "REST")
        return (await service.getNotifications("recipient", { limit: 20 })).data[0];
      await listener.handlePostQuoted({
        actorId: "author",
        postId: "quote",
        quotedPostId: "original",
        quotedPostAuthorId: "recipient",
      });
      return sent.at(-1) as ReturnType<typeof NotificationResponseMapper.toItemDto>;
    };
    assert.equal((await read()).post?.content, post.content);
    currentPost.visibility = "PRIVATE";
    assert.equal((await read()).post, null);
  });
}

test("notification mapping hides post previews unless access is explicitly granted", () => {
  assert.equal(NotificationResponseMapper.toItemDto({ post }).post, null);
});
