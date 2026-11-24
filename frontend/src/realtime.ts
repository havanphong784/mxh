type RecoverableSocket = {
  active: boolean;
  connected: boolean;
  connect: () => unknown;
};
type Schedule = (callback: () => void, delay: number) => () => void;
const scheduleRetry: Schedule = (callback, delay) => {
  const timer = setTimeout(callback, delay);
  return () => clearTimeout(timer);
};

export function createSocketRecovery(
  socket: RecoverableSocket,
  refresh: () => Promise<string | null>,
  schedule: Schedule = scheduleRetry,
) {
  let disposed = false;
  let pending = false;
  let failures = 0;
  let cancelRetry: (() => void) | undefined;

  async function recover() {
    if (disposed || pending || cancelRetry || socket.active || socket.connected) return;
    pending = true;
    try {
      const token = await refresh();
      if (!disposed && token && !socket.connected && !socket.active) {
        failures = 0;
        socket.connect();
      }
    } catch {
      if (!disposed) {
        const delay = Math.min(1000 * 2 ** Math.min(failures++, 5), 30000);
        cancelRetry = schedule(() => {
          cancelRetry = undefined;
          void recover();
        }, delay);
      }
    } finally {
      pending = false;
    }
  }

  function connected() {
    failures = 0;
    cancelRetry?.();
    cancelRetry = undefined;
  }
  return {
    recover,
    connected,
    dispose() {
      disposed = true;
      connected();
    },
  };
}
