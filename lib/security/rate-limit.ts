import Redis from "ioredis";

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();
let redisClient: Redis | null | undefined;

function getRedis() {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  redisClient = url ? new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, enableOfflineQueue: false }) : null;
  return redisClient;
}

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    memoryBuckets.set(key, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt, backend: "memory" as const };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt, backend: "memory" as const };
}

export async function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const redis = getRedis();
  if (!redis) return memoryRateLimit(key, limit, windowMs);
  try {
    if (redis.status === "wait") await redis.connect();
    const bucketKey = `h2obook:rate:${key}`;
    const count = await redis.incr(bucketKey);
    if (count === 1) await redis.pexpire(bucketKey, windowMs);
    const ttl = await redis.pttl(bucketKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + Math.max(ttl, 0),
      backend: "redis" as const
    };
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}

export function requestIdentity(request: Request, scope: string) {
  const trustedProxy = process.env.TRUST_PROXY === "true";
  const forwarded = trustedProxy ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  const realIp = trustedProxy ? request.headers.get("x-real-ip") : undefined;
  const requestId = request.headers.get("x-request-id") ?? "anonymous";
  return `${scope}:${forwarded ?? realIp ?? requestId}`;
}
