// lib/rate-limit.ts
// 인메모리 Rate Limiter — 엔드포인트별 격리 키 지원
// 프로덕션 스케일업 시 Redis(Upstash)로 교체 권장

const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  windowMs: number; // 시간 창 (ms)
  max:      number; // 최대 요청 수
  key?:     string; // 엔드포인트 구분자 (없으면 IP만 사용)
}

/**
 * @returns true  = 허용
 * @returns false = 차단
 */
export function rateLimit(ip: string, opts: RateLimitOptions): boolean {
  const now      = Date.now();
  // 엔드포인트 + IP 조합으로 격리 — 다른 라우트 카운트 공유 방지
  const storeKey = opts.key ? `${opts.key}:${ip}` : ip;

  let record = store.get(storeKey);

  if (!record || now > record.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }

  record.count += 1;
  return record.count <= opts.max;
}

// 오래된 항목 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, val]) => {
    if (now > val.resetAt) store.delete(key);
  });
}, 60_000);
