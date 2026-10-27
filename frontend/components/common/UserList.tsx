import { EmptyState } from '@/components/ui/EmptyState';
import type { Author } from '@/types/api';
import { UserRow } from './UserRow';

export function UserList({ users, emptyText }: { users: Author[]; emptyText: string }) {
  if (users.length === 0) return <EmptyState title={emptyText} description="Danh sách sẽ được cập nhật khi có hoạt động mới." />;
  return <div className="feed-stack">{users.map((user) => <UserRow key={user.id} user={user} />)}</div>;
}
