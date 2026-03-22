'use client';
// app/page.tsx
// ────────────────────────────────────────────────────────────
// 기존 moveiq.html을 Next.js Client Component로 이식합니다.
// API 호출은 /api/analyze, /api/noise-reports 로 분리됩니다.
// ────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import styles from './page.module.css';

// 분석 결과 타입
interface AnalysisResult {
  address: string;
  scores: {
    traffic: number; infra: number; school: number;
    noise: number; commerce: number; development: number;
  };
  total: number;
  grade: string;
  ai_comment: string;
  traffic_detail: string;
  infra_detail: string;
  school_detail: string;
  noise_detail: string;
  commerce_detail: string;
  development_detail: string;
  alternatives: { name: string; score: number; note: string }[];
  noise_times: { label: string; pct: number; note: string }[];
}

export default function HomePage() {
  const [activeTab,    setActiveTab]    = useState<'search' | 'noise'>('search');
  const [inputValue,   setInputValue]   = useState('');
  const [loading,      setLoading]      = useState(false);
  const [loadingStep,  setLoadingStep]  = useState(0);
  const [result,       setResult]       = useState<AnalysisResult | null>(null);
  const [resultTab,    setResultTab]    = useState('overview');
  const [reportModal,  setReportModal]  = useState(false);
  const [reportSuccess,setReportSuccess]= useState(false);
  const [mapView,      setMapView]      = useState<'pin' | 'heat'>('pin');
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  // 제보 위치: 실제 지도 핀 연동 전까지 서울 중심 기본값 사용 (추후 Kakao Maps 연동으로 교체)
  const [reportLat,    setReportLat]    = useState(37.5665);
  const [reportLng,    setReportLng]    = useState(126.9780);

  const STEPS = [
    '교통 데이터 수집 중...',
    '생활 시설 분석 중...',
    '소음 데이터 연동 중...',
    'AI 종합 평가 생성 중...',
  ];

  // ── 분석 실행 ──────────────────────────────────────────
  async function runAnalysis(addr?: string) {
    const address = addr ?? inputValue.trim();
    if (!address) return;
    setInputValue(address);
    setResult(null);
    setLoading(true);
    setLoadingStep(0);

    // 로딩 스텝 애니메이션
    const iv = setInterval(() => {
      setLoadingStep(s => {
        if (s >= STEPS.length - 1) { clearInterval(iv); return s; }
        return s + 1;
      });
    }, 700);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      clearInterval(iv);
      if (json.success) {
        setResult(json.data);
        setResultTab('overview');
        setErrorMsg(null);
      } else {
        setErrorMsg(json.message ?? '분석에 실패했습니다.');
      }
    } catch {
      clearInterval(iv);
      setErrorMsg('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  // ── 소음 제보 제출 ──────────────────────────────────────
  async function submitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch('/api/noise-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noise_type:  data.get('noise_type'),
          time_slot:   data.get('time_slot'),
          severity:    Number(data.get('severity')),
          lat:         reportLat,
          lng:         reportLng,
          description: data.get('description'),
        }),
      });
      const json = await res.json();
      if (json.success) setReportSuccess(true);
      else setErrorMsg(json.message ?? '제보 저장에 실패했습니다.');
    } catch {
      setErrorMsg('제보 저장에 실패했습니다. 다시 시도해주세요.');
    }
  }

  // ── 점수 → 색상 ────────────────────────────────────────
  function scoreColor(s: number) {
    if (s >= 80) return 'var(--main)';
    if (s >= 60) return '#BFD2BF';
    return '#111111';
  }

  const LAYERS = result ? [
    { icon: '🚇', name: '교통 접근성', score: result.scores.traffic,     detail: result.traffic_detail },
    { icon: '🏪', name: '생활 인프라', score: result.scores.infra,       detail: result.infra_detail },
    { icon: '📚', name: '학군 환경',   score: result.scores.school,      detail: result.school_detail },
    { icon: '🔊', name: '소음·환경',   score: result.scores.noise,       detail: result.noise_detail },
    { icon: '🛍️', name: '상권 활성도', score: result.scores.commerce,    detail: result.commerce_detail },
    { icon: '🏗️', name: '개발 잠재력', score: result.scores.development, detail: result.development_detail },
  ] : [];

  return (
    <>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <a className={styles.logo} href="/">
          <div className={styles.logoMark}>📍</div>
          <span className={styles.logoText}>MoveIQ</span>
        </a>
        <div className={styles.headerSearch}>
          <input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            placeholder="주소 검색 (예: 마포구 성산동)"
          />
          <button onClick={() => runAnalysis()}>→</button>
        </div>
        <nav className={styles.headerNav}>
          <button
            className={activeTab === 'search' ? styles.active : ''}
            onClick={() => setActiveTab('search')}
          >입지분석</button>
          <button
            className={activeTab === 'noise' ? styles.active : ''}
            onClick={() => setActiveTab('noise')}
          >소음지도</button>
        </nav>
        <button className={styles.btnReport} onClick={() => setReportModal(true)}>
          + 소음 제보
        </button>
      </header>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>실시간 소음 크라우드 × AI 입지 분석</div>
          <h1>이 동네,<br /><span>살아도 될까요?</span></h1>
          <p>소음부터 학군·상권·개발계획까지 — 이사 결정에 필요한 모든 데이터를 한 화면에서</p>
          <div className={styles.heroCtas}>
            <div className={`${styles.ctaCard} ${styles.primary}`}
              onClick={() => { setActiveTab('search'); document.getElementById('mainInput')?.focus(); }}>
              <div className={styles.ctaIcon}>🏙️</div>
              <div className={styles.ctaTitle}>이 주소 입지 분석하기</div>
              <div className={styles.ctaDesc}>6개 레이어 AI 종합 분석</div>
              <span className={styles.ctaBadge}>PDF 리포트 저장 가능</span>
            </div>
            <div className={styles.ctaCard} onClick={() => setActiveTab('noise')}>
              <div className={styles.ctaIcon}>🔊</div>
              <div className={styles.ctaTitle}>소음 지도 보기</div>
              <div className={styles.ctaDesc}>크라우드 소음 제보를 시간대별로 확인</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APP ── */}
      <div className={styles.app}>
        {/* 사이드바 */}
        <aside className={`${styles.sidebar} ${activeTab === 'search' ? styles.full : ''}`}>
          <div className={styles.sidebarTabs}>
            <button
              className={`${styles.sidebarTab} ${activeTab === 'search' ? styles.active : ''}`}
              onClick={() => setActiveTab('search')}
            >🏙️ 입지 분석</button>
            <button
              className={`${styles.sidebarTab} ${activeTab === 'noise' ? styles.active : ''}`}
              onClick={() => setActiveTab('noise')}
            >🔊 소음 지도</button>
          </div>

          {/* 입지 분석 패널 */}
          {activeTab === 'search' && (
            <div className={styles.sidebarContent}>
              <div className={styles.searchRow}>
                <input
                  id="mainInput"
                  className={styles.bigInput}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runAnalysis()}
                  placeholder="예: 마포구 성산동, 강남구 역삼동"
                />
                <button className={styles.btnAnalyze} onClick={() => runAnalysis()}>분석</button>
              </div>

              <div className={styles.quickChips}>
                <span>추천:</span>
                {['마포구 성산동','강남구 역삼동','용산구 이태원동','송파구 잠실동','서대문구 연희동'].map(addr => (
                  <button key={addr} className={styles.chip} onClick={() => runAnalysis(addr)}>{addr}</button>
                ))}
              </div>

              {/* 에러 메시지 */}
              {errorMsg && !loading && (
                <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: 8, padding: '12px 16px', marginTop: 12, color: '#c00', fontSize: 14 }}>
                  ⚠️ {errorMsg}
                  <button onClick={() => setErrorMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#c00' }}>✕</button>
                </div>
              )}

              {/* 로딩 */}
              {loading && (
                <div className={styles.loadingBox}>
                  <div className={styles.spinner} />
                  <div className={styles.loadingSteps}>
                    {STEPS.map((s, i) => (
                      <div key={i} className={`${styles.lstep} ${i < loadingStep ? styles.done : ''} ${i === loadingStep ? styles.active : ''}`}>
                        <span>{i < loadingStep ? '✓' : i === loadingStep ? '⏳' : '·'}</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 결과 */}
              {result && !loading && (
                <div className={styles.resultBox}>
                  <div className={styles.resultHeader}>
                    <div className={styles.resultAddr}>📍 {result.address}</div>
                    <div className={styles.scoreBadge}>
                      <span className={styles.scoreBig}>{result.total}</span>
                      <span className={styles.scoreGrade}>{result.grade}</span>
                    </div>
                  </div>

                  {/* 결과 탭 */}
                  <div className={styles.resultTabs}>
                    {['overview','traffic','infra','school','noise','commerce','dev'].map((t, i) => (
                      <button key={t}
                        className={`${styles.rtab} ${resultTab === t ? styles.active : ''}`}
                        onClick={() => setResultTab(t)}
                      >{['종합','교통','인프라','학군','소음★','상권','개발'][i]}</button>
                    ))}
                  </div>

                  {/* 종합 탭 */}
                  {resultTab === 'overview' && (
                    <>
                      <div className={styles.scoreGrid}>
                        {LAYERS.map(l => (
                          <div key={l.name} className={styles.scoreCard}>
                            <div className={styles.scLabel}>{l.icon} {l.name}</div>
                            <div className={styles.scVal} style={{ color: scoreColor(l.score) }}>{l.score}</div>
                            <div className={styles.scBar}>
                              <div className={styles.scFill} style={{ width: `${l.score}%`, background: scoreColor(l.score) }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.aiBox}>
                        <span>🤖</span>
                        <p>{result.ai_comment}</p>
                      </div>
                      <div className={styles.compareTitle}>📍 비슷한 조건의 대안 지역</div>
                      {result.alternatives.map(a => (
                        <div key={a.name} className={styles.compareItem}>
                          <div>
                            <div className={styles.compareName}>📍 {a.name}</div>
                            <div className={styles.compareNote}>{a.note}</div>
                          </div>
                          <span className={styles.compareScore}>{a.score}점</span>
                        </div>
                      ))}
                      <div className={styles.pdfCta}>
                        <div>
                          <strong>풀 리포트 PDF 저장</strong>
                          <small>6개 레이어 + 비교 3곳 + AI 평가</small>
                        </div>
                        <button className={styles.btnPdf}>📄 4,900원</button>
                      </div>
                    </>
                  )}

                  {/* 소음 탭 */}
                  {resultTab === 'noise' && (
                    <div className={styles.noisePanel}>
                      <div className={styles.tsTitle}>시간대별 소음 위험도</div>
                      {result.noise_times.map(t => {
                        const clr = t.pct >= 80 ? '#111' : t.pct >= 50 ? 'var(--main)' : 'var(--sub)';
                        return (
                          <div key={t.label} className={styles.timeRow}>
                            <span className={styles.timeLabel}>{t.label}</span>
                            <div className={styles.timeBarW}>
                              <div className={styles.timeBarF} style={{ width: `${t.pct}%`, background: clr }} />
                            </div>
                            <span style={{ color: clr, fontFamily: 'Space Mono', fontSize: 11 }}>{t.pct}%</span>
                            <span className={styles.timeNote}>{t.note}</span>
                          </div>
                        );
                      })}
                      <div className={styles.aiBox} style={{ marginTop: 16 }}>
                        <span>🤖</span><p>{result.noise_detail}</p>
                      </div>
                    </div>
                  )}

                  {/* 개별 레이어 탭 */}
                  {resultTab === 'traffic'  && <div className={styles.aiBox}><span>🚇</span><p>{result.traffic_detail}</p></div>}
                  {resultTab === 'infra'    && <div className={styles.aiBox}><span>🏪</span><p>{result.infra_detail}</p></div>}
                  {resultTab === 'school'   && <div className={styles.aiBox}><span>📚</span><p>{result.school_detail}</p></div>}
                  {resultTab === 'commerce' && <div className={styles.aiBox}><span>🛍️</span><p>{result.commerce_detail}</p></div>}
                  {resultTab === 'dev'      && <div className={styles.aiBox}><span>🏗️</span><p>{result.development_detail}</p></div>}
                </div>
              )}
            </div>
          )}

          {/* 소음 지도 패널 */}
          {activeTab === 'noise' && (
            <div className={styles.sidebarContent}>
              <div className={styles.noiseSummary}>
                <div className={styles.noiseSummaryTitle}>🔊 실시간 소음 지도</div>
                <p>크라우드 소음 제보 데이터를 시간대별로 확인하세요.</p>
              </div>
              <button className={styles.btnSubmitFull} onClick={() => setReportModal(true)}>
                + 소음 제보하기
              </button>
              <button className={styles.btnSecondaryFull} onClick={() => setActiveTab('search')}>
                🏙️ 이 지역 입지 전체 분석 →
              </button>
            </div>
          )}
        </aside>

        {/* 지도 영역 (소음 지도 탭에서만 표시) */}
        {activeTab === 'noise' && (
          <div className={styles.mapArea}>
            <div className={styles.mapToolbar}>
              <div className={styles.filterChips}>
                {['🏗️ 공사','🎵 유흥','🏠 층간','🚗 교통','🐕 기타'].map(f => (
                  <button key={f} className={`${styles.fChip} ${styles.on}`}>{f}</button>
                ))}
              </div>
              <div className={styles.viewToggle}>
                <button className={`${styles.vBtn} ${mapView === 'pin' ? styles.active : ''}`} onClick={() => setMapView('pin')}>📍 핀</button>
                <button className={`${styles.vBtn} ${mapView === 'heat' ? styles.active : ''}`} onClick={() => setMapView('heat')}>🌡️ 히트맵</button>
              </div>
            </div>
            <div className={styles.fakeMap}>
              <div className={styles.mapGrid} />
              <div className={styles.roadH} style={{ top: '35%' }} />
              <div className={styles.roadH} style={{ top: '62%' }} />
              <div className={styles.roadV} style={{ left: '28%' }} />
              <div className={styles.roadV} style={{ left: '68%' }} />
              {mapView === 'heat' && (
                <div className={styles.heatOverlay}>
                  <div className={styles.heatSpot} style={{ width: 180, height: 180, background: 'rgba(100,111,75,.6)', top: '22%', left: '58%' }} />
                  <div className={styles.heatSpot} style={{ width: 140, height: 140, background: 'rgba(100,111,75,.4)', top: '58%', left: '22%' }} />
                  <div className={styles.heatSpot} style={{ width: 110, height: 110, background: 'rgba(191,210,191,.55)', top: '38%', left: '78%' }} />
                </div>
              )}
              {mapView === 'pin' && (
                <>
                  <div className={styles.mPin} style={{ left: '60%', top: '26%' }}>
                    <div className={styles.pinBody} style={{ background: '#111' }}>🎵</div>
                    <div className={styles.pinLbl}>유흥</div>
                  </div>
                  <div className={styles.mPin} style={{ left: '23%', top: '52%' }}>
                    <div className={styles.pinBody} style={{ background: 'var(--main)' }}>🏠</div>
                    <div className={styles.pinLbl}>층간</div>
                  </div>
                  <div className={styles.mPin} style={{ left: '74%', top: '40%' }}>
                    <div className={styles.pinBody} style={{ background: '#111' }}>🏗️</div>
                    <div className={styles.pinLbl}>공사</div>
                  </div>
                  <div className={styles.mPin} style={{ left: '52%', top: '66%' }}>
                    <div className={styles.pinBody} style={{ background: 'var(--sub)' }}>🚗</div>
                    <div className={styles.pinLbl}>교통</div>
                  </div>
                </>
              )}
              <div className={styles.mapLegend}>
                <strong>소음 강도</strong>
                {[['#111','매우 심각'],['var(--main)','보통'],['var(--sub)','경미']].map(([c,l]) => (
                  <div key={l} className={styles.legRow}>
                    <div className={styles.legDot} style={{ background: c }} />{l}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.mapTimeBar}>
              <div>시간대 필터</div>
              <input type="range" min="0" max="4" defaultValue="2" />
              <div className={styles.mtbTicks}>
                <span>새벽</span><span>오전</span><span>오후</span><span>저녁</span><span>심야</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FAB ── */}
      <button className={styles.fab} onClick={() => setReportModal(true)}>+ 소음 제보하기</button>

      {/* ── 소음 제보 모달 ── */}
      {reportModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) { setReportModal(false); setReportSuccess(false); } }}>
          <div className={styles.modal}>
            {!reportSuccess ? (
              <>
                <div className={styles.modalHead}>
                  <h3>🔊 소음 제보하기</h3>
                  <button onClick={() => setReportModal(false)}>✕</button>
                </div>
                <form onSubmit={submitReport}>
                  <div className={styles.formGroup}>
                    <label>소음 유형</label>
                    <select name="noise_type" className={styles.formInput} required>
                      <option value="construction">🏗️ 공사 소음</option>
                      <option value="entertainment">🎵 유흥 소음</option>
                      <option value="floor">🏠 층간소음</option>
                      <option value="traffic">🚗 교통 소음</option>
                      <option value="other">🐕 기타</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>발생 시간대</label>
                    <select name="time_slot" className={styles.formInput} required>
                      <option value="dawn">새벽 (00-06시)</option>
                      <option value="morning">오전 (06-12시)</option>
                      <option value="afternoon">오후 (12-18시)</option>
                      <option value="evening">저녁 (18-24시)</option>
                      <option value="night">심야</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>심각도 (1~5)</label>
                    <input type="range" name="severity" min="1" max="5" defaultValue="3" className={styles.formInput} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>상세 설명 (선택)</label>
                    <textarea name="description" className={styles.formInput} rows={3} maxLength={100} placeholder="소음 상황을 간단히 설명해주세요" />
                  </div>
                  <button type="submit" className={styles.btnSubmit}>제보 완료</button>
                </form>
              </>
            ) : (
              <div className={styles.successState}>
                <div>🎉</div>
                <h3>제보 완료!</h3>
                <p>이 정보로 누군가의 이사를 도왔어요</p>
                <button onClick={() => { setReportModal(false); setReportSuccess(false); }} className={styles.btnSubmit}>닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
