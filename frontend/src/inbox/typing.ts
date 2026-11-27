type Options = {
  conversationId: string;
  userId: string;
  peerId?: string;
  emit: (conversationId: string, isTyping: boolean) => void;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => () => void;
  onChange: (isTyping: boolean) => void;
};

export function createTypingController({
  conversationId,
  userId,
  peerId,
  emit,
  now = Date.now,
  schedule = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    return () => clearTimeout(timer);
  },
  onChange,
}: Options) {
  const streams = new Map<string, number>();
  let cancelTimer: (() => void) | undefined;
  let lastSent: number | undefined;
  let outgoing = false;
  let visible = false;
  let disposed = false;

  function update() {
    cancelTimer?.();
    cancelTimer = undefined;
    const time = now();
    for (const [id, expiry] of streams) if (expiry <= time) streams.delete(id);
    const next = streams.size > 0;
    if (visible !== next) {
      visible = next;
      onChange(next);
    }
    if (next) cancelTimer = schedule(update, Math.max(0, Math.min(...streams.values()) - time));
  }
  function stop() {
    if (disposed) return;
    if (outgoing) emit(conversationId, false);
    outgoing = false;
    lastSent = undefined;
  }
  function disconnected() {
    outgoing = false;
    lastSent = undefined;
    streams.clear();
    update();
  }
  return {
    changed(text: string) {
      if (disposed) return;
      if (!text.trim()) {
        stop();
        return;
      }
      const time = now();
      if (lastSent !== undefined && time - lastSent < 2000) return;
      lastSent = time;
      outgoing = true;
      emit(conversationId, true);
    },
    stop,
    receive(input: unknown) {
      if (disposed || !input || typeof input !== "object") return;
      const value = input as Record<string, unknown>;
      if (
        value.conversationId !== conversationId ||
        typeof value.userId !== "string" ||
        !value.userId ||
        value.userId === userId ||
        (peerId !== undefined && value.userId !== peerId) ||
        typeof value.streamId !== "string" ||
        !value.streamId ||
        value.streamId.length > 128 ||
        typeof value.isTyping !== "boolean"
      )
        return;
      if (value.isTyping) streams.set(value.streamId, now() + 4000);
      else streams.delete(value.streamId);
      update();
    },
    disconnected,
    dispose() {
      if (disposed) return;
      stop();
      disconnected();
      disposed = true;
    },
  };
}
