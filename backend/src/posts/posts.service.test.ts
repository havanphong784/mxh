import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { PostsService } from './posts.service.js';

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
    const service = new PostsService(prisma as any, {} as any, {} as any);

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
    const service = new PostsService(prisma as any, {} as any, {} as any);

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
    const service = new PostsService({ client } as any, {} as any, {} as any);

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
