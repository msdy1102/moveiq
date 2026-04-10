import { Metadata } from 'next';
import { notFound }  from 'next/navigation';
import Link          from 'next/link';
import { KOREA_DONGS } from '@/lib/korea-dongs';

function parseSlug(slug: string): { sido: string; sigungu: string; dong: string } | null {
  try {
    const decoded = decodeURIComponent(slug);
    const parts   = decoded.split('-');
    if (parts.length < 3) return null;
    const sido    = parts[0];
    const sigungu = parts[1];
    const dong    = parts.slice(2).join('-');
    const exists  = KOREA_DONGS.some(([s, sg, d]) => s === sido && sg === sigungu && d === dong);
    if (!exists) return null;
    return { sido, sigungu, dong };
  } catch { return null; }
}

export async function generateStaticParams() {
  const PRIORITY_SIDO = ['서울', '부산', '인천', '대구', '광주', '대전', '울산'];
  return KOREA_DONGS
    .filter(([sido]) => PRIORITY_SIDO.includes(sido))
    .map(([sido, sigungu, dong]) => ({
      dong: encodeURIComponent(`${sido}-${sigungu}-${dong}`),
    }));
}

export const revalidate    = 604800;
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: { dong: string } }): Promise<Metadata> {
  const parsed = parseSlug(params.dong);
  if (!parsed) return { title: '동네를 찾을 수 없습니다 | 무브IQ' };
  const { sido, sigungu, dong } = parsed;
  const full  = `${sido} ${sigungu} ${dong}`;
  const short = `${sigungu} ${dong}`;
  const title       = `${short} 이사 괜찮을까? 소음·입지 분석 | 무브IQ`;
  const description = `${full} 이사 전 꼭 확인하세요. 층간소음 이력, 야간 유흥가 소음, 공사 현황, 학군·마트·병원 거리, 전세사기 위험도까지 AI가 3분 만에 분석합니다.`;
  return {
    title, description,
    keywords: [`${short} 이사`, `${short} 입지분석`, `${short} 소음`, `${short} 층간소음`, `${short} 학군`, `${sigungu} 이사`, '무브IQ'],
    openGraph: {
      title, description,
      url: `https://moveiq.vercel.app/analysis/${params.dong}`,
      type: 'website', locale: 'ko_KR', siteName: '무브IQ',
      images: [{ url: `https://moveiq.vercel.app/api/og?dong=${encodeURIComponent(full)}`, width: 1200, height: 630, alt: `${full} 입지 분석 | 무브IQ` }],
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `https://moveiq.vercel.app/analysis/${params.dong}` },
  };
}

const LAYERS = [
  { icon: '🔊', title: '층간소음 이력',   desc: '크라우드 소싱 소음 데이터 기반 소음 유형·시간대 분포' },
  { icon: '🏗️', title: '공사·개발 현황', desc: '주변 공사장, 재개발·재건축 구역, 완료 예정일' },
  { icon: '🚇', title: '교통 접근성',     desc: '지하철·버스 환승 거리, 강남까지 소요 시간' },
  { icon: '📚', title: '학군 환경',       desc: '배정 초등·중학교, 학원가 밀도, 학업 성취도' },
  { icon: '🛍️', title: '생활 인프라',    desc: '반경 500m 편의점·마트·병원·카페·공원 수' },
  { icon: '🏦', title: '전세사기 위험도', desc: '전세가율 추정, 깡통전세 위험 AI 분석' },
];

const CHECKLIST = [
  '층간소음 이웃이 있는 건물인지 사전 확인',
  '야간·주말 유흥 소음 발생 여부',
  '진행 중인 공사 소음 및 종료 예정일',
  '초등학교 배정 구역 및 도보 거리',
  '편의점·마트·병원 도보 거리',
  '전세가율 80% 초과 여부 (깡통전세)',
  '재개발·재건축 예정 구역 포함 여부',
  '대중교통 출퇴근 소요 시간',
];

// ── 스타일 상수 ──────────────────────────────────────────────────
const S = {
  page:    { minHeight:'100vh', background:'#f7faf5', fontFamily:"'Pretendard', -apple-system, sans-serif" } as React.CSSProperties,
  header:  { position:'sticky' as const, top:0, zIndex:100, background:'rgba(255,255,255,.97)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(100,111,75,.12)', height:64, display:'flex', alignItems:'center', padding:'0 24px', gap:16 },
  logoBox: { width:30, height:30, background:'#646F4B', borderRadius:8, position:'relative' as const, flexShrink:0 },
  logoDot: { position:'absolute' as const, inset:7, background:'#BFD2BF', borderRadius:'50%' },
  logoTxt: { fontSize:17, fontWeight:800, color:'#646F4B' },
  navLink: { fontSize:13, color:'#7a8570', padding:'6px 12px', borderRadius:18, textDecoration:'none' },
  main:    { maxWidth:860, margin:'0 auto', padding:'40px 24px 80px' },
  h1:      { fontSize:30, fontWeight:800, color:'#1a1e15', lineHeight:1.3, marginBottom:12 },
  h2:      { fontSize:20, fontWeight:700, color:'#1a1e15', marginBottom:16 },
  h2sm:    { fontSize:18, fontWeight:700, color:'#1a1e15', marginBottom:14 },
  desc:    { fontSize:16, color:'#7a8570', lineHeight:1.7, marginBottom:28 },
  ctaBtn:  { display:'inline-flex', alignItems:'center', gap:8, background:'#646F4B', color:'#fff', fontSize:16, fontWeight:700, padding:'14px 28px', borderRadius:12, textDecoration:'none', boxShadow:'0 4px 16px rgba(100,111,75,.3)' },
  card:    { background:'#fff', borderRadius:12, padding:'16px 18px', border:'1px solid rgba(100,111,75,.12)' },
  chkWrap: { background:'#fff', borderRadius:14, padding:'20px 24px', border:'1px solid rgba(100,111,75,.12)' },
  numBadge:{ width:22, height:22, borderRadius:'50%', background:'rgba(191,210,191,.4)', color:'#646F4B', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 },
  ctaBox:  { background:'linear-gradient(135deg,#646F4B 0%,#4a5236 100%)', borderRadius:16, padding:'32px 28px', marginBottom:40, textAlign:'center' as const },
  ctaBtn2: { display:'inline-flex', alignItems:'center', gap:8, background:'#fff', color:'#646F4B', fontSize:15, fontWeight:700, padding:'13px 28px', borderRadius:10, textDecoration:'none' },
  tag:     { fontSize:13, color:'#646F4B', background:'rgba(191,210,191,.25)', border:'1px solid rgba(100,111,75,.2)', padding:'7px 14px', borderRadius:20, textDecoration:'none' },
  footer:  { borderTop:'1px solid rgba(100,111,75,.12)', padding:'24px', textAlign:'center' as const, fontSize:12, color:'#a4ad98' },
  fLink:   { color:'#a4ad98', textDecoration:'none' },
  crumb:   { fontSize:12, color:'#7a8570', textDecoration:'none' },
  crumbAct:{ fontSize:12, color:'#646F4B', fontWeight:600 },
  sep:     { fontSize:12, color:'#a4ad98' },
};

export default function DongSeoPage({ params }: { params: { dong: string } }) {
  const parsed = parseSlug(params.dong);
  if (!parsed) notFound();

  const { sido, sigungu, dong } = parsed!;
  const full        = `${sido} ${sigungu} ${dong}`;
  const short       = `${sigungu} ${dong}`;
  const analyzeUrl  = `/analysis?address=${encodeURIComponent(`${sigungu} ${dong}`)}`;
  const neighbors   = KOREA_DONGS.filter(([s, sg, d]) => s === sido && sg === sigungu && d !== dong).slice(0, 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context':'https://schema.org', '@type':'WebPage',
        name:`${short} 이사 입지 분석`,
        description:`${full} 소음·학군·교통·전세사기 위험도 AI 분석`,
        url:`https://moveiq.vercel.app/analysis/${params.dong}`,
        provider:{ '@type':'Organization', name:'무브IQ', url:'https://moveiq.vercel.app' },
      }) }} />

      <div style={S.page}>
        {/* 헤더 */}
        <header style={S.header}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
            <div style={S.logoBox}><div style={S.logoDot} /></div>
            <span style={S.logoTxt}>무브IQ</span>
          </Link>
          <nav style={{ display:'flex', gap:4, marginLeft:'auto' }}>
            {([['소음 지도','/noise-map'],['입지 분석','/analysis'],['커뮤니티','/community']] as [string,string][]).map(([l,h]) => (
              <Link key={h} href={h} style={S.navLink}>{l}</Link>
            ))}
          </nav>
        </header>

        <main style={S.main}>
          {/* 브레드크럼 */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            <Link href="/" style={S.crumb}>홈</Link>
            <span style={S.sep}>›</span>
            <Link href="/analysis" style={S.crumb}>입지 분석</Link>
            <span style={S.sep}>›</span>
            <span style={S.crumbAct}>{full}</span>
          </div>

          {/* 히어로 */}
          <section style={{ marginBottom:40 }}>
            <h1 style={S.h1}>{short} 이사,<br /><span style={{ color:'#646F4B' }}>괜찮을까요?</span></h1>
            <p style={S.desc}>{full} 이사를 고민 중이신가요?<br />층간소음 이력, 야간 유흥 소음, 학군, 교통, 전세사기 위험도까지<br />AI가 6개 레이어로 분석해 드립니다.</p>
            <Link href={analyzeUrl} style={S.ctaBtn}>🏙️ {short} AI 입지 분석 시작하기 →</Link>
          </section>

          {/* 분석 레이어 */}
          <section style={{ marginBottom:40 }}>
            <h2 style={S.h2}>{short}에서 확인할 수 있는 정보</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12 }}>
              {LAYERS.map(l => (
                <div key={l.title} style={S.card}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{l.icon}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1e15', marginBottom:4 }}>{l.title}</div>
                  <div style={{ fontSize:12, color:'#7a8570', lineHeight:1.6 }}>{l.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 체크리스트 */}
          <section style={{ marginBottom:40 }}>
            <h2 style={S.h2}>{short} 이사 전 필수 체크리스트</h2>
            <div style={S.chkWrap}>
              {CHECKLIST.map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom: i < CHECKLIST.length-1 ? '1px solid rgba(100,111,75,.08)' : 'none' }}>
                  <span style={S.numBadge}>{i+1}</span>
                  <span style={{ fontSize:14, color:'#3d4535', lineHeight:1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section style={S.ctaBox}>
            <h2 style={{ fontSize:22, fontWeight:800, color:'#fff', marginBottom:10 }}>{short} 실제 소음·입지 점수가 궁금하다면?</h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.8)', marginBottom:24, lineHeight:1.7 }}>주소 입력 한 번으로 AI가 6개 레이어 종합 점수를 즉시 제공합니다.<br />무료로 분석해 보세요.</p>
            <Link href={analyzeUrl} style={S.ctaBtn2}>🔍 {short} 무료 분석하기</Link>
          </section>

          {/* 인접 동네 */}
          {neighbors.length > 0 && (
            <section>
              <h2 style={S.h2sm}>{sigungu} 다른 동네 비교하기</h2>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {neighbors.map(([s,sg,d]) => {
                  const slug = encodeURIComponent(`${s}-${sg}-${d}`);
                  return <Link key={slug} href={`/analysis/${slug}`} style={S.tag}>📍 {d}</Link>;
                })}
              </div>
            </section>
          )}
        </main>

        <footer style={S.footer}>
          <p>© 2025 무브IQ — 이사 전, 이것만 보면 끝</p>
          <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8 }}>
            <Link href="/legal/terms"   style={S.fLink}>이용약관</Link>
            <Link href="/legal/privacy" style={S.fLink}>개인정보처리방침</Link>
            <Link href="/noise-map"     style={S.fLink}>소음 지도</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
