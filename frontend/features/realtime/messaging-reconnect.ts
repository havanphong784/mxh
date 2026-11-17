import type { QueryClient } from "@tanstack/react-query";

interface ReconcileMessagingOptions {
  queryClient: Pick<QueryClient, "invalidateQueries">;
  getUnreadCount: () => Promise<number>;
  setUnreadCount: (count: number) => void;
  isCurrent: () => boolean;
}

export async function reconcileMessagingAfterReconnect({
  queryClient,
  getUnreadCount,
  setUnreadCount,
  isCurrent,
}: ReconcileMessagingOptions) {
  if (!isCurrent()) return;

  const unreadCountRequest = Promise.resolve()
    .then(getUnreadCount)
    .then((count) => {
      if (isCurrent()) setUnreadCount(count);
    })
    .catch(() => undefined);

  await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  await unreadCountRequest;
}
