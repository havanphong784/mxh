import { postsApi } from '../api';
import { usePostList } from './usePostList';
import { usePostInteractions } from './usePostInteractions';

export function useFeed(enabled = true) {
  const query = usePostList(['feed'], postsApi.getFeed, enabled);
  const actions = usePostInteractions();
  return { ...query, ...actions };
}
