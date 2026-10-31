import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Temporal } from '@js-temporal/polyfill';
import { NotificationsService } from './notifications.service.js';
import { NotificationsRepository } from './notifications.repository.js';

function createService(prisma: any, gateway: any) {
    return new NotificationsService(new NotificationsRepository(prisma), gateway);
}

test('an invalid notification cursor is ignored instead of being sent to the database', async () => {
    let cursorWasApplied = false;
    const query: any = {
        orderBy() { return query; },
        cursor() { cursorWasApplied = true; return query; },
        include() { return query; },
        limit() { return query; },
        async all() { return []; },
    };
    const prisma = {
        client: {
            orm: {
                public: {
                    Notification: { where: () => query },
                },
            },
        },
    };
    const service = createService(prisma, {});
    const invalidCursor = Buffer.from(
        JSON.stringify({ createdAt: 'not-a-date', id: null }),
    ).toString('base64');

    const response = await service.getNotifications('user-id', {
        cursor: invalidCursor,
        limit: 20,
    });

    assert.equal(cursorWasApplied, false);
    assert.deepEqual(response, { data: [], nextCursor: null, hasMore: false });
});

test('a valid notification cursor uses a Temporal.Instant for Prisma pagination', async () => {
    let appliedCursor: any;
    const query: any = {
        orderBy() { return query; },
        cursor(value: any) { appliedCursor = value; return query; },
        include() { return query; },
        limit() { return query; },
        async all() { return []; },
    };
    const prisma = { client: { orm: { public: { Notification: { where: () => query } } } } };
    const service = createService(prisma, {});
    const createdAt = '2026-10-26T12:34:56.123456Z';
    const cursor = Buffer.from(JSON.stringify({ createdAt, id: 'notification-1' })).toString('base64');

    await service.getNotifications('user-id', { cursor, limit: 20 });

    assert.ok(appliedCursor.createdAt instanceof Temporal.Instant);
    assert.equal(appliedCursor.createdAt.toString(), createdAt);
    assert.equal(appliedCursor.id, 'notification-1');
});

test('mark all as read returns the affected row count', async () => {
    const prisma = {
        client: {
            raw: { sql: () => ({ affectedCount: () => ({ build: () => ({}) }) }) },
            transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
                execute: async () => ({ affectedRows: 3 }),
            }),
        },
    };
    const gateway = { pushToUser() {} };
    const service = createService(prisma, gateway);

    assert.deepEqual(await service.markAllAsRead('user-id'), { success: true, count: 3 });
});

test('getNotifications maps actor and post through NotificationResponseMapper', async () => {
    const mockNotification = {
        id: 'notif-1',
        type: 'LIKE',
        isRead: false,
        createdAt: '2026-10-27T10:00:00.000Z',
        actor: {
            id: 'actor-1',
            username: 'alice',
            displayName: 'Alice',
            avatarUrl: 'https://example.com/avatar.jpg',
        },
        post: {
            id: 'post-1',
            content: 'Hello world long content that should be sliced to 100 characters max when returned as post preview in notification item dto.',
        },
    };

    const query: any = {
        orderBy() { return query; },
        include() { return query; },
        limit() { return query; },
        async all() { return [mockNotification]; },
    };
    const prisma = { client: { orm: { public: { Notification: { where: () => query } } } } };
    const service = createService(prisma, {});

    const result = await service.getNotifications('user-id', { limit: 20 });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].id, 'notif-1');
    assert.equal(result.data[0].actor?.username, 'alice');
    assert.equal(result.data[0].post?.id, 'post-1');
    assert.ok(result.data[0].post?.content && result.data[0].post.content.length <= 100);
});
