'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface AnalysisResult {
  address: string;
  scores: { traffic: number; infra: number; school: number; noise: number; commerce: number; development: number; };
  total: number; grade: string; ai_comment: string;
  traffic_detail: string; infra_detail: string; school_detail: string;
  noise_detail: string; commerce_detail: string; development_detail: string;
  alternatives: { name: string; score: number; note: string }[];
  noise_times: { label: string; pct: number; note: string }[];
}

// ── 예시 데이터 ──────────────────────────────────────────
const SAMPLE: AnalysisResult = {
  address: '마포구 성산동 일대 (예시)',
  scores: { traffic: 80, infra: 88, school: 62, noise: 45, commerce: 79, development: 72 },
  total: 75, grade: 'B+ (준수)',
  ai_comment: '교통·생활 편의는 우수하나 소음 환경과 학군 측면에서 개선 여지가 있습니다. 주말 저녁~새벽 유흥 소음이 집중되며, 인근 재개발 공사는 2027년 2월까지 예정되어 있습니다.',
  traffic_detail: '지하철 2·6호선 도보 10분 이내. 버스 정류장 8개. 강남까지 약 35분 소요. 교통 접근성 우수.',
  infra_detail: '반경 500m 내 편의점 6개, 병원·약국 12개, 카페 18개, 공원 2개. 생활 인프라 매우 풍부.',
  school_detail: '배정 초등학교 1개(도보 8분), 중학교 배정 예측 2곳, 학원가 밀집(수학·영어 중심).',
  noise_detail: '주중 낮은 비교적 조용하나 주말 저녁~새벽 유흥 소음이 집중됩니다. 재택근무자·영유아 가정 주의 필요.',
  commerce_detail: '유동인구 구 평균 대비 +22%, 음식점·카페 중심 업종, 공실률 7%(안정적).',
  development_detail: '2027년 재개발 구역 인접. 주변 재건축 단지 호재 예정. 장기 보유 시 가치 상승 기대.',
  alternatives: [
    { name: '연남동', score: 78, note: '학군 +15점, 임대료 +12%' },
    { name: '공덕동', score: 77, note: '교통 +8점, 소음 -10점' },
    { name: '마포동', score: 74, note: '소음 -15점, 개발 +10점' },
  ],
  noise_times: [
    { label: '새벽 00-06시', pct: 80, note: '유흥 퇴장 집중' },
    { label: '오전 06-12시', pct: 30, note: '비교적 조용' },
    { label: '오후 12-18시', pct: 40, note: '공사 소음(평일)' },
    { label: '저녁 18-24시', pct: 90, note: '유흥 최고조' },
  ],
};

// ── 푸터 모달 콘텐츠 ──────────────────────────────────────
const PAGES: Record<string, { title: string; body: string }> = {
  '서비스 소개': {
    title: '서비스 소개',
    body: `MoveIQ는 소음 크라우드 지도와 AI 입지 분석을 결합한 이사 결정 플랫폼입니다.

■ 핵심 기능
• 소음 크라우드 지도: 층간·공사·유흥·교통 소음 시간대별 확인
• AI 입지 분석: 교통·학군·인프라·소음·상권·개발 6개 레이어 종합 분석
• 스마트 알림: 관심 주소 소음 변화·공사 허가·개발 계획 실시간 알림

■ 시장 배경
• 연간 이사 가구: 800만 가구 (국토부, 2024)
• 이사 후 입지 후회율: 42%
• 연간 층간소음 민원: 40만 건 이상

■ 운영 문의
admin@moveiq.co.kr`,
  },
  '개인정보처리방침': {
    title: '개인정보처리방침',
    body: `MoveIQ는 이용자의 개인정보를 중요시하며 개인정보보호법을 준수합니다.

■ 수집하는 개인정보
• 소음 제보 시: 제보 위치(50m 반경 랜덤화 처리), IP 주소(어뷰징 방지)
• 회원가입 시(예정): 이메일, 닉네임

■ 개인정보 이용 목적
• 소음 제보 데이터 지도 표시
• 어뷰징·허위 제보 방지
• 서비스 개선 및 통계 분석

■ 개인정보 보유 및 파기
• 소음 제보: 제보일로부터 90일 후 자동 삭제
• 회원 탈퇴 시: 즉시 파기

■ 위치정보 처리
제보된 위치는 반경 50m 랜덤화 처리 후 저장됩니다. 정확한 위치는 저장되지 않습니다.

문의: admin@moveiq.co.kr`,
  },
  '이용약관': {
    title: '이용약관',
    body: `■ 제1조 (목적)
본 약관은 MoveIQ(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.

■ 제2조 (서비스 제공)
서비스는 소음 크라우드 지도, AI 입지 분석 정보를 제공합니다. 제공되는 정보는 참고용이며, 최종 이사 결정의 책임은 이용자에게 있습니다.

■ 제3조 (이용자 의무)
• 허위 소음 제보 금지
• 타인의 권리 침해 금지
• 서비스 정상 운영 방해 금지

■ 제4조 (면책조항)
서비스가 제공하는 분석 결과는 AI 및 크라우드 데이터 기반으로 100% 정확성을 보장하지 않습니다. 부동산 계약 시 전문가 상담을 병행하시기 바랍니다.

■ 제5조 (준거법)
본 약관은 대한민국 법령에 따라 해석됩니다.

문의: admin@moveiq.co.kr`,
  },
  '공지사항': {
    title: '공지사항',
    body: `■ [2025.03] MoveIQ 베타 서비스 오픈

안녕하세요, MoveIQ팀입니다.

소음 크라우드 지도 × AI 입지 분석 플랫폼 MoveIQ가 베타 서비스를 시작합니다.

▶ 베타 기간 중 무료 제공
• 소음 지도 열람 및 제보 무제한
• AI 입지 분석 일 3회
• 6개 레이어 기본 분석

▶ 순차 오픈 예정
• PDF 리포트 저장
• 실시간 알림 서비스
• 유료 요금제 (이사 플랜 / 월정액 / 프리미엄)

서비스 이용 중 불편 사항이나 개선 의견은 admin@moveiq.co.kr 로 보내주세요.

감사합니다. MoveIQ팀 드림`,
  },
};

// ── Kakao Map 컴포넌트 ───────────────────────────────────
function KakaoMap({ lat, lng, loading }: { lat: number; lng: number; loading: boolean }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key || loading) return;
    const init = () => {
      const el = document.getElementById('kakaoMapEl');
      const k  = (window as any).kakao;
      if (!el || !k?.maps) return;
      k.maps.load(() => {
        const map = new k.maps.Map(el, { center: new k.maps.LatLng(lat, lng), level: 4 });
        // 현재 위치 마커
        new k.maps.Marker({ map, position: new k.maps.LatLng(lat, lng) });
        // 샘플 소음 핀
        [
          { dlat:+0.005, dlng:+0.003, t:'🎵', c:'#111111' },
          { dlat:-0.003, dlng:-0.004, t:'🏗️', c:'#111111' },
          { dlat:+0.002, dlng:-0.005, t:'🏠', c:'#646F4B' },
          { dlat:-0.005, dlng:+0.006, t:'🚗', c:'#BFD2BF' },
        ].forEach(p => {
          const html = `<div style="background:${p.c};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.25)"><span style="transform:rotate(45deg)">${p.t}</span></div>`;
          new k.maps.CustomOverlay({ map, position: new k.maps.LatLng(lat + p.dlat, lng + p.dlng), content: html, yAnchor: 1 });
        });
      });
    };
    if (document.getElementById('kakao-sdk')) { init(); return; }
    const s = document.createElement('script');
    s.id  = 'kakao-sdk';
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    s.onload = init;
    document.head.appendChild(s);
  }, [lat, lng, loading]);

  if (loading) return (
    <div className={styles.mapPlaceholder}>
      <span style={{ fontSize:32 }}>📍</span>
      <span>현재 위치 확인 중...</span>
    </div>
  );
  return <div id="kakaoMapEl" className={styles.kakaoMapEl} />;
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function HomePage() {
  const [tab,          setTab]          = useState<'search'|'noise'>('search');
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [step,         setStep]         = useState(0);
  const [result,       setResult]       = useState<AnalysisResult|null>(null);
  const [rTab,         setRTab]         = useState('overview');
  const [reportOpen,   setReportOpen]   = useState(false);
  const [reportOk,     setReportOk]     = useState(false);
  const [pageModal,    setPageModal]    = useState<string|null>(null);
  const [mapView,      setMapView]      = useState<'pin'|'heat'>('pin');
  const [userLat,      setUserLat]      = useState<number|null>(null);
  const [userLng,      setUserLng]      = useState<number|null>(null);
  const [locLoading,   setLocLoading]   = useState(false);

  const STEPS = ['교통 데이터 수집 중...','생활 시설 분석 중...','소음 데이터 연동 중...','AI 종합 평가 생성 중...'];

  // 4. 소음지도 탭: 위치 요청
  function goNoise() {
    setTab('noise');
    if (userLat !== null) return;
    setLocLoading(true);
    navigator.geolocation?.getCurrentPosition(
      p  => { setUserLat(p.coords.latitude); setUserLng(p.coords.longitude); setLocLoading(false); },
      () => { setUserLat(37.5665); setUserLng(126.9780); setLocLoading(false); },
      { timeout: 8000 }
    );
  }

  async function runAnalysis(addr?: string) {
    const address = addr ?? input.trim();
    if (!address) return;
    setInput(address);
    setResult(null);
    setLoading(true);
    setStep(0);
    const iv = setInterval(() => setStep(s => s >= STEPS.length-1 ? s : s+1), 700);
    try {
      const res = await fetch('/api/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ address }) });
      const json = await res.json();
      clearInterval(iv);
      if (json.success) { setResult(json.data); setRTab('overview'); }
      else alert(json.message ?? '분석에 실패했습니다.');
    } catch { clearInterval(iv); alert('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/noise-reports', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ noise_type: d.get('noise_type'), time_slot: d.get('time_slot'),
          severity: Number(d.get('severity')), lat: userLat??37.5665, lng: userLng??126.9780, description: d.get('description') }) });
      const json = await res.json();
      if (json.success) setReportOk(true); else alert(json.message);
    } catch { alert('제보 저장에 실패했습니다.'); }
  }

  const sc = (s: number) => s >= 80 ? 'var(--main)' : s >= 60 ? '#BFD2BF' : '#111111';
  const D  = result ?? SAMPLE;
  const LAYERS = [
    { icon:'🚇', name:'교통 접근성', score: D.scores.traffic,     detail: D.traffic_detail },
    { icon:'🏪', name:'생활 인프라', score: D.scores.infra,       detail: D.infra_detail },
    { icon:'📚', name:'학군 환경',   score: D.scores.school,      detail: D.school_detail },
    { icon:'🔊', name:'소음·환경',   score: D.scores.noise,       detail: D.noise_detail },
    { icon:'🛍️', name:'상권 활성도', score: D.scores.commerce,    detail: D.commerce_detail },
    { icon:'🏗️', name:'개발 잠재력', score: D.scores.development, detail: D.development_detail },
  ];

  return (
    <>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <a className={styles.logo} href="/"><div className={styles.logoMark}>📍</div><span className={styles.logoText}>MoveIQ</span></a>
        <div className={styles.headerSearch}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runAnalysis()} placeholder="주소 검색 (예: 마포구 성산동)" />
          <button onClick={()=>runAnalysis()}>→</button>
        </div>
        {/* 5. 헤더 탭 버튼 제거 */}
        <button className={styles.btnReport} onClick={()=>setReportOpen(true)}>+ 소음 제보</button>
      </header>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg}/>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>실시간 소음 크라우드 × AI 입지 분석</div>
          <h1>이 동네,<br/><span>살아도 될까요?</span></h1>
          <p>소음부터 학군·상권·개발계획까지 — 이사 결정에 필요한 모든 데이터를 한 화면에서</p>
          <div className={styles.heroCtas}>
            <div className={`${styles.ctaCard} ${styles.primary}`} onClick={()=>{setTab('search');setTimeout(()=>document.getElementById('mainInput')?.focus(),100);}}>
              <div className={styles.ctaIcon}>🏙️</div>
              <div className={styles.ctaTitle}>이 주소 입지 분석하기</div>
              <div className={styles.ctaDesc}>6개 레이어 AI 종합 분석</div>
              <span className={styles.ctaBadge}>PDF 리포트 저장 가능</span>
            </div>
            <div className={styles.ctaCard} onClick={goNoise}>
              <div className={styles.ctaIcon}>🔊</div>
              <div className={styles.ctaTitle}>소음 지도 보기</div>
              <div className={styles.ctaDesc}>크라우드 소음 제보를 시간대별로 확인</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APP ── */}
      <div className={styles.app}>
        {/* 3. 사이드바 폭 항상 고정 (full 클래스 없음) */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTabs}>
            <button className={`${styles.sidebarTab} ${tab==='search'?styles.active:''}`} onClick={()=>setTab('search')}>🏙️ 입지 분석</button>
            <button className={`${styles.sidebarTab} ${tab==='noise'?styles.active:''}`}  onClick={goNoise}>🔊 소음 지도</button>
          </div>

          {/* 입지 분석 패널 */}
          {tab==='search' && (
            <div className={styles.sidebarContent}>
              <div className={styles.searchRow}>
                <input id="mainInput" className={styles.bigInput} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runAnalysis()} placeholder="예: 마포구 성산동, 강남구 역삼동"/>
                <button className={styles.btnAnalyze} onClick={()=>runAnalysis()}>분석</button>
              </div>
              <div className={styles.quickChips}>
                <span>추천:</span>
                {['마포구 성산동','강남구 역삼동','용산구 이태원동','송파구 잠실동','서대문구 연희동'].map(a=>(
                  <button key={a} className={styles.chip} onClick={()=>runAnalysis(a)}>{a}</button>
                ))}
              </div>

              {/* 로딩 */}
              {loading && (
                <div className={styles.loadingBox}>
                  <div className={styles.spinner}/>
                  <div className={styles.loadingSteps}>
                    {STEPS.map((s,i)=>(
                      <div key={i} className={`${styles.lstep} ${i<step?styles.done:''} ${i===step?styles.active:''}`}>
                        <span>{i<step?'✓':i===step?'⏳':'·'}</span>{s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1·2. 예시 or 실제 결과 */}
              {!loading && (
                <div className={styles.resultBox}>
                  {/* 1. 예시 배지 */}
                  {!result && (
                    <div className={styles.sampleBadge}>
                      📋 예시 데이터 — 주소를 입력하면 실제 AI 분석 결과가 표시됩니다
                    </div>
                  )}
                  <div className={styles.resultHeader}>
                    <div className={styles.resultAddr}>📍 {D.address}</div>
                    <div className={styles.scoreBadge}>
                      <span className={styles.scoreBig}>{D.total}</span>
                      <span className={styles.scoreGrade}>{D.grade}</span>
                    </div>
                  </div>
                  <div className={styles.resultTabs}>
                    {['overview','traffic','infra','school','noise','commerce','dev'].map((t,i)=>(
                      <button key={t} className={`${styles.rtab} ${rTab===t?styles.active:''}`} onClick={()=>setRTab(t)}>
                        {['종합','교통','인프라','학군','소음★','상권','개발'][i]}
                      </button>
                    ))}
                  </div>

                  {rTab==='overview' && (
                    <>
                      <div className={styles.scoreGrid}>
                        {LAYERS.map(l=>(
                          <div key={l.name} className={styles.scoreCard}>
                            <div className={styles.scLabel}>{l.icon} {l.name}</div>
                            <div className={styles.scVal} style={{color:sc(l.score)}}>{l.score}</div>
                            <div className={styles.scBar}><div className={styles.scFill} style={{width:`${l.score}%`,background:sc(l.score)}}/></div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.aiBox}><span>🤖</span><p>{D.ai_comment}</p></div>
                      <div className={styles.compareTitle}>📍 비슷한 조건의 대안 지역</div>
                      {D.alternatives.map(a=>(
                        <div key={a.name} className={styles.compareItem}>
                          <div><div className={styles.compareName}>📍 {a.name}</div><div className={styles.compareNote}>{a.note}</div></div>
                          <span className={styles.compareScore}>{a.score}점</span>
                        </div>
                      ))}
                      <div className={styles.pdfCta}>
                        <div><strong>풀 리포트 PDF 저장</strong><small>6개 레이어 + 비교 3곳 + AI 평가</small></div>
                        <button className={styles.btnPdf}>📄 4,900원</button>
                      </div>
                    </>
                  )}
                  {rTab==='noise' && (
                    <div className={styles.noisePanel}>
                      <div className={styles.tsTitle}>시간대별 소음 위험도</div>
                      {D.noise_times.map(t=>{
                        const c = t.pct>=80?'#111':t.pct>=50?'var(--main)':'var(--sub)';
                        return (
                          <div key={t.label} className={styles.timeRow}>
                            <span className={styles.timeLabel}>{t.label}</span>
                            <div className={styles.timeBarW}><div className={styles.timeBarF} style={{width:`${t.pct}%`,background:c}}/></div>
                            <span style={{color:c,fontFamily:'Space Mono',fontSize:11}}>{t.pct}%</span>
                            <span className={styles.timeNote}>{t.note}</span>
                          </div>
                        );
                      })}
                      <div className={styles.aiBox} style={{marginTop:16}}><span>🤖</span><p>{D.noise_detail}</p></div>
                    </div>
                  )}
                  {rTab==='traffic'  && <div className={styles.aiBox}><span>🚇</span><p>{D.traffic_detail}</p></div>}
                  {rTab==='infra'    && <div className={styles.aiBox}><span>🏪</span><p>{D.infra_detail}</p></div>}
                  {rTab==='school'   && <div className={styles.aiBox}><span>📚</span><p>{D.school_detail}</p></div>}
                  {rTab==='commerce' && <div className={styles.aiBox}><span>🛍️</span><p>{D.commerce_detail}</p></div>}
                  {rTab==='dev'      && <div className={styles.aiBox}><span>🏗️</span><p>{D.development_detail}</p></div>}
                </div>
              )}
            </div>
          )}

          {/* 소음 지도 사이드 패널 */}
          {tab==='noise' && (
            <div className={styles.sidebarContent}>
              <div className={styles.noiseSummary}>
                <div className={styles.noiseSummaryTitle}>🔊 실시간 소음 지도</div>
                {locLoading
                  ? <p className={styles.locLoading}>📍 현재 위치 확인 중...</p>
                  : <p>현재 위치 기준 소음 제보 현황입니다.<br/>핀을 클릭해 상세 정보를 확인하세요.</p>
                }
              </div>
              <div className={styles.noiseStatBox}>
                {[['🎵 유흥 소음','147건','#111'],['🏗️ 공사 소음','23건','var(--main)'],['🚗 교통 소음','18건','var(--sub)'],['🏠 층간소음','11건','var(--sub)']].map(([l,v,c])=>(
                  <div key={l} className={styles.noiseStatRow}><span>{l}</span><strong style={{color:c as string}}>{v}</strong></div>
                ))}
              </div>
              <button className={styles.btnSubmitFull} onClick={()=>setReportOpen(true)}>+ 소음 제보하기</button>
              <button className={styles.btnSecondaryFull} onClick={()=>setTab('search')}>🏙️ 이 지역 입지 분석 →</button>
            </div>
          )}
        </aside>

        {/* 우측 콘텐츠 */}
        <div className={`${styles.mainContent} ${tab==='search'?styles.mainContentHidden:''}`}>
          {tab==='noise' && (
            <div className={styles.mapArea}>
              <div className={styles.mapToolbar}>
                <div className={styles.filterChips}>
                  {['🏗️ 공사','🎵 유흥','🏠 층간','🚗 교통','🐕 기타'].map(f=>(
                    <button key={f} className={`${styles.fChip} ${styles.on}`}>{f}</button>
                  ))}
                </div>
                <div className={styles.viewToggle}>
                  <button className={`${styles.vBtn} ${mapView==='pin'?styles.active:''}`} onClick={()=>setMapView('pin')}>📍 핀</button>
                  <button className={`${styles.vBtn} ${mapView==='heat'?styles.active:''}`} onClick={()=>setMapView('heat')}>🌡️ 히트맵</button>
                </div>
              </div>
              {/* 4. Kakao Maps — 현재 위치 기반 */}
              <KakaoMap lat={userLat??37.5665} lng={userLng??126.9780} loading={locLoading}/>
              <div className={styles.mapTimeBar}>
                <div>시간대 필터</div>
                <input type="range" min="0" max="4" defaultValue="2"/>
                <div className={styles.mtbTicks}><span>새벽</span><span>오전</span><span>오후</span><span>저녁</span><span>심야</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button className={styles.fab} onClick={()=>setReportOpen(true)}>+ 소음 제보하기</button>

      {/* ── 핵심 기능 ── */}
      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.secLabel}>핵심 기능</div>
          <h2 className={styles.secTitle}>이사 결정에 필요한<br/>모든 데이터</h2>
          <div className={styles.featGrid}>
            {[
              {icon:'🔊',title:'소음 크라우드 지도',    desc:'층간·공사·유흥·교통 소음을 시간대별로 확인. 핀 뷰와 히트맵 뷰 전환 가능.'},
              {icon:'🤖',title:'AI 입지 분석 리포트',   desc:'교통·학군·인프라·소음·상권·개발 6개 레이어를 Claude AI가 종합 분석해 점수와 코멘트 제공.'},
              {icon:'📊',title:'레이더 차트 스코어카드', desc:'6개 항목을 레이더 차트와 바 그래프로 시각화. 비슷한 조건의 대안 지역 3곳 비교.'},
              {icon:'🔔',title:'스마트 알림',            desc:'관심 주소 반경 500m 내 새 소음 제보, 공사 허가, 입지 점수 변동 시 즉시 알림.'},
              {icon:'📋',title:'민원 원클릭 가이드',     desc:'층간·공사·유흥 소음 유형별 신고 절차와 담당 기관을 주소 기반으로 자동 연결.'},
              {icon:'📄',title:'PDF 리포트 저장',        desc:'풀 리포트를 PDF로 저장해 부동산 계약 전 참고 자료로 활용하거나 공인중개사와 공유.'},
            ].map(f=>(
              <div key={f.title} className={styles.featCard}>
                <div className={styles.featIcon}>{f.icon}</div>
                <div className={styles.featTitle}>{f.title}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 요금제 — 준비중 */}
      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionInner}>
          <div style={{textAlign:'center',maxWidth:520,margin:'0 auto 32px'}}>
            <div className={styles.secLabel} style={{textAlign:'center'}}>요금제</div>
            <h2 className={styles.secTitle}>이사 전 가장 중요한 투자</h2>
            <p className={styles.secDesc} style={{textAlign:'center',marginTop:8}}>한 번의 잘못된 이사가 수개월의 스트레스보다 더 비쌉니다.</p>
          </div>
          <div className={styles.comingSoonBanner}>🔧 결제 서비스 준비 중입니다. 베타 기간 동안 무료로 이용하실 수 있습니다.</div>
          <div className={styles.pricingGrid}>
            {[
              {plan:'무료',      price:'0',      unit:'원',    desc:'소음 지도 + 기본 분석',       feats:['소음 지도 열람·제보 무제한','입지 분석 일 3회','6개 레이어 기본 보기','민원 가이드 이용'],     btn:'무료 시작',  free:true,  badge:''},
              {plan:'이사 플랜', price:'4,900',  unit:'원/건', desc:'이사 결정 1회용 완전 리포트', feats:['특정 주소 풀 리포트','PDF 다운로드','비교 지역 3곳 분석','AI 상세 코멘트'],              btn:'준비 중',    free:false, badge:'인기'},
              {plan:'월정액',    price:'14,900', unit:'원/월', desc:'청약·투자 준비자',             feats:['무제한 분석·비교','실시간 알림','분석 히스토리 30개','이사 예정지 모니터링'],            btn:'준비 중',    free:false, badge:''},
              {plan:'프리미엄',  price:'29,900', unit:'원/월', desc:'완전한 이사 결정 패키지',      feats:['월정액 전체 포함','민원 자동 가이드','주간 리포트 이메일','전문가 상담 1회'],             btn:'준비 중',    free:false, badge:''},
            ].map(p=>(
              <div key={p.plan} className={`${styles.priceCard} ${p.badge?styles.priceCardFeatured:''}`}>
                {p.badge && <div className={styles.priceBadge}>{p.badge}</div>}
                <div className={styles.pricePlan}>{p.plan}</div>
                <div className={styles.priceNum}>{p.price}<span className={styles.priceUnit}>{p.unit}</span></div>
                <div className={styles.priceDesc}>{p.desc}</div>
                <ul className={styles.priceFeats}>{p.feats.map(f=><li key={f}>{f}</li>)}</ul>
                <button disabled={!p.free} className={p.free?styles.priceBtnMain:styles.priceBtnDisabled}>{p.btn}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. B2B — 준비중 */}
      <section className={styles.b2bSection} id="b2b">
        <div className={styles.b2bInner}>
          <div className={styles.b2bLeft}>
            <div className={styles.b2bLabel}>B2B API</div>
            <h2 className={styles.b2bTitle}>직방·다방·건설사·지자체를 위한<br/>입지 분석 API</h2>
            <p className={styles.b2bDesc}>매물별 입지 점수 API 납품, 공인중개사 플랫폼 연동, 지자체 소음 민원 대시보드 등 다양한 B2B 협업을 준비 중입니다.</p>
            <div className={styles.b2bComingSoon}>🔧 서비스 준비 중 — 사전 문의는 이메일로 받고 있습니다</div>
            <a href="mailto:admin@moveiq.co.kr" className={styles.b2bBtn}>✉️ 사전 문의하기</a>
          </div>
          <div className={styles.b2bCards}>
            {[
              {icon:'🏢',title:'부동산 플랫폼',    desc:'직방·다방·부동산114 — 입지 분석 API 납품'},
              {icon:'🔑',title:'공인중개사 플랫폼',desc:'매물별 입지 점수 연동 — 건당 과금 모델'},
              {icon:'🏗️',title:'건설사·시행사',    desc:'분양 전 입지 분석 리포트 — 프로젝트별'},
              {icon:'🏛️',title:'지자체',           desc:'소음 민원 집계 대시보드 — 연간 계약'},
            ].map(c=>(
              <div key={c.title} className={styles.b2bCard}>
                <span className={styles.b2bCardIcon}>{c.icon}</span>
                <div><div className={styles.b2bCardTitle}>{c.title}</div><div className={styles.b2bCardDesc}>{c.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div>
              <div className={styles.footerLogo}>📍 MoveIQ</div>
              <p className={styles.footerTagline}>이사 후 "알았다면 안 왔을 텐데"라는 말이<br/>사라지는 세상을 만든다</p>
            </div>
            {/* 7. 실제 동작하는 푸터 링크 */}
            <div className={styles.footerLinks}>
              {Object.keys(PAGES).map(name=>(
                <button key={name} className={styles.footerLinkBtn} onClick={()=>setPageModal(name)}>{name}</button>
              ))}
              <a href="mailto:admin@moveiq.co.kr" className={styles.footerLinkBtn}>B2B 문의</a>
            </div>
          </div>
          <div className={styles.footerCopy}>© 2025 MoveIQ. All rights reserved.</div>
        </div>
      </footer>

      {/* ── 소음 제보 모달 ── */}
      {reportOpen && (
        <div className={styles.modalBg} onClick={e=>{if(e.target===e.currentTarget){setReportOpen(false);setReportOk(false);}}}>
          <div className={styles.modal}>
            {!reportOk ? (
              <>
                <div className={styles.modalHead}><h3>🔊 소음 제보하기</h3><button onClick={()=>setReportOpen(false)}>✕</button></div>
                <form onSubmit={submitReport}>
                  <div className={styles.formGroup}><label>소음 유형</label>
                    <select name="noise_type" className={styles.formInput} required>
                      <option value="construction">🏗️ 공사 소음</option>
                      <option value="entertainment">🎵 유흥 소음</option>
                      <option value="floor">🏠 층간소음</option>
                      <option value="traffic">🚗 교통 소음</option>
                      <option value="other">🐕 기타</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}><label>발생 시간대</label>
                    <select name="time_slot" className={styles.formInput} required>
                      <option value="dawn">새벽 (00-06시)</option><option value="morning">오전 (06-12시)</option>
                      <option value="afternoon">오후 (12-18시)</option><option value="evening">저녁 (18-24시)</option>
                      <option value="night">심야</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}><label>심각도 (1~5)</label>
                    <input type="range" name="severity" min="1" max="5" defaultValue="3" className={styles.formInput}/>
                  </div>
                  <div className={styles.formGroup}><label>상세 설명 (선택)</label>
                    <textarea name="description" className={styles.formInput} rows={3} maxLength={100} placeholder="소음 상황을 간단히 설명해주세요"/>
                  </div>
                  <button type="submit" className={styles.btnSubmit}>제보 완료</button>
                </form>
              </>
            ) : (
              <div className={styles.successState}>
                <div>🎉</div><h3>제보 완료!</h3><p>이 정보로 누군가의 이사를 도왔어요</p>
                <button onClick={()=>{setReportOpen(false);setReportOk(false);}} className={styles.btnSubmit}>닫기</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. 페이지 모달 */}
      {pageModal && (
        <div className={styles.modalBg} onClick={e=>{if(e.target===e.currentTarget)setPageModal(null);}}>
          <div className={styles.modal} style={{maxWidth:600}}>
            <div className={styles.modalHead}><h3>{PAGES[pageModal].title}</h3><button onClick={()=>setPageModal(null)}>✕</button></div>
            <pre className={styles.pageContent}>{PAGES[pageModal].body}</pre>
          </div>
        </div>
      )}
    </>
  );
}
