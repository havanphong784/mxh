import type { Temporal } from "@js-temporal/polyfill";
import { Injectable } from "@nestjs/common";
import { toContainsPattern } from "../common/search.js";
import type { VerifiedMediaItem } from "../media/media.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get post() {
    return this.prisma.client.orm.public.Post;
  }

  get like() {
    return this.prisma.client.orm.public.PostLike;
  }

  get bookmark() {
    return this.prisma.client.orm.public.PostBookmark;
  }

  async findById(postId: string) {
    return this.post.where({ id: postId }).first();
  }

  async findByIdWithMedia(postId: string) {
    return this.post.where({ id: postId }).include("media").first();
  }

  async findByIdWithAuthor(postId: string) {
    return this.post.where({ id: postId }).include("author").first();
  }

  async findManyWithAuthors(postIds: string[]) {
    if (postIds.length === 0) return [];
    return this.post
      .where((post) => post.id.in(postIds))
      .include("author")
      .all();
  }

  async findByIdWithAuthorAndMedia(postId: string) {
    return this.post.where({ id: postId }).include("author").include("media").first();
  }

  async findRootsWithAuthors(rootIds: string[]) {
    if (rootIds.length === 0) return [];

    return this.post
      .where((post) => post.id.in(rootIds))
      .include("author")
      .all();
  }

  async findByIdForResponse(postId: string) {
    return this.post
      .where({ id: postId })
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .first();
  }

  async updatePostAndReplies(
    postId: string,
    payload: Record<string, any>,
    visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE",
  ) {
    await this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.Post.where({ id: postId }).update(payload);
      if (visibility !== undefined) {
        await tx.orm.public.Post.where((post) => post.rootId.eq(postId)).updateAndCount({
          visibility,
        });
      }
    });
  }

  async findViewerMarks(viewerId: string, postIds: string[]) {
    const [likes, reposts, bookmarks] = await Promise.all([
      this.like
        .where((like) => like.userId.eq(viewerId))
        .where((like) => like.postId.in(postIds))
        .all(),
      this.post
        .where((post) => post.authorId.eq(viewerId))
        .where((post) => post.repostOfId.in(postIds))
        .where((post) => post.isDeleted.eq(false))
        .all(),
      this.bookmark
        .where((bookmark) => bookmark.userId.eq(viewerId))
        .where((bookmark) => bookmark.postId.in(postIds))
        .all(),
    ]);
    return { likes, reposts, bookmarks };
  }

  async listReplies(
    postId: string,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string } | null,
  ) {
    let query = this.post
      .where((post) => post.parentId.eq(postId))
      .orderBy([(post) => post.createdAt.asc(), (post) => post.id.asc()]);
    if (cursor) query = query.cursor(cursor);
    return query
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .all();
  }

  async createRepostAndIncrement(postId: string, userId: string) {
    await this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.Post.create({
        authorId: userId,
        repostOfId: postId,
        visibility: "PUBLIC",
      });
      const plan = this.prisma.client.raw.sql`
        UPDATE "post" SET "repostCount" = "repostCount" + 1 WHERE id = ${postId}
      `
        .affectedCount()
        .build();
      await tx.execute(plan);
    });
  }

  async removeRepostAndDecrement(postId: string, userId: string) {
    return this.prisma.client.transaction(async (tx) => {
      const deletePlan = this.prisma.client.raw.sql`
        DELETE FROM "post" WHERE "authorId" = ${userId} AND "repostOfId" = ${postId}
      `
        .affectedCount()
        .build();
      const { affectedRows: deletedCount } = await tx.execute(deletePlan);
      if (deletedCount === 1) {
        const decrementPlan = this.prisma.client.raw.sql`
          UPDATE "post" SET "repostCount" = GREATEST(0, "repostCount" - 1) WHERE id = ${postId}
        `
          .affectedCount()
          .build();
        await tx.execute(decrementPlan);
      }
      const latestPost = await tx.orm.public.Post.where({ id: postId }).first();
      return { deletedCount, repostCount: latestPost?.repostCount };
    });
  }

  async createLikeAndIncrement(postId: string, userId: string) {
    await this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.PostLike.create({ userId, postId });
      const plan = this.prisma.client.raw.sql`
        UPDATE "post" SET "likeCount" = "likeCount" + 1 WHERE id = ${postId}
      `
        .affectedCount()
        .build();
      await tx.execute(plan);
    });
  }

  async removeLikeAndDecrement(postId: string, userId: string) {
    return this.prisma.client.transaction(async (tx) => {
      const deletePlan = this.prisma.client.raw.sql`
        DELETE FROM "postLike" WHERE "userId" = ${userId} AND "postId" = ${postId}
      `
        .affectedCount()
        .build();
      const { affectedRows: deletedCount } = await tx.execute(deletePlan);
      if (deletedCount === 1) {
        const decrementPlan = this.prisma.client.raw.sql`
          UPDATE "post" SET "likeCount" = GREATEST(0, "likeCount" - 1) WHERE id = ${postId}
        `
          .affectedCount()
          .build();
        await tx.execute(decrementPlan);
      }
      const latestPost = await tx.orm.public.Post.where({ id: postId }).first();
      return { deletedCount, likeCount: latestPost?.likeCount };
    });
  }

  async createBookmarkAndIncrement(postId: string, userId: string) {
    await this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.PostBookmark.create({ userId, postId });
      const plan = this.prisma.client.raw.sql`
        UPDATE "post" SET "bookmarkCount" = "bookmarkCount" + 1 WHERE id = ${postId}
      `
        .affectedCount()
        .build();
      await tx.execute(plan);
    });
  }

  async removeBookmarkAndDecrement(postId: string, userId: string) {
    await this.prisma.client.transaction(async (tx) => {
      const deletePlan = this.prisma.client.raw.sql`
        DELETE FROM "postBookmark" WHERE "userId" = ${userId} AND "postId" = ${postId}
      `
        .affectedCount()
        .build();
      const { affectedRows: deletedCount } = await tx.execute(deletePlan);
      if (deletedCount === 1) {
        const decrementPlan = this.prisma.client.raw.sql`
          UPDATE "post" SET "bookmarkCount" = GREATEST(0, "bookmarkCount" - 1) WHERE id = ${postId}
        `
          .affectedCount()
          .build();
        await tx.execute(decrementPlan);
      }
    });
  }

  async listPostLikes(
    postId: string,
    options: {
      limit: number;
      offset?: number;
      cursor?: { createdAt: Temporal.Instant; userId: string };
    },
  ) {
    let query = this.like
      .where((like) => like.postId.eq(postId))
      .orderBy([(like) => like.createdAt.desc(), (like) => like.userId.desc()])
      .limit(options.limit)
      .include("user");
    if (options.offset !== undefined) query = query.offset(options.offset);
    if (options.cursor) query = query.cursor(options.cursor);
    return query.all();
  }

  async countPostLikes(postId: string): Promise<number> {
    const aggregate = await this.like
      .where((like) => like.postId.eq(postId))
      .aggregate((item) => ({ total: item.count() }));
    return Number(aggregate.total) || 0;
  }

  async listMarkedPostReferences(
    kind: "bookmark" | "like",
    userId: string,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; postId: string } | null,
  ) {
    const table: any = kind === "bookmark" ? this.bookmark : this.like;
    let query = table
      .where((mark: any) => mark.userId.eq(userId))
      .orderBy([(mark: any) => mark.createdAt.desc(), (mark: any) => mark.postId.desc()]);
    if (cursor) query = query.cursor(cursor);
    return query.limit(limit).all();
  }

  async findPostsByIdsForResponse(postIds: string[]) {
    if (postIds.length === 0) return [];
    return this.post
      .where((post) => post.id.in(postIds))
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .all();
  }

  async findAncestorsForResponse(postId: string, maxDepth = 20) {
    const plan = this.prisma.client.raw.sql`
      WITH RECURSIVE ancestors AS (
        SELECT parent.id, parent."parentId", 1 AS depth
        FROM "post" child
        JOIN "post" parent ON parent.id = child."parentId"
        WHERE child.id = ${postId}

        UNION ALL

        SELECT parent.id, parent."parentId", ancestors.depth + 1
        FROM ancestors
        JOIN "post" parent ON parent.id = ancestors."parentId"
        WHERE ancestors.depth < ${maxDepth}
      )
      SELECT id FROM ancestors ORDER BY depth DESC
    `
      .returnsRow({ id: "pg/text@1" })
      .build();
    const ancestors = await this.prisma.client.runtime().query(plan);
    const ids = ancestors.map((ancestor: { id: string }) => ancestor.id);
    if (ids.length === 0) return [];

    const posts = await this.findPostsByIdsForResponse(ids);
    const postsById = new Map(posts.map((post: any) => [post.id, post]));
    return ids.map((id: string) => postsById.get(id)).filter(Boolean);
  }

  async findSecondaryMarks(kind: "bookmark" | "like", userId: string, postIds: string[]) {
    const [likes, bookmarks, reposts] = await Promise.all([
      kind === "like"
        ? []
        : this.like
            .where((like) => like.userId.eq(userId))
            .where((like) => like.postId.in(postIds))
            .all(),
      kind === "bookmark"
        ? []
        : this.bookmark
            .where((bookmark) => bookmark.userId.eq(userId))
            .where((bookmark) => bookmark.postId.in(postIds))
            .all(),
      this.post
        .where((post) => post.authorId.eq(userId))
        .where((post) => post.repostOfId.in(postIds))
        .where((post) => post.isDeleted.eq(false))
        .all(),
    ]);
    return { likes, bookmarks, reposts };
  }

  async listFeedPosts(
    authorIds: string[],
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string } | null,
  ) {
    let query = this.post
      .where((post) => post.authorId.in(authorIds))
      .where((post) => post.isDeleted.eq(false))
      .where((post) => post.author.some((user) => user.isActive.eq(true)))
      .where((post) => post.author.some((user) => user.isEmailVerified.eq(true)))
      .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()]);
    if (cursor) query = query.cursor(cursor);
    return query
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .all();
  }

  async listExplorePosts(
    limit: number,
    cursor: { createdAt: Temporal.Instant; id: string } | null,
    searchTerm?: string,
    mediaOnly = false,
  ) {
    let query = this.post
      .where((post) => post.visibility.eq("PUBLIC"))
      .where((post) => post.parentId.isNull())
      .where((post) => post.isDeleted.eq(false))
      .where((post) => post.author.some((user) => user.isActive.eq(true)))
      .where((post) => post.author.some((user) => user.isEmailVerified.eq(true)))
      .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()]);
    if (searchTerm)
      query = query.where((post) => post.content.ilike(toContainsPattern(searchTerm)));
    if (mediaOnly)
      query = query.where((post) => post.media.some((media) => media.type.in(["IMAGE", "VIDEO"])));
    if (cursor) query = query.cursor(cursor);
    return query
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .all();
  }

  async listUserPosts(
    authorId: string,
    visibilities: Array<"PUBLIC" | "FOLLOWERS" | "PRIVATE">,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string } | null,
  ) {
    let query = this.post
      .where((post) => post.authorId.eq(authorId))
      .where((post) => post.parentId.isNull())
      .where((post) => post.isDeleted.eq(false))
      .where((post) => post.visibility.in(visibilities))
      .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()]);
    if (cursor) query = query.cursor(cursor);
    return query
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .all();
  }

  async listUserReplies(
    authorId: string,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string } | null,
  ) {
    let query = this.post
      .where((post) => post.authorId.eq(authorId))
      .where((post) => post.parentId.isNotNull())
      .where((post) => post.isDeleted.eq(false))
      .orderBy([(post) => post.createdAt.desc(), (post) => post.id.desc()]);
    if (cursor) query = query.cursor(cursor);
    return query
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost", (quote) =>
        quote
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author")),
      )
      .include("repostOf", (repost) =>
        repost
          .include("author")
          .include("media")
          .include("root", (root) => root.include("author"))
          .include("quotedPost", (quote) =>
            quote
              .include("author")
              .include("media")
              .include("root", (root) => root.include("author")),
          ),
      )
      .include("parent")
      .all();
  }

  async listActivePosts(targetPostId?: string) {
    let query = this.post.where((post) => post.isDeleted.eq(false));
    if (targetPostId) query = query.where((post) => post.id.eq(targetPostId));
    return query.all();
  }

  async countPostRelations(postId: string) {
    const [likes, bookmarks, reposts, quotes, replies] = await Promise.all([
      this.like
        .where((like) => like.postId.eq(postId))
        .aggregate((item) => ({ total: item.count() })),
      this.bookmark
        .where((bookmark) => bookmark.postId.eq(postId))
        .aggregate((item) => ({ total: item.count() })),
      this.post
        .where((post) => post.repostOfId.eq(postId))
        .where((post) => post.isDeleted.eq(false))
        .aggregate((item) => ({ total: item.count() })),
      this.post
        .where((post) => post.quotedPostId.eq(postId))
        .where((post) => post.isDeleted.eq(false))
        .aggregate((item) => ({ total: item.count() })),
      this.post
        .where((post) => post.parentId.eq(postId))
        .where((post) => post.isDeleted.eq(false))
        .aggregate((item) => ({ total: item.count() })),
    ]);
    return {
      likeCount: Number(likes.total),
      bookmarkCount: Number(bookmarks.total),
      repostCount: Number(reposts.total),
      quoteCount: Number(quotes.total),
      replyCount: Number(replies.total),
    };
  }

  async countPostRelationsForPosts(postIds: string[]) {
    type Counts = {
      likeCount: number;
      bookmarkCount: number;
      repostCount: number;
      quoteCount: number;
      replyCount: number;
    };
    const result = new Map<string, Counts>();
    if (postIds.length === 0) return result;

    const [likes, bookmarks, reposts, quotes, replies] = await Promise.all([
      this.like
        .where((item) => item.postId.in(postIds))
        .groupBy("postId")
        .aggregate((aggregate) => ({ count: aggregate.count() })),
      this.bookmark
        .where((item) => item.postId.in(postIds))
        .groupBy("postId")
        .aggregate((aggregate) => ({ count: aggregate.count() })),
      this.post
        .where((item) => item.repostOfId.in(postIds))
        .where((item) => item.isDeleted.eq(false))
        .groupBy("repostOfId")
        .aggregate((aggregate) => ({ count: aggregate.count() })),
      this.post
        .where((item) => item.quotedPostId.in(postIds))
        .where((item) => item.isDeleted.eq(false))
        .groupBy("quotedPostId")
        .aggregate((aggregate) => ({ count: aggregate.count() })),
      this.post
        .where((item) => item.parentId.in(postIds))
        .where((item) => item.isDeleted.eq(false))
        .groupBy("parentId")
        .aggregate((aggregate) => ({ count: aggregate.count() })),
    ]);

    for (const id of postIds) {
      result.set(id, {
        likeCount: 0,
        bookmarkCount: 0,
        repostCount: 0,
        quoteCount: 0,
        replyCount: 0,
      });
    }
    for (const row of likes) result.get(row.postId)!.likeCount = Number(row.count);
    for (const row of bookmarks) result.get(row.postId)!.bookmarkCount = Number(row.count);
    for (const row of reposts)
      if (row.repostOfId) result.get(row.repostOfId)!.repostCount = Number(row.count);
    for (const row of quotes)
      if (row.quotedPostId) result.get(row.quotedPostId)!.quoteCount = Number(row.count);
    for (const row of replies)
      if (row.parentId) result.get(row.parentId)!.replyCount = Number(row.count);
    return result;
  }

  async updatePostCountersForPosts(
    updates: Array<{
      postId: string;
      likeCount: number;
      bookmarkCount: number;
      repostCount: number;
      quoteCount: number;
      replyCount: number;
    }>,
  ) {
    if (updates.length === 0) return;
    const plan = this.prisma.client.raw.sql`
      UPDATE "post" AS post
      SET "likeCount" = counts."likeCount",
          "bookmarkCount" = counts."bookmarkCount",
          "repostCount" = counts."repostCount",
          "quoteCount" = counts."quoteCount",
          "replyCount" = counts."replyCount",
          "updatedAt" = CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS counts(
        "postId" text, "likeCount" int, "bookmarkCount" int,
        "repostCount" int, "quoteCount" int, "replyCount" int
      )
      WHERE post.id = counts."postId"
    `
      .affectedCount()
      .build();
    await this.prisma.client.transaction((tx) => tx.execute(plan));
  }

  async deletePostRecord(
    postId: string,
    post: {
      quotedPostId: string | null;
      repostOfId: string | null;
      parentId: string | null;
    },
  ) {
    await this.prisma.client.transaction(async (tx) => {
      const repliesCount = await tx.orm.public.Post.where((reply) =>
        reply.parentId.eq(postId),
      ).aggregate((aggregate) => ({ total: aggregate.count() }));
      const hasReplies = Number(repliesCount.total) > 0;

      if (hasReplies) {
        await tx.orm.public.Post.where({ id: postId }).update({
          isDeleted: true,
          content: null,
        });
        await tx.orm.public.PostMedia.where((media) => media.postId.eq(postId)).deleteAndCount();
        await tx.orm.public.PostLike.where((like) => like.postId.eq(postId)).deleteAndCount();
        await tx.orm.public.PostBookmark.where((bookmark) =>
          bookmark.postId.eq(postId),
        ).deleteAndCount();
        await tx.orm.public.Post.where((repost) => repost.repostOfId.eq(postId)).deleteAndCount();
      } else {
        await tx.orm.public.Post.where({ id: postId }).delete();
      }

      if (post.quotedPostId) {
        const plan = this.prisma.client.raw.sql`
          UPDATE "post" SET "quoteCount" = GREATEST(0, "quoteCount" - 1)
          WHERE id = ${post.quotedPostId}
        `
          .affectedCount()
          .build();
        await tx.execute(plan);
      }
      if (post.repostOfId) {
        const plan = this.prisma.client.raw.sql`
          UPDATE "post" SET "repostCount" = GREATEST(0, "repostCount" - 1)
          WHERE id = ${post.repostOfId}
        `
          .affectedCount()
          .build();
        await tx.execute(plan);
      }
      if (!hasReplies && post.parentId) {
        await this.cleanupParentTombstone(tx, post.parentId);
      }
    });
  }

  async findLike(userId: string, postId: string) {
    return this.like
      .where((l) => l.userId.eq(userId))
      .where((l) => l.postId.eq(postId))
      .first();
  }

  async findBookmark(userId: string, postId: string) {
    return this.bookmark
      .where((b) => b.userId.eq(userId))
      .where((b) => b.postId.eq(postId))
      .first();
  }

  async findRepost(authorId: string, repostOfId: string) {
    return this.post.where({ authorId, repostOfId }).first();
  }

  async createPostWithMedia(data: {
    authorId: string;
    content: string | null;
    visibility: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
    parentId: string | null;
    rootId: string | null;
    quotedPostId: string | null;
    media: VerifiedMediaItem[];
  }) {
    return this.prisma.client.transaction(async (tx) => {
      const post = await tx.orm.public.Post.create({
        authorId: data.authorId,
        content: data.content,
        visibility: data.visibility,
        parentId: data.parentId,
        rootId: data.rootId,
        quotedPostId: data.quotedPostId,
      });

      if (data.parentId) {
        const plan = this.prisma.client.raw.sql`
          UPDATE "post" SET "replyCount" = "replyCount" + 1
          WHERE id = ${data.parentId}
        `
          .affectedCount()
          .build();
        await tx.execute(plan);
      }

      if (data.quotedPostId) {
        const plan = this.prisma.client.raw.sql`
          UPDATE "post" SET "quoteCount" = "quoteCount" + 1
          WHERE id = ${data.quotedPostId}
        `
          .affectedCount()
          .build();
        await tx.execute(plan);
      }

      if (data.media.length > 0) {
        await tx.orm.public.PostMedia.createAndCount(
          data.media.map((media) => ({
            postId: post.id,
            publicId: media.publicId,
            url: media.url,
            type: media.type,
            width: media.width,
            height: media.height,
            duration: media.duration,
            order: media.order,
          })),
        );
      }

      return tx.orm.public.Post.where({ id: post.id })
        .include("author")
        .include("media")
        .include("quotedPost", (quote) =>
          quote
            .include("author")
            .include("media")
            .include("root", (root) => root.include("author")),
        )
        .include("repostOf", (repost) =>
          repost
            .include("author")
            .include("media")
            .include("root", (root) => root.include("author"))
            .include("quotedPost", (quote) =>
              quote
                .include("author")
                .include("media")
                .include("root", (root) => root.include("author")),
            ),
        )
        .first();
    });
  }

  private async cleanupParentTombstone(tx: any, parentId: string) {
    let currentId: string | null = parentId;
    while (currentId) {
      const plan = this.prisma.client.raw.sql`
        UPDATE "post" SET "replyCount" = GREATEST(0, "replyCount" - 1)
        WHERE id = ${currentId}
      `
        .affectedCount()
        .build();
      await tx.execute(plan);
      const parent: any = await tx.orm.public.Post.where({
        id: currentId,
      }).first();
      if (parent && parent.isDeleted && parent.replyCount === 0) {
        await tx.orm.public.Post.where({ id: currentId }).delete();
        currentId = parent.parentId;
      } else {
        break;
      }
    }
  }
}
