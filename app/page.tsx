'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthButton from './components/AuthButton';
import styles from './page.module.css';

// ── 모달 콘텐츠 ─────────────────────────────────────────
const PAGES: Record<string, { title: string; body: string }> = {
  '이용약관': {
    title: '이용약관',
    body: `■ 제1조 (목적)\n본 약관은 무브IQ(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.\n\n■ 제2조 (서비스 제공)\n서비스는 소음 크라우드 지도, AI 입지 분석 정보를 제공합니다. 제공되는 정보는 참고용이며, 최종 이사 결정의 책임은 이용자에게 있습니다.\n\n■ 제3조 (이용자 의무)\n• 허위 소음 제보 금지\n• 타인의 권리 침해 금지\n• 서비스 정상 운영 방해 금지\n\n■ 제4조 (면책조항)\n서비스가 제공하는 분석 결과는 AI 및 크라우드 데이터 기반으로 100% 정확성을 보장하지 않습니다.\n\n문의: admin@moveiq.co.kr`,
  },
  '개인정보처리방침': {
    title: '개인정보처리방침',
    body: `무브IQ는 이용자의 개인정보를 중요시하며 개인정보보호법을 준수합니다.\n\n■ 수집하는 개인정보\n• 소음 제보 시: 제보 위치(50m 반경 랜덤화), IP 주소\n• 회원가입 시: 이메일, 닉네임\n\n■ 개인정보 보유 및 파기\n• 소음 제보: 제보일로부터 90일 후 자동 삭제\n• 회원 탈퇴 시: 즉시 파기\n\n문의: admin@moveiq.co.kr`,
  },
};

// ── FAQ 데이터 ─────────────────────────────────────────
const FAQ_DATA = [
  {
    q: '소음 제보 데이터는 신뢰할 수 있나요?',
    a: '모든 제보는 계정 인증 사용자만 등록 가능합니다. 동일 IP에서 10분 내 5건 초과 시 자동 차단, 제보 위치는 반경 50m 익명화 처리됩니다. 현재 누적 제보 23,400건, 이 중 71%가 서울·경기 지역입니다.',
  },
  {
    q: '제보가 없는 동네도 분석되나요?',
    a: '네. 크라우드 데이터가 없는 지역은 공공 소음 측정값, 유흥업소 등록 수, 공사 허가 데이터로 대체합니다. 교통·인프라·학군·상권·개발잠재력 5개 레이어는 전국 어디든 분석 가능합니다.',
  },
  {
    q: '가입 없이 쓸 수 있는 기능이 뭔가요?',
    a: '소음 지도 열람, 커뮤니티 읽기, 기본 입지 점수 확인(월 3회)은 가입 없이 가능합니다. 소음 제보, AI 분석 저장, 커뮤니티 글 작성은 무료 가입이 필요합니다.',
  },
  {
    q: '데이터는 얼마나 최신인가요?',
    a: '소음 크라우드 제보는 실시간 반영됩니다. 생활 인프라 데이터는 매월 갱신, 도시계획 데이터는 분기별 갱신(국토부 공시 기준)입니다.',
  },
  {
    q: '환불이 되나요?',
    a: '첫 분석 완료 후 24시간 이내 요청 시 전액 환불됩니다. 월 구독은 다음 결제일 전 언제든 해지 가능합니다.',
  },
  {
    q: '모바일에서도 쓸 수 있나요?',
    a: '네, 모바일 웹으로 전체 기능을 사용할 수 있습니다. 현장 방문 중에 해당 주소를 바로 조회하는 방식으로 많이 사용합니다.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pageModal, setPageModal] = useState<string | null>(null);
  const [counter, setCounter] = useState(23400);

  // 카운터 애니메이션
  useEffect(() => {
    const target = 23400;
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setCounter(current);
      if (current >= target) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/analysis?address=${encodeURIComponent(searchVal.trim())}`);
    }
  }

  return (
    <div className={styles.root}>

      {/* ── GNB ── */}
      <header className={styles.gnb}>
        <div className={styles.gnbInner}>
          <Link href="/" className={styles.gnbLogo}>
            <div className={styles.gnbLogoMark}/>
            <span>무브IQ</span>
          </Link>

          <form className={styles.gnbSearch} onSubmit={handleSearch}>
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="이사 예정 주소 입력 (예: 마포구 성산동)"
              className={styles.gnbSearchInput}
            />
            <button type="submit" className={styles.gnbSearchBtn}>&gt;&gt;</button>
          </form>

          <nav className={styles.gnbNav}>
            <Link href="/noise-map" className={styles.gnbNavLink}>소음 지도</Link>
            <Link href="/analysis"  className={styles.gnbNavLink}>입지 분석</Link>
            <Link href="/community" className={styles.gnbNavLink}>커뮤니티</Link>
          </nav>

          <div className={styles.gnbActions}>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* ── SEC 01 · HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroGrid}/>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot}/>
              실시간 소음 크라우드 × AI 입지 분석 — 무료로 시작
            </div>

            <h1 className={styles.heroH1}>
              이사 후 후회,<br/>
              <span className={styles.heroAccent}>42%</span>가 겪는다.<br/>
              계약 전 <span className={styles.heroAccent}>3분</span>이면<br/>
              막을 수 있습니다.
            </h1>

            <p className={styles.heroSub}>
              층간소음 이력, 야간 유흥가 소음, 진행 중인 공사 현황,<br/>
              학군·인프라·개발계획까지 — 주소 하나로.
            </p>

            <form className={styles.heroSearch} onSubmit={handleSearch}>
              <div className={styles.heroSearchLabel}>TARGET ACQUISITION</div>
              <div className={styles.heroSearchRow}>
                <input
                  value={searchVal}
                  onChange={e => setSearchVal(e.target.value)}
                  placeholder="이사 예정지 주소를 입력하세요..."
                  className={styles.heroSearchInput}
                />
                <button type="submit" className={styles.heroSearchBtn}>
                  [ 3분 분석 실행 ]
                </button>
              </div>
              <Link href="/noise-map" className={styles.heroSecondary}>
                &gt;&gt; 소음 지도 먼저 보기 (가입 불필요)
              </Link>
            </form>

            <div className={styles.heroBadgeRow}>
              <span>✓ {counter.toLocaleString()}건 데이터 집계</span>
              <span>✓ 가입 없이 지도 열람</span>
              <span>✓ 24시간 환불 보장</span>
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.heroCard}>
              <div className={styles.heroCardHeader}>
                <span className={styles.heroCardSys}>SYS_ID: 884.22.A</span>
                <span className={styles.heroCardStatus}>[ LIVE TELEMETRY ]</span>
                <span className={styles.heroCardOnline}>ONLINE</span>
              </div>
              <div className={styles.heroCardMap}>
                <div className={styles.heroMapGrid}/>
                <div className={styles.heroMapPin} style={{top:'38%',left:'62%',background:'#e74c3c'}}/>
                <div className={styles.heroMapPin} style={{top:'55%',left:'43%',background:'#f39c12'}}/>
                <div className={styles.heroMapPin} style={{top:'72%',left:'24%',background:'#e74c3c'}}/>
                <div className={styles.heroMapCrosshair}/>
              </div>
              <div className={styles.heroCardScore}>
                <div className={styles.heroCardScoreLabel}>LOCATION INTEGRITY SCORE</div>
                <div className={styles.heroCardScoreNum}>75<span>/100</span></div>
                <p className={styles.heroCardScoreDesc}>소음 환경 주의 감지.<br/>유흥 간섭 반경 내 존재.</p>
                <div className={styles.heroCardScoreBar}><div className={styles.heroCardScoreFill}/></div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.heroSecLabel}>SEC.02 // ANOMALY DETECTION</div>
      </section>

      {/* ── SEC 02 · PAIN POINT ── */}
      <section className={styles.pain} id="pain">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>SEC.02 // ANOMALY DETECTION</div>
          <h2 className={styles.painTitle}>
            이사 준비에 평균 <span>3주</span>를 쓰는데,<br/>
            정작 중요한 정보는 어디에도 없다.
          </h2>

          <div className={styles.painCards}>
            {/* 카드 1 */}
            <div className={styles.painCard}>
              <div className={styles.painCardTag}>ERR.01 : TIME TRAP</div>
              <div className={styles.painCardNum}>37%</div>
              <div className={styles.painCardTitle}>DAYTIME ILLUSION</div>
              <p className={styles.painCardDesc}>
                낮에 방문해서 "조용하다"고 확인해도, 입주 첫 달 이내 심각한 소음을 경험한다.
                평일 오전 방문으로는 심야 유흥가·주말 공사 소음을 알 수 없다.
              </p>
            </div>

            {/* 카드 2 */}
            <div className={styles.painCard}>
              <div className={styles.painCardTag}>ERR.02 : FRAGMENTATION</div>
              <div className={styles.painCardNum}>05</div>
              <div className={styles.painCardTitle}>DATA SCATTER</div>
              <p className={styles.painCardDesc}>
                부동산 앱·학교알리미·국토부·구청 홈페이지·카카오맵.
                평균 5개 앱을 돌아다녀도 "이 동네 소음이 어떤가"는 어디에도 없다.
              </p>
            </div>

            {/* 카드 3 */}
            <div className={styles.painCard}>
              <div className={styles.painCardTag}>ERR.03 : FINANCIAL BLEED</div>
              <div className={styles.painCardNum}>2M</div>
              <div className={styles.painCardTitle}>POST-CONTRACT COST</div>
              <p className={styles.painCardDesc}>
                이사 후 42% 후회율. 평균 이사 비용 200만원+, 재이사까지 평균 18개월 소요.
                층간소음 민원 연 40만 건. "몰랐다"는 이유가 너무 비싸다.
              </p>
            </div>
          </div>

          <div className={styles.painTransition}>
            이사를 앞둔 3주 동안, 가장 중요한 정보를 찾는 데 가장 많은 시간이 든다.<br/>
            <strong>무브IQ는 그 시간을 3분으로 줄입니다.</strong>
          </div>
        </div>
      </section>

      {/* ── SEC 03 · SOLUTION ── */}
      <section className={styles.solution} id="solution">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>SEC.03 // CORRECTIVE PROTOCOLS</div>
          <h2 className={styles.solutionTitle}>
            주소 하나, 3분.<br/>
            <span>42%</span>가 겪는 후회를 <span>12%</span>로 줄입니다.
          </h2>

          <div className={styles.moduleGrid}>
            <div className={styles.moduleCard}>
              <div className={styles.moduleTag}>MODULE_01</div>
              <div className={styles.moduleTitle}>ACOUSTIC CROWD-MAP</div>
              <p className={styles.moduleDesc}>
                23,400건의 실거주자 제보. 새벽·오전·오후·심야 4개 시간대 필터.
                층간소음·공사·유흥가·교통 소음 유형별 분리.
              </p>
              <div className={styles.moduleFakeMap}>
                <div className={styles.moduleFakeMapGrid}/>
                <div className={styles.moduleFakeMapLabel}>[FLTR] NIGHT_TIME<br/>[TYPE] TRAFFIC</div>
              </div>
            </div>

            <div className={styles.moduleCard}>
              <div className={styles.moduleTag}>MODULE_02</div>
              <div className={styles.moduleTitle}>AI LOCATION MATRIX</div>
              <p className={styles.moduleDesc}>
                6개 레이어 × 100점 만점 종합 채점.
                교통 / 생활 인프라 / 학군 / 소음 / 상권 활성도 / 개발 잠재력.
              </p>
              <div className={styles.moduleChart}>
                {[62, 45, 80, 55, 72, 88].map((h, i) => (
                  <div key={i} className={styles.moduleChartBar} style={{ height: `${h}%` }}/>
                ))}
              </div>
              <div className={styles.moduleChartLabel}>SYNTHESIS COMPLETE</div>
            </div>

            <div className={styles.moduleCard}>
              <div className={styles.moduleTag}>MODULE_03</div>
              <div className={styles.moduleTitle}>DEVELOPMENT VECTOR</div>
              <p className={styles.moduleDesc}>
                재개발·재건축·교통 신설 — 향후 5년 타임라인.
                현재 공사 건수 + 예상 종료일.
              </p>
              <div className={styles.moduleTimeline}>
                <div className={styles.moduleTimelineBar}/>
                <div className={styles.moduleTimelineDot} style={{ left: '20%' }}/>
                <div className={styles.moduleTimelineDot} style={{ left: '55%', background: 'var(--sub)' }}/>
                <div className={styles.moduleTimelineDot} style={{ left: '80%', background: 'rgba(191,210,191,.4)' }}/>
              </div>
            </div>

            <div className={styles.moduleCard}>
              <div className={styles.moduleTag}>MODULE_04</div>
              <div className={styles.moduleTitle}>RESIDENT NETWORK</div>
              <p className={styles.moduleDesc}>
                데이터가 말 못하는 것을 먼저 살아본 사람이 말해줍니다.
                평균 24시간 이내 답변.
              </p>
              <div className={styles.moduleNodes}>
                {['NODE_A8', 'NODE_B2', 'NODE_C9'].map(n => (
                  <div key={n} className={styles.moduleNodeRow}>
                    <span>{n}</span><span className={styles.moduleNodeVerified}>VERIFIED</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEC 04 · HOW IT WORKS ── */}
      <section className={styles.howItWorks}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabelLight}>OPERATION PROTOCOL</div>
          <h2 className={styles.howTitle}>3 MINUTES. EXACTLY 3 STEPS.</h2>

          <div className={styles.stepGrid}>
            <div className={styles.stepCard}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepTitle}>주소 입력</div>
              <p className={styles.stepDesc}>이사 예정지 주소를 입력하세요. 동 이름만 입력해도 됩니다.</p>
              <div className={styles.stepTime}>T_EST: 30 SEC</div>
            </div>
            <div className={`${styles.stepCard} ${styles.stepCardActive}`}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepTitle}>소음 + 입지 확인</div>
              <p className={styles.stepDesc}>반경 500m 소음 제보, 6개 레이어 AI 점수, 개발 예정 5년 타임라인이 자동으로 나옵니다.</p>
              <div className={styles.stepTime}>T_EST: 2 MIN // CRITICAL PHASE</div>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepTitle}>실거주자에게 묻기</div>
              <p className={styles.stepDesc}>해당 동네 커뮤니티에서 실거주자 후기를 읽거나 직접 질문하세요.</p>
              <div className={styles.stepTime}>T_EST: OPTIONAL</div>
            </div>
          </div>

          <p className={styles.howNote}>
            * 소음 지도 열람과 커뮤니티 읽기는 인증 없이 공개 채널에서 가능합니다.
            리포트 생성과 AI 분석은 가입이 필요합니다.
          </p>
        </div>
      </section>

      {/* ── SEC 05 · FOCUS (페르소나 탭) ── */}
      <section className={styles.focus} id="features">
        <FocusSection />
      </section>

      {/* ── SEC 06 · SOCIAL PROOF ── */}
      <section className={styles.proof}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>SEC.06 // NETWORK TELEMETRY</div>

          {/* 수치 배너 */}
          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <div className={styles.statNum}>{counter.toLocaleString()}+</div>
              <div className={styles.statLabel}>ACOUSTIC NODES ACTIVE</div>
            </div>
            <div className={styles.statItem}>
              <div className={`${styles.statNum} ${styles.statNumGreen}`}>12%</div>
              <div className={styles.statLabel}>REGRET RATE (POST-USE)<br/><small>vs. 전체 평균 42%</small></div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statNum}>4.8</div>
              <div className={styles.statLabel}>NETWORK RATING<br/><small>리뷰 1,240개 기준</small></div>
            </div>
          </div>

          {/* 후기 카드 */}
          <div className={styles.reviewGrid}>
            {[
              { stars: 5, text: '"층간소음 제보가 5건 있는 걸 보고 계약을 포기했어요. 그 집 지금도 계속 새 제보가 올라오더라고요. 200만원짜리 이사 비용을 아꼈습니다."', name: '32세, 마포구 이사 준비자' },
              { stars: 5, text: '"재택근무자라 평일 낮 소음이 제일 걱정이었어요. 오전 시간대 필터로 확인하고 5분 만에 결론 냈습니다. 지금 이사한 곳, 공사 제보 0건이에요."', name: '28세, 성동구 전세 계약 완료' },
              { stars: 5, text: '"중개사가 조용한 동네라고 했는데 소음 지도에 노래방 제보 3건, 유흥업소 6곳이 나왔어요. 직접 확인하고 계약 안 했습니다."', name: '41세, 영등포구 전세 계약 취소' },
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
            <div className={styles.compareTitle}>COMPETITIVE MATRIX</div>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th>CAPABILITY</th>
                  <th className={styles.thHighlight}>MOVE_IQ</th>
                  <th>호갱노노</th>
                  <th>직방</th>
                  <th>네이버부동산</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['소음 이력 데이터',     '[ SUPPORTED ]', '-',       '-',       '-'],
                  ['AI 입지 종합 분석',    '[ SUPPORTED ]', 'Partial', 'Partial', '-'],
                  ['개발계획 타임라인',    '[ SUPPORTED ]', '-',       '-',       'Partial'],
                  ['실거주자 커뮤니티',    '[ 24H SLA ]',   '-',       'Forum',   '-'],
                ].map(([cap, ...vals], i) => (
                  <tr key={i}>
                    <td>{cap}</td>
                    {vals.map((v, j) => (
                      <td key={j} className={j === 0 ? styles.tdHighlight : ''}>
                        <span className={v.startsWith('[') ? styles.supported : styles.unsupported}>{v}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SEC 07 · PRICING ── */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>SEC.07 // ACCESS TIERS</div>
          <div className={styles.pricingAnchor}>
            부동산 컨설팅: <s>300,000 KRW</s>
            <br/>무브IQ 분석: <strong>4,900원부터 시작</strong>
          </div>

          <div className={styles.pricingGrid}>
            {/* TIER 01 */}
            <div className={styles.pricingCard}>
              <div className={styles.pricingTier}>TIER_01</div>
              <div className={styles.pricingPlan}>게스트 접근</div>
              <div className={styles.pricingPrice}>0 <span>KRW</span></div>
              <ul className={styles.pricingFeats}>
                <li>[+] 소음 지도 열람 (제한)</li>
                <li>[+] 커뮤니티 읽기</li>
                <li className={styles.lineThrough}>[–] AI 분석 리포트</li>
                <li className={styles.lineThrough}>[–] PDF 저장</li>
              </ul>
              <Link href="/noise-map" className={styles.pricingBtn}>지도 바로 보기</Link>
            </div>

            {/* TIER 02 — 추천 */}
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.pricingRecommended}>RECOMMENDED</div>
              <div className={styles.pricingTier}>TIER_02</div>
              <div className={styles.pricingPlan}>이사 한 번 프로토콜</div>
              <div className={styles.pricingPrice}>4,900 <span>KRW</span></div>
              <div className={styles.pricingUnit}>ONE-TIME EXTRACTION</div>
              <ul className={styles.pricingFeats}>
                <li>[+] 완전한 AI 입지 분석 1회</li>
                <li>[+] 6개 레이어 상세 데이터</li>
                <li>[+] 개발잠재력 5년 타임라인</li>
                <li>[+] PDF 리포트 저장 + 공유</li>
                <li>[+] 실거주자 커뮤니티 질문</li>
              </ul>
              <button className={`${styles.pricingBtn} ${styles.pricingBtnPrimary}`} disabled>
                준비 중
              </button>
            </div>

            {/* TIER 03 */}
            <div className={styles.pricingCard}>
              <div className={styles.pricingTier}>TIER_03</div>
              <div className={styles.pricingPlan}>브로커 / 프리미엄</div>
              <div className={styles.pricingPrice}>14,900 <span>KRW/MO</span></div>
              <ul className={styles.pricingFeats}>
                <li>[+] 무제한 AI 입지 분석</li>
                <li>[+] 지역 동시 비교 (최대 5곳)</li>
                <li>[+] 소음 신규 제보 실시간 알림</li>
                <li>[+] 주간 동네 리포트</li>
                <li>[+] 커뮤니티 주민 인증</li>
              </ul>
              <button className={styles.pricingBtn} disabled>준비 중</button>
            </div>
          </div>

          <div className={styles.pricingNote}>
            첫 분석 후 24시간 이내 환불 가능 · 월 구독 언제든 해지
          </div>
        </div>
      </section>

      {/* ── SEC 08 · FAQ ── */}
      <section className={styles.faq} id="faq">
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>SEC.08 // DATA ARCHIVE</div>
          <h2 className={styles.faqTitle}>SYSTEM INQUIRIES</h2>
          <div className={styles.faqList}>
            {FAQ_DATA.map((item, i) => (
              <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ''}`}>
                <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{String(i + 1).padStart(2, '0')}. {item.q}</span>
                  <span className={styles.faqArrow}>▾</span>
                </button>
                {openFaq === i && <p className={styles.faqA}>{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEC 09 · FINAL CTA ── */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>
          AVOID THE 42% PROBABILITY OF REGRET.
        </h2>
        <p className={styles.finalCtaSub}>SYSTEM READY FOR ADDRESS INPUT.</p>
        <form onSubmit={handleSearch} className={styles.finalCtaForm}>
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="이사 예정지 주소..."
            className={styles.finalCtaInput}
          />
          <button type="submit" className={styles.finalCtaBtn}>
            [ 3분 분석 실행 ]
          </button>
        </form>
        <div className={styles.finalCtaBadges}>
          <span>✓ 가입 없이 지도 열람</span>
          <span>✓ 24시간 환불 보장</span>
          <span>✓ 월 구독 언제든 해지</span>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <div className={styles.footerLogoMark}/>
            <span>무브IQ</span>
          </div>
          <p className={styles.footerTagline}>
            Advanced Real Estate Telemetry &amp; Acoustic Intelligence Network.
          </p>

          <div className={styles.footerCols}>
            <div>
              <div className={styles.footerColTitle}>MODULES</div>
              <Link href="/noise-map" className={styles.footerLink}>소음 지도</Link>
              <Link href="/analysis"  className={styles.footerLink}>입지 분석</Link>
              <Link href="/community" className={styles.footerLink}>커뮤니티</Link>
            </div>
            <div>
              <div className={styles.footerColTitle}>SUPPORT</div>
              <button className={styles.footerLinkBtn} onClick={() => setPageModal('이용약관')}>이용약관</button>
              <button className={styles.footerLinkBtn} onClick={() => setPageModal('개인정보처리방침')}>개인정보처리방침</button>
              <a href="mailto:admin@moveiq.co.kr" className={styles.footerLink}>문의하기</a>
            </div>
          </div>

          <div className={styles.footerCopy}>© 2026 MoveIQ. All rights reserved.</div>
        </div>
      </footer>

      {/* 페이지 모달 */}
      {pageModal && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setPageModal(null); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>{PAGES[pageModal].title}</h3>
              <button onClick={() => setPageModal(null)}>✕</button>
            </div>
            <pre className={styles.modalBody}>{PAGES[pageModal].body}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 페르소나 탭 컴포넌트 ─────────────────────────────────
const PERSONAS = [
  {
    tab: '소음이 제일 걱정돼요',
    title: 'FOCUS: ACOUSTIC INTEGRITY',
    desc: '소음 트라우마가 있거나 조용한 집이 최우선인 분',
    items: [
      { label: 'VERIFIED REPORTS', sub: '반경 500m 내', val: '142', highlight: false },
      { label: 'PEAK DISTURBANCE', sub: '최대 데시벨 시간', val: '23:00-02:00', highlight: true },
      { label: 'ACTIVE CONSTRUCTION', sub: '진행 중 공사', val: '02 ZONES', highlight: false },
    ],
    analysis: '> ANALYSIS: 심야 소음 집중 감지. 북동 방향 유흥 간섭 최소화를 위해 남향 내부 유닛 권장.',
  },
  {
    tab: '아이 키우기 좋은 곳',
    title: 'FOCUS: FAMILY ENVIRONMENT',
    desc: '영유아 자녀가 있고 학군·환경·소음을 함께 봐야 하는 분',
    items: [
      { label: 'SCHOOL DISTRICT SCORE', sub: '배정 초등학교 기준', val: '62/100', highlight: false },
      { label: 'CHILDCARE FACILITIES', sub: '반경 500m 내', val: '08 NODES', highlight: false },
      { label: 'NIGHT NOISE INDEX', sub: '22시 이후 기준', val: '58/100 ⚠', highlight: true },
    ],
    analysis: '> ANALYSIS: 학군 강화 필요. 야간 소음 지수 주의. 공원·소아과 인프라 양호.',
  },
  {
    tab: '재택근무라 낮 소음',
    title: 'FOCUS: DAYTIME ACOUSTICS',
    desc: '주 3일 이상 재택, 낮 시간 집중 업무가 필요한 분',
    items: [
      { label: 'WEEKDAY AM REPORTS', sub: '오전 9–12시 제보', val: '03건', highlight: false },
      { label: 'ACTIVE CONSTRUCTION', sub: '현재 진행 중', val: '00 ZONES', highlight: false },
      { label: 'CAFE PROXIMITY', sub: '반경 500m', val: '14 NODES', highlight: false },
    ],
    analysis: '> ANALYSIS: 주간 소음 환경 양호. 공사 구역 0. 카페 대체 근무 옵션 풍부.',
  },
  {
    tab: '입지 가치도 봐요',
    title: 'FOCUS: DEVELOPMENT VECTOR',
    desc: '실거주하면서 향후 시세·개발 가치도 따지는 분',
    items: [
      { label: 'DEVELOPMENT SCORE', sub: '입지 잠재력', val: '78/100', highlight: false },
      { label: 'TRANSIT EXPANSION', sub: '5호선 연장 예정', val: '2027 Q3', highlight: false },
      { label: 'COMMERCE TREND', sub: '최근 2년 개업 비율', val: '+23%', highlight: false },
    ],
    analysis: '> ANALYSIS: 개발 잠재력 높음. 교통 인프라 신설 예정. 상권 성장세 지속.',
  },
  {
    tab: '청약 당첨됐어요',
    title: 'FOCUS: UNKNOWN TERRITORY',
    desc: '청약 당첨 후 낯선 지역 입주를 앞두고 있는 분',
    items: [
      { label: 'CURRENT INFRA SCORE', sub: '현재 기준', val: '64/100', highlight: false },
      { label: 'PROJECTED SCORE', sub: '입주 시점 예상', val: '79/100', highlight: false },
      { label: 'PLANNED FACILITIES', sub: '입주 전후 신설', val: '03 NODES', highlight: false },
    ],
    analysis: '> ANALYSIS: 입주 시점 대비 인프라 성장 예상. 이마트 입점·초교 신설 포함.',
  },
];

function FocusSection() {
  const [active, setActive] = useState(0);
  const p = PERSONAS[active];

  return (
    <div className={styles.focusInner}>
      <div className={styles.sectionLabel}>SEC.05 // SCENARIO ANALYSIS</div>
      <h2 className={styles.focusTitle}>어떤 상황이신가요?</h2>

      <div className={styles.focusTabs}>
        {PERSONAS.map((p, i) => (
          <button
            key={i}
            className={`${styles.focusTab} ${active === i ? styles.focusTabActive : ''}`}
            onClick={() => setActive(i)}
          >
            {p.tab}
          </button>
        ))}
      </div>

      <div className={styles.focusContent}>
        <div className={styles.focusLeft}>
          <h3 className={styles.focusCardTitle}>{p.title}</h3>
          <p className={styles.focusCardDesc}>{p.desc}</p>
          <div className={styles.focusStats}>
            {p.items.map((item, i) => (
              <div key={i} className={styles.focusStat}>
                <div className={styles.focusStatLeft}>
                  <div className={styles.focusStatLabel}>{item.label}</div>
                  <div className={styles.focusStatSub}>{item.sub}</div>
                </div>
                <div className={`${styles.focusStatVal} ${item.highlight ? styles.focusStatValRed : ''}`}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.focusRight}>
          <div className={styles.focusAnalysisBox}>
            <div className={styles.focusAnalysisLabel}>DATA_VISUALIZATION_MATRIX</div>
            <span className={styles.focusAnalysisStatus}>[ ACTIVE ]</span>
          </div>
          <div className={styles.focusRadar}>
            {/* 간단한 레이더 차트 시각화 */}
            <svg viewBox="0 0 200 200" className={styles.focusRadarSvg}>
              <polygon points="100,20 160,65 140,140 60,140 40,65" fill="var(--main)" opacity="0.25" stroke="var(--main)" strokeWidth="1.5"/>
              <polygon points="100,20 160,65 140,140 60,140 40,65" fill="none" stroke="var(--border)" strokeWidth="0.5"/>
              <polygon points="100,50 140,80 130,130 70,130 60,80" fill="none" stroke="var(--border)" strokeWidth="0.5"/>
              <polygon points="100,80 120,95 115,120 85,120 80,95" fill="none" stroke="var(--border)" strokeWidth="0.5"/>
              <line x1="100" y1="20" x2="100" y2="180" stroke="var(--border)" strokeWidth="0.5"/>
              <line x1="40" y1="65" x2="160" y2="135" stroke="var(--border)" strokeWidth="0.5"/>
              <line x1="160" y1="65" x2="40" y2="135" stroke="var(--border)" strokeWidth="0.5"/>
            </svg>
          </div>
          <p className={styles.focusAnalysisText}>{p.analysis}</p>
        </div>
      </div>
    </div>
  );
}
