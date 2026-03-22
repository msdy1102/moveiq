# MoveIQ 배포 가이드

> 코딩 경험 없어도 따라할 수 있도록 단계별로 설명합니다.

---

## 전체 흐름

```
1. GitHub 저장소 생성
2. Supabase DB 세팅
3. API 키 발급 (Kakao, Anthropic)
4. Vercel 배포
5. 도메인 연결 (선택)
6. 배포 후 보안 점검
```

---

## STEP 1. GitHub 저장소 생성

1. [github.com](https://github.com) 로그인 → **New repository**
2. Repository name: `moveiq`
3. Private 선택 → **Create repository**
4. 로컬에서 업로드:

```bash
# 이 프로젝트 폴더에서 실행
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/[내 아이디]/moveiq.git
git push -u origin main
```

> ⚠️ `.env.local` 파일은 절대 push하지 마세요. `.gitignore`에 이미 포함되어 있습니다.

---

## STEP 2. Supabase DB 세팅

### 2-1. 프로젝트 생성

1. [supabase.com](https://supabase.com) → **New project**
2. Organization: 개인 계정
3. Project name: `moveiq`
4. Database Password: 강력한 비밀번호 (기억해두기)
5. Region: **Northeast Asia (Seoul)**
6. **Create new project** 클릭 → 약 2분 대기

### 2-2. 스키마 실행

1. 왼쪽 메뉴 → **SQL Editor**
2. `supabase/schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기 → **Run** (▶) 클릭
4. 오류 없이 실행되면 완료

### 2-3. API 키 복사

1. 왼쪽 메뉴 → **Project Settings** → **API**
2. 아래 두 값을 메모장에 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ 절대 공개 금지

---

## STEP 3. API 키 발급

### 3-1. Kakao Maps API

1. [developers.kakao.com](https://developers.kakao.com) → 로그인 → **내 애플리케이션** → **앱 추가하기**
2. 앱 이름: `MoveIQ`, 회사명 입력
3. 생성 후 **요약 정보** → **JavaScript 키** 복사 → `NEXT_PUBLIC_KAKAO_MAP_KEY`
4. **플랫폼** → **Web** → 사이트 도메인 추가:
   - `http://localhost:3000` (개발용)
   - `https://[내 Vercel 도메인].vercel.app` (배포 후 추가)

> 카카오 API는 무료 (하루 30만 건 한도)

### 3-2. Anthropic Claude API

1. [console.anthropic.com](https://console.anthropic.com) → 로그인
2. **API Keys** → **Create Key**
3. 키 이름: `moveiq-prod`, 생성 → 값 복사 → `CLAUDE_API_KEY`
4. **Usage Limits** → 월 예산 설정 (예: $20/월)
   - 예산 초과 시 Slack/이메일 알림 설정 권장

---

## STEP 4. Vercel 배포

### 4-1. Vercel 연결

1. [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. **New Project** → GitHub 저장소에서 `moveiq` 선택 → **Import**
3. Framework Preset: **Next.js** (자동 감지)

### 4-2. 환경변수 입력 (핵심)

**Settings → Environment Variables** 에서 아래 항목을 하나씩 추가합니다.

| 변수명 | 값 | 환경 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role | Production, Preview |
| `CLAUDE_API_KEY` | Anthropic API key | Production, Preview |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | Kakao JS key | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://[내도메인].vercel.app` | Production |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY`와 `CLAUDE_API_KEY`는 **Production/Preview만** 설정 (Development 제외)

### 4-3. 배포 실행

1. **Deploy** 클릭 → 약 2~3분 대기
2. 배포 완료 후 `https://moveiq-[해시].vercel.app` 주소 발급
3. 카카오 앱 설정에서 이 도메인을 허용 도메인에 추가

---

## STEP 5. 도메인 연결 (선택)

1. 가비아/카페24에서 도메인 구매 (예: `moveiq.co.kr`)
2. Vercel → **Settings → Domains** → 도메인 추가
3. 가비아 DNS 관리 → CNAME 레코드 추가:
   - 이름: `www`, 값: `cname.vercel-dns.com`
4. 카카오 앱 설정에 새 도메인 추가

---

## STEP 6. 배포 후 보안 점검

배포 완료 후 반드시 아래 항목을 확인하세요.

### 환경변수 노출 여부 확인

```bash
# 빌드 번들에 시크릿 키 없는지 확인
# Vercel 대시보드 → Functions → 소스 확인
# 또는 로컬에서:
npm run build
grep -r "sk-ant\|service_role\|TOSS" .next/static/ 2>/dev/null
# → 결과 없어야 정상
```

### 보안 헤더 확인

```bash
curl -I https://[내 도메인]
# X-Frame-Options: DENY ✓
# X-Content-Type-Options: nosniff ✓
# X-Powered-By 없음 ✓
```

### API Rate Limit 테스트

```bash
# 6번 연속 분석 요청 → 6번째는 429 반환되어야 함
for i in {1..6}; do
  curl -X POST https://[내도메인]/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"address":"마포구 성산동"}' -s | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','ok'))"
done
```

### Supabase RLS 확인

Supabase SQL Editor에서 실행:

```sql
-- anon 키로 payments 직접 INSERT 차단 확인
-- (service_role 없이는 실패해야 함)
SELECT * FROM payments LIMIT 1;
-- → 결과 없음 or 권한 오류 → 정상
```

---

## 개발 환경 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일 열어서 실제 값 입력

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000
```

---

## 자주 묻는 문제

### "분석이 안 돼요"
- Vercel 환경변수 `CLAUDE_API_KEY`가 올바르게 입력됐는지 확인
- Anthropic 계정에 크레딧이 있는지 확인 (처음에는 무료 크레딧 제공)

### "지도가 안 보여요"
- 카카오 앱 허용 도메인에 현재 접속 도메인이 등록됐는지 확인
- `NEXT_PUBLIC_KAKAO_MAP_KEY` 값이 올바른지 확인

### "제보가 저장이 안 돼요"
- Supabase에서 `schema.sql` 실행됐는지 확인
- `SUPABASE_SERVICE_ROLE_KEY`가 Vercel 환경변수에 있는지 확인

---

## 운영 비용 예상

| 항목 | 월 비용 |
|---|---|
| Vercel (Hobby 플랜) | 무료 |
| Supabase (Free 플랜, MAU 5만까지) | 무료 |
| Kakao Maps API | 무료 (월 30만 건 한도) |
| Claude API (분석 500건/월) | 약 $2 (3,000원) |
| **합계** | **약 3,000원/월** |

> MAU 5만 초과 시 Supabase Pro ($25/월), Vercel Pro ($20/월) 업그레이드 필요
