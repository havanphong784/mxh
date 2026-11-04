const pending = new Map<string, Promise<void>>();

export function queuePostInteraction<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = pending.get(key) ?? Promise.resolve();
  const result = previous.then(operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  pending.set(key, tail);
  void tail.then(() => {
    if (pending.get(key) === tail) pending.delete(key);
  });
  return result;
}
