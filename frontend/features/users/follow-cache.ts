import type { QueryClient } from "@tanstack/react-query";

export async function invalidateFollowDependentQueries(
  client: QueryClient,
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["users"] }),
    client.invalidateQueries({ queryKey: ["posts"] }),
  ]);
}
