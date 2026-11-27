export function createArrivalBarrier(
  expectedArrivals: number,
  timeoutMs?: number,
): () => Promise<void>;
