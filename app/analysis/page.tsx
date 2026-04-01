'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthButton from '../components/AuthButton';
import styles from './analysis.module.css';

// ── 타입 ──────────────────────────────────────────────────
interface AnalysisResult {
  address: string;
  scores: { traffic:number; infra:number; school:number; noise:number; commerce:number; development:number; };
  total: number; grade: string; ai_comment: string;
  traffic_detail:string; infra_detail:string; school_detail:string;
  noise_detail:string; commerce_detail:string; development_detail:string;
  alternatives:{ name:string; score:number; note:string }[];
  noise_times:{ label:string; pct:number; note:string }[];
  reviews?:{ author:string; rating:number; text:string; date:string }[];
  jeonse_risk?:{ level:'low'|'medium'|'high'; reason:string; checklist:string[] };
  school_info?:{ name:string; type:string; distance:string; rating:string; note:string }[];
}

// ── 예시 데이터 ──────────────────────────────────────────
const SAMPLE: AnalysisResult = {
  address: '마포구 성산동 일대 (예시)',
  scores: { traffic:80, infra:88, school:62, noise:45, commerce:79, development:72 },
  total: 75, grade: 'B+',
  ai_comment: '교통·생활 편의는 우수하나 소음 환경과 학군 측면에서 개선 여지가 있습니다. 주말 저녁~새벽 유흥 소음이 집중되며, 인근 재개발 공사는 2027년 2월까지 예정되어 있습니다.',
  traffic_detail: '지하철 2·6호선 도보 10분 이내. 버스 정류장 8개. 강남까지 약 35분 소요. 교통 접근성 우수.',
  infra_detail: '반경 500m 내 편의점 6개, 병원·약국 12개, 카페 18개, 공원 2개. 생활 인프라 매우 풍부.',
  school_detail: '배정 초등학교 1개(도보 8분), 중학교 배정 예측 2곳, 학원가 밀집(수학·영어 중심).',
  noise_detail: '주중 낮은 비교적 조용하나 주말 저녁~새벽 유흥 소음이 집중됩니다. 재택근무자·영유아 가정 주의 필요.',
  commerce_detail: '유동인구 구 평균 대비 +22%, 음식점·카페 중심 업종, 공실률 7%(안정적).',
  development_detail: '2027년 재개발 구역 인접. 주변 재건축 단지 호재 예정. 장기 보유 시 가치 상승 기대.',
  alternatives: [
    { name:'연남동', score:78, note:'학군 +15점, 임대료 +12%' },
    { name:'공덕동', score:77, note:'교통 +8점, 소음 -10점' },
    { name:'마포동', score:74, note:'소음 -15점, 개발 +10점' },
  ],
  noise_times: [
    { label:'새벽 00–06시', pct:80, note:'유흥 퇴장 집중' },
    { label:'오전 06–12시', pct:30, note:'비교적 조용' },
    { label:'오후 12–18시', pct:40, note:'공사 소음(평일)' },
    { label:'저녁 18–24시', pct:90, note:'유흥 최고조' },
  ],
};

const STEPS = ['교통 데이터 수집 중...', '생활 시설 분석 중...', '소음 데이터 연동 중...', 'AI 종합 평가 생성 중...'];
const sc = (s: number) => s >= 80 ? 'var(--main)' : s >= 60 ? 'var(--main-lite)' : '#e0a84b';

function AnalysisContent() {
  const searchParams = useSearchParams();
  const [input,  setInput]  = useState(searchParams.get('address') ?? '');
  const [loading, setLoading] = useState(false);
  const [step, setStep]     = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rTab, setRTab]     = useState('overview');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const ex = localStorage.getItem('moveiq_session_id');
    if (ex) return ex;
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('moveiq_session_id', id);
    return id;
  });

  useEffect(() => {
    // 검색 히스토리 + DB 설정 불러오기
    if (sessionId) {
      fetch(`/api/user-preferences?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(json => { if (json.success && json.search_history?.length) setRecentSearches(json.search_history); })
        .catch(() => {
          try {
            const h = JSON.parse(localStorage.getItem('moveiq_history') ?? '[]');
            if (h.length) setRecentSearches(h);
          } catch {}
        });
    }
    // URL 파라미터로 주소가 넘어온 경우 자동 분석
    const addr = searchParams.get('address');
    if (addr) runAnalysis(addr);
  }, []);

  async function saveHistory(history: string[]) {
    localStorage.setItem('moveiq_history', JSON.stringify(history));
    if (sessionId) {
      fetch('/api/user-preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, search_history: history }),
      }).catch(() => {});
    }
  }

  async function runAnalysis(addr?: string) {
    const address = addr ?? input.trim();
    if (!address) return;
    setInput(address);
    setResult(null);
    setRecentSearches(prev => {
      const next = [address, ...prev.filter(a => a !== address)].slice(0, 8);
      saveHistory(next);
      return next;
    });
    setLoading(true); setStep(0);
    const iv = setInterval(() => setStep(s => s >= STEPS.length - 1 ? s : s + 1), 700);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      clearInterval(iv);
      if (json.success) { setResult(json.data); setRTab('overview'); }
      else alert(json.message ?? '분석에 실패했습니다.');
    } catch { clearInterval(iv); alert('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  const D = result ?? SAMPLE;
  const LAYERS = [
    { icon:'🚇', name:'교통 접근성', score:D.scores.traffic,     detail:D.traffic_detail },
    { icon:'🏪', name:'생활 인프라', score:D.scores.infra,       detail:D.infra_detail },
    { icon:'📚', name:'학군 환경',   score:D.scores.school,      detail:D.school_detail },
    { icon:'🔊', name:'소음·환경',   score:D.scores.noise,       detail:D.noise_detail },
    { icon:'🛍️', name:'상권 활성도', score:D.scores.commerce,    detail:D.commerce_detail },
    { icon:'🏗️', name:'개발 잠재력', score:D.scores.development, detail:D.development_detail },
  ];

  const TABS = [
    ['overview','종합'],['noise','소음★'],['school','학군★'],
    ['traffic','교통'],['infra','인프라'],['commerce','상권'],
    ['dev','개발'],['review','후기'],['jeonse','전세 위험'],
  ];

  return (
    <div className={styles.page}>
      {/* 검색 */}
      <div className={styles.searchBox}>
        <div className={styles.searchRow}>
          <input
            id="mainInput" className={styles.searchInput}
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            placeholder="예: 마포구 성산동, 강남구 역삼동, 서대문구 연희동"
          />
          <button className={styles.btnAnalyze} onClick={() => runAnalysis()}>분석하기</button>
        </div>

        <div className={styles.quickChips}>
          <span className={styles.quickLabel}>추천:</span>
          {['마포구 성산동', '강남구 역삼동', '용산구 이태원동', '송파구 잠실동', '서대문구 연희동'].map(a => (
            <button key={a} className={styles.chip} onClick={() => runAnalysis(a)}>{a}</button>
          ))}
        </div>

        {recentSearches.length > 0 && (
          <div className={styles.recentRow}>
            <span className={styles.recentLabel}>최근 검색:</span>
            {recentSearches.map(a => (
              <button key={a} className={`${styles.chip} ${styles.chipRecent}`} onClick={() => runAnalysis(a)}>🕐 {a}</button>
            ))}
            <button className={styles.btnClear} onClick={() => {
              setRecentSearches([]);
              localStorage.removeItem('moveiq_history');
              if (sessionId) fetch('/api/user-preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:sessionId, search_history:[] }) }).catch(()=>{});
            }}>지우기</button>
          </div>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <div className={styles.loadingSteps}>
            {STEPS.map((s, i) => (
              <div key={i} className={`${styles.lstep} ${i < step ? styles.lstepDone : ''} ${i === step ? styles.lstepActive : ''}`}>
                <span>{i < step ? '✓' : i === step ? '⏳' : '·'}</span>{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {!loading && (
        <div className={styles.resultBox}>
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

          <div className={styles.tabs}>
            {TABS.map(([t, label]) => (
              <button key={t} className={`${styles.tab} ${rTab === t ? styles.tabActive : ''}`} onClick={() => setRTab(t)}>{label}</button>
            ))}
          </div>

          {/* 종합 */}
          {rTab === 'overview' && (
            <>
              <div className={styles.scoreGrid}>
                {LAYERS.map(l => (
                  <div key={l.name} className={styles.scoreCard}>
                    <div className={styles.scLabel}>{l.icon} {l.name}</div>
                    <div className={styles.scVal} style={{ color: sc(l.score) }}>{l.score}</div>
                    <div className={styles.scBar}><div className={styles.scFill} style={{ width:`${l.score}%`, background: sc(l.score) }} /></div>
                  </div>
                ))}
              </div>
              <div className={styles.aiBox}><span>🤖</span><p>{D.ai_comment}</p></div>
              <div className={styles.compareTitle}>📍 비슷한 조건의 대안 지역</div>
              <div className={styles.compareGrid}>
                {D.alternatives.map(a => (
                  <div key={a.name} className={styles.compareItem}>
                    <div><div className={styles.compareName}>📍 {a.name}</div><div className={styles.compareNote}>{a.note}</div></div>
                    <span className={styles.compareScore}>{a.score}점</span>
                  </div>
                ))}
              </div>
              <div className={styles.pdfCta}>
                <div><strong>풀 리포트 PDF 저장</strong><small>6개 레이어 + 비교 3곳 + AI 평가 + 학군 상세</small></div>
                <button className={styles.btnPdf} disabled>📄 준비 중</button>
              </div>
            </>
          )}

          {/* 소음 */}
          {rTab === 'noise' && (
            <div className={styles.noisePanel}>
              <div className={styles.panelTitle}>시간대별 소음 위험도</div>
              {D.noise_times.map(t => {
                const c = t.pct >= 80 ? '#e74c3c' : t.pct >= 50 ? 'var(--main)' : 'var(--sub)';
                return (
                  <div key={t.label} className={styles.timeRow}>
                    <span className={styles.timeLabel}>{t.label}</span>
                    <div className={styles.timeBarW}><div className={styles.timeBarF} style={{ width:`${t.pct}%`, background:c }} /></div>
                    <span style={{ color:c, fontSize:11, fontWeight:700, minWidth:32 }}>{t.pct}%</span>
                    <span className={styles.timeNote}>{t.note}</span>
                  </div>
                );
              })}
              <div className={styles.aiBox} style={{ marginTop:16 }}><span>🤖</span><p>{D.noise_detail}</p></div>
            </div>
          )}

          {/* 학군 */}
          {rTab === 'school' && (
            <div>
              <div className={styles.aiBox}><span>📚</span><p>{D.school_detail}</p></div>
              {D.school_info?.length ? (
                <div className={styles.schoolList}>
                  {D.school_info.map((s, i) => (
                    <div key={i} className={styles.schoolItem}>
                      <div><span className={styles.schoolType}>{s.type}</span><strong className={styles.schoolName}>{s.name}</strong><span className={styles.schoolDist}>도보 {s.distance}</span></div>
                      <div style={{ textAlign:'right', flexShrink:0 }}><span className={styles.schoolRating}>{s.rating}</span><span className={styles.schoolNote}>{s.note}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.noData}><p>🔍 주소를 입력하면 배정 학교·학원가 정보를 확인할 수 있습니다.</p></div>
              )}
            </div>
          )}

          {rTab === 'traffic'  && <div className={styles.aiBox}><span>🚇</span><p>{D.traffic_detail}</p></div>}
          {rTab === 'infra'    && <div className={styles.aiBox}><span>🏪</span><p>{D.infra_detail}</p></div>}
          {rTab === 'commerce' && <div className={styles.aiBox}><span>🛍️</span><p>{D.commerce_detail}</p></div>}
          {rTab === 'dev'      && <div className={styles.aiBox}><span>🏗️</span><p>{D.development_detail}</p></div>}

          {/* 거주 후기 */}
          {rTab === 'review' && (
            <div>
              {D.reviews?.length ? (
                <>
                  {D.reviews.map((r, i) => (
                    <div key={i} className={styles.reviewItem}>
                      <div className={styles.reviewHeader}>
                        <span className={styles.reviewAuthor}>{r.author}</span>
                        <span className={styles.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span className={styles.reviewDate}>{r.date}</span>
                      </div>
                      <p style={{ fontSize:13, lineHeight:1.75, color:'var(--text2)' }}>{r.text}</p>
                    </div>
                  ))}
                  <Link href="/community" className={styles.btnGoComm}>✏️ 이 동네 후기 남기기</Link>
                </>
              ) : (
                <div className={styles.noData}>
                  <div style={{ fontSize:36, marginBottom:12 }}>📝</div>
                  <p>아직 등록된 거주후기가 없습니다.</p>
                  <p style={{ fontSize:12, color:'var(--muted2)', margin:'6px 0 16px' }}>첫 번째 후기를 남겨보세요!</p>
                  <Link href="/community" className={styles.btnGoComm}>✏️ 후기 작성하러 가기</Link>
                </div>
              )}
            </div>
          )}

          {/* 전세 위험도 */}
          {rTab === 'jeonse' && (
            <div>
              {D.jeonse_risk ? (
                <>
                  <div className={`${styles.jeonseRiskBadge} ${styles[`jeonseRisk_${D.jeonse_risk.level}` as keyof typeof styles]}`}>
                    {D.jeonse_risk.level === 'high' ? '🔴 전세사기 위험 지역' : D.jeonse_risk.level === 'medium' ? '🟡 전세사기 주의 필요' : '🟢 비교적 안전한 지역'}
                  </div>
                  <div className={styles.aiBox} style={{ marginTop:12 }}><span>🤖</span><p>{D.jeonse_risk.reason}</p></div>
                  <div className={styles.jeonseChecklist}>
                    <div className={styles.panelTitle}>✅ 계약 전 필수 체크리스트</div>
                    {D.jeonse_risk.checklist.map((item, i) => (
                      <div key={i} className={styles.jeonseCheckItem}><span className={styles.jeonseNum}>{i + 1}</span><span>{item}</span></div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.noData}>
                  <div style={{ fontSize:36, marginBottom:12 }}>🏦</div>
                  <p>주소를 입력하면 전세사기 위험도를 분석합니다.</p>
                  <div className={styles.jeonseManual}>
                    <div className={styles.panelTitle}>📋 전세계약 기본 체크리스트</div>
                    {[
                      '등기부등본 열람 (계약 당일·잔금 직전 재확인)',
                      '전세가율 80% 초과 여부 확인 (위험 신호)',
                      '선순위 채권·근저당 합계 확인',
                      '임대인 신원 확인 (등기부등본 소유자와 일치)',
                      '전세보증보험 가입 가능 여부 확인 (HUG/SGI)',
                      '확정일자 즉시 신청 (전입신고 당일)',
                    ].map((item, i) => (
                      <div key={i} className={styles.jeonseCheckItem}><span className={styles.jeonseNum}>{i + 1}</span><span>{item}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo}><div className={styles.logoMark} /><span>무브IQ</span></Link>
          <nav className={styles.nav}>
            <Link href="/noise-map" className={styles.navLink}>소음 지도</Link>
            <Link href="/analysis"  className={`${styles.navLink} ${styles.navActive}`}>입지 분석</Link>
            <Link href="/community" className={styles.navLink}>커뮤니티</Link>
          </nav>
          <AuthButton />
        </div>
      </header>

      <Suspense fallback={<div className={styles.loading}>로딩 중...</div>}>
        <AnalysisContent />
      </Suspense>

      <nav className={styles.mobileNav}>
        <Link href="/"          className={styles.mobileNavBtn}><span>🏠</span>홈</Link>
        <Link href="/noise-map" className={styles.mobileNavBtn}><span>🔊</span>소음 지도</Link>
        <Link href="/analysis"  className={`${styles.mobileNavBtn} ${styles.mobileNavActive}`}><span>🏙️</span>입지 분석</Link>
        <Link href="/community" className={styles.mobileNavBtn}><span>💬</span>커뮤니티</Link>
      </nav>
    </div>
  );
}
