export interface PostAuthorDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
}

export interface PostMediaResponseDto {
  id: string;
  publicId: string;
  url: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  width: number | null;
  height: number | null;
  duration: number | null;
  order: number;
}

export interface PostCountersDto {
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  bookmarkCount: number;
}

export interface PostInteractionsDto {
  isLiked: boolean;
  isReposted: boolean;
  isBookmarked: boolean;
}

export interface QuotedPostResponseDto {
  id: string;
  content: string | null;
  createdAt: string | unknown;
  author: PostAuthorDto | null;
  media: PostMediaResponseDto[];
}

export interface PostLikeUserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  likedAt?: string | unknown;
}

export interface PostLikesResponseDto {
  items: PostLikeUserDto[];
  nextCursor: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ParentPostSummaryDto {
  id: string;
  content: string | null;
  isDeleted: boolean;
  authorId: string;
  createdAt: string | unknown;
}

export interface ActivePostResponseDto {
  id: string;
  content: string | null;
  visibility: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
  parentId: string | null;
  rootId: string | null;
  repostOfId: string | null;
  repostOf?: PostResponseDto | null;
  quotedPostId: string | null;
  quotedPost?: QuotedPostResponseDto | null;
  isQuotedPostDeleted?: boolean;
  isDeleted: false;
  isUnavailable?: false;
  editedAt: string | unknown | null;
  createdAt: string | unknown;
  author: PostAuthorDto;
  media: PostMediaResponseDto[];
  counters: PostCountersDto;
  interactions: PostInteractionsDto;
  parent?: ParentPostSummaryDto;
}

export interface DeletedPostResponseDto {
  id: string;
  createdAt: string | unknown;
  isDeleted: true;
  isUnavailable?: false;
  replyCount?: number;
}

export interface UnavailablePostResponseDto {
  id: string;
  createdAt: string | unknown;
  parentId?: string | null;
  rootId?: string | null;
  isDeleted?: false;
  isUnavailable: true;
  replyCount?: number;
}

export type PostResponseDto =
  ActivePostResponseDto | DeletedPostResponseDto | UnavailablePostResponseDto;

export class PostResponseMapper {
  static fromEntity(
    post: any,
    options?: {
      likedSet?: Set<string>;
      repostedSet?: Set<string>;
      bookmarkedSet?: Set<string>;
    },
  ): PostResponseDto {
    if (post.isDeleted) {
      return {
        id: post.id,
        isDeleted: true,
        createdAt: post.createdAt,
        replyCount: post.replyCount,
      };
    }

    if (
      post.author &&
      (!post.author.isActive || !post.author.isEmailVerified)
    ) {
      return {
        id: post.id,
        isUnavailable: true,
        createdAt: post.createdAt,
        replyCount: post.replyCount,
      };
    }

    const isLiked = options?.likedSet ? options.likedSet.has(post.id) : false;
    const isReposted = options?.repostedSet
      ? options.repostedSet.has(post.id)
      : false;
    const isBookmarked = options?.bookmarkedSet
      ? options.bookmarkedSet.has(post.id)
      : false;

    let quotedPostData: QuotedPostResponseDto | null = null;
    let isQuotedPostDeleted = false;

    if (post.quotedPostId) {
      if (
        !post.quotedPost ||
        post.quotedPost.isDeleted ||
        post.quotedPost.visibility !== "PUBLIC"
      ) {
        isQuotedPostDeleted = true;
      } else if (
        !post.quotedPost.author ||
        !post.quotedPost.author.isActive ||
        !post.quotedPost.author.isEmailVerified
      ) {
        isQuotedPostDeleted = true;
      } else {
        quotedPostData = {
          id: post.quotedPost.id,
          content: post.quotedPost.content,
          createdAt: post.quotedPost.createdAt,
          author: {
            id: post.quotedPost.author.id,
            username: post.quotedPost.author.username,
            displayName: post.quotedPost.author.displayName,
            avatarUrl: post.quotedPost.author.avatarUrl,
            bio: post.quotedPost.author.bio,
          },
          media: (post.quotedPost.media || [])
            .sort((a: any, b: any) => a.order - b.order)
            .map((m: any) => ({
              id: m.id,
              publicId: m.publicId,
              url: m.url,
              type: m.type,
              width: m.width ?? null,
              height: m.height ?? null,
              duration: m.duration ?? null,
              order: m.order,
            })),
        };
      }
    }

    const result: ActivePostResponseDto = {
      id: post.id,
      content: post.content,
      visibility: post.visibility,
      parentId: post.parentId,
      rootId: post.rootId,
      repostOfId: post.repostOfId,
      repostOf:
        post.repostOfId &&
        post.repostOf &&
        !post.repostOf.isDeleted &&
        post.repostOf.visibility === "PUBLIC"
          ? PostResponseMapper.fromEntity(post.repostOf)
          : null,
      quotedPostId: post.quotedPostId ?? null,
      quotedPost: quotedPostData,
      isQuotedPostDeleted,
      isDeleted: false,
      editedAt: post.editedAt ?? null,
      createdAt: post.createdAt,
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
        bio: post.author.bio,
      },
      media: (post.media || [])
        .sort((a: any, b: any) => a.order - b.order)
        .map((m: any) => ({
          id: m.id,
          publicId: m.publicId,
          url: m.url,
          type: m.type,
          width: m.width ?? null,
          height: m.height ?? null,
          duration: m.duration ?? null,
          order: m.order,
        })),
      counters: {
        likeCount: post.likeCount ?? 0,
        replyCount: post.replyCount ?? 0,
        repostCount: post.repostCount ?? 0,
        quoteCount: post.quoteCount ?? 0,
        bookmarkCount: post.bookmarkCount ?? 0,
      },
      interactions: {
        isLiked,
        isReposted,
        isBookmarked,
      },
    };

    if (post.parent) {
      result.parent = {
        id: post.parent.id,
        content: post.parent.isDeleted ? null : post.parent.content,
        isDeleted: post.parent.isDeleted,
        authorId: post.parent.authorId,
        createdAt: post.parent.createdAt,
      };
    }

    return result;
  }
}
