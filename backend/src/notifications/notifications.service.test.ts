import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationsService } from './notifications.service.js';

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
    const service = new NotificationsService(prisma as any, {} as any);
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
