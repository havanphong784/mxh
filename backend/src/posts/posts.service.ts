import {BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException} from '@nestjs/common';
import {CreatePostDto, PostMediaItemDto} from "./dto/create-post.dto.js";
import * as crypto from 'node:crypto';
import {PrismaService} from "../prisma/prisma.service.js";
import {UpdatePostDto} from "./dto/update-post.dto.js";
import {MediaService} from "../media/media.service.js";

@Injectable()
export class PostsService {
    private readonly logger = new Logger(PostsService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly mediaService: MediaService,
    ) {
    }

    async createPost(userId: string, dto: CreatePostDto) {
        const content = dto.content?.trim();
        const hasMedia = dto.media && dto.media.length > 0;
        if (!content && !hasMedia) {
            throw new BadRequestException('Bài viết phải có nội dung hoặc ít nhất một media item');
        }

        const verifiedMedia = hasMedia ? this.verifyMediaItems(userId, dto.media!) : [];
        return this.prismaService.client.transaction(async (tx) => {
            const post = await tx.orm.public.Post.create({
                authorId: userId,
                content,
                visibility: dto.visibility ?? 'PUBLIC',
            })

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
                })
            }

            const fullPost = await tx.orm.public.Post
                .where({ id: post.id })
                .include('author')
                .include('media')
                .first();

            return this.toPostResponse(fullPost);
        })
    }

    async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
        const post = await this.prismaService.client.orm.public.Post
            .where({ id: postId })
            .include('author')
            .first();

        if (!post || post.isDeleted) {
            throw new NotFoundException('Không tìm thấy bài viết');
        }

        if (post.authorId !== userId) {
            throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này');
        }

        const updatePayload: Record<string, any> = {
            editedAt: new Date(),
        };

        if (dto.content !== undefined) {
            const trimmed = dto.content.trim();
            updatePayload.content = trimmed || null;
        }

        if (dto.visibility !== undefined) {
            updatePayload.visibility = dto.visibility;
        }

        await this.prismaService.client.orm.public.Post
            .where({ id: postId })
            .update(updatePayload);

        const updated = await this.prismaService.client.orm.public.Post
            .where({ id: postId })
            .include('author')
            .include('media')
            .first();

        return this.toPostResponse(updated);
    }

    async deletePost(postId: string, userId: string) {
        const post = await this.prismaService.client.orm.public.Post
            .where({ id: postId })
            .include('media')
            .first();

        if (!post || post.isDeleted) {
            throw new NotFoundException('Không tìm thấy bài viết');
        }

        if (post.authorId !== userId) {
            throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
        }

        const publicIdsToDelete: string[] = (post.media || []).map((m: any) => m.publicId);

        await this.prismaService.client.transaction(async (tx) => {
            const repliesCountAgg = await tx.orm.public.Post
                .where((p) => p.parentId.eq(postId))
                .aggregate((agg) => ({ total: agg.count() }));
            const hasReplies = Number(repliesCountAgg.total) > 0;

            if (hasReplies) {
                await tx.orm.public.Post
                    .where({ id: postId })
                    .update({
                        isDeleted: true,
                        content: null,
                    });

                await tx.orm.public.PostMedia
                    .where((m) => m.postId.eq(postId))
                    .delete();

                await tx.orm.public.PostLike
                    .where((l) => l.postId.eq(postId))
                    .delete();
                await tx.orm.public.PostBookmark
                    .where((b) => b.postId.eq(postId))
                    .delete();

                await tx.orm.public.Post
                    .where((p) => p.repostOfId.eq(postId))
                    .delete();

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
            } else {
                await tx.orm.public.Post
                    .where({ id: postId })
                    .delete();

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

                if (post.parentId) {
                    const rawPlan = this.prismaService.client.raw.sql`
            UPDATE "post"
            SET "replyCount" = GREATEST(0, "replyCount" - 1)
            WHERE id = ${post.parentId}
          `
                        .affectedCount()
                        .build();
                    await tx.execute(rawPlan);
                }
            }
        });

        if (publicIdsToDelete.length > 0) {
            Promise.all(publicIdsToDelete.map((id) => this.mediaService.deleteFile(id)))
                .catch((err) => this.logger.error('Lỗi khi xóa media trên Cloudinary:', err));
        }

        return {
            message: 'Xóa bài viết thành công',
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
    ) {
        if (post.isDeleted) {
            return {
                id: post.id,
                isDeleted: true,
                createdAt: post.createdAt,
            };
        }

        const isLiked = options?.likedSet ? options.likedSet.has(post.id) : false;
        const isReposted = options?.repostedSet ? options.repostedSet.has(post.id) : false;
        const isBookmarked = options?.bookmarkedSet ? options.bookmarkedSet.has(post.id) : false;

        return {
            id: post.id,
            content: post.content,
            visibility: post.visibility,
            isDeleted: false,
            editedAt: post.editedAt,
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
                    width: m.width,
                    height: m.height,
                    duration: m.duration,
                    order: m.order,
                })),
            counters: {
                likeCount: post.likeCount,
                replyCount: post.replyCount,
                repostCount: post.repostCount,
                quoteCount: post.quoteCount,
                bookmarkCount: post.bookmarkCount,
            },
            interactions: {
                isLiked,
                isReposted,
                isBookmarked,
            },
        };
    }

    async canView(post: any, viewerId?: string): Promise<boolean> {
        if (!post.author?.isActive || !post.author?.isEmailVerified) {
            return false;
        }

        if (viewerId && viewerId === post.authorId) {
            return true;
        }

        if (post.visibility === 'PUBLIC') {
            return true;
        }

        if (post.visibility === 'PRIVATE') {
            return false;
        }

        if (post.visibility === 'FOLLOWERS') {
            if (!viewerId) return false;
            const follow = await this.prismaService.client.orm.public.Follow
                .where((f) => f.followerId.eq(viewerId))
                .where((f) => f.followingId.eq(post.authorId))
                .first();
            return !!follow;
        }

        return false;
    }

    async getPostById(postId: string, viewerId?: string) {
        const post = await this.prismaService.client.orm.public.Post
            .where({ id: postId })
            .include('author')
            .include('media')
            .first();

        if (!post) {
            throw new NotFoundException('Không tìm thấy bài viết');
        }

        if (post.isDeleted) {
            return {
                id: post.id,
                isDeleted: true,
                createdAt: post.createdAt,
            };
        }

        const allowed = await this.canView(post, viewerId);
        if (!allowed) {
            throw new ForbiddenException('Bạn không có quyền xem bài viết này');
        }

        let likedSet = new Set<string>();
        let repostedSet = new Set<string>();
        let bookmarkedSet = new Set<string>();

        if (viewerId) {
            const [like, repost, bookmark] = await Promise.all([
                this.prismaService.client.orm.public.PostLike
                    .where((l) => l.userId.eq(viewerId))
                    .where((l) => l.postId.eq(postId))
                    .first(),
                this.prismaService.client.orm.public.Post
                    .where((p) => p.authorId.eq(viewerId))
                    .where((p) => p.repostOfId.eq(postId))
                    .where((p) => p.isDeleted.eq(false))
                    .first(),
                this.prismaService.client.orm.public.PostBookmark
                    .where((b) => b.userId.eq(viewerId))
                    .where((b) => b.postId.eq(postId))
                    .first(),
            ]);

            if (like) likedSet.add(postId);
            if (repost) repostedSet.add(postId);
            if (bookmark) bookmarkedSet.add(postId);
        }

        return this.toPostResponse(post, { likedSet, repostedSet, bookmarkedSet });
    }

    private verifyMediaItems(userId: string, mediaItems: PostMediaItemDto[]) {
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (!apiSecret || !cloudName) {
            throw new Error('Chưa cấu hình Cloudinary environment variables');
        }
        const expectedPrefix = `mxh/${userId}/posts/`;

        return mediaItems.map((item) => {
            if (!item.publicId.startsWith(expectedPrefix)) {
                throw new BadRequestException(
                    `Media ${item.publicId} không hợp lệ hoặc không thuộc quyền sở hữu của bạn`,
                );
            }
            const signaturePayload = `public_id=${item.publicId}&version=${item.version}${apiSecret}`;
            const expectedSignature = crypto
                .createHash('sha1')
                .update(signaturePayload)
                .digest('hex');
            if (item.signature !== expectedSignature) {
                throw new BadRequestException(`Chữ ký media ${item.publicId} không hợp lệ`);
            }
            const resourceType = item.type === 'IMAGE' ? 'image' : 'video';
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
}
