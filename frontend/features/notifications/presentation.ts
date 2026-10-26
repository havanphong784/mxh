import type { NotificationItem, NotificationType } from '../../types/api.ts';

const actions: Record<NotificationType, string> = {
  LIKE: 'đã thích bài viết của bạn',
  REPLY: 'đã trả lời bài viết của bạn',
  REPOST: 'đã đăng lại bài viết của bạn',
  QUOTE: 'đã trích dẫn bài viết của bạn',
  FOLLOW: 'đã theo dõi bạn',
};

export function getNotificationPresentation(item: NotificationItem) {
  return {
    action: actions[item.type],
    href: item.post ? `/post/${item.post.id}` : item.actor ? `/${item.actor.username}` : '/notifications',
  };
}
