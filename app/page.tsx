'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthButton from './components/AuthButton';
import styles from './page.module.css';

// ── FAQ ──────────────────────────────────────────────────
const FAQ_DATA = [
  {
    q: '소음 제보 데이터는 신뢰할 수 있나요?',
    a: '모든 제보는 계정 인증 사용자만 등록 가능합니다. 동일 IP에서 10분 내 5건 초과 시 자동 차단되며, 제보 위치는 반경 50m 이내에서 익명화 처리됩니다. 현재 누적 제보 23,400건, 이 중 71%가 서울·경기 지역입니다.',
  },
  {
    q: '소음 제보가 없는 동네도 분석되나요?',
    a: '네. 크라우드 데이터가 없는 지역은 공공 소음 측정값, 유흥업소 등록 수, 공사 허가 공공데이터를 활용합니다. 교통·인프라·학군·상권·개발잠재력 레이어는 전국 어디든 분석 가능합니다.',
  },
  {
    q: '가입 없이 쓸 수 있는 기능이 뭔가요?',
    a: '소음 지도 열람, 커뮤니티 읽기, 기본 입지 점수 확인(월 3회)은 가입 없이 가능합니다. 소음 제보, AI 분석 리포트 저장, 커뮤니티 글 작성은 무료 가입이 필요합니다.',
  },
  {
    q: '분석 데이터는 얼마나 최신인가요?',
    a: '소음 크라우드 제보는 실시간 반영됩니다. 생활 인프라 데이터는 매월 갱신, 도시계획·재개발 정보는 분기별 갱신(국토부 공시 기준)입니다.',
  },
  {
    q: 'PDF 리포트를 배우자와 공유할 수 있나요?',
    a: '이사 한 번 플랜 이상에서 PDF 저장 및 링크 공유가 가능합니다. 카카오톡으로 보내기가 가장 많이 활용되는 기능입니다.',
  },
  {
    q: '환불은 어떻게 되나요?',
    a: '첫 분석 완료 후 24시간 이내 요청 시 전액 환불됩니다. 월 구독은 다음 결제일 전 언제든 해지 가능합니다.',
  },
];

// ── 레이더 차트 헬퍼 ─────────────────────────────────────
// 6각형 레이더: 교통·인프라·학군·소음·상권·개발 순서
function radarPolygon(scores: number[], cx: number, cy: number, r: number) {
  const n = scores.length;
  const pts = scores.map((s, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const dist  = (s / 100) * r;
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)];
  });
  return pts.map(p => p.join(',')).join(' ');
}
function radarGrid(cx: number, cy: number, r: number, levels: number, n: number) {
  return Array.from({ length: levels }, (_, li) => {
    const ratio = (li + 1) / levels;
    const pts = Array.from({ length: n }, (__, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + r * ratio * Math.cos(angle), cy + r * ratio * Math.sin(angle)].join(',');
    });
    return pts.join(' ');
  });
}
function radarAxes(cx: number, cy: number, r: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}
const RADAR_LABELS = ['교통', '인프라', '학군', '소음', '상권', '개발'];

// ── 페르소나 탭 데이터 ────────────────────────────────────
const PERSONAS = [
  {
    tab: '소음 걱정되는 분',
    icon: '🔊',
    title: '소음, 계약 전에 확인하세요',
    desc: '이전 집에서 층간소음·공사소음으로 고생한 경험이 있는 분',
    scores: [80, 88, 62, 45, 79, 72],  // 교통·인프라·학군·소음·상권·개발
    stats: [
      { label: '반경 500m 제보 건수', sub: '최근 6개월 기준', val: '142건', red: false },
      { label: '최대 소음 시간대',    sub: '데시벨 최고 시점', val: '23:00–02:00', red: true },
      { label: '진행 중인 공사',      sub: '허가 건수',        val: '2구역', red: false },
    ],
    insight: '소음 점수 45점 — 심야 유흥가 밀집 구역 인접. 층간소음 제보 3건 포함. 남향 내부 유닛 권장.',
  },
  {
    tab: '아이 키우는 분',
    icon: '👶',
    title: '학군·소음·인프라 한 번에',
    desc: '영유아 자녀가 있고 학군·환경을 함께 봐야 하는 분',
    scores: [75, 82, 62, 58, 70, 65],
    stats: [
      { label: '학군 점수',      sub: '배정 초등학교 기준', val: '62/100', red: false },
      { label: '어린이집',       sub: '반경 500m 내',       val: '8개소',  red: false },
      { label: '심야 소음 지수', sub: '22시 이후 기준',     val: '58/100 ⚠', red: true },
    ],
    insight: '학군 62점 — 보완 필요. 야간 소음 58점 주의. 반경 500m 소아과 3곳·공원 2곳으로 육아 인프라는 양호.',
  },
  {
    tab: '재택근무 하시는 분',
    icon: '💻',
    title: '평일 낮 소음이 진짜 문제',
    desc: '주 3일 이상 재택, 집에서 화상회의·집중 업무를 하는 분',
    scores: [82, 90, 60, 78, 85, 68],
    stats: [
      { label: '평일 오전 제보', sub: '9–12시 기준',    val: '3건',   red: false },
      { label: '현재 공사 건수', sub: '반경 내 활성',   val: '0건',   red: false },
      { label: '주변 카페',      sub: '반경 500m 내',   val: '14곳',  red: false },
    ],
    insight: '평일 오전 소음 제보 3건(양호). 현재 공사 0건. 카페 14곳으로 외부 근무 대안 풍부. 재택 환경 적합.',
  },
  {
    tab: '투자도 고려하시는 분',
    icon: '📈',
    title: '입지 가치까지 한 번에 분석',
    desc: '실거주하면서 향후 시세·개발 가치도 함께 따지는 분',
    scores: [85, 80, 65, 55, 88, 78],
    stats: [
      { label: '개발 잠재력 점수', sub: '입지 종합 지수',  val: '78/100', red: false },
      { label: '교통 신설 예정',   sub: '5호선 연장',      val: '2027 Q3', red: false },
      { label: '상권 성장세',      sub: '최근 2년 개업률', val: '+23%',   red: false },
    ],
    insight: '개발 잠재력 78점. 5호선 연장 2027년 예정. 상권 성장세 +23%. 교통·상권 모두 상위권으로 투자 매력 높음.',
  },
  {
    tab: '청약 당첨 후 이주',
    icon: '🏠',
    title: '낯선 동네, 미리 파악하기',
    desc: '청약 당첨 후 처음 가보는 지역에 입주를 앞두고 있는 분',
    scores: [70, 64, 72, 80, 60, 75],
    stats: [
      { label: '현재 인프라 점수', sub: '현재 기준',    val: '64/100', red: false },
      { label: '입주 시점 예상',   sub: '개발 완료 후', val: '79/100', red: false },
      { label: '신설 예정 시설',   sub: '입주 전후',    val: '3곳',    red: false },
    ],
    insight: '현재 인프라 64점 → 입주 시점 79점 예상. 이마트·초등학교·버스환승센터 3개 시설 신설 예정.',
  },
];

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activePersna, setActivePersona] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const target = 23400;
    let current = 0;
    const step = Math.ceil(target / 50);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCounter(current);
      if (current >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/analysis?address=${encodeURIComponent(searchVal.trim())}`);
    }
  }

  const p = PERSONAS[activePersna];

  return (
    <div className={styles.root}>

      {/* ══ GNB ══ */}
      <header className={styles.gnb}>
        <div className={styles.gnbInner}>
          <Link href="/" className={styles.gnbLogo}>
            <div className={styles.gnbLogoMark} />
            <span>무브IQ</span>
          </Link>

          <form className={styles.gnbSearch} onSubmit={handleSearch}>
            <svg className={styles.gnbSearchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="이사 예정 주소 입력 (예: 마포구 성산동)"
              className={styles.gnbSearchInput}
            />
            <button type="submit" className={styles.gnbSearchBtn}>분석하기</button>
          </form>

          <nav className={styles.gnbNav}>
            <Link href="/noise-map" className={styles.gnbNavLink}>소음 지도</Link>
            <Link href="/analysis"  className={styles.gnbNavLink}>입지 분석</Link>
            <Link href="/community" className={styles.gnbNavLink}>커뮤니티</Link>
          </nav>

          <div className={styles.gnbActions}>
            <AuthButton />
          </div>

          <button className={styles.hamburger} onClick={() => setMobileMenuOpen(v => !v)} aria-label="메뉴">
            <span /><span /><span />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <Link href="/noise-map" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>🔊 소음 지도</Link>
            <Link href="/analysis"  className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>🏙️ 입지 분석</Link>
            <Link href="/community" className={styles.mobileLink} onClick={() => setMobileMenuOpen(false)}>💬 커뮤니티</Link>
          </div>
        )}
      </header>

      {/* ══ 01 HERO ══ */}
      <section className={styles.hero}>
        <div className={styles.heroBgCircle1} />
        <div className={styles.heroBgCircle2} />
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              실시간 소음 크라우드 × AI 입지 분석
            </div>

            <h1 className={styles.heroH1}>
              이사 후 후회,<br />
              <em>42%</em>가 겪는다.<br />
              계약 전 <em>3분</em>이면<br />
              막을 수 있습니다.
            </h1>

            <p className={styles.heroSub}>
              층간소음 이력, 야간 유흥가 소음, 진행 중인 공사 현황,<br />
              학군·인프라·개발계획까지 — 주소 하나로.
            </p>

            <form className={styles.heroSearchForm} onSubmit={handleSearch}>
              <input
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                placeholder="이사 예정지 주소를 입력하세요"
                className={styles.heroSearchInput}
              />
              <button type="submit" className={styles.heroSearchBtn}>3분 분석 시작 →</button>
            </form>

            <Link href="/noise-map" className={styles.heroSecLink}>
              가입 없이 소음 지도 먼저 보기 →
            </Link>

            <div className={styles.heroBadgeRow}>
              <span>✓ {counter.toLocaleString()}건 데이터 집계</span>
              <span>✓ 가입 없이 지도 열람</span>
              <span>✓ 24시간 환불 보장</span>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroCard}>
              <div className={styles.heroCardTop}>
                <span className={styles.heroCardAddr}>📍 마포구 성산동</span>
                <span className={styles.heroCardLive}>실시간</span>
              </div>
              <div className={styles.heroScoreBig}>
                <span className={styles.heroScoreNum}>75</span>
                <span className={styles.heroScoreDenom}>/100</span>
                <span className={styles.heroScoreGrade}>B+</span>
              </div>
              <div className={styles.heroScoreGrid}>
                {[
                  { label: '교통', score: 80 }, { label: '인프라', score: 88 },
                  { label: '학군', score: 62 }, { label: '소음', score: 45 },
                  { label: '상권', score: 79 }, { label: '개발', score: 72 },
                ].map(item => (
                  <div key={item.label} className={styles.heroScoreItem}>
                    <div className={styles.heroScoreLabel}>{item.label}</div>
                    <div className={styles.heroScoreBar}>
                      <div
                        className={styles.heroScoreBarFill}
                        style={{ width: `${item.score}%`, background: item.score >= 80 ? 'var(--main)' : item.score >= 60 ? 'var(--main-lite)' : '#e0a84b' }}
                      />
                    </div>
                    <div className={styles.heroScoreVal} style={{ color: item.score >= 80 ? 'var(--main)' : item.score >= 60 ? 'var(--main-lite)' : '#e0a84b' }}>
                      {item.score}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.heroAiComment}>
                🤖 교통·인프라 우수. 소음 환경 개선 여지 있음. 재개발 구역 인접 호재.
              </div>
              <div className={styles.heroNoiseRow}>
                <div className={styles.heroNoiseBadge} style={{ background: '#fff3cd', color: '#856404' }}>🎵 유흥 2건</div>
                <div className={styles.heroNoiseBadge} style={{ background: '#f8d7da', color: '#721c24' }}>🏠 층간 3건</div>
                <div className={styles.heroNoiseBadge} style={{ background: '#d1ecf1', color: '#0c5460' }}>🏗️ 공사 1건</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 02 PAIN POINT ══ */}
      <section className={styles.pain} id="pain">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>이사 결정의 현실</div>
          <h2 className={styles.sectionTitle}>
            이사 준비에 평균 <strong>3주</strong>를 쓰는데,<br />
            정작 중요한 정보는 어디에도 없습니다.
          </h2>

          <div className={styles.painCards}>
            <div className={styles.painCard}>
              <div className={styles.painCardTag}>문제 01</div>
              <div className={styles.painCardNum}>37%</div>
              <div className={styles.painCardTitle}>낮에는 조용했는데...</div>
              <p className={styles.painCardDesc}>
                낮에 방문해서 조용하다고 확인해도, 입주 첫 달 이내 심각한 소음을 경험합니다.
                심야 유흥가·주말 공사 소음은 낮 방문으로 절대 파악할 수 없습니다.
              </p>
            </div>
            <div className={styles.painCard}>
              <div className={styles.painCardTag}>문제 02</div>
              <div className={styles.painCardNum}>5개</div>
              <div className={styles.painCardTitle}>앱을 돌아다녀도 없다</div>
              <p className={styles.painCardDesc}>
                부동산 앱, 학교알리미, 국토부, 구청 홈페이지, 카카오맵. 
                5개 앱을 뒤져도 "이 동네 소음이 어떤가"는 어디에도 없습니다.
              </p>
            </div>
            <div className={styles.painCard}>
              <div className={styles.painCardTag}>문제 03</div>
              <div className={styles.painCardNum}>200만원</div>
              <div className={styles.painCardTitle}>이사 후 후회의 비용</div>
              <p className={styles.painCardDesc}>
                이사 후 42%가 입지를 후회합니다. 이사 비용 평균 200만원+, 
                재이사까지 평균 18개월. 층간소음 민원만 연 40만 건이 넘습니다.
              </p>
            </div>
          </div>

          <div className={styles.painTransition}>
            이사를 앞둔 3주 동안, 가장 중요한 정보를 찾는 데 가장 많은 시간이 듭니다.<br />
            <strong>무브IQ는 그 시간을 3분으로 줄입니다.</strong>
          </div>
        </div>
      </section>

      {/* ══ 03 SOLUTION ══ */}
      <section className={styles.solution} id="solution">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>무브IQ의 해결책</div>
          <h2 className={styles.sectionTitle}>
            주소 하나, 3분.<br />
            <strong>42%</strong>가 겪는 후회를 <strong>12%</strong>로 줄입니다.
          </h2>

          <div className={styles.moduleGrid}>
            <div className={styles.moduleCard}>
              <div className={styles.moduleIcon}>🔊</div>
              <div className={styles.moduleNum}>모듈 01</div>
              <div className={styles.moduleTitle}>소음 크라우드 지도</div>
              <p className={styles.moduleDesc}>
                23,400건의 실거주자 제보. 새벽·오전·오후·심야 4개 시간대 필터.
                층간소음·공사·유흥가·교통 소음을 지도 위에서 확인합니다.
              </p>
              <div className={styles.moduleFakeMap}>
                <div className={styles.moduleFakeMapGrid} />
                <div className={styles.moduleFakePin} style={{ top: '35%', left: '55%', background: '#e74c3c' }} />
                <div className={styles.moduleFakePin} style={{ top: '58%', left: '32%', background: '#f39c12' }} />
                <div className={styles.moduleFakePin} style={{ top: '70%', left: '68%', background: '#e74c3c' }} />
                <div className={styles.moduleFakeLabel}>심야 22시 기준</div>
              </div>
            </div>

            <div className={styles.moduleCard}>
              <div className={styles.moduleIcon}>🏙️</div>
              <div className={styles.moduleNum}>모듈 02</div>
              <div className={styles.moduleTitle}>AI 입지 분석 리포트</div>
              <p className={styles.moduleDesc}>
                교통·인프라·학군·소음·상권·개발잠재력 6개 레이어를 AI가 100점 만점으로 종합 채점.
                한 줄 평가로 요약해드립니다.
              </p>
              <div className={styles.moduleChart}>
                {[80, 62, 45, 88, 79, 72].map((h, i) => (
                  <div key={i} className={styles.moduleChartBar}
                    style={{ height: `${h * 0.7}%`, background: h >= 80 ? 'var(--main)' : h >= 60 ? 'var(--sub)' : '#f0c070' }}
                  />
                ))}
              </div>
            </div>

            <div className={styles.moduleCard}>
              <div className={styles.moduleIcon}>📅</div>
              <div className={styles.moduleNum}>모듈 03</div>
              <div className={styles.moduleTitle}>개발계획 5년 타임라인</div>
              <p className={styles.moduleDesc}>
                재개발·재건축·교통 신설 예정을 5년 타임라인으로 표시.
                현재 진행 중인 공사 건수와 예상 종료일도 확인할 수 있습니다.
              </p>
              <div className={styles.moduleTimeline}>
                <div className={styles.moduleTimelineBar} />
                {[20, 50, 80].map((left, i) => (
                  <div key={i} className={styles.moduleTimelineDot}
                    style={{ left: `${left}%`, background: i === 0 ? 'var(--main)' : i === 1 ? 'var(--sub)' : 'var(--bg3)' }}
                  />
                ))}
              </div>
            </div>

            <div className={styles.moduleCard}>
              <div className={styles.moduleIcon}>💬</div>
              <div className={styles.moduleNum}>모듈 04</div>
              <div className={styles.moduleTitle}>실거주자 커뮤니티</div>
              <p className={styles.moduleDesc}>
                데이터가 말 못하는 것을 먼저 살아본 사람이 알려줍니다.
                동네 질문·소음 후기·이사 후기·생활 꿀팁을 공유하는 공간입니다.
              </p>
              <div className={styles.moduleNodes}>
                {['성산동 3개월 후기', '주차 꿀팁 공유', '윗집 소음 해결법'].map(t => (
                  <div key={t} className={styles.moduleNodeRow}>
                    <span>💬 {t}</span>
                    <span className={styles.moduleNodeNew}>새 글</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 04 HOW IT WORKS ══ */}
      <section className={styles.how} id="how">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>사용 방법</div>
          <h2 className={styles.sectionTitle}>딱 3단계면 됩니다</h2>

          <div className={styles.stepGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepTitle}>주소 입력</div>
              <p className={styles.stepDesc}>이사 예정지 주소를 입력하세요. 동 이름만 입력해도 됩니다.</p>
              <div className={styles.stepTime}>약 30초</div>
            </div>
            <div className={styles.stepArrow}>→</div>
            <div className={`${styles.stepCard} ${styles.stepCardMain}`}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepTitle}>소음 + 입지 확인</div>
              <p className={styles.stepDesc}>소음 제보 현황, 6개 레이어 AI 점수, 개발 예정 5년 타임라인이 자동으로 나옵니다.</p>
              <div className={styles.stepTime}>약 2분 (핵심 단계)</div>
            </div>
            <div className={styles.stepArrow}>→</div>
            <div className={styles.stepCard}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepTitle}>주민에게 물어보기</div>
              <p className={styles.stepDesc}>해당 동네 커뮤니티에서 실거주자 후기를 읽거나 직접 질문하세요.</p>
              <div className={styles.stepTime}>선택사항</div>
            </div>
          </div>

          <p className={styles.howNote}>
            * 소음 지도 열람과 커뮤니티 읽기는 가입 없이 가능합니다. 리포트 저장과 AI 분석은 무료 가입이 필요합니다.
          </p>
        </div>
      </section>

      {/* ══ 05 PERSONA ══ */}
      <section className={styles.persona} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>내 상황에 맞는 기능</div>
          <h2 className={styles.sectionTitle}>어떤 상황이신가요?</h2>

          <div className={styles.personaTabs}>
            {PERSONAS.map((per, i) => (
              <button
                key={i}
                className={`${styles.personaTab} ${activePersna === i ? styles.personaTabActive : ''}`}
                onClick={() => setActivePersona(i)}
              >
                <span>{per.icon}</span> {per.tab}
              </button>
            ))}
          </div>

          <div className={styles.personaContent}>
            <div className={styles.personaLeft}>
              <h3 className={styles.personaTitle}>{p.title}</h3>
              <p className={styles.personaDesc}>{p.desc}</p>
              <div className={styles.personaStats}>
                {p.stats.map((s, i) => (
                  <div key={i} className={styles.personaStat}>
                    <div className={styles.personaStatMeta}>
                      <div className={styles.personaStatLabel}>{s.label}</div>
                      <div className={styles.personaStatSub}>{s.sub}</div>
                    </div>
                    <div className={`${styles.personaStatVal} ${s.red ? styles.personaStatValRed : ''}`}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.personaRight}>
              <div className={styles.personaInsightBox}>
                <div className={styles.personaInsightLabel}>🤖 AI 분석 코멘트</div>
                <p className={styles.personaInsightText}>{p.insight}</p>
              </div>
              <div className={styles.personaChartBox}>
                {(() => {
                  const cx = 110, cy = 110, r = 80, n = 6;
                  const gridLevels = radarGrid(cx, cy, r, 4, n);
                  const axes       = radarAxes(cx, cy, r, n);
                  const dataPoints = radarPolygon(p.scores, cx, cy, r);
                  const labelDist  = r + 20;
                  const labelPts   = RADAR_LABELS.map((lbl, i) => {
                    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                    return {
                      lbl,
                      x: cx + labelDist * Math.cos(angle),
                      y: cy + labelDist * Math.sin(angle),
                      score: p.scores[i],
                    };
                  });
                  return (
                    <svg viewBox="0 0 220 220" className={styles.personaRadar}>
                      {/* 그리드 */}
                      {gridLevels.map((pts, i) => (
                        <polygon key={i} points={pts} fill="none" stroke="var(--border)" strokeWidth="0.8"/>
                      ))}
                      {/* 축선 */}
                      {axes.map(([ax, ay], i) => (
                        <line key={i} x1={cx} y1={cy} x2={ax} y2={ay} stroke="var(--border)" strokeWidth="0.8"/>
                      ))}
                      {/* 데이터 폴리곤 */}
                      <polygon
                        points={dataPoints}
                        fill="rgba(100,111,75,0.18)"
                        stroke="var(--main)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      {/* 데이터 포인트 */}
                      {radarPolygon(p.scores, cx, cy, r).split(' ').map((pt, i) => {
                        const [px, py] = pt.split(',').map(Number);
                        return <circle key={i} cx={px} cy={py} r="3.5" fill="var(--main)" stroke="#fff" strokeWidth="1.5"/>;
                      })}
                      {/* 라벨 */}
                      {labelPts.map(({ lbl, x, y, score }, i) => (
                        <text key={i} x={x} y={y}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize="9" fill="var(--muted)" fontFamily="Pretendard, sans-serif"
                        >
                          {lbl}
                        </text>
                      ))}
                    </svg>
                  );
                })()}
                <div className={styles.personaChartLabel}>
                  종합 점수: <strong style={{ color: 'var(--main)' }}>
                    {Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length)}점
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 06 SOCIAL PROOF ══ */}
      <section className={styles.proof} id="proof">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>실제 사용자 후기</div>
          <h2 className={styles.sectionTitle}>계약 전에 확인한 사람들</h2>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <div className={styles.statNum}>{counter.toLocaleString()}+</div>
              <div className={styles.statLabel}>실거주자 소음 제보</div>
            </div>
            <div className={styles.statItem}>
              <div className={`${styles.statNum} ${styles.statNumGreen}`}>12%</div>
              <div className={styles.statLabel}>무브IQ 사용자 후회율<br /><small>전체 평균 42% 대비</small></div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNum}>4.8</div>
              <div className={styles.statLabel}>사용자 평점<br /><small>리뷰 1,240개 기준</small></div>
            </div>
          </div>

          <div className={styles.reviewGrid}>
            {[
              { stars: 5, text: '"층간소음 제보가 5건 있는 걸 보고 계약을 포기했어요. 그 집 지금도 계속 새 제보가 올라오더라고요. 200만원짜리 이사 비용을 아꼈습니다."', name: '32세, 마포구 이사 준비자' },
              { stars: 5, text: '"재택근무자라 평일 낮 소음이 제일 걱정이었어요. 오전 시간대 필터로 확인하고 5분 만에 결론 냈습니다. 지금 이사한 곳, 공사 제보 0건이에요."', name: '28세, 성동구 전세 계약 완료' },
              { stars: 5, text: '"중개사가 조용한 동네라고 했는데 소음 지도에 노래방 제보 3건, 유흥업소 6곳이 나왔어요. 직접 확인하고 계약 안 했습니다."', name: '41세, 영등포구 전세 취소' },
            ].map((r, i) => (
              <div key={i} className={styles.reviewCard}>
                <div className={styles.reviewStars}>{'★'.repeat(r.stars)}</div>
                <p className={styles.reviewText}>{r.text}</p>
                <div className={styles.reviewName}>— {r.name}</div>
              </div>
            ))}
          </div>

          {/* 비교 테이블 */}
          <div className={styles.compareWrap}>
            <div className={styles.compareTitle}>타 서비스와 비교</div>
            <div className={styles.compareTableWrap}>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th>기능</th>
                    <th className={styles.thMain}>무브IQ</th>
                    <th>경쟁사 A</th>
                    <th>경쟁사 B</th>
                    <th>경쟁사 C</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['소음 이력 데이터',  '✓', '✗', '✗', '✗'],
                    ['AI 입지 종합 분석', '✓', '△', '△', '✗'],
                    ['개발계획 타임라인', '✓', '✗', '✗', '△'],
                    ['실거주자 커뮤니티', '✓', '✗', '△', '✗'],
                    ['무료 기본 열람',    '✓', '✓', '✓', '✓'],
                  ].map(([cap, ...vals], i) => (
                    <tr key={i}>
                      <td>{cap}</td>
                      {vals.map((v, j) => (
                        <td key={j} className={j === 0 ? styles.tdMain : ''}>
                          <span className={v === '✓' ? (j === 0 ? styles.checkMain : styles.checkOther) : v === '△' ? styles.checkPartial : styles.checkNo}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 07 PRICING ══ */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>요금제</div>
          <h2 className={styles.sectionTitle}>이사 결정에 쓰는 비용</h2>
          <p className={styles.pricingAnchor}>
            부동산 컨설팅 비용: <s>30만원~</s> &nbsp;|&nbsp; 무브IQ: <strong>4,900원부터</strong>
          </p>

          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingTierLabel}>무료 플랜</div>
              <div className={styles.pricingPlan}>게스트</div>
              <div className={styles.pricingPrice}>0<span>원</span></div>
              <ul className={styles.pricingFeats}>
                <li className={styles.featOn}>✓ 소음 지도 열람</li>
                <li className={styles.featOn}>✓ 커뮤니티 읽기</li>
                <li className={styles.featOn}>✓ 기본 입지 점수 (월 3회)</li>
                <li className={styles.featOff}>✗ AI 분석 리포트</li>
                <li className={styles.featOff}>✗ PDF 저장</li>
              </ul>
              <Link href="/noise-map" className={styles.pricingBtnSecondary}>지도 먼저 보기</Link>
            </div>

            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.pricingBadge}>가장 많이 선택</div>
              <div className={styles.pricingTierLabel}>이사 한 번</div>
              <div className={styles.pricingPlan}>원타임</div>
              <div className={styles.pricingPrice}>4,900<span>원</span></div>
              <div className={styles.pricingUnit}>단건 결제</div>
              <ul className={styles.pricingFeats}>
                <li className={styles.featOn}>✓ 완전한 AI 입지 분석 1회</li>
                <li className={styles.featOn}>✓ 6개 레이어 상세 데이터</li>
                <li className={styles.featOn}>✓ 개발잠재력 5년 타임라인</li>
                <li className={styles.featOn}>✓ PDF 리포트 저장 + 공유</li>
                <li className={styles.featOn}>✓ 커뮤니티 글 작성</li>
              </ul>
              <button className={styles.pricingBtnMain} disabled>곧 출시 예정</button>
            </div>

            <div className={styles.pricingCard}>
              <div className={styles.pricingTierLabel}>월 구독</div>
              <div className={styles.pricingPlan}>프리미엄</div>
              <div className={styles.pricingPrice}>14,900<span>원/월</span></div>
              <ul className={styles.pricingFeats}>
                <li className={styles.featOn}>✓ 무제한 AI 입지 분석</li>
                <li className={styles.featOn}>✓ 지역 동시 비교 (최대 5곳)</li>
                <li className={styles.featOn}>✓ 소음 신규 제보 실시간 알림</li>
                <li className={styles.featOn}>✓ 주간 동네 리포트</li>
                <li className={styles.featOn}>✓ 커뮤니티 주민 인증</li>
              </ul>
              <button className={styles.pricingBtnSecondary} disabled>곧 출시 예정</button>
            </div>
          </div>

          <div className={styles.pricingNote}>
            첫 분석 후 24시간 이내 환불 가능 · 월 구독 언제든 해지 가능
          </div>
        </div>
      </section>

      {/* ══ 08 FAQ ══ */}
      <section className={styles.faq} id="faq">
        <div className={styles.sectionInner}>
          <div className={styles.sectionEyebrow}>자주 묻는 질문</div>
          <h2 className={styles.sectionTitle}>궁금한 점이 있으신가요?</h2>

          <div className={styles.faqList}>
            {FAQ_DATA.map((item, i) => (
              <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ''}`}>
                <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{item.q}</span>
                  <span className={styles.faqArrow}>{openFaq === i ? '▲' : '▼'}</span>
                </button>
                {openFaq === i && <p className={styles.faqA}>{item.a}</p>}
              </div>
            ))}
          </div>

          {/* 불편사항 접수 */}
          <FeedbackBox />
        </div>
      </section>

      {/* ══ 09 FINAL CTA ══ */}
      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <div className={styles.finalCtaBgDecor} />
          <h2 className={styles.finalCtaTitle}>
            42%가 겪는 이사 후 후회,<br />
            지금 확인하면 피할 수 있습니다.
          </h2>
          <p className={styles.finalCtaSub}>
            소음 제보 23,400건 · 6개 레이어 AI 분석 · 실거주자 커뮤니티<br />
            무료로 시작할 수 있습니다.
          </p>
          <form onSubmit={handleSearch} className={styles.finalCtaForm}>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="이사 예정지 주소를 입력하세요"
              className={styles.finalCtaInput}
            />
            <button type="submit" className={styles.finalCtaBtn}>3분 분석 시작 →</button>
          </form>
          <div className={styles.finalCtaBadges}>
            <span>✓ 가입 없이 지도 열람</span>
            <span>✓ 24시간 환불 보장</span>
            <span>✓ 월 구독 언제든 해지</span>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <div className={styles.footerLogoMark} />
                <span>무브IQ</span>
              </div>
              <p className={styles.footerTagline}>
                이사 후 "알았다면 안 왔을 텐데"가<br />없는 세상을 만듭니다.
              </p>
            </div>

            <div className={styles.footerCols}>
              <div className={styles.footerCol}>
                <div className={styles.footerColTitle}>서비스</div>
                <Link href="/noise-map" className={styles.footerLink}>소음 지도</Link>
                <Link href="/analysis"  className={styles.footerLink}>입지 분석</Link>
                <Link href="/community" className={styles.footerLink}>커뮤니티</Link>
              </div>
              <div className={styles.footerCol}>
                <div className={styles.footerColTitle}>고객지원</div>
                <Link href="/legal/notice"  className={styles.footerLink}>공지사항</Link>
                <a href="mailto:admin@moveiq.co.kr" className={styles.footerLink}>문의하기</a>
              </div>
              <div className={styles.footerCol}>
                <div className={styles.footerColTitle}>법적 고지</div>
                <Link href="/legal/terms"   className={styles.footerLink}>이용약관</Link>
                <Link href="/legal/privacy" className={styles.footerLink}>개인정보처리방침</Link>
              </div>
            </div>
          </div>
          <div className={styles.footerCopy}>© 2026 MoveIQ. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}

// ── 불편사항 접수 컴포넌트 ───────────────────────────────
function FeedbackBox() {
  const [sent, setSent]     = useState(false);
  const [type, setType]     = useState('');
  const [text, setText]     = useState('');
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSessionId(localStorage.getItem('moveiq_session_id') ?? '');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text, email, session_id: sessionId || undefined }),
      });
      if (!res.ok) throw new Error('api_unavailable');
      setSent(true);
    } catch {
      // fallback: mailto 열기
      const subject = encodeURIComponent(`[무브IQ 불편사항] ${type}`);
      const body    = encodeURIComponent(`유형: ${type}\n\n내용:\n${text}\n\n${email ? `연락처: ${email}` : ''}`);
      window.open(`mailto:admin@moveiq.co.kr?subject=${subject}&body=${body}`);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  const TYPES = [
    { icon: '🐛', label: '버그 신고' },
    { icon: '💡', label: '기능 건의' },
    { icon: '📊', label: '데이터 오류' },
    { icon: '💬', label: '기타 불편' },
  ];

  return (
    <div style={{
      marginTop: 40, background: '#fff', border: '1px solid rgba(100,111,75,.15)',
      borderRadius: 16, padding: '32px 28px',
      boxShadow: '0 2px 12px rgba(100,111,75,.06)',
    }}>
      {sent ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1e15', marginBottom: 6 }}>
            접수 완료! 감사합니다.
          </div>
          <p style={{ fontSize: 13, color: '#7a8570', lineHeight: 1.7 }}>
            소중한 의견은 서비스 개선에 반영됩니다.<br />
            영업일 기준 3일 이내 검토 후 답변드립니다.
          </p>
          <button
            onClick={() => { setSent(false); setType(''); setText(''); setEmail(''); }}
            style={{ marginTop: 16, fontSize: 13, color: '#646F4B', background: 'none', border: '1px solid #646F4B', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
          >
            다른 의견 보내기
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>🙋</span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1e15' }}>불편하셨나요?</div>
              <div style={{ fontSize: 13, color: '#7a8570', marginTop: 2 }}>
                버그·오류·개선 제안 무엇이든 알려주세요. 직접 확인하겠습니다.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
            {/* 유형 선택 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {TYPES.map(t => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setType(t.label)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 24,
                    border: `1.5px solid ${type === t.label ? '#646F4B' : 'rgba(100,111,75,.2)'}`,
                    background: type === t.label ? '#646F4B' : '#fff',
                    color: type === t.label ? '#fff' : '#3d4535',
                    fontSize: 13, fontWeight: type === t.label ? 700 : 500,
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* 내용 입력 */}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="어떤 점이 불편하셨나요? 구체적으로 알려주시면 빠르게 개선하겠습니다."
              required
              rows={4}
              style={{
                width: '100%', padding: '12px 14px',
                background: '#f7faf5', border: '1.5px solid rgba(100,111,75,.15)',
                borderRadius: 10, fontSize: 14, color: '#1a1e15',
                outline: 'none', resize: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#646F4B'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(100,111,75,.15)'; e.target.style.background = '#f7faf5'; }}
            />

            {/* 이메일 (선택) */}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="답변받을 이메일 (선택사항)"
              style={{
                width: '100%', marginTop: 8, padding: '11px 14px',
                background: '#f7faf5', border: '1.5px solid rgba(100,111,75,.15)',
                borderRadius: 10, fontSize: 13, color: '#1a1e15',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#646F4B'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(100,111,75,.15)'; e.target.style.background = '#f7faf5'; }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 11, color: '#a4ad98' }}>
                또는 <a href="mailto:admin@moveiq.co.kr" style={{ color: '#646F4B', fontWeight: 600 }}>admin@moveiq.co.kr</a>으로 직접 보내셔도 됩니다.
              </span>
              <button
                type="submit"
                disabled={loading || !type || !text.trim()}
                style={{
                  padding: '11px 24px', background: '#646F4B', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: loading || !type || !text.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !type || !text.trim() ? 0.5 : 1,
                  transition: 'all .2s', fontFamily: 'inherit',
                }}
              >
                {loading ? '전송 중...' : '의견 보내기'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
