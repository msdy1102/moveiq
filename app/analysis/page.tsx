'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthButton from '../components/AuthButton';
import { useAuth } from '../components/useAuth';
import styles from './analysis.module.css';

// ── 타입 ──────────────────────────────────────────────────────
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

// 지역 비교 아이템
interface CompareItem {
  address: string;
  result:  AnalysisResult | null;
  loading: boolean;
}

// 커뮤니티에서 가져오는 거주 후기
interface CommunityReview {
  id:          string;
  nickname:    string;
  dong:        string;
  title:       string;
  content:     string;
  likes:       number;
  is_verified: boolean;
  created_at:  string;
}

// 전세사기 위험도 AI 분석 결과
interface JeonseRisk {
  risk_level:           'low' | 'medium' | 'high';
  risk_score:           number;
  jeonse_rate_estimate: string;
  summary:              string;
  risk_factors:         string[];
  safe_factors:         string[];
  checklist:            string[];
  recommendations:      string;
}

interface QuotaInfo {
  plan:        string;
  remaining:   number;
  daily_limit: number;
}

// ── 예시 데이터 ───────────────────────────────────────────────
const SAMPLE: AnalysisResult = {
  address: '마포구 성산동 일대 (예시)',
  scores: { traffic:80, infra:88, school:62, noise:45, commerce:79, development:72 },
  total: 75, grade: 'B+',
  ai_comment: '교통·생활 편의는 우수하나 소음 환경과 학군 측면에서 개선 여지가 있습니다. 주말 저녁~새벽 유흥 소음이 집중되며, 인근 재개발 공사는 2027년 2월까지 예정되어 있습니다.',
  traffic_detail: '지하철 2·6호선 도보 10분 이내. 버스 정류장 8개. 강남까지 약 35분 소요.',
  infra_detail: '반경 500m 내 편의점 6개, 병원·약국 12개, 카페 18개, 공원 2개.',
  school_detail: '배정 초등학교 1개(도보 8분), 중학교 배정 예측 2곳, 학원가 밀집.',
  noise_detail: '주중 낮은 비교적 조용하나 주말 저녁~새벽 유흥 소음이 집중됩니다.',
  commerce_detail: '유동인구 구 평균 대비 +22%, 음식점·카페 중심 업종, 공실률 7%.',
  development_detail: '2027년 재개발 구역 인접. 장기 보유 시 가치 상승 기대.',
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

// ── 플랜 라벨 ─────────────────────────────────────────────────
const PLAN_LABEL: Record<string, { label:string; color:string; bg:string }> = {
  free:     { label:'무료',          color:'#7a8570', bg:'#f7faf5' },
  one_time: { label:'이사 한 번',    color:'#2563EB', bg:'#eff6ff' },
  premium:  { label:'프리미엄',      color:'#646F4B', bg:'rgba(100,111,75,.1)' },
  guest:    { label:'비로그인',       color:'#a4ad98', bg:'#f5f5f5' },
};

// ── 레이더 차트 SVG 컴포넌트 ────────────────────────────────────
const RADAR_LABELS = ['교통', '인프라', '학군', '소음', '상권', '개발'];
const RADAR_COLORS = ['#646F4B', '#2563EB', '#e0a84b', '#e74c3c', '#8b5cf6'];

function RadarChart({ current, compares }: {
  current:  AnalysisResult;
  compares: { address: string; result: AnalysisResult }[];
}) {
  const CX = 160, CY = 160, R = 110;
  const N  = 6;
  const all = [
    { label: current.address.slice(0, 6), scores: Object.values(current.scores), color: RADAR_COLORS[0] },
    ...compares.map((c, i) => ({
      label:  c.address.slice(0, 6),
      scores: Object.values(c.result.scores),
      color:  RADAR_COLORS[i + 1] ?? '#999',
    })),
  ];

  function polar(i: number, r: number): [number, number] {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
  }

  function scoreToR(score: number) { return (score / 100) * R; }

  return (
    <svg width="320" height="320" viewBox="0 0 320 320" style={{ maxWidth: '100%' }}>
      {/* 배경 그리드 */}
      {[20, 40, 60, 80, 100].map(pct => {
        const r = scoreToR(pct);
        const pts = Array.from({ length: N }, (_, i) => polar(i, r).join(',')).join(' ');
        return <polygon key={pct} points={pts} fill="none" stroke="var(--border)" strokeWidth="1" />;
      })}
      {/* 축선 */}
      {Array.from({ length: N }, (_, i) => {
        const [x, y] = polar(i, R);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
      })}
      {/* 레이블 */}
      {RADAR_LABELS.map((label, i) => {
        const [x, y] = polar(i, R + 20);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fontWeight="600" fill="var(--muted)" fontFamily="'Pretendard', sans-serif">
            {label}
          </text>
        );
      })}
      {/* 데이터 폴리곤 */}
      {all.map(({ scores, color }, di) => {
        const pts = scores.map((s, i) => polar(i, scoreToR(s)).join(',')).join(' ');
        return (
          <g key={di}>
            <polygon points={pts} fill={color} fillOpacity={di === 0 ? 0.15 : 0.08} stroke={color} strokeWidth={di === 0 ? 2.5 : 1.5} strokeLinejoin="round" />
            {scores.map((s, i) => {
              const [x, y] = polar(i, scoreToR(s));
              return <circle key={i} cx={x} cy={y} r={di === 0 ? 4 : 3} fill={color} />;
            })}
          </g>
        );
      })}
      {/* 범례 */}
      {all.map(({ label, color }, i) => (
        <g key={i} transform={`translate(10,${i * 18 + 280})`}>
          <rect width="10" height="10" fill={color} rx="2" />
          <text x="14" y="9" fontSize="10" fill="var(--text2)" fontFamily="'Pretendard', sans-serif">{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── 업그레이드 모달 ────────────────────────────────────────────
function UpgradeModal({ onClose, plan, reason }: {
  onClose: () => void;
  plan:    string;
  reason:  string;
}) {
  return (
    <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.upgradeModal}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>
        <div className={styles.upgradeLock}>🔒</div>
        <h3 className={styles.upgradeTitle}>
          {plan === 'free' ? '오늘 무료 분석 횟수를 모두 사용했습니다' : '분석 횟수를 모두 사용했습니다'}
        </h3>
        <p className={styles.upgradeDesc}>{reason}</p>

        <div className={styles.upgradePlans}>
          {/* 이사 한 번 플랜 */}
          <div className={styles.upgradePlanCard}>
            <div className={styles.upgradePlanName}>이사 한 번 플랜</div>
            <div className={styles.upgradePlanPrice}>4,900<span>원</span></div>
            <ul className={styles.upgradePlanFeats}>
              <li>✓ AI 입지 분석 1회</li>
              <li>✓ 6개 레이어 상세 데이터</li>
              <li>✓ PDF 리포트 저장</li>
            </ul>
            <button className={styles.upgradePlanBtn} disabled>곧 출시 예정</button>
          </div>

          {/* 프리미엄 플랜 */}
          <div className={`${styles.upgradePlanCard} ${styles.upgradePlanCardMain}`}>
            <div className={styles.upgradePlanBadge}>추천</div>
            <div className={styles.upgradePlanName}>프리미엄</div>
            <div className={styles.upgradePlanPrice}>14,900<span>원/월</span></div>
            <ul className={styles.upgradePlanFeats}>
              <li>✓ 무제한 AI 입지 분석</li>
              <li>✓ 지역 동시 비교 최대 5곳</li>
              <li>✓ PDF 저장 + 공유 링크</li>
              <li>✓ 소음 신규 제보 실시간 알림</li>
            </ul>
            <button className={styles.upgradePlanBtnMain} disabled>곧 출시 예정</button>
          </div>
        </div>

        <p className={styles.upgradeNote}>
          내일 자정에 무료 횟수가 초기화됩니다.<br/>
          또는 <Link href="/#faq" onClick={onClose} className={styles.upgradeLink}>FAQ에서 더 알아보기 →</Link>
        </p>
      </div>
    </div>
  );
}

// ── 메인 콘텐츠 ───────────────────────────────────────────────
function AnalysisContent() {
  const searchParams = useSearchParams();
  const { user }     = useAuth();

  const [input,   setInput]   = useState(searchParams.get('address') ?? '');
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState(0);
  const [result,  setResult]  = useState<AnalysisResult | null>(null);
  const [rTab,    setRTab]    = useState('overview');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // ── 플랜/쿼터 상태 ────────────────────────────────────────
  const [quota,          setQuota]          = useState<QuotaInfo | null>(null);
  const [showUpgrade,    setShowUpgrade]    = useState(false);
  const [upgradeReason,  setUpgradeReason]  = useState('');

  // ── 거주 후기 (커뮤니티 연동) ─────────────────────────────
  const [communityReviews,    setCommunityReviews]    = useState<CommunityReview[]>([]);
  const [reviewsLoading,      setReviewsLoading]      = useState(false);

  // ── 전세사기 위험도 ─────────────────────────────────────────
  const [jeonseRisk,     setJeonseRisk]     = useState<JeonseRisk | null>(null);
  const [jeonseLoading,  setJeonseLoading]  = useState(false);
  const [jeonseError,    setJeonseError]    = useState('');

  // ── 지역 비교 상태 ─────────────────────────────────────────
  const [compareMode,  setCompareMode]  = useState(false);
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [compareInput, setCompareInput] = useState('');
  const [compareFull,  setCompareFull]  = useState(false); // 5곳 제한 안내

  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const ex = localStorage.getItem('moveiq_session_id');
    if (ex) return ex;
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem('moveiq_session_id', id);
    return id;
  });

  // 공유 링크
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl,     setShareUrl]     = useState('');
  const [shareCopied,  setShareCopied]  = useState(false);

  // 플랜 정보 로드
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/profile?user_id=${encodeURIComponent(user.id)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setQuota({ plan: json.plan, remaining: json.remaining, daily_limit: json.daily_limit });
        }
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/user-preferences?session_id=${encodeURIComponent(sessionId)}`)
        .then(r => r.json())
        .then(json => { if (json.success && json.search_history?.length) setRecentSearches(json.search_history); })
        .catch(() => {
          try { const h = JSON.parse(localStorage.getItem('moveiq_history') ?? '[]'); if (h.length) setRecentSearches(h); } catch {}
        });
    }
    const addr = searchParams.get('address');
    if (addr) runAnalysis(addr);
  }, []);

  // ── 공유 링크 생성 ────────────────────────────────────────
  async function createShareLink() {
    if (!result) return;
    setShareLoading(true);
    try {
      const res  = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: result.address, result }),
      });
      const json = await res.json();
      if (json.success) {
        setShareUrl(json.share_url);
        // 클립보드 복사
        await navigator.clipboard.writeText(json.share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      } else {
        alert('공유 링크 생성에 실패했습니다.');
      }
    } catch {
      alert('공유 링크 생성에 실패했습니다.');
    } finally {
      setShareLoading(false);
    }
  }

  // ── 카카오 링크 공유 ──────────────────────────────────────
  function shareKakao(url: string) {
    // 카카오 SDK 미연동 시 URL 복사로 폴백
    if (typeof window !== 'undefined' && (window as any).Kakao?.Link) {
      (window as any).Kakao.Link.sendDefault({
        objectType: 'feed',
        content: {
          title:       `${result?.address} 입지 분석 결과`,
          description: `종합 점수 ${result?.total}점 (${result?.grade}등급) — 무브IQ AI 분석`,
          imageUrl:    `https://moveiq.vercel.app/api/og?dong=${encodeURIComponent(result?.address ?? '')}`,
          link:        { mobileWebUrl: url, webUrl: url },
        },
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('링크가 복사되었습니다. 카카오톡에 붙여넣기 해주세요.');
    }
  }

  // ── 거주 후기 로드 (커뮤니티 이사 후기 카테고리 연동) ────
  async function loadCommunityReviews(address: string) {
    // 주소에서 동 이름 추출 (예: "마포구 성산동" → "성산동" or "성산1동")
    const dongMatch = address.match(/([가-힣]+[동읍면리][\d]?동?)/);
    const dong = dongMatch ? dongMatch[1] : '';
    if (!dong) return;

    setReviewsLoading(true);
    try {
      const params = new URLSearchParams({
        category: '이사 후기',
        dong,
        sort:  'latest',
        limit: '10',
      });
      const res  = await fetch(`/api/community/posts?${params}`);
      const json = await res.json();
      if (json.success) setCommunityReviews(json.data ?? []);
    } catch {}
    finally { setReviewsLoading(false); }
  }

  // ── 전세사기 위험도 분석 ─────────────────────────────────────
  async function loadJeonseRisk(address: string, analysisResult: any) {
    // 이미 같은 주소 분석된 경우 스킵
    if (jeonseRisk && (jeonseRisk as any)._address === address) return;
    setJeonseLoading(true);
    setJeonseError('');
    try {
      const res  = await fetch('/api/jeonse-risk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, analysis_result: analysisResult }),
      });
      const json = await res.json();
      if (json.success) {
        const risk = json.data as JeonseRisk;
        setJeonseRisk(risk);
        (risk as any)._address = address;
      }
      else setJeonseError('분석에 실패했습니다. 다시 시도해주세요.');
    } catch { setJeonseError('네트워크 오류가 발생했습니다.'); }
    finally { setJeonseLoading(false); }
  }

  async function saveHistory(history: string[]) {
    localStorage.setItem('moveiq_history', JSON.stringify(history));
    if (sessionId) {
      fetch('/api/user-preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, search_history: history }),
      }).catch(() => {});
    }
  }

  // ── 지역 비교 ──────────────────────────────────────────────
  // 현재 분석 결과를 비교 목록에 추가
  function addCurrentToCompare() {
    if (!result) return;
    if (compareItems.length >= 4) { setCompareFull(true); return; }
    if (compareItems.some(c => c.address === result.address)) return;
    setCompareItems(prev => [...prev, { address: result.address, result, loading: false }]);
    setCompareMode(true);
    setCompareFull(false);
  }

  function removeCompareItem(address: string) {
    setCompareItems(prev => prev.filter(c => c.address !== address));
    if (compareItems.length <= 1) setCompareMode(false);
  }

  // 비교 목록에 새 주소 추가하여 분석 실행
  async function addAndAnalyzeCompare() {
    const addr = compareInput.trim();
    if (!addr) return;
    // 이미 포함된 주소 체크
    if (compareItems.some(c => c.address === addr) || addr === result?.address) {
      setCompareInput('');
      return;
    }
    // 최대 5곳 (현재 분석 1 + 비교 4)
    if (compareItems.length >= 4) { setCompareFull(true); return; }

    const newItem: CompareItem = { address: addr, result: null, loading: true };
    setCompareItems(prev => [...prev, newItem]);
    setCompareInput('');
    setCompareMode(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, session_id: sessionId, user_id: user?.id }),
      });
      const json = await res.json();
      setCompareItems(prev => prev.map(c =>
        c.address === addr
          ? { ...c, loading: false, result: json.success ? json.data : null }
          : c
      ));
    } catch {
      setCompareItems(prev => prev.map(c =>
        c.address === addr ? { ...c, loading: false } : c
      ));
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
        body: JSON.stringify({
          address,
          session_id: sessionId || undefined,
          user_id:    user?.id  || undefined,   // 로그인 유저만 플랜 체크
        }),
      });
      const json = await res.json();
      clearInterval(iv);

      if (json.success) {
        setResult(json.data);
        setRTab('overview');
        // 쿼터 정보 업데이트
        if (json.quota) setQuota(json.quota);
      } else if (json.code === 'QUOTA_EXCEEDED') {
        // 횟수 초과 → 업그레이드 모달
        setUpgradeReason(json.message ?? '분석 횟수를 모두 사용했습니다.');
        setShowUpgrade(true);
        if (json.quota) setQuota({ plan: json.plan, remaining: 0, daily_limit: json.daily_limit });
      } else {
        alert(json.message ?? '분석에 실패했습니다.');
      }
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
    ['compare', compareItems.length > 0 ? `비교 (${compareItems.length + 1})` : '지역 비교'],
  ];

  // PDF 저장 가능 여부: one_time 또는 premium 플랜
  const canPdf = quota && (quota.plan === 'one_time' || quota.plan === 'premium');

  return (
    <div className={styles.page}>

      {/* ── 플랜 상태 바 ── */}
      {user && quota && (
        <div className={styles.quotaBar}>
          <div className={styles.quotaLeft}>
            <span
              className={styles.planBadge}
              style={{ color: PLAN_LABEL[quota.plan]?.color, background: PLAN_LABEL[quota.plan]?.bg }}
            >
              {PLAN_LABEL[quota.plan]?.label ?? quota.plan}
            </span>
            {quota.plan === 'free' && (
              <span className={styles.quotaText}>
                오늘 남은 분석:&nbsp;
                <strong style={{ color: quota.remaining === 0 ? '#e74c3c' : 'var(--main)' }}>
                  {quota.remaining}/{quota.daily_limit}회
                </strong>
                {quota.remaining === 0 && (
                  <span style={{ fontSize: 11, color: '#e74c3c', marginLeft: 6 }}>
                    — 내일 자정 초기화
                  </span>
                )}
                {quota.remaining > 0 && quota.remaining <= 1 && (
                  <span style={{ fontSize: 11, color: '#e0a84b', marginLeft: 6 }}>
                    ⚠️ 1회 남음
                  </span>
                )}
              </span>
            )}
            {quota.plan === 'one_time' && (
              <span className={styles.quotaText}>
                남은 분석: <strong style={{ color: 'var(--main)' }}>{quota.remaining}회</strong>
              </span>
            )}
            {quota.plan === 'premium' && (
              <span className={styles.quotaText} style={{ color: 'var(--main)' }}>무제한 분석</span>
            )}
          </div>
          {quota.plan === 'free' && (
            <button className={styles.quotaUpgradeBtn} onClick={() => { setUpgradeReason('더 많은 분석을 위해 유료 플랜을 이용해보세요.'); setShowUpgrade(true); }}>
              업그레이드
            </button>
          )}
        </div>
      )}

      {/* ── 검색 ── */}
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

      {/* ── 로딩 ── */}
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

      {/* ── 결과 ── */}
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
              <button key={t} className={`${styles.tab} ${rTab === t ? styles.tabActive : ''}`}
                onClick={() => {
                  setRTab(t);
                  if (t === 'review' && result) loadCommunityReviews(result.address);
                  if (t === 'jeonse' && result) loadJeonseRisk(result.address, result);
                }}
              >{label}</button>
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

              {/* PDF CTA — 플랜별 표시 분기 */}
              <div className={styles.pdfCta}>
                <div>
                  <strong>풀 리포트 PDF 저장</strong>
                  <small>6개 레이어 + 비교 3곳 + AI 평가 + 학군 상세</small>
                </div>
                {canPdf ? (
                  <button
                    className={styles.btnPdf}
                    onClick={() => alert('PDF 저장 기능은 현재 준비 중입니다.')}
                  >
                    📄 PDF 저장
                  </button>
                ) : (
                  <button
                    className={`${styles.btnPdf} ${styles.btnPdfLocked}`}
                    onClick={() => { setUpgradeReason('PDF 저장은 이사 한 번 플랜 이상에서 이용 가능합니다.'); setShowUpgrade(true); }}
                  >
                    🔒 PDF 저장 (잠금)
                  </button>
                )}
              </div>

              {/* 공유 버튼 */}
              <div className={styles.shareCta}>
                {shareUrl ? (
                  <div className={styles.shareResult}>
                    <input
                      readOnly
                      value={shareUrl}
                      className={styles.shareInput}
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      className={styles.shareBtn}
                      onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 3000); }}
                    >
                      {shareCopied ? '✅ 복사됨' : '🔗 링크 복사'}
                    </button>
                    <button
                      className={styles.shareBtnKakao}
                      onClick={() => shareKakao(shareUrl)}
                    >
                      💬 카카오 공유
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.shareGenBtn}
                    onClick={createShareLink}
                    disabled={shareLoading || !result}
                  >
                    {shareLoading ? '링크 생성 중...' : '🔗 이 분석 결과 공유하기'}
                  </button>
                )}
              </div>
            </>
          )}

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

          {/* ══ 거주 후기 탭 — 커뮤니티 이사 후기 연동 ══ */}
          {rTab === 'review' && (
            <div>
              {reviewsLoading ? (
                <div className={styles.tabLoading}>
                  <div className={styles.tabSpinner} />
                  <p>커뮤니티에서 이사 후기를 불러오는 중...</p>
                </div>
              ) : communityReviews.length > 0 ? (
                <>
                  <div className={styles.reviewMeta}>
                    <span className={styles.reviewCount}>📝 이사 후기 {communityReviews.length}개</span>
                    <span className={styles.reviewDong}>{result?.address} 인근</span>
                  </div>
                  {communityReviews.map(r => (
                    <div key={r.id} className={styles.reviewItem}>
                      <div className={styles.reviewHeader}>
                        <span className={styles.reviewAuthor}>
                          {r.is_verified && <span className={styles.verifiedMark}>🏠</span>}
                          {r.nickname}
                        </span>
                        <span className={styles.reviewDongTag}>📍 {r.dong}</span>
                        <span className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })}</span>
                        <span className={styles.reviewLikes}>❤️ {r.likes}</span>
                      </div>
                      <p className={styles.reviewTitle}>{r.title}</p>
                      <p className={styles.reviewContent}>{r.content}</p>
                    </div>
                  ))}
                  <div className={styles.reviewActions}>
                    <Link href={`/community?category=이사 후기`} className={styles.btnGoComm}>
                      커뮤니티에서 더 보기 →
                    </Link>
                    <Link href="/community" className={styles.btnWriteReview}>
                      ✏️ 후기 작성하기
                    </Link>
                  </div>
                </>
              ) : result ? (
                // 분석 결과 있는데 후기 없음
                <div className={styles.noData}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
                  <p style={{ marginBottom: 8, fontWeight: 600 }}>아직 이 동네 이사 후기가 없어요.</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                    직접 살아본 경험을 커뮤니티에 공유하면<br/>다음 이사자에게 큰 도움이 됩니다.
                  </p>
                  <div className={styles.reviewActions}>
                    <Link href={`/community?category=이사 후기`} className={styles.btnGoComm}>
                      이사 후기 보러가기 →
                    </Link>
                    <Link href="/community" className={styles.btnWriteReview}>
                      ✏️ 첫 후기 작성하기
                    </Link>
                  </div>
                </div>
              ) : (
                // 주소 미입력
                <div className={styles.noData}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
                  <p>주소를 입력하면 해당 동네 이사 후기를 가져옵니다.</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    커뮤니티의 '이사 후기' 카테고리와 실시간 연동됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ 전세사기 위험도 탭 ══ */}
          {rTab === 'jeonse' && (
            <div>
              {jeonseLoading ? (
                <div className={styles.tabLoading}>
                  <div className={styles.tabSpinner} />
                  <p>AI가 전세사기 위험도를 분석 중입니다...</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>입지 데이터 + AI 추론 기반 분석</p>
                </div>
              ) : jeonseError ? (
                <div className={styles.noData}>
                  <p style={{ color: '#e74c3c' }}>{jeonseError}</p>
                  <button className={styles.btnRetry} onClick={() => result && loadJeonseRisk(result.address, result)}>
                    다시 시도
                  </button>
                </div>
              ) : jeonseRisk ? (
                <>
                  {/* 위험도 배지 */}
                  <div className={`${styles.jeonseRiskBadge} ${
                    jeonseRisk.risk_level === 'high'   ? styles.jeonseRisk_high   :
                    jeonseRisk.risk_level === 'medium' ? styles.jeonseRisk_medium :
                    styles.jeonseRisk_low
                  }`}>
                    <div className={styles.jeonseRiskLeft}>
                      <div className={styles.jeonseRiskLabel}>
                        {jeonseRisk.risk_level === 'high' ? '🔴 전세사기 위험 높음' :
                         jeonseRisk.risk_level === 'medium' ? '🟡 주의 필요' : '🟢 비교적 안전'}
                      </div>
                      <div className={styles.jeonseRiskSub}>
                        전세가율 추정: {jeonseRisk.jeonse_rate_estimate}
                      </div>
                    </div>
                    <div className={styles.jeonseScoreCircle} style={{
                      background: jeonseRisk.risk_level === 'high' ? '#e74c3c' :
                                  jeonseRisk.risk_level === 'medium' ? '#e0a84b' : '#27ae60',
                    }}>
                      <span className={styles.jeonseScoreNum}>{jeonseRisk.risk_score}</span>
                      <span className={styles.jeonseScoreLabel}>위험도</span>
                    </div>
                  </div>

                  {/* AI 요약 */}
                  <div className={styles.aiBox} style={{ marginTop: 14 }}>
                    <span>🤖</span><p>{jeonseRisk.summary}</p>
                  </div>

                  {/* 위험/안전 요소 */}
                  <div className={styles.jeonseFactors}>
                    <div className={styles.jeonseFactorCol}>
                      <div className={styles.jeonseFactorTitle} style={{ color: '#c0392b' }}>⚠️ 위험 요소</div>
                      {jeonseRisk.risk_factors.map((f, i) => (
                        <div key={i} className={styles.jeonseFactorItem} style={{ background: '#fdecea', borderColor: '#f5c6cb' }}>
                          <span className={styles.jeonseFactorDot} style={{ background: '#e74c3c' }} />{f}
                        </div>
                      ))}
                    </div>
                    <div className={styles.jeonseFactorCol}>
                      <div className={styles.jeonseFactorTitle} style={{ color: '#1e8449' }}>✅ 안전 요소</div>
                      {jeonseRisk.safe_factors.map((f, i) => (
                        <div key={i} className={styles.jeonseFactorItem} style={{ background: '#eafaf1', borderColor: '#a9dfbf' }}>
                          <span className={styles.jeonseFactorDot} style={{ background: '#27ae60' }} />{f}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 계약 전 체크리스트 */}
                  <div className={styles.jeonseChecklist}>
                    <div className={styles.panelTitle}>📋 계약 전 필수 체크리스트</div>
                    {jeonseRisk.checklist.map((item, i) => (
                      <div key={i} className={styles.jeonseCheckItem}>
                        <span className={styles.jeonseNum}>{i + 1}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* AI 추천 코멘트 */}
                  <div className={styles.aiBox} style={{ marginTop: 16 }}>
                    <span>💡</span><p>{jeonseRisk.recommendations}</p>
                  </div>

                  <div className={styles.jeonseDisclaimer}>
                    ⚠️ AI 분석 결과는 참고용이며, 실제 계약 전 반드시 등기부등본·전세보증보험 가능 여부를 직접 확인하세요.
                  </div>
                </>
              ) : result ? (
                // 분석 결과 있지만 전세 분석 미실행
                <div className={styles.noData}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                  <p style={{ marginBottom: 16 }}>
                    <strong>{result.address}</strong>의<br/>전세사기 위험도를 AI가 분석합니다.
                  </p>
                  <button
                    className={styles.btnAnalyzeJeonse}
                    onClick={() => loadJeonseRisk(result.address, result)}
                  >
                    🔍 전세사기 위험도 분석하기
                  </button>
                  <div className={styles.jeonseManual} style={{ marginTop: 20 }}>
                    <div className={styles.panelTitle}>📋 전세계약 기본 체크리스트</div>
                    {[
                      '등기부등본 열람 (계약 당일·잔금 직전 재확인)',
                      '전세가율 80% 초과 여부 확인 (깡통전세 위험)',
                      '선순위 채권·근저당 합계 확인',
                      '임대인 신원 확인 (신분증·등기부 소유자 일치)',
                      '전세보증보험 가입 가능 여부 확인 (HUG/SGI)',
                      '확정일자 즉시 신청 (전입신고 당일)',
                    ].map((item, i) => (
                      <div key={i} className={styles.jeonseCheckItem}>
                        <span className={styles.jeonseNum}>{i + 1}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.noData}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                  <p>주소를 입력하면 전세사기 위험도를 AI로 분석합니다.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ 지역 비교 탭 ══ */}
      {rTab === 'compare' && (
        <div>
          {/* 비교 지역 입력 */}
          <div style={{ background: 'var(--sub-light)', border: '1px solid var(--sub-mid)', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--main)', marginBottom: 10 }}>
              📍 비교할 지역 추가 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>(최대 5곳 동시 비교)</span>
            </div>

            {/* 현재 분석 지역 칩 */}
            {result && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <span style={{ background: 'var(--main)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
                  ⭐ {result.address.slice(0, 16)} <span style={{ opacity: .7 }}>{result.total}점</span>
                </span>
                {compareItems.map(c => (
                  <span key={c.address} style={{ background: '#fff', border: '1.5px solid var(--border)', fontSize: 12, padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {c.loading ? '⏳' : `📍 ${c.address.slice(0, 12)} ${c.result ? c.result.total + '점' : '실패'}`}
                    <button onClick={() => removeCompareItem(c.address)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0, fontSize: 12 }}>✕</button>
                  </span>
                ))}
              </div>
            )}

            {compareFull && (
              <p style={{ fontSize: 12, color: '#e74c3c', marginBottom: 8 }}>⚠️ 최대 5곳까지 비교 가능합니다.</p>
            )}

            {!result ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>먼저 위에서 주소를 분석해주세요.</p>
            ) : compareItems.length < 4 ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={compareInput}
                  onChange={e => setCompareInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAndAnalyzeCompare()}
                  placeholder="예: 강남구 역삼동, 마포구 합정동"
                  style={{ flex: 1, padding: '10px 14px', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', minWidth: 0 }}
                />
                <button
                  onClick={addAndAnalyzeCompare}
                  style={{ padding: '10px 16px', background: 'var(--main)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  + 추가
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>최대 비교 지역에 도달했습니다.</p>
            )}

            {result && compareItems.length === 0 && (
              <button
                onClick={addCurrentToCompare}
                style={{ marginTop: 10, fontSize: 12, color: 'var(--main)', background: 'none', border: '1px dashed var(--sub-mid)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
              >
                + 현재 분석({result.address.slice(0, 10)})을 비교에 추가
              </button>
            )}
          </div>

          {/* 비교 테이블 */}
          {result && compareItems.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>📊 점수 비교표</div>
              <div style={{ overflowX: 'auto', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--sub-light)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--main)', borderBottom: '2px solid var(--sub-mid)', whiteSpace: 'nowrap' }}>항목</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--main)', borderBottom: '2px solid var(--sub-mid)', whiteSpace: 'nowrap', background: 'rgba(100,111,75,.08)' }}>
                        ⭐ {result.address.slice(0, 8)}
                      </th>
                      {compareItems.map(c => (
                        <th key={c.address} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)', borderBottom: '2px solid var(--sub-mid)', whiteSpace: 'nowrap' }}>
                          {c.loading ? '⏳' : c.address.slice(0, 8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: '🏆 종합 점수', key: 'total' as const },
                      { label: '🚇 교통 접근성', key: 'traffic' as const },
                      { label: '🏪 생활 인프라', key: 'infra' as const },
                      { label: '📚 학군 환경', key: 'school' as const },
                      { label: '🔊 소음·환경', key: 'noise' as const },
                      { label: '🛍️ 상권 활성도', key: 'commerce' as const },
                      { label: '🏗️ 개발 잠재력', key: 'development' as const },
                    ].map((row, ri) => {
                      const mainVal = row.key === 'total' ? result.total : result.scores[row.key as keyof typeof result.scores];
                      const allVals = [mainVal, ...compareItems.map(c => c.result ? (row.key === 'total' ? c.result.total : c.result.scores[row.key as keyof typeof c.result.scores]) : null)];
                      const maxVal  = Math.max(...allVals.filter(v => v !== null) as number[]);

                      return (
                        <tr key={row.key} style={{ background: ri % 2 === 0 ? '#fff' : 'var(--bg2)', borderBottom: '1px solid var(--border2)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{row.label}</td>
                          {/* 현재 분석 지역 */}
                          <td style={{ padding: '10px 14px', textAlign: 'center', background: 'rgba(100,111,75,.04)' }}>
                            <span style={{
                              fontWeight: mainVal === maxVal ? 800 : 600,
                              color: mainVal === maxVal ? 'var(--main)' : row.key === 'total' ? 'var(--text)' : sc(mainVal as number),
                              fontSize: mainVal === maxVal ? 15 : 13,
                            }}>
                              {mainVal}{row.key !== 'total' && '점'}
                              {mainVal === maxVal && ' 🥇'}
                            </span>
                          </td>
                          {/* 비교 지역들 */}
                          {compareItems.map(c => {
                            const val = c.result ? (row.key === 'total' ? c.result.total : c.result.scores[row.key as keyof typeof c.result.scores]) : null;
                            return (
                              <td key={c.address} style={{ padding: '10px 14px', textAlign: 'center' }}>
                                {c.loading ? (
                                  <span style={{ color: 'var(--muted2)', fontSize: 12 }}>분석 중...</span>
                                ) : val !== null ? (
                                  <span style={{
                                    fontWeight: val === maxVal ? 800 : 500,
                                    color: val === maxVal ? 'var(--main)' : 'var(--text2)',
                                    fontSize: val === maxVal ? 15 : 13,
                                  }}>
                                    {val}{row.key !== 'total' && '점'}
                                    {val === maxVal && ' 🥇'}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--muted2)', fontSize: 11 }}>실패</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 레이더 차트 (SVG) */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>🕸️ 레이더 차트</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <RadarChart
                  current={result}
                  compares={compareItems.filter(c => c.result !== null) as (CompareItem & { result: AnalysisResult })[]}
                />
              </div>

              {/* AI 총평 */}
              <div style={{ background: 'var(--sub-light)', border: '1px solid var(--sub-mid)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--main)', marginBottom: 8 }}>🤖 비교 총평</div>
                {(() => {
                  const allItems = [
                    { address: result.address, total: result.total },
                    ...compareItems.filter(c => c.result).map(c => ({ address: c.address, total: c.result!.total })),
                  ].sort((a, b) => b.total - a.total);
                  const best = allItems[0];
                  return (
                    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }}>
                      비교한 {allItems.length}개 지역 중 <strong style={{ color: 'var(--main)' }}>{best.address}</strong>이(가) 종합 <strong>{best.total}점</strong>으로 가장 높은 점수를 기록했습니다.
                      {allItems.length > 1 && ` 2위는 ${allItems[1].address}(${allItems[1].total}점)입니다.`}
                      {' '}각 지역의 강점과 약점을 위 표에서 항목별로 확인하세요.
                    </p>
                  );
                })()}
              </div>
            </>
          )}

          {/* 비교 지역 없을 때 안내 */}
          {(!result || compareItems.length === 0) && (
            <div className={styles.noData}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>지역 비교 기능</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                최대 5곳의 주소를 동시에 비교합니다.<br/>
                점수 비교표 + 레이더 차트로 한눈에 확인하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 업그레이드 모달 */}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          plan={quota?.plan ?? 'free'}
          reason={upgradeReason}
        />
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
