// lib/rate-limit.ts
// 인메모리 Rate Limiter (소규모 MVP용)
// 프로덕션 스케일업 시 Redis(Upstash)로 교체 권장

const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number; // 시간 창 (ms)
  max: number;      // 최대 요청 수
}

export function rateLimit(ip: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  const key = ip;

  let record = store.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + opts.windowMs };
    store.set(key, record);
    return true; // 허용
  }

  record.count += 1;
  if (record.count > opts.max) return false; // 차단
  return true;
}

// 오래된 항목 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, val]) => {
    if (now > val.resetAt) store.delete(key);
  });
}, 60_000);
