// One time limit for every market-price request. A price API that hangs
// must not hold a page: after this the request is aborted and the page
// uses the last good price (lib/prices/quotes.ts) with its age.
export const PRICE_TIMEOUT_MS = 2500;

export const withTimeout = (ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

/** Resolve with `fallback` if `promise` has not settled within `ms`. */
export function settleWithin<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise.catch(() => fallback), late]).finally(() => clearTimeout(timer));
}
