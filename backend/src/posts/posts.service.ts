import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { CreatePostDto, PostMediaItemDto } from "./dto/create-post.dto.js";
import * as crypto from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { UpdatePostDto } from "./dto/update-post.dto.js";
import { MediaService } from "../media/media.service.js";
import { UsersService } from "../users/users.service.js";
import { CursorPaginationDto } from "./dto/cursor-pagination.dto.js";
import { OffsetPaginationDto } from "./dto/offset-pagination.dto.js";
import { POST_EVENTS } from "../events/event-types.js";
import type {
  PostCreatedEvent,
  PostLikedEvent,
  PostQuotedEvent,
  PostRepliedEvent,
  PostRepostedEvent,
} from "../events/event-types.js";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Temporal } from "@js-temporal/polyfill";
import { toContainsPattern } from "../common/search.js";
import { ExploreQueryDto } from "./dto/explore-query.dto.js";
import {
  PostLikesResponseDto,
  PostResponseDto,
  PostResponseMapper,
} from "./dto/post-response.dto.js";
import type { CursorPage, OffsetPage } from "../common/dto/cursor-page.dto.js";
import { PostsRepository } from "./posts.repository.js";
import {
  DomainException,
  ERROR_CODES,
} from "../common/exceptions/domain.exception.js";

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);
  private readonly postRepository: PostsRepository;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => UsersService))
    @Optional()
    private readonly usersService?: UsersService,
    @Optional()
    postsRepository?: PostsRepository,
  ) {
    this.postRepository =
      postsRepository ?? new PostsRepository(this.prismaService);
  }

  async createPost(userId: string, dto: CreatePostDto) {
    await this.ensureActiveUser(userId);

    const content = dto.content?.trim();
    const hasMedia = dto.media && dto.media.length > 0;
    if (!content && !hasMedia) {
      throw new BadRequestException(
        "Bài viết phải có nội dung hoặc ít nhất một media item",
      );
    }

    let parentPost: any = null;
    let rootPost: any = null;
    let rootId: string | null = null;
    let quotedPost: any = null;
    let visibility = dto.visibility ?? "PUBLIC";

    if (dto.parentId) {
      parentPost = await this.prismaService.client.orm.public.Post.where({
        id: dto.parentId,
      })
        .include("author")
        .first();

      if (!parentPost) {
        throw new NotFoundException("Bài viết cha không tồn tại");
      }

      if (parentPost.isDeleted) {
        throw new BadRequestException("Không thể trả lời bài viết đã bị xóa");
      }

      rootId = parentPost.rootId ? parentPost.rootId : parentPost.id;

      rootPost = parentPost.rootId
        ? await this.prismaService.client.orm.public.Post.where({ id: rootId })
            .include("author")
            .first()
        : parentPost;

      if (!rootPost) {
        throw new NotFoundException(
          "Không tìm thấy bài viết gốc của cuộc thảo luận",
        );
      }

      const canViewRoot = await this.canView(rootPost, userId);
      if (!canViewRoot) {
        throw new ForbiddenException(
          "Bạn không có quyền tham gia cuộc thảo luận này",
        );
      }

      visibility = rootPost.visibility;
    }

    if (dto.quotedPostId) {
      quotedPost = await this.prismaService.client.orm.public.Post.where({
        id: dto.quotedPostId,
      }).first();

      if (!quotedPost || quotedPost.isDeleted) {
        throw new BadRequestException(
          "Không thể trích dẫn bài viết không tồn tại hoặc đã bị xóa",
        );
      }

      if (quotedPost.visibility !== "PUBLIC") {
        throw new ForbiddenException("Chỉ có thể trích dẫn bài viết công khai");
      }
    }

    const verifiedMedia = hasMedia
      ? (this.mediaService?.verifyMediaItems
          ? this.mediaService.verifyMediaItems(userId, dto.media!)
          : this.verifyMediaItems(userId, dto.media!))
      : [];

    let result: any;
    try {
      result = await this.prismaService.client.transaction(async (tx) => {
        const post = await tx.orm.public.Post.create({
          authorId: userId,
          content: content || null,
          visibility,
          parentId: dto.parentId || null,
          rootId: rootId || null,
          quotedPostId: dto.quotedPostId || null,
        });

        if (dto.parentId) {
          const rawPlan = this.prismaService.client.raw.sql`
                        UPDATE "post"
                        SET "replyCount" = "replyCount" + 1
                        WHERE id = ${dto.parentId}
                    `
            .affectedCount()
            .build();
          await tx.execute(rawPlan);
        }

        if (dto.quotedPostId) {
          const rawPlan = this.prismaService.client.raw.sql`
                        UPDATE "post"
                        SET "quoteCount" = "quoteCount" + 1
                        WHERE id = ${dto.quotedPostId}
                    `
            .affectedCount()
            .build();
          await tx.execute(rawPlan);
        }

        for (const media of verifiedMedia) {
          await tx.orm.public.PostMedia.create({
            postId: post.id,
            publicId: media.publicId,
            url: media.url,
            type: media.type,
            width: media.width,
            height: media.height,
            duration: media.duration,
            order: media.order,
          });
        }

        const fullPost = await tx.orm.public.Post.where({ id: post.id })
          .include("author")
          .include("media")
          .include("quotedPost")
          .include("repostOf", (repost) =>
            repost.include("author").include("media").include("quotedPost"),
          )
          .first();

        return this.toPostResponse(fullPost);
      });
    } catch (error) {
      if (verifiedMedia.length > 0 && this.isUniqueConstraintError(error)) {
        throw new BadRequestException(
          "Media đã được sử dụng cho một bài viết khác",
        );
      }
      throw error;
    }

    if (dto.parentId && parentPost && parentPost.authorId !== userId) {
      this.eventEmitter.emit(POST_EVENTS.REPLIED, {
        actorId: userId,
        postId: result.id,
        parentId: dto.parentId,
        parentAuthorId: parentPost.authorId,
      } satisfies PostRepliedEvent);
    }

    if (dto.quotedPostId && quotedPost && quotedPost.authorId !== userId) {
      this.eventEmitter.emit(POST_EVENTS.QUOTED, {
        actorId: userId,
        postId: result.id,
        quotedPostId: dto.quotedPostId,
        quotedPostAuthorId: quotedPost.authorId,
      } satisfies PostQuotedEvent);
    }

    if (!dto.parentId && visibility !== "PRIVATE") {
      this.eventEmitter.emit(POST_EVENTS.CREATED, {
        authorId: userId,
        postId: result.id,
        isRootPost: true,
      } satisfies PostCreatedEvent);
    }

    return result;
  }

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    await this.ensureActiveUser(userId);

    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    })
      .include("author")
      .include("media")
      .first();

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException("Bạn không có quyền chỉnh sửa bài viết này");
    }

    const updatePayload: Record<string, any> = {
      editedAt: Temporal.Now.instant(),
    };

    if (dto.content !== undefined) {
      const trimmed = dto.content.trim();
      if (
        !trimmed &&
        (!post.media || post.media.length === 0) &&
        !post.repostOfId
      ) {
        throw new BadRequestException(
          "Bài viết phải có nội dung hoặc ít nhất một media item",
        );
      }
      updatePayload.content = trimmed || null;
    }

    if (dto.visibility !== undefined) {
      if (post.parentId) {
        throw new BadRequestException(
          "Không thể thay đổi visibility của câu trả lời; câu trả lời kế thừa visibility từ bài viết gốc",
        );
      }
      updatePayload.visibility = dto.visibility;
    }

    await this.prismaService.client.transaction(async (tx) => {
      await tx.orm.public.Post.where({ id: postId }).update(updatePayload);

      if (dto.visibility !== undefined) {
        await tx.orm.public.Post.where((p) => p.rootId.eq(postId)).update({
          visibility: dto.visibility,
        });
      }
    });

    const updated = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    })
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .first();

    return this.toPostResponse(updated);
  }

  async deletePost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    })
      .include("media")
      .first();

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException("Bạn không có quyền xóa bài viết này");
    }

    const mediaToDelete: Array<{
      publicId: string;
      type: "IMAGE" | "VIDEO" | "AUDIO";
    }> = (post.media || []).map((media: any) => ({
      publicId: media.publicId,
      type: media.type,
    }));

    await this.prismaService.client.transaction(async (tx) => {
      const repliesCountAgg = await tx.orm.public.Post.where((p) =>
        p.parentId.eq(postId),
      ).aggregate((agg) => ({ total: agg.count() }));
      const hasReplies = Number(repliesCountAgg.total) > 0;

      if (hasReplies) {
        await tx.orm.public.Post.where({ id: postId }).update({
          isDeleted: true,
          content: null,
        });

        await tx.orm.public.PostMedia.where((m) =>
          m.postId.eq(postId),
        ).delete();

        await tx.orm.public.PostLike.where((l) => l.postId.eq(postId)).delete();
        await tx.orm.public.PostBookmark.where((b) =>
          b.postId.eq(postId),
        ).delete();

        await tx.orm.public.Post.where((p) => p.repostOfId.eq(postId)).delete();

        if (post.quotedPostId) {
          const rawPlan = this.prismaService.client.raw.sql`
            UPDATE "post"
            SET "quoteCount" = GREATEST(0, "quoteCount" - 1)
            WHERE id = ${post.quotedPostId}
          `
            .affectedCount()
            .build();
          await tx.execute(rawPlan);
        }

        if (post.repostOfId) {
          const rawPlan = this.prismaService.client.raw.sql`
            UPDATE "post"
            SET "repostCount" = GREATEST(0, "repostCount" - 1)
            WHERE id = ${post.repostOfId}
          `
            .affectedCount()
            .build();
          await tx.execute(rawPlan);
        }
      } else {
        await tx.orm.public.Post.where({ id: postId }).delete();

        if (post.quotedPostId) {
          const rawPlan = this.prismaService.client.raw.sql`
            UPDATE "post"
            SET "quoteCount" = GREATEST(0, "quoteCount" - 1)
            WHERE id = ${post.quotedPostId}
          `
            .affectedCount()
            .build();
          await tx.execute(rawPlan);
        }

        if (post.repostOfId) {
          const rawPlan = this.prismaService.client.raw.sql`
            UPDATE "post"
            SET "repostCount" = GREATEST(0, "repostCount" - 1)
            WHERE id = ${post.repostOfId}
          `
            .affectedCount()
            .build();
          await tx.execute(rawPlan);
        }

        if (post.parentId) {
          await this.cleanupParentTombstone(tx, post.parentId);
        }
      }
    });

    if (mediaToDelete.length > 0) {
      Promise.all(
        mediaToDelete.map((media) =>
          this.mediaService.deleteFile(media.publicId, media.type),
        ),
      ).catch((err) =>
        this.logger.error("Lỗi khi xóa media trên Cloudinary:", err),
      );
    }

    return {
      message: "Xóa bài viết thành công",
      id: postId,
    };
  }

  toPostResponse(
    post: any,
    options?: {
      likedSet?: Set<string>;
      repostedSet?: Set<string>;
      bookmarkedSet?: Set<string>;
    },
  ): PostResponseDto {
    return PostResponseMapper.fromEntity(post, options);
  }

  async canView(post: any, viewerId?: string): Promise<boolean> {
    let visibilitySource = post;
    if (post.rootId) {
      visibilitySource = await this.prismaService.client.orm.public.Post.where({
        id: post.rootId,
      })
        .include("author")
        .first();

      if (!visibilitySource) {
        return false;
      }
    }

    let author = visibilitySource.author;
    if (!author && visibilitySource.authorId) {
      if (this.usersService) {
        author = await this.usersService.findActiveUserById(
          visibilitySource.authorId,
        );
      } else {
        author = await this.prismaService.client.orm.public.User.where(
          (u: any) => u.id.eq(visibilitySource.authorId),
        ).first();
      }
    }

    if (!author || !author.isActive || !author.isEmailVerified) {
      return false;
    }

    if (viewerId && viewerId === visibilitySource.authorId) {
      return true;
    }

    if (visibilitySource.visibility === "PUBLIC") {
      return true;
    }

    if (visibilitySource.visibility === "PRIVATE") {
      return false;
    }

    if (visibilitySource.visibility === "FOLLOWERS") {
      if (!viewerId) return false;
      if (this.usersService) {
        return this.usersService.isFollowing(
          viewerId,
          visibilitySource.authorId,
        );
      }
      const follow = await this.prismaService.client.orm.public.Follow.where(
        (f: any) => f.followerId.eq(viewerId),
      )
        .where((f: any) => f.followingId.eq(visibilitySource.authorId))
        .first();
      return Boolean(follow);
    }

    return false;
  }

  async getPostById(postId: string, viewerId?: string) {
    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    })
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .first();

    if (!post) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (post.isDeleted) {
      return {
        id: post.id,
        isDeleted: true,
        createdAt: post.createdAt,
        replyCount: post.replyCount,
      };
    }

    const allowed = await this.canView(post, viewerId);
    if (!allowed) {
      throw new ForbiddenException("Bạn không có quyền xem bài viết này");
    }

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId) {
      const [like, repost, bookmark] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(viewerId),
        )
          .where((l) => l.postId.eq(postId))
          .first(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(viewerId),
        )
          .where((p) => p.repostOfId.eq(postId))
          .where((p) => p.isDeleted.eq(false))
          .first(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(viewerId),
        )
          .where((b) => b.postId.eq(postId))
          .first(),
      ]);

      if (like) likedSet.add(postId);
      if (repost) repostedSet.add(postId);
      if (bookmark) bookmarkedSet.add(postId);
    }

    return this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet });
  }

  async getReplies(
    postId: string,
    query: CursorPaginationDto,
    viewerId?: string,
  ) {
    const parentPost = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    })
      .include("author")
      .first();

    if (!parentPost) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const rootIdToCheck =
      parentPost.rootId || (parentPost.parentId ? null : parentPost.id);
    if (rootIdToCheck) {
      const rootPost =
        rootIdToCheck === parentPost.id
          ? parentPost
          : await this.prismaService.client.orm.public.Post.where({
              id: rootIdToCheck,
            })
              .include("author")
              .first();

      if (rootPost) {
        const canViewRoot = await this.canView(rootPost, viewerId);
        if (!canViewRoot) {
          throw new ForbiddenException(
            "Bạn không có quyền xem các câu trả lời trong chuỗi bài này",
          );
        }
      }
    }

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    let replyQuery = this.prismaService.client.orm.public.Post.where((p) =>
      p.parentId.eq(postId),
    ).orderBy([(p) => p.createdAt.asc(), (p) => p.id.asc()]);

    if (cursor) {
      replyQuery = replyQuery.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    const replies = await replyQuery
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .all();

    const hasNextPage = replies.length > limit;
    const items = hasNextPage ? replies.slice(0, limit) : replies;

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(viewerId),
        )
          .where((l) => l.postId.in(postIds))
          .all(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(viewerId),
        )
          .where((p) => p.repostOfId.in(postIds))
          .where((p) => p.isDeleted.eq(false))
          .all(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(viewerId),
        )
          .where((b) => b.postId.in(postIds))
          .all(),
      ]);

      likes.forEach((l: any) => likedSet.add(l.postId));
      reposts.forEach((r: any) => repostedSet.add(r.repostOfId));
      bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    }

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items: items.map((item: any) =>
        this.toPostResponse(item, { likedSet, repostedSet, bookmarkedSet }),
      ),
      nextCursor,
    };
  }

  async getAncestors(postId: string, viewerId?: string) {
    const currentPost = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!currentPost) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (!currentPost.parentId) {
      return { ancestors: [] };
    }

    const ancestorsList: any[] = [];
    let currentParentId: string | null = currentPost.parentId;

    let depth = 0;
    while (currentParentId && depth < 20) {
      depth++;
      const parent: any = await this.prismaService.client.orm.public.Post.where(
        { id: currentParentId },
      )
        .include("author")
        .include("media")
        .include("quotedPost")
        .include("repostOf", (repost) =>
          repost.include("author").include("media").include("quotedPost"),
        )
        .first();

      if (!parent) break;

      ancestorsList.unshift(parent);
      currentParentId = parent.parentId;
    }

    if (ancestorsList.length > 0) {
      const rootPost = ancestorsList[0];
      const canViewRoot = await this.canView(rootPost, viewerId);
      if (!canViewRoot) {
        throw new ForbiddenException(
          "Bạn không có quyền xem chuỗi bài viết này",
        );
      }
    }

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && ancestorsList.length > 0) {
      const postIds = ancestorsList.map((p: any) => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(viewerId),
        )
          .where((l) => l.postId.in(postIds))
          .all(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(viewerId),
        )
          .where((p) => p.repostOfId.in(postIds))
          .where((p) => p.isDeleted.eq(false))
          .all(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(viewerId),
        )
          .where((b) => b.postId.in(postIds))
          .all(),
      ]);

      likes.forEach((l: any) => likedSet.add(l.postId));
      reposts.forEach((r: any) => repostedSet.add(r.repostOfId));
      bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    }

    return {
      ancestors: ancestorsList.map((item: any) =>
        this.toPostResponse(item, { likedSet, repostedSet, bookmarkedSet }),
      ),
    };
  }

  async repost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const targetPost = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!targetPost || targetPost.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (targetPost.visibility !== "PUBLIC") {
      throw new ForbiddenException("Chỉ có thể chia sẻ lại bài viết công khai");
    }

    // Kiểm tra xem người dùng đã repost chưa
    const existingRepost =
      await this.prismaService.client.orm.public.Post.where({
        authorId: userId,
        repostOfId: postId,
      }).first();

    if (existingRepost) {
      // Idempotent: Đã repost rồi thì trả về thành công kèm số đếm hiện tại
      return {
        reposted: true,
        repostCount: targetPost.repostCount,
      };
    }

    let result: { reposted: boolean; repostCount: number };
    let inserted = false;
    try {
      result = await this.prismaService.client.transaction(async (tx) => {
        await tx.orm.public.Post.create({
          authorId: userId,
          repostOfId: postId,
          visibility: "PUBLIC",
        });

        const rawPlan = this.prismaService.client.raw.sql`
                    UPDATE "post"
                    SET "repostCount" = "repostCount" + 1
                    WHERE id = ${postId}
                `
          .affectedCount()
          .build();
        await tx.execute(rawPlan);
        inserted = true;

        return {
          reposted: true,
          repostCount: targetPost.repostCount + 1,
        };
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const latestPost = await this.prismaService.client.orm.public.Post.where({
        id: postId,
      }).first();
      result = {
        reposted: true,
        repostCount: latestPost?.repostCount ?? targetPost.repostCount,
      };
    }

    if (inserted && targetPost.authorId !== userId) {
      this.eventEmitter.emit(POST_EVENTS.REPOSTED, {
        actorId: userId,
        postId,
        postAuthorId: targetPost.authorId,
      } satisfies PostRepostedEvent);
    }

    return result;
  }

  async unrepost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const targetPost = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!targetPost) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const existingRepost =
      await this.prismaService.client.orm.public.Post.where({
        authorId: userId,
        repostOfId: postId,
      }).first();

    if (!existingRepost) {
      return {
        reposted: false,
        repostCount: targetPost.repostCount,
      };
    }

    return this.prismaService.client.transaction(async (tx) => {
      const deletePlan = this.prismaService.client.raw.sql`
                DELETE FROM "post"
                WHERE "authorId" = ${userId} AND "repostOfId" = ${postId}
            `
        .affectedCount()
        .build();
      const { affectedRows: deletedCount } = await tx.execute(deletePlan);

      if (deletedCount === 1) {
        const decrementPlan = this.prismaService.client.raw.sql`
                    UPDATE "post"
                    SET "repostCount" = GREATEST(0, "repostCount" - 1)
                    WHERE id = ${postId}
                `
          .affectedCount()
          .build();
        await tx.execute(decrementPlan);
      }

      const latestPost = await tx.orm.public.Post.where({ id: postId }).first();
      return {
        reposted: false,
        repostCount:
          latestPost?.repostCount ??
          Math.max(0, targetPost.repostCount - deletedCount),
      };
    });
  }

  async likePost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const allowed = await this.canView(post, userId);
    if (!allowed) {
      throw new ForbiddenException(
        "Bạn không có quyền tương tác với bài viết này",
      );
    }

    const existingLike =
      await this.prismaService.client.orm.public.PostLike.where((l) =>
        l.userId.eq(userId),
      )
        .where((l) => l.postId.eq(postId))
        .first();

    if (existingLike) {
      return {
        liked: true,
        likeCount: post.likeCount,
      };
    }

    let result: { liked: boolean; likeCount: number };
    let inserted = false;
    try {
      result = await this.prismaService.client.transaction(async (tx) => {
        await tx.orm.public.PostLike.create({ userId, postId });

        const rawPlan = this.prismaService.client.raw.sql`
                    UPDATE "post"
                    SET "likeCount" = "likeCount" + 1
                    WHERE id = ${postId}
                `
          .affectedCount()
          .build();
        await tx.execute(rawPlan);
        inserted = true;

        return { liked: true, likeCount: post.likeCount + 1 };
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const latestPost = await this.prismaService.client.orm.public.Post.where({
        id: postId,
      }).first();
      result = {
        liked: true,
        likeCount: latestPost?.likeCount ?? post.likeCount,
      };
    }

    if (inserted && post.authorId !== userId) {
      this.eventEmitter.emit(POST_EVENTS.LIKED, {
        actorId: userId,
        postId,
        postAuthorId: post.authorId,
      } satisfies PostLikedEvent);
    }

    return result;
  }

  async unlikePost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!post) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const existingLike =
      await this.prismaService.client.orm.public.PostLike.where((l) =>
        l.userId.eq(userId),
      )
        .where((l) => l.postId.eq(postId))
        .first();

    if (!existingLike) {
      return {
        liked: false,
        likeCount: post.likeCount,
      };
    }

    return this.prismaService.client.transaction(async (tx) => {
      const deletePlan = this.prismaService.client.raw.sql`
                DELETE FROM "postLike"
                WHERE "userId" = ${userId} AND "postId" = ${postId}
            `
        .affectedCount()
        .build();
      const { affectedRows: deletedCount } = await tx.execute(deletePlan);

      if (deletedCount === 1) {
        const decrementPlan = this.prismaService.client.raw.sql`
                    UPDATE "post"
                    SET "likeCount" = GREATEST(0, "likeCount" - 1)
                    WHERE id = ${postId}
                `
          .affectedCount()
          .build();
        await tx.execute(decrementPlan);
      }

      const latestPost = await tx.orm.public.Post.where({ id: postId }).first();
      return {
        liked: false,
        likeCount:
          latestPost?.likeCount ?? Math.max(0, post.likeCount - deletedCount),
      };
    });
  }

  async getPostLikes(
    postId: string,
    query: OffsetPaginationDto,
    viewerId?: string,
  ): Promise<PostLikesResponseDto> {
    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const allowed = await this.canView(post, viewerId);
    if (!allowed) {
      throw new ForbiddenException(
        "Bạn không có quyền xem thông tin bài viết này",
      );
    }

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeLikeCursor(query.cursor);

    if (cursor) {
      let likeQuery = this.prismaService.client.orm.public.PostLike.where(
        (l: any) => l.postId.eq(postId),
      )
        .orderBy([(l: any) => l.createdAt.desc(), (l: any) => l.userId.desc()])
        .limit(limit + 1)
        .include("user");

      likeQuery = likeQuery.cursor(cursor);
      const likes = await likeQuery.all();

      const hasNextPage = likes.length > limit;
      const items = hasNextPage ? likes.slice(0, limit) : likes;
      const nextCursor =
        hasNextPage && items.length > 0
          ? this.encodeLikeCursor(items[items.length - 1])
          : null;

      return {
        items: items.map((item: any) => ({
          id: item.user.id,
          username: item.user.username,
          displayName: item.user.displayName,
          avatarUrl: item.user.avatarUrl,
          bio: item.user.bio,
          likedAt: item.createdAt,
        })),
        nextCursor,
      };
    }

    const page = Math.max(1, Number(query.page) || 1);
    const skip = (page - 1) * limit;

    const [likes, totalAgg] = await Promise.all([
      this.prismaService.client.orm.public.PostLike.where((l) =>
        l.postId.eq(postId),
      )
        .orderBy([(l: any) => l.createdAt.desc(), (l: any) => l.userId.desc()])
        .offset(skip)
        .limit(limit)
        .include("user")
        .all(),
      this.prismaService.client.orm.public.PostLike.where((l) =>
        l.postId.eq(postId),
      ).aggregate((agg) => ({ total: agg.count() })),
    ]);

    const total = Number(totalAgg.total) || 0;
    const nextCursor =
      likes.length === limit && skip + limit < total
        ? this.encodeLikeCursor(likes[likes.length - 1])
        : null;

    return {
      items: likes.map((item: any) => ({
        id: item.user.id,
        username: item.user.username,
        displayName: item.user.displayName,
        avatarUrl: item.user.avatarUrl,
        bio: item.user.bio,
        likedAt: item.createdAt,
      })),
      nextCursor,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async bookmarkPost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const allowed = await this.canView(post, userId);
    if (!allowed) {
      throw new ForbiddenException("Bạn không có quyền lưu bài viết này");
    }

    const existingBookmark =
      await this.prismaService.client.orm.public.PostBookmark.where((b) =>
        b.userId.eq(userId),
      )
        .where((b) => b.postId.eq(postId))
        .first();

    if (existingBookmark) {
      return { bookmarked: true };
    }

    try {
      return await this.prismaService.client.transaction(async (tx) => {
        await tx.orm.public.PostBookmark.create({ userId, postId });

        const rawPlan = this.prismaService.client.raw.sql`
                    UPDATE "post"
                    SET "bookmarkCount" = "bookmarkCount" + 1
                    WHERE id = ${postId}
                `
          .affectedCount()
          .build();
        await tx.execute(rawPlan);

        return { bookmarked: true };
      });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      return { bookmarked: true };
    }
  }

  async unbookmarkPost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.prismaService.client.orm.public.Post.where({
      id: postId,
    }).first();

    if (!post) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const existingBookmark =
      await this.prismaService.client.orm.public.PostBookmark.where((b) =>
        b.userId.eq(userId),
      )
        .where((b) => b.postId.eq(postId))
        .first();

    if (!existingBookmark) {
      return { bookmarked: false };
    }

    return this.prismaService.client.transaction(async (tx) => {
      const deletePlan = this.prismaService.client.raw.sql`
                DELETE FROM "postBookmark"
                WHERE "userId" = ${userId} AND "postId" = ${postId}
            `
        .affectedCount()
        .build();
      const { affectedRows: deletedCount } = await tx.execute(deletePlan);

      if (deletedCount === 1) {
        const decrementPlan = this.prismaService.client.raw.sql`
                    UPDATE "post"
                    SET "bookmarkCount" = GREATEST(0, "bookmarkCount" - 1)
                    WHERE id = ${postId}
                `
          .affectedCount()
          .build();
        await tx.execute(decrementPlan);
      }

      return { bookmarked: false };
    });
  }

  async getBookmarks(userId: string, query: CursorPaginationDto) {
    return this.getMarkedPosts(userId, query, "bookmark");
  }

  async getLikedPosts(userId: string, query: CursorPaginationDto) {
    return this.getMarkedPosts(userId, query, "like");
  }

  private async getMarkedPosts(
    userId: string,
    query: CursorPaginationDto,
    kind: "bookmark" | "like",
  ) {
    await this.ensureActiveUser(userId);

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const batchSize = Math.min(100, Math.max(20, limit * 2));
    const markerTable: any =
      kind === "bookmark"
        ? this.prismaService.client.orm.public.PostBookmark
        : this.prismaService.client.orm.public.PostLike;
    let scanCursor = this.decodeMarkedCursor(query.cursor);
    const accessible: Array<{ marker: any; post: any }> = [];
    let lastScanned: any = null;
    let hasMore = false;

    for (
      let batchIndex = 0;
      batchIndex < 3 && accessible.length <= limit;
      batchIndex++
    ) {
      let markerQuery = markerTable
        .where((b: any) => b.userId.eq(userId))
        .orderBy([(b: any) => b.createdAt.desc(), (b: any) => b.postId.desc()]);
      if (scanCursor) {
        markerQuery = markerQuery.cursor(scanCursor);
      }
      const batch = await markerQuery.limit(batchSize).all();
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      lastScanned = batch[batch.length - 1];
      hasMore = batch.length === batchSize;

      const batchIds = batch.map((marker: any) => marker.postId);
      const posts = await this.prismaService.client.orm.public.Post.where((p) =>
        p.id.in(batchIds),
      )
        .include("author")
        .include("media")
        .include("quotedPost")
        .include("repostOf", (repost) =>
          repost.include("author").include("media").include("quotedPost"),
        )
        .all();
      const postMap = new Map<string, any>(
        posts.map((post: any) => [post.id, post]),
      );
      const accessChecks = await Promise.all(
        batch.map((marker: any) => {
          const post = postMap.get(marker.postId);
          return post ? this.canView(post, userId) : false;
        }),
      );
      for (let index = 0; index < batch.length; index++) {
        if (accessChecks[index]) {
          accessible.push({
            marker: batch[index],
            post: postMap.get(batch[index].postId),
          });
        }
        if (accessible.length > limit) break;
      }
      if (!hasMore || accessible.length > limit) break;
      scanCursor = {
        createdAt: lastScanned.createdAt,
        postId: lastScanned.postId,
      };
    }

    const page = accessible.slice(0, limit);
    const orderedPosts = page.map((entry) => entry.post);
    const postIds = orderedPosts.map((post: any) => post.id);
    if (postIds.length === 0)
      return {
        items: [],
        nextCursor:
          hasMore && lastScanned ? this.encodeMarkedCursor(lastScanned) : null,
      };

    const likedSet = new Set<string>(kind === "like" ? postIds : []);
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>(kind === "bookmark" ? postIds : []);

    const [likes, bookmarks, reposts] = await Promise.all([
      kind === "like"
        ? []
        : this.prismaService.client.orm.public.PostLike.where((l) =>
            l.userId.eq(userId),
          )
            .where((l) => l.postId.in(postIds))
            .all(),
      kind === "bookmark"
        ? []
        : this.prismaService.client.orm.public.PostBookmark.where((b) =>
            b.userId.eq(userId),
          )
            .where((b) => b.postId.in(postIds))
            .all(),
      this.prismaService.client.orm.public.Post.where((p) =>
        p.authorId.eq(userId),
      )
        .where((p) => p.repostOfId.in(postIds))
        .where((p) => p.isDeleted.eq(false))
        .all(),
    ]);

    likes.forEach((l: any) => likedSet.add(l.postId));
    bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    reposts.forEach((r: any) => repostedSet.add(r.repostOfId));

    return {
      items: orderedPosts.map((post: any) =>
        this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet }),
      ),
      nextCursor:
        accessible.length > limit
          ? this.encodeMarkedCursor(page[page.length - 1].marker)
          : hasMore && lastScanned
            ? this.encodeMarkedCursor(lastScanned)
            : null,
    };
  }

  async getFeed(userId: string, query: CursorPaginationDto) {
    await this.ensureActiveUser(userId);

    const followingIds = this.usersService
      ? await this.usersService.getActiveFollowingIds(userId)
      : await this.prismaService.client.orm.public.Follow.where((f: any) =>
          f.followerId.eq(userId),
        )
          .where((f: any) => f.following.some((u: any) => u.isActive.eq(true)))
          .where((f: any) =>
            f.following.some((u: any) => u.isEmailVerified.eq(true)),
          )
          .all()
          .then((rows: any[]) => rows.map((r) => r.followingId));
    const targetAuthorIds = [userId, ...followingIds];

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    let feedQuery = this.prismaService.client.orm.public.Post.where((p) =>
      p.authorId.in(targetAuthorIds),
    )
      .where((p) => p.isDeleted.eq(false))
      .where((p) => p.author.some((u) => u.isActive.eq(true)))
      .where((p) => p.author.some((u) => u.isEmailVerified.eq(true)))
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()]);

    if (cursor) {
      feedQuery = feedQuery.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    const posts = await feedQuery
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .all();

    const hasNextPage = posts.length > limit;
    const pageCandidates = hasNextPage ? posts.slice(0, limit) : posts;
    const accessChecks = await Promise.all(
      pageCandidates.map((post: any) => this.canView(post, userId)),
    );
    const items = pageCandidates.filter(
      (_: any, index: number) => accessChecks[index],
    );

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(userId),
        )
          .where((l) => l.postId.in(postIds))
          .all(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(userId),
        )
          .where((p) => p.repostOfId.in(postIds))
          .where((p) => p.isDeleted.eq(false))
          .all(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(userId),
        )
          .where((b) => b.postId.in(postIds))
          .all(),
      ]);

      likes.forEach((l: any) => likedSet.add(l.postId));
      reposts.forEach((r: any) => repostedSet.add(r.repostOfId));
      bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    }

    const lastScannedPost = pageCandidates[pageCandidates.length - 1];
    const nextCursor =
      hasNextPage && lastScannedPost
        ? this.encodeCursor(lastScannedPost)
        : null;

    return {
      items: items.map((post: any) =>
        this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet }),
      ),
      nextCursor,
    };
  }

  async getExplore(
    query: ExploreQueryDto,
    viewerId?: string,
    searchTerm?: string,
  ) {
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    let exploreQuery = this.prismaService.client.orm.public.Post.where((p) =>
      p.visibility.eq("PUBLIC"),
    )
      .where((p) => p.parentId.isNull())
      .where((p) => p.isDeleted.eq(false))
      .where((p) => p.author.some((u) => u.isActive.eq(true)))
      .where((p) => p.author.some((u) => u.isEmailVerified.eq(true)))
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()]);

    if (searchTerm) {
      exploreQuery = exploreQuery.where((p) =>
        p.content.ilike(toContainsPattern(searchTerm)),
      );
    }
    if (query.mediaOnly === "true") {
      exploreQuery = exploreQuery.where((p) =>
        p.media.some((media) => media.type.in(["IMAGE", "VIDEO"])),
      );
    }

    if (cursor) {
      exploreQuery = exploreQuery.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    const posts = await exploreQuery
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .all();

    const hasNextPage = posts.length > limit;
    const items = hasNextPage ? posts.slice(0, limit) : posts;

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(viewerId),
        )
          .where((l) => l.postId.in(postIds))
          .all(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(viewerId),
        )
          .where((p) => p.repostOfId.in(postIds))
          .where((p) => p.isDeleted.eq(false))
          .all(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(viewerId),
        )
          .where((b) => b.postId.in(postIds))
          .all(),
      ]);

      likes.forEach((l: any) => likedSet.add(l.postId));
      reposts.forEach((r: any) => repostedSet.add(r.repostOfId));
      bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    }

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items: items.map((post: any) =>
        this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet }),
      ),
      nextCursor,
    };
  }

  async getUserPosts(
    username: string,
    query: CursorPaginationDto,
    viewerId?: string,
  ) {
    const targetUser =
      await this.usersService.findActiveUserByUsername(username);

    const isOwner = viewerId === targetUser.id;
    let isFollowing = false;
    if (viewerId && !isOwner) {
      isFollowing = await this.usersService.isFollowing(
        viewerId,
        targetUser.id,
      );
    }

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    const allowedVisibilities: ("PUBLIC" | "FOLLOWERS" | "PRIVATE")[] = isOwner
      ? ["PUBLIC", "FOLLOWERS", "PRIVATE"]
      : isFollowing
        ? ["PUBLIC", "FOLLOWERS"]
        : ["PUBLIC"];

    let userPostsQuery = this.prismaService.client.orm.public.Post.where((p) =>
      p.authorId.eq(targetUser.id),
    )
      .where((p) => p.parentId.isNull())
      .where((p) => p.isDeleted.eq(false))
      .where((p) => p.visibility.in(allowedVisibilities))
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()]);

    if (cursor) {
      userPostsQuery = userPostsQuery.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    const posts = await userPostsQuery
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .all();

    const hasNextPage = posts.length > limit;
    const items = hasNextPage ? posts.slice(0, limit) : posts;

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(viewerId),
        )
          .where((l) => l.postId.in(postIds))
          .all(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(viewerId),
        )
          .where((p) => p.repostOfId.in(postIds))
          .where((p) => p.isDeleted.eq(false))
          .all(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(viewerId),
        )
          .where((b) => b.postId.in(postIds))
          .all(),
      ]);

      likes.forEach((l: any) => likedSet.add(l.postId));
      reposts.forEach((r: any) => repostedSet.add(r.repostOfId));
      bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    }

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items: items.map((post: any) =>
        this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet }),
      ),
      nextCursor,
    };
  }

  async getUserReplies(
    username: string,
    query: CursorPaginationDto,
    viewerId?: string,
  ) {
    const targetUser =
      await this.usersService.findActiveUserByUsername(username);

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    let userRepliesQuery = this.prismaService.client.orm.public.Post.where(
      (p) => p.authorId.eq(targetUser.id),
    )
      .where((p) => p.parentId.isNotNull())
      .where((p) => p.isDeleted.eq(false))
      .orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()]);

    if (cursor) {
      userRepliesQuery = userRepliesQuery.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    const posts = await userRepliesQuery
      .limit(limit + 1)
      .include("author")
      .include("media")
      .include("quotedPost")
      .include("repostOf", (repost) =>
        repost.include("author").include("media").include("quotedPost"),
      )
      .include("parent")
      .all();

    const hasNextPage = posts.length > limit;
    const pageCandidates = hasNextPage ? posts.slice(0, limit) : posts;
    const accessChecks = await Promise.all(
      pageCandidates.map((post: any) => this.canView(post, viewerId)),
    );
    const items = pageCandidates.filter(
      (_: any, index: number) => accessChecks[index],
    );

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const [likes, reposts, bookmarks] = await Promise.all([
        this.prismaService.client.orm.public.PostLike.where((l) =>
          l.userId.eq(viewerId),
        )
          .where((l) => l.postId.in(postIds))
          .all(),
        this.prismaService.client.orm.public.Post.where((p) =>
          p.authorId.eq(viewerId),
        )
          .where((p) => p.repostOfId.in(postIds))
          .where((p) => p.isDeleted.eq(false))
          .all(),
        this.prismaService.client.orm.public.PostBookmark.where((b) =>
          b.userId.eq(viewerId),
        )
          .where((b) => b.postId.in(postIds))
          .all(),
      ]);

      likes.forEach((l: any) => likedSet.add(l.postId));
      reposts.forEach((r: any) => repostedSet.add(r.repostOfId));
      bookmarks.forEach((b: any) => bookmarkedSet.add(b.postId));
    }

    const lastScannedPost = pageCandidates[pageCandidates.length - 1];
    const nextCursor =
      hasNextPage && lastScannedPost
        ? this.encodeCursor(lastScannedPost)
        : null;

    return {
      items: items.map((post: any) => {
        const response: any = this.toPostResponse(post, {
          likedSet,
          repostedSet,
          bookmarkedSet,
        });
        if (post.parent) {
          response.parent = {
            id: post.parent.id,
            content: post.parent.isDeleted ? null : post.parent.content,
            isDeleted: post.parent.isDeleted,
            authorId: post.parent.authorId,
            createdAt: post.parent.createdAt,
          };
        }
        return response;
      }),
      nextCursor,
    };
  }

  async reconcileCounters(targetPostId?: string) {
    let postsQuery = this.prismaService.client.orm.public.Post.where((p) =>
      p.isDeleted.eq(false),
    );

    if (targetPostId) {
      postsQuery = postsQuery.where((p) => p.id.eq(targetPostId));
    }

    const posts = await postsQuery.all();
    let correctedCount = 0;
    const discrepancies: any[] = [];

    for (const post of posts) {
      const [likesAgg, bookmarksAgg, repostsAgg, quotesAgg, repliesAgg] =
        await Promise.all([
          this.prismaService.client.orm.public.PostLike.where((l) =>
            l.postId.eq(post.id),
          ).aggregate((agg) => ({ total: agg.count() })),
          this.prismaService.client.orm.public.PostBookmark.where((b) =>
            b.postId.eq(post.id),
          ).aggregate((agg) => ({ total: agg.count() })),
          this.prismaService.client.orm.public.Post.where((p) =>
            p.repostOfId.eq(post.id),
          )
            .where((p) => p.isDeleted.eq(false))
            .aggregate((agg) => ({ total: agg.count() })),
          this.prismaService.client.orm.public.Post.where((p) =>
            p.quotedPostId.eq(post.id),
          )
            .where((p) => p.isDeleted.eq(false))
            .aggregate((agg) => ({ total: agg.count() })),
          this.prismaService.client.orm.public.Post.where((p) =>
            p.parentId.eq(post.id),
          )
            .where((p) => p.isDeleted.eq(false))
            .aggregate((agg) => ({ total: agg.count() })),
        ]);

      const actualLikes = Number(likesAgg.total);
      const actualBookmarks = Number(bookmarksAgg.total);
      const actualReposts = Number(repostsAgg.total);
      const actualQuotes = Number(quotesAgg.total);
      const actualReplies = Number(repliesAgg.total);

      const hasDiscrepancy =
        post.likeCount !== actualLikes ||
        post.bookmarkCount !== actualBookmarks ||
        post.repostCount !== actualReposts ||
        post.quoteCount !== actualQuotes ||
        post.replyCount !== actualReplies;

      if (hasDiscrepancy) {
        correctedCount++;
        discrepancies.push({
          postId: post.id,
          before: {
            likeCount: post.likeCount,
            bookmarkCount: post.bookmarkCount,
            repostCount: post.repostCount,
            quoteCount: post.quoteCount,
            replyCount: post.replyCount,
          },
          after: {
            likeCount: actualLikes,
            bookmarkCount: actualBookmarks,
            repostCount: actualReposts,
            quoteCount: actualQuotes,
            replyCount: actualReplies,
          },
        });

        await this.prismaService.client.orm.public.Post.where({
          id: post.id,
        }).update({
          likeCount: actualLikes,
          bookmarkCount: actualBookmarks,
          repostCount: actualReposts,
          quoteCount: actualQuotes,
          replyCount: actualReplies,
        });
      }
    }

    return {
      totalScanned: posts.length,
      correctedCount,
      discrepancies,
    };
  }

  private async ensureActiveUser(userId: string) {
    if (this.usersService) {
      return this.usersService.ensureActiveUser(userId);
    }
    const user = await this.prismaService.client.orm.public.User.where(
      (u: any) => u.id.eq(userId),
    ).first();
    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new DomainException(
        ERROR_CODES.USER_NOT_FOUND,
        "Người dùng không tồn tại hoặc tài khoản đã bị khóa",
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const candidate = error as { code?: string; message?: string };
    return (
      candidate.code === "23505" ||
      candidate.message?.includes("duplicate key") === true ||
      candidate.message?.includes("violates unique constraint") === true
    );
  }

  private verifyMediaItems(userId: string, mediaItems: PostMediaItemDto[]) {
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiSecret || !cloudName) {
      throw new Error("Chưa cấu hình Cloudinary environment variables");
    }
    const expectedPrefix = `mxh/${userId}/posts/`;
    const seenPublicIds = new Set<string>();

    return mediaItems.map((item) => {
      if (seenPublicIds.has(item.publicId)) {
        throw new BadRequestException(`Media ${item.publicId} bị trùng lặp`);
      }
      seenPublicIds.add(item.publicId);

      if (!item.publicId.startsWith(expectedPrefix)) {
        throw new BadRequestException(
          `Media ${item.publicId} không hợp lệ hoặc không thuộc quyền sở hữu của bạn`,
        );
      }
      const signaturePayload = `public_id=${item.publicId}&version=${item.version}${apiSecret}`;
      const expectedSignature = crypto
        .createHash("sha1")
        .update(signaturePayload)
        .digest("hex");
      if (item.signature !== expectedSignature) {
        throw new BadRequestException(
          `Chữ ký media ${item.publicId} không hợp lệ`,
        );
      }
      const resourceType = item.type === "IMAGE" ? "image" : "video";
      const secureUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/v${item.version}/${item.publicId}`;
      return {
        publicId: item.publicId,
        url: secureUrl,
        type: item.type,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
        order: item.order,
      };
    });
  }

  private encodeCursor(item: { createdAt: any; id: string }): string {
    const payload = JSON.stringify({
      createdAt: item.createdAt.toString(),
      id: item.id,
    });
    return Buffer.from(payload).toString("base64url");
  }

  private encodeMarkedCursor(item: { createdAt: any; postId: string }): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: item.createdAt.toString(),
        postId: item.postId,
      }),
    ).toString("base64url");
  }

  private decodeMarkedCursor(
    value?: string,
  ): { createdAt: Temporal.Instant; postId: string } | null {
    if (!value) return null;
    try {
      const decoded = JSON.parse(
        Buffer.from(value, "base64url").toString("utf8"),
      );
      if (
        typeof decoded?.createdAt !== "string" ||
        typeof decoded?.postId !== "string" ||
        !decoded.postId
      )
        return null;
      return {
        createdAt: Temporal.Instant.from(decoded.createdAt),
        postId: decoded.postId,
      };
    } catch {
      return null;
    }
  }

  private encodeLikeCursor(item: { createdAt: any; userId: string }): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: item.createdAt.toString(),
        userId: item.userId,
      }),
    ).toString("base64url");
  }

  private decodeLikeCursor(
    cursor?: string,
  ): { createdAt: Temporal.Instant; userId: string } | null {
    if (!cursor) return null;
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      );
      if (
        typeof decoded?.createdAt !== "string" ||
        typeof decoded?.userId !== "string" ||
        !decoded.userId
      ) {
        return null;
      }
      return {
        createdAt: Temporal.Instant.from(decoded.createdAt),
        userId: decoded.userId,
      };
    } catch {
      return null;
    }
  }

  private decodeCursor(
    cursor?: string,
  ): { createdAt: Temporal.Instant; id: string } | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof parsed.createdAt !== "string" ||
        typeof parsed.id !== "string" ||
        parsed.id.length === 0
      ) {
        return null;
      }
      const createdAt = Temporal.Instant.from(parsed.createdAt);
      return {
        createdAt,
        id: parsed.id,
      };
    } catch {
      return null;
    }
  }

  private async cleanupParentTombstone(tx: any, parentId: string) {
    let currentId: string | null = parentId;

    while (currentId) {
      const rawPlan = this.prismaService.client.raw.sql`
                UPDATE "post"
                SET "replyCount" = GREATEST(0, "replyCount" - 1)
                WHERE id = ${currentId}
            `
        .affectedCount()
        .build();
      await tx.execute(rawPlan);

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
