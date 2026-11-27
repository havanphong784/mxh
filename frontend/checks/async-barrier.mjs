/** Hold each arrival until all expected peers arrive, or reject on timeout. */
export function createArrivalBarrier(expectedArrivals, timeoutMs = 7000) {
  let arrivals = 0;
  let timer;
  let release;
  let reject;
  const ready = new Promise((resolve, fail) => {
    release = resolve;
    reject = fail;
  });
  return () => {
    if (arrivals === 0)
      timer = setTimeout(
        () =>
          reject(new Error(`Arrival barrier timed out: ${arrivals}/${expectedArrivals} arrivals`)),
        timeoutMs,
      );
    arrivals++;
    if (arrivals === expectedArrivals) {
      clearTimeout(timer);
      release();
    }
    return ready;
  };
}
