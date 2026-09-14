const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 30;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function pruneExpired(now: number) {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

function getEntry(key: string, windowMs: number): RateLimitEntry {
  const now = Date.now();
  pruneExpired(now);

  const current = store.get(key);
  if (!current || now >= current.resetAt) {
    const next = { count: 0, resetAt: now + windowMs };
    store.set(key, next);
    return next;
  }

  return current;
}

export function peekRateLimited(
  key: string,
  max = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): boolean {
  return getEntry(key, windowMs).count >= max;
}

export function isRateLimited(
  key: string,
  max = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): boolean {
  const entry = getEntry(key, windowMs);
  if (entry.count >= max) {
    return true;
  }

  entry.count += 1;
  return false;
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
