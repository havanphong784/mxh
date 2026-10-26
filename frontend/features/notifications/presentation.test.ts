import assert from 'node:assert/strict';
import test from 'node:test';

import type { NotificationItem, NotificationType } from '../../types/api.ts';
import { getNotificationPresentation } from './presentation.ts';

for (const [type, text] of Object.entries({ LIKE: 'đã thích bài viết của bạn', REPLY: 'đã trả lời bài viết của bạn', REPOST: 'đã đăng lại bài viết của bạn', QUOTE: 'đã trích dẫn bài viết của bạn', FOLLOW: 'đã theo dõi bạn' })) {
  test(`maps ${type} to its Vietnamese action and destination`, () => {
    const item = { type: type as NotificationType, actor: { username: 'an' }, post: type === 'FOLLOW' ? null : { id: 'p1' } } as NotificationItem;
    const result = getNotificationPresentation(item);
    assert.equal(result.action, text);
    assert.equal(result.href, type === 'FOLLOW' ? '/an' : '/post/p1');
  });
}
