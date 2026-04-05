// app/api/dong-search/route.ts — v2
// ─────────────────────────────────────────────────────────────
// 로컬 데이터 기반 동네 자동완성 (Naver API 의존 없음)
// 검색 우선순위:
//   1순위: 동 이름 시작 일치  (예: "성산" → 성산1동, 성산2동)
//   2순위: 동 이름 포함       (예: "산동" → 성산동, 죽산동...)
//   3순위: 구 이름 포함       (예: "마포" → 마포구 전체 동)
//   4순위: 시도 + 구 복합     (예: "서울 강남" → 강남구 전체)
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { KOREA_DONGS } from '@/lib/korea-dongs';

// 표시 라벨 생성: "구 동" 형태 (시도는 생략 — 동 이름만으로 충분)
function makeLabel(sido: string, gu: string, dong: string): string {
  // 세종은 구 없음
  if (gu === '세종') return dong;
  // 경기·강원 등 광역은 시군구 포함
  const needsGu = ['경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];
  if (needsGu.includes(sido)) return `${gu} ${dong}`;
  return `${gu} ${dong}`;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(ip, { windowMs: 60 * 1000, max: 60 })) {
    return NextResponse.json({ success: false, message: '요청이 너무 많습니다.' }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length < 1) return NextResponse.json({ success: true, results: [] });

  const MAX = 8;
  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  const nq = normalize(q);

  // 검색 버킷 (우선순위별)
  const exact:   typeof KOREA_DONGS = [];  // 동 이름 시작 일치
  const contains:typeof KOREA_DONGS = [];  // 동 이름 포함
  const guMatch: typeof KOREA_DONGS = [];  // 구/시 이름 포함
  const seen = new Set<string>();

  for (const entry of KOREA_DONGS) {
    const [sido, gu, dong] = entry;
    const ndong = normalize(dong);
    const ngu   = normalize(gu);
    const nsido = normalize(sido);
    const label = makeLabel(sido, gu, dong);
    const nlabel = normalize(label);

    if (seen.has(label)) continue;

    // 1. 동 이름 시작
    if (ndong.startsWith(nq)) {
      exact.push(entry); seen.add(label); continue;
    }
    // 2. 전체 라벨 포함 (구+동 같이 검색: "마포 성산")
    if (nlabel.includes(nq)) {
      contains.push(entry); seen.add(label); continue;
    }
    // 3. 동 이름 포함
    if (ndong.includes(nq)) {
      contains.push(entry); seen.add(label); continue;
    }
    // 4. 구/시 이름 포함
    if (ngu.includes(nq) || nsido.includes(nq)) {
      guMatch.push(entry); seen.add(label);
    }
  }

  // 버킷 순서로 최대 MAX개 반환
  const merged = [...exact, ...contains, ...guMatch].slice(0, MAX);

  const results = merged.map(([sido, gu, dong]) => ({
    label: makeLabel(sido, gu, dong),
    sido,
    gu,
    dong,
    // 좌표는 Naver 없이 제공 불가 — 클라이언트에서 입력값 기반 사용
    lat: 0,
    lng: 0,
  }));

  return NextResponse.json({ success: true, results });
}
