import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto.js";
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
import { ExploreQueryDto } from "./dto/explore-query.dto.js";
import {
  PostLikesResponseDto,
  PostResponseDto,
  PostResponseMapper,
} from "./dto/post-response.dto.js";
import type { CursorPage, OffsetPage } from "../common/dto/cursor-page.dto.js";
import { PostsRepository } from "./posts.repository.js";

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly postRepository: PostsRepository,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

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
      parentPost = await this.postRepository.findByIdWithAuthor(dto.parentId);

      if (!parentPost) {
        throw new NotFoundException("Bài viết cha không tồn tại");
      }

      if (parentPost.isDeleted) {
        throw new BadRequestException("Không thể trả lời bài viết đã bị xóa");
      }

      rootId = parentPost.rootId ? parentPost.rootId : parentPost.id;

      rootPost = parentPost.rootId
        ? await this.postRepository.findByIdWithAuthor(rootId!)
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
      quotedPost = await this.postRepository.findById(dto.quotedPostId);

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
      ? this.mediaService.verifyMediaItems(userId, dto.media!)
      : [];

    let result: any;
    try {
      const post = await this.postRepository.createPostWithMedia({
        authorId: userId,
        content: content || null,
        visibility,
        parentId: dto.parentId || null,
        rootId: rootId || null,
        quotedPostId: dto.quotedPostId || null,
        media: verifiedMedia,
      });
      result = this.toPostResponse(post);
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

    const post = await this.postRepository.findByIdWithAuthorAndMedia(postId);

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

    await this.postRepository.updatePostAndReplies(postId, updatePayload, dto.visibility);

    const updated = await this.postRepository.findByIdForResponse(postId);

    return this.toPostResponse(updated);
  }

  async deletePost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.postRepository.findByIdWithMedia(postId);

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

    await this.postRepository.deletePostRecord(postId, post);

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
      visibilitySource = await this.postRepository.findByIdWithAuthor(post.rootId);

      if (!visibilitySource) {
        return false;
      }
    }

    let author = visibilitySource.author;
    if (!author && visibilitySource.authorId) {
      author = await this.getUsersService().findActiveUserById(
        visibilitySource.authorId,
      );
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
      return this.getUsersService().isFollowing(
        viewerId,
        visibilitySource.authorId,
      );
    }

    return false;
  }

  async getPostById(postId: string, viewerId?: string) {
    const post = await this.postRepository.findByIdForResponse(postId);

    if (!post) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (post.isDeleted) {
      return {
        id: post.id,
        isDeleted: true as const,
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
      const marks = await this.postRepository.findViewerMarks(viewerId, [postId]);
      if (marks.likes.length > 0) likedSet.add(postId);
      if (marks.reposts.length > 0) repostedSet.add(postId);
      if (marks.bookmarks.length > 0) bookmarkedSet.add(postId);
    }

    return this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet });
  }

  async getReplies(
    postId: string,
    query: CursorPaginationDto,
    viewerId?: string,
  ) {
    const parentPost = await this.postRepository.findByIdWithAuthor(postId);

    if (!parentPost) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const rootIdToCheck =
      parentPost.rootId || (parentPost.parentId ? null : parentPost.id);
    if (rootIdToCheck) {
      const rootPost =
        rootIdToCheck === parentPost.id
          ? parentPost
          : await this.postRepository.findByIdWithAuthor(rootIdToCheck);

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

    const replies = await this.postRepository.listReplies(postId, limit, cursor);

    const hasNextPage = replies.length > limit;
    const items = hasNextPage ? replies.slice(0, limit) : replies;

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const { likes, reposts, bookmarks } = await this.postRepository.findViewerMarks(viewerId, postIds);

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
    const currentPost = await this.postRepository.findById(postId);

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
      const parent: any = await this.postRepository.findByIdForResponse(currentParentId);

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
      const { likes, reposts, bookmarks } = await this.postRepository.findViewerMarks(viewerId, postIds);

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

    const targetPost = await this.postRepository.findById(postId);

    if (!targetPost || targetPost.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    if (targetPost.visibility !== "PUBLIC") {
      throw new ForbiddenException("Chỉ có thể chia sẻ lại bài viết công khai");
    }

    // Kiểm tra xem người dùng đã repost chưa
    const existingRepost = await this.postRepository.findRepost(userId, postId);

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
      await this.postRepository.createRepostAndIncrement(postId, userId);
      inserted = true;
      result = { reposted: true, repostCount: targetPost.repostCount + 1 };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const latestPost = await this.postRepository.findById(postId);
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

    const targetPost = await this.postRepository.findById(postId);

    if (!targetPost) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const existingRepost = await this.postRepository.findRepost(userId, postId);

    if (!existingRepost) {
      return {
        reposted: false,
        repostCount: targetPost.repostCount,
      };
    }

    const { deletedCount, repostCount } = await this.postRepository.removeRepostAndDecrement(postId, userId);
    return {
      reposted: false,
      repostCount: repostCount ?? Math.max(0, targetPost.repostCount - deletedCount),
    };
  }

  async likePost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.postRepository.findById(postId);

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const allowed = await this.canView(post, userId);
    if (!allowed) {
      throw new ForbiddenException(
        "Bạn không có quyền tương tác với bài viết này",
      );
    }

    const existingLike = await this.postRepository.findLike(userId, postId);

    if (existingLike) {
      return {
        liked: true,
        likeCount: post.likeCount,
      };
    }

    let result: { liked: boolean; likeCount: number };
    let inserted = false;
    try {
      await this.postRepository.createLikeAndIncrement(postId, userId);
      inserted = true;
      result = { liked: true, likeCount: post.likeCount + 1 };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const latestPost = await this.postRepository.findById(postId);
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

    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const existingLike = await this.postRepository.findLike(userId, postId);

    if (!existingLike) {
      return {
        liked: false,
        likeCount: post.likeCount,
      };
    }

    const { deletedCount, likeCount } = await this.postRepository.removeLikeAndDecrement(postId, userId);
    return { liked: false, likeCount: likeCount ?? Math.max(0, post.likeCount - deletedCount) };
  }

  async getPostLikes(
    postId: string,
    query: OffsetPaginationDto,
    viewerId?: string,
  ): Promise<PostLikesResponseDto> {
    const post = await this.postRepository.findById(postId);

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
      const likes = await this.postRepository.listPostLikes(postId, { limit: limit + 1, cursor });

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

    const [likes, total] = await Promise.all([
      this.postRepository.listPostLikes(postId, { offset: skip, limit }),
      this.postRepository.countPostLikes(postId),
    ]);
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

    const post = await this.postRepository.findById(postId);

    if (!post || post.isDeleted) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const allowed = await this.canView(post, userId);
    if (!allowed) {
      throw new ForbiddenException("Bạn không có quyền lưu bài viết này");
    }

    const existingBookmark = await this.postRepository.findBookmark(userId, postId);

    if (existingBookmark) {
      return { bookmarked: true };
    }

    try {
      await this.postRepository.createBookmarkAndIncrement(postId, userId);
      return { bookmarked: true };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      return { bookmarked: true };
    }
  }

  async unbookmarkPost(postId: string, userId: string) {
    await this.ensureActiveUser(userId);

    const post = await this.postRepository.findById(postId);

    if (!post) {
      throw new NotFoundException("Không tìm thấy bài viết");
    }

    const existingBookmark = await this.postRepository.findBookmark(userId, postId);

    if (!existingBookmark) {
      return { bookmarked: false };
    }

    await this.postRepository.removeBookmarkAndDecrement(postId, userId);
    return { bookmarked: false };
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
    let scanCursor = this.decodeMarkedCursor(query.cursor);
    const accessible: Array<{ marker: any; post: any }> = [];
    let lastScanned: any = null;
    let hasMore = false;

    for (
      let batchIndex = 0;
      batchIndex < 3 && accessible.length <= limit;
      batchIndex++
    ) {
      const batch = await this.postRepository.listMarkedPostReferences(kind, userId, batchSize, scanCursor);
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      lastScanned = batch[batch.length - 1];
      hasMore = batch.length === batchSize;

      const batchIds = batch.map((marker: any) => marker.postId);
      const posts = await this.postRepository.findPostsByIdsForResponse(batchIds);
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

    const { likes, bookmarks, reposts } = await this.postRepository.findSecondaryMarks(kind, userId, postIds);

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

    const followingIds = await this.getUsersService().getActiveFollowingIds(userId);
    const targetAuthorIds = [userId, ...followingIds];

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    const posts = await this.postRepository.listFeedPosts(targetAuthorIds, limit, cursor);

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
      const { likes, reposts, bookmarks } = await this.postRepository.findViewerMarks(userId, postIds);

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

    const posts = await this.postRepository.listExplorePosts(limit, cursor, searchTerm, query.mediaOnly === "true");

    const hasNextPage = posts.length > limit;
    const items = hasNextPage ? posts.slice(0, limit) : posts;

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const { likes, reposts, bookmarks } = await this.postRepository.findViewerMarks(viewerId, postIds);

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
      await this.getUsersService().findActiveUserByUsername(username);

    const isOwner = viewerId === targetUser.id;
    let isFollowing = false;
    if (viewerId && !isOwner) {
      isFollowing = await this.getUsersService().isFollowing(
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

    const posts = await this.postRepository.listUserPosts(targetUser.id, allowedVisibilities, limit, cursor);

    const hasNextPage = posts.length > limit;
    const items = hasNextPage ? posts.slice(0, limit) : posts;

    const likedSet = new Set<string>();
    const repostedSet = new Set<string>();
    const bookmarkedSet = new Set<string>();

    if (viewerId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const { likes, reposts, bookmarks } = await this.postRepository.findViewerMarks(viewerId, postIds);

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
      await this.getUsersService().findActiveUserByUsername(username);

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeCursor(query.cursor);

    const posts = await this.postRepository.listUserReplies(targetUser.id, limit, cursor);

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
      const { likes, reposts, bookmarks } = await this.postRepository.findViewerMarks(viewerId, postIds);

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
    const posts = await this.postRepository.listActivePosts(targetPostId);
    let correctedCount = 0;
    const discrepancies: any[] = [];

    for (const post of posts) {
      const {
        likeCount: actualLikes, bookmarkCount: actualBookmarks,
        repostCount: actualReposts, quoteCount: actualQuotes,
        replyCount: actualReplies,
      } = await this.postRepository.countPostRelations(post.id);

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

        await this.postRepository.updatePostCounters(post.id, {
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
    return this.getUsersService().ensureActiveUser(userId);
  }

  private getUsersService(): UsersService {
    if (!this.usersService) {
      throw new Error("UsersService chưa được cấu hình cho PostsService");
    }
    return this.usersService;
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

}
