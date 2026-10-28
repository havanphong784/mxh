import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as crypto from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Temporal } from '@js-temporal/polyfill';
import { PostsService } from './posts.service.js';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';

function mockConfigService(overrides: Partial<EnvironmentVariables> = {}): ConfigService<EnvironmentVariables, true> {
  const env: Partial<EnvironmentVariables> = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    ...overrides,
  };
  return {
    get(key: string, _opts?: any) { return (env as any)[key]; },
    getOrThrow(key: string, _opts?: any) {
      const v = (env as any)[key];
      if (v === undefined) throw new Error(`Missing ${key}`);
      return v;
    },
  } as any;
}

const activeAuthor = (id: string) => ({
    id,
    username: id,
    displayName: id,
    avatarUrl: null,
    bio: null,
    isActive: true,
    isEmailVerified: true,
});

const postFixture = (overrides: Record<string, unknown>) => ({
    id: 'reply-id',
    authorId: 'reply-author',
    author: activeAuthor('reply-author'),
    content: 'reply',
    visibility: 'FOLLOWERS',
    parentId: 'root-id',
    rootId: 'root-id',
    repostOfId: null,
    quotedPostId: null,
    quotedPost: null,
    isDeleted: false,
    editedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    media: [],
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    quoteCount: 0,
    bookmarkCount: 0,
    ...overrides,
});

test('a follower of the reply author cannot read a reply in another author\'s followers-only thread', async () => {
    const root = postFixture({
        id: 'root-id',
        authorId: 'root-author',
        author: activeAuthor('root-author'),
        parentId: null,
        rootId: null,
    });
    const reply = postFixture({});
    const followedAuthorIds = new Set(['reply-author']);
    const followFilters: Record<string, string> = {};

    const followQuery: any = {
        where(callback: (fields: any) => unknown) {
            callback({
                followerId: { eq: (value: string) => (followFilters.followerId = value) },
                followingId: { eq: (value: string) => (followFilters.followingId = value) },
            });
            return this;
        },
        async first() {
            return followFilters.followerId === 'viewer-id'
                && followedAuthorIds.has(followFilters.followingId)
                ? { followerId: 'viewer-id', followingId: followFilters.followingId }
                : null;
        },
    };
    const postQuery: any = {
        include() { return this; },
        async first() { return root; },
    };
    const prisma = {
        client: {
            orm: {
                public: {
                    Post: { where: () => postQuery },
                    Follow: followQuery,
                },
            },
        },
    };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    assert.equal(await service.canView(reply, 'viewer-id'), false);
});

test('a reply author cannot override the root thread visibility', async () => {
    const reply = postFixture({});
    const postQuery: any = {
        include() { return this; },
        async first() { return reply; },
        async update() { return reply; },
    };
    const userQuery: any = {
        where() { return this; },
        async first() { return activeAuthor('reply-author'); },
    };
    const prisma = {
        client: {
            orm: {
                public: {
                    User: userQuery,
                    Post: { where: () => postQuery },
                },
            },
        },
    };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    await assert.rejects(
        service.updatePost('reply-id', 'reply-author', { visibility: 'PUBLIC' }),
        BadRequestException,
    );
});

test('changing root visibility propagates to every reply in the thread', async () => {
    const rows = [
        postFixture({
            id: 'root-id',
            authorId: 'root-author',
            author: activeAuthor('root-author'),
            parentId: null,
            rootId: null,
            visibility: 'PUBLIC',
        }),
        postFixture({ id: 'direct-reply', parentId: 'root-id', rootId: 'root-id', visibility: 'PUBLIC' }),
        postFixture({ id: 'nested-reply', parentId: 'direct-reply', rootId: 'root-id', visibility: 'PUBLIC' }),
    ];

    const postTable = {
        where(condition: { id: string } | ((fields: any) => unknown)) {
            let matches: (row: any) => boolean;
            if (typeof condition === 'function') {
                let rootId: string | undefined;
                condition({ rootId: { eq: (value: string) => (rootId = value) } });
                matches = (row) => row.rootId === rootId;
            } else {
                matches = (row) => row.id === condition.id;
            }

            const query: any = {
                include() { return query; },
                async first() { return rows.find(matches) ?? null; },
                async update(payload: Record<string, unknown>) {
                    rows.filter(matches).forEach((row) => Object.assign(row, payload));
                },
            };
            return query;
        },
    };
    const userQuery: any = {
        where() { return this; },
        async first() { return activeAuthor('root-author'); },
    };
    const client: any = {
        orm: { public: { User: userQuery, Post: postTable } },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({ orm: client.orm });
        },
    };
    const service = new PostsService({ client } as any, {} as any, {} as any, mockConfigService());

    await service.updatePost('root-id', 'root-author', { visibility: 'PRIVATE' });

    assert.deepEqual(
        rows.map((row) => ({ id: row.id, visibility: row.visibility })),
        [
            { id: 'root-id', visibility: 'PRIVATE' },
            { id: 'direct-reply', visibility: 'PRIVATE' },
            { id: 'nested-reply', visibility: 'PRIVATE' },
        ],
    );
});

test('a deleted followers-only root still protects its replies', async () => {
    const root = postFixture({
        id: 'root-id',
        authorId: 'root-author',
        author: activeAuthor('root-author'),
        content: null,
        parentId: null,
        rootId: null,
        isDeleted: true,
    });
    const reply = postFixture({ id: 'reply-id', parentId: 'root-id', rootId: 'root-id' });
    const postTable = {
        where(condition: { id: string } | ((fields: any) => unknown)) {
            const query: any = {
                include() { return query; },
                orderBy() { return query; },
                limit() { return query; },
                async first() {
                    return typeof condition === 'object' && condition.id === 'root-id' ? root : null;
                },
                async all() { return [reply]; },
            };
            return query;
        },
    };
    const prisma = { client: { orm: { public: { Post: postTable } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    await assert.rejects(
        service.getReplies('root-id', { limit: 20 }, undefined),
        ForbiddenException,
    );
});

test('a deleted followers-only root still protects the ancestor chain', async () => {
    const root = postFixture({
        id: 'root-id',
        authorId: 'root-author',
        author: activeAuthor('root-author'),
        content: null,
        parentId: null,
        rootId: null,
        isDeleted: true,
    });
    const reply = postFixture({ id: 'reply-id', parentId: 'root-id', rootId: 'root-id' });
    const postTable = {
        where(condition: { id: string }) {
            const query: any = {
                include() { return query; },
                async first() {
                    if (condition.id === 'reply-id') return reply;
                    if (condition.id === 'root-id') return root;
                    return null;
                },
            };
            return query;
        },
    };
    const prisma = { client: { orm: { public: { Post: postTable } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    await assert.rejects(
        service.getAncestors('reply-id', undefined),
        ForbiddenException,
    );
});

test('a quote stops exposing the original post after it becomes private', () => {
    const quotedPost = postFixture({
        id: 'quoted-id',
        authorId: 'quoted-author',
        author: activeAuthor('quoted-author'),
        content: 'private content',
        visibility: 'PRIVATE',
        parentId: null,
        rootId: null,
    });
    const quote = postFixture({
        id: 'quote-id',
        visibility: 'PUBLIC',
        quotedPostId: 'quoted-id',
        quotedPost,
        parentId: null,
        rootId: null,
    });
    const service = new PostsService({} as any, {} as any, {} as any, mockConfigService());

    const response = service.toPostResponse(quote);

    assert.equal(response.quotedPost, null);
    assert.equal(response.isQuotedPostDeleted, true);
});

test('a deleted reply keeps its reply count so descendants can be opened', () => {
    const deletedReply = postFixture({ id: 'deleted-reply', isDeleted: true, replyCount: 2 });
    const service = new PostsService({} as any, {} as any, {} as any, mockConfigService());

    assert.deepEqual(service.toPostResponse(deletedReply), {
        id: 'deleted-reply',
        isDeleted: true,
        createdAt: deletedReply.createdAt,
        replyCount: 2,
    });
});

test('a pure repost response embeds the original public post', () => {
    const original = postFixture({
        id: 'original-id',
        authorId: 'original-author',
        author: activeAuthor('original-author'),
        content: 'original content',
        visibility: 'PUBLIC',
        parentId: null,
        rootId: null,
        media: [{
            id: 'media-id',
            publicId: 'mxh/original-author/posts/media-id',
            url: 'https://example.com/media.jpg',
            type: 'IMAGE',
            width: 100,
            height: 100,
            duration: null,
            order: 0,
        }],
    });
    const repost = postFixture({
        id: 'repost-id',
        authorId: 'reposter-id',
        author: activeAuthor('reposter-id'),
        content: null,
        visibility: 'PUBLIC',
        parentId: null,
        rootId: null,
        repostOfId: original.id,
        repostOf: original,
    });
    const service = new PostsService({} as any, {} as any, {} as any, mockConfigService());

    const response = service.toPostResponse(repost);

    assert.equal(response.repostOf?.id, 'original-id');
    assert.equal(response.repostOf?.content, 'original content');
    assert.equal(response.repostOf?.author.username, 'original-author');
    assert.deepEqual(response.repostOf?.media, [{
        id: 'media-id',
        publicId: 'mxh/original-author/posts/media-id',
        url: 'https://example.com/media.jpg',
        type: 'IMAGE',
        width: 100,
        height: 100,
        duration: null,
        order: 0,
    }]);
});

test('updating a pure repost reloads the embedded original post', async () => {
    let updatePayload: Record<string, unknown> | undefined;
    const original = postFixture({
        id: 'original-id',
        authorId: 'original-author',
        author: activeAuthor('original-author'),
        content: 'original content',
        visibility: 'PUBLIC',
        parentId: null,
        rootId: null,
    });
    const repost = postFixture({
        id: 'repost-id',
        authorId: 'reposter-id',
        author: activeAuthor('reposter-id'),
        content: null,
        visibility: 'PUBLIC',
        parentId: null,
        rootId: null,
        repostOfId: original.id,
        repostOf: undefined,
    });
    const postTable = {
        where() {
            let includeRepost = false;
            const relationQuery: any = {
                include() { return relationQuery; },
            };
            const query: any = {
                include(name: string, refine?: (relation: any) => unknown) {
                    if (name === 'repostOf') {
                        includeRepost = true;
                        refine?.(relationQuery);
                    }
                    return query;
                },
                async first() {
                    return {
                        ...repost,
                        repostOf: includeRepost ? original : undefined,
                    };
                },
                async update(payload: Record<string, unknown>) {
                    updatePayload = payload;
                    Object.assign(repost, payload);
                },
            };
            return query;
        },
    };
    const userTable = {
        where() { return this; },
        async first() { return activeAuthor('reposter-id'); },
    };
    const client: any = {
        orm: { public: { User: userTable, Post: postTable } },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({ orm: client.orm });
        },
    };
    const service = new PostsService({ client } as any, {} as any, {} as any, mockConfigService());

    const response = await service.updatePost('repost-id', 'reposter-id', {});

    assert.equal(response.repostOf?.id, 'original-id');
    assert.ok(updatePayload?.editedAt instanceof Temporal.Instant);
});

test('bookmarks no longer return a followers-only post after the user unfollows its author', async () => {
    const viewer = activeAuthor('viewer-id');
    const restrictedPost = postFixture({
        id: 'restricted-id',
        authorId: 'root-author',
        author: activeAuthor('root-author'),
        parentId: null,
        rootId: null,
    });
    let postQueryCount = 0;
    let requestedBookmarkLimit = 0;
    const prisma = {
        client: {
            orm: {
                public: {
                    User: {
                        where() { return this; },
                        async first() { return viewer; },
                    },
                    PostBookmark: {
                        where() {
                            const query: any = {
                                orderBy() { return query; },
                                offset() { return query; },
                                limit(value: number) { requestedBookmarkLimit = value; return query; },
                                async all() { return [{ userId: 'viewer-id', postId: 'restricted-id' }]; },
                                async aggregate() { return { total: 1 }; },
                            };
                            return query;
                        },
                    },
                    Post: {
                        where() {
                            postQueryCount += 1;
                            const query: any = {
                                where() { return query; },
                                include() { return query; },
                                async all() { return postQueryCount === 1 ? [restrictedPost] : []; },
                            };
                            return query;
                        },
                    },
                    PostLike: {
                        where() {
                            const query: any = { where() { return query; }, async all() { return []; } };
                            return query;
                        },
                    },
                    Follow: {
                        where() {
                            const query: any = { where() { return query; }, async first() { return null; } };
                            return query;
                        },
                    },
                },
            },
        },
    };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    const response = await service.getBookmarks('viewer-id', { limit: 20 });

    assert.deepEqual(response.items, []);
    assert.equal(response.nextCursor, null);
    assert.ok(requestedBookmarkLimit > 0 && requestedBookmarkLimit <= 100);
});

test('bookmark pages skip inaccessible posts without losing later accessible posts', async () => {
    const bookmarks = [
        { userId: 'viewer', postId: 'first', createdAt: Temporal.Instant.from('2026-01-03T00:00:00Z') },
        { userId: 'viewer', postId: 'hidden', createdAt: Temporal.Instant.from('2026-01-02T00:00:00Z') },
        { userId: 'viewer', postId: 'last', createdAt: Temporal.Instant.from('2026-01-01T00:00:00Z') },
    ];
    const posts = [
        postFixture({ id: 'first', parentId: null, rootId: null, visibility: 'PUBLIC' }),
        postFixture({ id: 'hidden', parentId: null, rootId: null, visibility: 'PRIVATE' }),
        postFixture({ id: 'last', parentId: null, rootId: null, visibility: 'PUBLIC' }),
    ];
    const requestedLimits: number[] = [];
    const bookmarkTable = {
        where() {
            let cursor: { createdAt: Temporal.Instant; postId: string } | null = null;
            let limit = Infinity;
            const query: any = {
                where() { return query; },
                orderBy() { return query; },
                cursor(value: typeof cursor) { cursor = value; return query; },
                limit(value: number) { limit = value; requestedLimits.push(value); return query; },
                async all() {
                    const available = cursor
                        ? bookmarks.filter((item) => item.createdAt.epochMilliseconds < cursor!.createdAt.epochMilliseconds)
                        : bookmarks;
                    return available.slice(0, limit);
                },
            };
            return query;
        },
    };
    const postTable = {
        where() {
            const query: any = {
                where() { return query; },
                include() { return query; },
                async all() { return posts; },
            };
            return query;
        },
    };
    const prisma = { client: { orm: { public: {
        User: { where() { return { async first() { return activeAuthor('viewer'); } }; } },
        PostBookmark: bookmarkTable,
        Post: postTable,
        PostLike: { where() { return { where() { return this; }, async all() { return []; } }; } },
    } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    const firstPage = await service.getBookmarks('viewer', { limit: 1 });
    const secondPage = await service.getBookmarks('viewer', { limit: 1, cursor: firstPage.nextCursor! });

    assert.deepEqual(firstPage.items.map((item: any) => item.id), ['first']);
    assert.ok(firstPage.nextCursor);
    assert.deepEqual(secondPage.items.map((item: any) => item.id), ['last']);
    assert.equal(secondPage.nextCursor, null);
    assert.ok(requestedLimits.every((value) => value <= 100));
});

test('liked posts return viewable posts with active like state', async () => {
    const likedPost = postFixture({ id: 'liked-post', parentId: null, rootId: null, visibility: 'PUBLIC' });
    const marker = { userId: 'viewer', postId: 'liked-post', createdAt: Temporal.Instant.from('2026-01-02T00:00:00Z') };
    const likeTable = {
        where() {
            const query: any = {
                where() { return query; },
                orderBy() { return query; },
                limit() { return query; },
                async all() { return [marker]; },
            };
            return query;
        },
    };
    const postTable = { where() { const query: any = { where() { return query; }, include() { return query; }, async all() { return [likedPost]; } }; return query; } };
    const prisma = { client: { orm: { public: {
        User: { where() { return { async first() { return activeAuthor('viewer'); } }; } },
        PostLike: likeTable,
        PostBookmark: { where() { return { where() { return this; }, async all() { return []; } }; } },
        Post: postTable,
    } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    const response = await service.getLikedPosts('viewer', { limit: 20 });
    assert.deepEqual(response.items.map((item: any) => item.id), ['liked-post']);
    assert.equal(response.items[0].interactions.isLiked, true);
    assert.equal(response.items[0].interactions.isBookmarked, false);
    assert.equal(response.nextCursor, null);
});

test('bookmarks bound scanning when many saved posts are inaccessible', async () => {
    const bookmarks = Array.from({ length: 61 }, (_, index) => ({
        userId: 'viewer',
        postId: `post-${index}`,
        createdAt: Temporal.Instant.fromEpochMilliseconds(61 - index),
    }));
    const posts = bookmarks.map((bookmark, index) => postFixture({
        id: bookmark.postId,
        authorId: 'another-user',
        author: activeAuthor('another-user'),
        parentId: null,
        rootId: null,
        visibility: index === 60 ? 'PUBLIC' : 'PRIVATE',
    }));
    let reads = 0;
    const bookmarkTable = {
        where() {
            let cursor: { createdAt: Temporal.Instant } | null = null;
            let limit = 0;
            const query: any = {
                orderBy() { return query; },
                cursor(value: typeof cursor) { cursor = value; return query; },
                limit(value: number) { limit = value; return query; },
                async all() {
                    reads += 1;
                    const remaining = cursor
                        ? bookmarks.filter((bookmark) => bookmark.createdAt.epochMilliseconds < cursor!.createdAt.epochMilliseconds)
                        : bookmarks;
                    return remaining.slice(0, limit);
                },
            };
            return query;
        },
    };
    const postTable = { where() { const query: any = { where() { return query; }, include() { return query; }, async all() { return posts; } }; return query; } };
    const prisma = { client: { orm: { public: {
        User: { where() { return { async first() { return activeAuthor('viewer'); } }; } },
        PostBookmark: bookmarkTable,
        Post: postTable,
        PostLike: { where() { return { where() { return this; }, async all() { return []; } }; } },
    } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    const firstPage = await service.getBookmarks('viewer', { limit: 1 });
    assert.equal(reads, 3);
    assert.deepEqual(firstPage.items, []);
    assert.ok(firstPage.nextCursor);

    const secondPage = await service.getBookmarks('viewer', { limit: 1, cursor: firstPage.nextCursor! });
    assert.deepEqual(secondPage.items.map((item: any) => item.id), ['post-60']);
    assert.equal(secondPage.nextCursor, null);
});

test('searching media posts keeps public root filtering and escapes the search term', async () => {
    const filters: string[] = [];
    const fields: any = {
        visibility: { eq(value: string) { filters.push(`visibility:${value}`); return true; } },
        parentId: { isNull() { filters.push('root-only'); return true; } },
        isDeleted: { eq(value: boolean) { filters.push(`deleted:${value}`); return true; } },
        author: { some(callback: (value: any) => unknown) {
            callback({ isActive: { eq: () => true }, isEmailVerified: { eq: () => true } });
            return true;
        } },
        content: { ilike(value: string) { filters.push(`content:${value}`); return true; } },
        media: { some(callback: (value: any) => unknown) {
            callback({ type: { in(values: string[]) { filters.push(`media:${values.join(',')}`); return true; } } });
            return true;
        } },
        createdAt: { desc: () => true },
        id: { desc: () => true },
    };
    const postQuery: any = {
        where(callback: (value: any) => unknown) { callback(fields); return postQuery; },
        orderBy() { return postQuery; },
        limit() { return postQuery; },
        include() { return postQuery; },
        async all() { return []; },
    };
    const service = new PostsService({ client: { orm: { public: { Post: postQuery } } } } as any, {} as any, {} as any, mockConfigService());

    await service.getExplore({ limit: 20, mediaOnly: 'true' }, undefined, '100%');

    assert.ok(filters.includes('visibility:PUBLIC'));
    assert.ok(filters.includes('root-only'));
    assert.ok(filters.includes('deleted:false'));
    assert.ok(filters.includes('content:%100\\%%'));
    assert.ok(filters.includes('media:IMAGE,VIDEO'));
});

test('a text-only post cannot be edited into an empty post', async () => {
    const post = postFixture({ content: 'existing text', media: [] });
    const postQuery: any = {
        include() { return this; },
        async first() { return post; },
    };
    const userQuery: any = {
        where() { return this; },
        async first() { return activeAuthor('reply-author'); },
    };
    const client: any = {
        orm: { public: { User: userQuery, Post: { where: () => postQuery } } },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({ orm: client.orm });
        },
    };
    postQuery.update = async () => post;
    const prisma = { client };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());

    await assert.rejects(
        service.updatePost('reply-id', 'reply-author', { content: '   ' }),
        BadRequestException,
    );
});

test('an invalid post cursor is ignored instead of being sent to the database', async () => {
    let cursorWasApplied = false;
    const query: any = {
        where() { return query; },
        orderBy() { return query; },
        cursor() { cursorWasApplied = true; return query; },
        limit() { return query; },
        include() { return query; },
        async all() { return []; },
    };
    const prisma = { client: { orm: { public: { Post: query } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());
    const invalidCursor = Buffer.from(JSON.stringify({ createdAt: 'not-a-date', id: null })).toString('base64url');

    const response = await service.getExplore({ cursor: invalidCursor, limit: 20 });

    assert.equal(cursorWasApplied, false);
    assert.deepEqual(response, { items: [], nextCursor: null });
});

test('a valid post cursor uses a Temporal.Instant for Prisma pagination', async () => {
    let appliedCursor: any;
    const query: any = {
        where() { return query; },
        orderBy() { return query; },
        cursor(value: any) { appliedCursor = value; return query; },
        limit() { return query; },
        include() { return query; },
        async all() { return []; },
    };
    const prisma = { client: { orm: { public: { Post: query } } } };
    const service = new PostsService(prisma as any, {} as any, {} as any, mockConfigService());
    const createdAt = '2026-10-26T12:34:56.123456Z';
    const cursor = Buffer.from(JSON.stringify({ createdAt, id: 'post-1' })).toString('base64url');

    await service.getExplore({ cursor, limit: 20 });

    assert.ok(appliedCursor.createdAt instanceof Temporal.Instant);
    assert.equal(appliedCursor.createdAt.toString(), createdAt);
    assert.equal(appliedCursor.id, 'post-1');
});

test('concurrent likes are idempotent instead of returning a unique-constraint error', async () => {
    const state = { liked: false, likeCount: 0 };
    let reads = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    const post = postFixture({ id: 'post-id', visibility: 'PUBLIC', parentId: null, rootId: null });
    const postTable = {
        where() {
            const query: any = {
                async first() { return { ...post, likeCount: state.likeCount }; },
            };
            return query;
        },
    };
    const postLikeTable = {
        where() {
            const query: any = {
                where() { return query; },
                async first() {
                    reads += 1;
                    if (reads === 2) releaseReads();
                    await bothRead;
                    return null;
                },
            };
            return query;
        },
        async create() {
            if (state.liked) throw Object.assign(new Error('duplicate key'), { code: '23505' });
            state.liked = true;
        },
    };
    const raw = {
        sql(strings: TemplateStringsArray) {
            return { affectedCount: () => ({ build: () => ({ text: strings.join('?') }) }) };
        },
    };
    const client: any = {
        raw,
        orm: {
            public: {
                User: { where: () => ({ first: async () => activeAuthor('viewer-id') }) },
                Post: postTable,
                PostLike: postLikeTable,
            },
        },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({
                orm: client.orm,
                async execute() { state.likeCount += 1; return 1; },
            });
        },
    };
    const service = new PostsService({ client } as any, {} as any, { emit() {} } as any, mockConfigService());

    const results = await Promise.allSettled([
        service.likePost('post-id', 'viewer-id'),
        service.likePost('post-id', 'viewer-id'),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
    assert.deepEqual(state, { liked: true, likeCount: 1 });
});

test('concurrent unlikes decrement the counter only when a like row is deleted', async () => {
    const state = { liked: true, likeCount: 2 };
    let reads = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    const post = postFixture({ id: 'post-id', visibility: 'PUBLIC', parentId: null, rootId: null });
    const postTable = {
        where() {
            return { async first() { return { ...post, likeCount: state.likeCount }; } };
        },
    };
    const postLikeTable = {
        where() {
            const query: any = {
                where() { return query; },
                async first() {
                    reads += 1;
                    if (reads === 2) releaseReads();
                    await bothRead;
                    return { userId: 'viewer-id', postId: 'post-id' };
                },
                async delete() { state.liked = false; },
            };
            return query;
        },
    };
    const raw = {
        sql(strings: TemplateStringsArray) {
            return { affectedCount: () => ({ build: () => ({ text: strings.join('?') }) }) };
        },
    };
    const client: any = {
        raw,
        orm: {
            public: {
                User: { where: () => ({ first: async () => activeAuthor('viewer-id') }) },
                Post: postTable,
                PostLike: postLikeTable,
            },
        },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({
                orm: client.orm,
                async execute(plan: { text: string }) {
                    if (plan.text.includes('DELETE')) {
                        if (!state.liked) return { affectedRows: 0 };
                        state.liked = false;
                        return { affectedRows: 1 };
                    }
                    state.likeCount = Math.max(0, state.likeCount - 1);
                    return { affectedRows: 1 };
                },
            });
        },
    };
    const service = new PostsService({ client } as any, {} as any, {} as any, mockConfigService());

    await Promise.all([
        service.unlikePost('post-id', 'viewer-id'),
        service.unlikePost('post-id', 'viewer-id'),
    ]);

    assert.deepEqual(state, { liked: false, likeCount: 1 });
});

test('the same Cloudinary asset cannot be attached more than once', async () => {
    const publicId = 'mxh/user-id/posts/asset-id';
    const version = '123';
    const signature = crypto
        .createHash('sha1')
        .update(`public_id=${publicId}&version=${version}test-secret`)
        .digest('hex');
    const media = {
        publicId,
        version,
        signature,
        type: 'IMAGE' as const,
        order: 0,
    };
    const createdPost = postFixture({
        id: 'created-id',
        authorId: 'user-id',
        author: activeAuthor('user-id'),
        content: 'post',
        visibility: 'PUBLIC',
        parentId: null,
        rootId: null,
    });
    const postQuery: any = {
        include() { return this; },
        async first() { return createdPost; },
    };
    const client: any = {
        orm: {
            public: {
                User: { where: () => ({ first: async () => activeAuthor('user-id') }) },
                Post: { create: async () => createdPost, where: () => postQuery },
                PostMedia: { create: async () => ({}) },
            },
        },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({ orm: client.orm, execute: async () => 1 });
        },
    };
    const service = new PostsService({ client } as any, {} as any, { emit() {} } as any, mockConfigService());

    await assert.rejects(
        service.createPost('user-id', { content: 'post', media: [media, { ...media, order: 1 }] }),
        BadRequestException,
    );
});
