import type { PostItem } from '@/types/api';
import { InteractivePostCard } from '@/features/posts/components/InteractivePostCard';

interface PostListProps {
  posts: PostItem[];
  currentUserId?: string | null;
  onLike: (id: string, active: boolean) => void;
  onRepost: (id: string, active: boolean) => void;
  onBookmark: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}

export function PostList({ posts, currentUserId, onLike, onRepost, onBookmark, onDelete }: PostListProps) {
  return <>{posts.map((post) => <InteractivePostCard key={post.id} post={post} currentUserId={currentUserId} onLike={onLike} onRepost={onRepost} onBookmark={onBookmark} onDelete={onDelete} />)}</>;
}
