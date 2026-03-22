# 🏙️ MoveIQ

> 소음 크라우드 지도 × AI 입지 분석 — 이사 결정에 필요한 모든 데이터를 한 화면에서

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 14, TypeScript, CSS Modules |
| AI 분석 | Anthropic Claude Sonnet (서버 전용) |
| DB | Supabase (PostgreSQL + RLS) |
| 지도 | Kakao Maps API |
| 배포 | Vercel |

## 프로젝트 구조

```
moveiq/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts        # Claude AI 입지 분석 (서버 전용)
│   │   ├── noise-reports/route.ts  # 소음 제보 저장/조회
│   │   └── payments/route.ts       # 토스페이먼츠 결제 승인
│   ├── page.tsx                    # 메인 페이지
│   ├── page.module.css
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── supabase.ts                 # Supabase 클라이언트 (anon/service_role 분리)
│   ├── rate-limit.ts               # IP Rate Limiting
│   └── error-handler.ts            # 안전한 에러 응답
├── supabase/
│   └── schema.sql                  # DB 테이블 + RLS 정책
├── .env.local.example              # 환경변수 템플릿
├── .gitignore
├── next.config.js                  # 보안 헤더 설정
├── DEPLOY.md                       # 배포 가이드
└── README.md
```

## 빠른 시작

```bash
npm install
cp .env.local.example .env.local
# .env.local 에 API 키 입력
npm run dev
```

자세한 배포 방법은 [DEPLOY.md](./DEPLOY.md) 참고.

## 보안

- Claude API, 결제 API는 서버 사이드에서만 호출
- Supabase RLS로 행 단위 접근 제어
- 소음 제보 위치 50m 랜덤화 (개인정보 보호)
- IP Rate Limiting (분석 10분/5회, 제보 10분/5건)
- 결제 금액 서버 재검증 (클라이언트 금액 미신뢰)
