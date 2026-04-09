'use client';
// app/admin/page.tsx
// 어드민 대시보드
// 보안: 클라이언트에서 Supabase session 토큰으로 API 호출 → 서버에서 ADMIN_EMAIL 검증
// 비인가 접근 시 서버가 404를 반환하여 어드민 존재 자체를 숨김

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth }   from '@/app/components/useAuth';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import styles from './admin.module.css';

// ── 타입 ──────────────────────────────────────────────────────
interface Stats {
  pending_reports:   number;
  auto_blinded:      number;
  today_noise:       number;
  total_noise:       number;
  total_subscribers: number;
  today_analysis:    number;
}

interface ReportItem {
  id:           string;
  target_type:  string;
  target_id:    string;
  report_count: number;
  status:       string;
  preview:      string;
  created_at:   string;
}

interface Subscriber {
  id:              string;
  nickname:        string;
  plan:            string;
  plan_expires_at: string | null;
  analysis_count:  number;
  is_expired:      boolean;
  created_at:      string;
}

interface AuditLog {
  id:         string;
  action:     string;
  target_id:  string | null;
  detail:     Record<string, unknown> | null;
  ip:         string;
  created_at: string;
}

type Tab = 'dashboard' | 'reports' | 'noise' | 'subscribers' | 'audit';

// ── 뱃지 컬러 ────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  pending:         styles.pillAmber,
  auto_blinded:    styles.pillRed,
  reviewed_keep:   styles.pillGreen,
  reviewed_remove: styles.pillGray,
};

const PLAN_PILL: Record<string, string> = {
  free:     styles.pillGray,
  one_time: styles.pillBlue,
  premium:  styles.pillGreen,
};

const PLAN_LABEL: Record<string, string> = {
  free: '무료', one_time: '이사 한 번', premium: '프리미엄',
};

const TARGET_LABEL: Record<string, string> = {
  noise_report:      '소음 제보',
  community_post:    '커뮤니티 글',
  community_comment: '댓글',
};

const ACTION_PILL: Record<string, string> = {
  blind_restore:  styles.pillBlue,
  content_remove: styles.pillRed,
  plan_change:    styles.pillAmber,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function AdminPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();

  const [tab,         setTab]         = useState<Tab>('dashboard');
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // ── 데이터 상태 ───────────────────────────────────────────
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [reports,     setReports]     = useState<ReportItem[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [auditLogs,   setAuditLogs]   = useState<AuditLog[]>([]);

  const [statsLoading,  setStatsLoading]  = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [subLoading,    setSubLoading]    = useState(false);
  const [auditLoading,  setAuditLoading]  = useState(false);

  // ── 처리 모달 상태 ────────────────────────────────────────
  const [actionItem,   setActionItem]   = useState<ReportItem | null>(null);
  const [actionNote,   setActionNote]   = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── 플랜 변경 모달 ────────────────────────────────────────
  const [planItem,     setPlanItem]    = useState<Subscriber | null>(null);
  const [newPlan,      setNewPlan]     = useState('free');
  const [expireDays,   setExpireDays]  = useState(30);
  const [planLoading,  setPlanLoading] = useState(false);

  // ── 필터 상태 ─────────────────────────────────────────────
  const [reportFilter, setReportFilter] = useState('pending');
  const [subFilter,    setSubFilter]    = useState('all');
  const [subSearch,    setSubSearch]    = useState('');

  // ── 토큰 가져오기 ─────────────────────────────────────────
  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  // ── 어드민 접근 초기 검증 ─────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user || !session) { router.replace('/'); return; }

    // 서버에 토큰 검증 요청 (404 = 비어드민)
    getToken().then(token => {
      if (!token) { router.replace('/'); return; }
      fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (r.status === 404 || r.status === 401) {
            setAccessDenied(true);
          } else {
            setAuthChecked(true);
          }
        })
        .catch(() => setAccessDenied(true));
    });
  }, [user, session, loading, router, getToken]);

  // ── 통계 로드 ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setStatsLoading(true);
    try {
      const res  = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } finally { setStatsLoading(false); }
  }, [getToken]);

  // ── 신고 큐 로드 ──────────────────────────────────────────
  const loadReports = useCallback(async (status = reportFilter) => {
    const token = await getToken();
    if (!token) return;
    setReportLoading(true);
    try {
      const res  = await fetch(`/api/admin/reports?status=${status}&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setReports(json.data);
    } finally { setReportLoading(false); }
  }, [getToken, reportFilter]);

  // ── 구독자 로드 ───────────────────────────────────────────
  const loadSubscribers = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setSubLoading(true);
    try {
      const params = new URLSearchParams({ plan: subFilter, limit: '100' });
      if (subSearch) params.set('search', subSearch);
      const res  = await fetch(`/api/admin/subscribers?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setSubscribers(json.data);
    } finally { setSubLoading(false); }
  }, [getToken, subFilter, subSearch]);

  // ── 감사 로그 로드 ────────────────────────────────────────
  const loadAudit = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setAuditLoading(true);
    try {
      const res  = await fetch('/api/admin/audit-log?limit=50', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setAuditLogs(json.data);
    } finally { setAuditLoading(false); }
  }, [getToken]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (!authChecked) return;
    if (tab === 'dashboard') loadStats();
    if (tab === 'reports')   loadReports();
    if (tab === 'subscribers') loadSubscribers();
    if (tab === 'audit')     loadAudit();
  }, [tab, authChecked]);

  // ── 신고 처리 ─────────────────────────────────────────────
  async function handleAction(action: 'keep' | 'remove') {
    if (!actionItem) return;
    const token = await getToken();
    if (!token) return;
    setActionLoading(true);
    try {
      const res  = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ queue_id: actionItem.id, action, note: actionNote }),
      });
      const json = await res.json();
      if (json.success) {
        setActionItem(null);
        setActionNote('');
        loadReports();
        loadStats();
      }
    } finally { setActionLoading(false); }
  }

  // ── 플랜 변경 ─────────────────────────────────────────────
  async function handlePlanChange() {
    if (!planItem) return;
    const token = await getToken();
    if (!token) return;
    setPlanLoading(true);
    try {
      const res  = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: planItem.id, plan: newPlan, expires_days: newPlan === 'premium' ? expireDays : undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setPlanItem(null);
        loadSubscribers();
        loadStats();
      }
    } finally { setPlanLoading(false); }
  }

  // ── 로딩 / 접근 거부 ─────────────────────────────────────
  if (loading || (!authChecked && !accessDenied)) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.spinner} />
        <p>접근 권한 확인 중...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className={styles.loadingPage}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>페이지를 찾을 수 없습니다</p>
        <Link href="/" className={styles.backLink}>← 홈으로</Link>
      </div>
    );
  }

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className={styles.root}>

      {/* 사이드바 */}
      <aside className={styles.sidebar}>
        <div className={styles.logoWrap}>
          <Link href="/" className={styles.logo}>무브IQ</Link>
          <span className={styles.logoSub}>어드민</span>
        </div>
        {([ 
          { id: 'dashboard',   label: '대시보드',    dot: '#639922',  badge: 0 },
          { id: 'reports',     label: '신고 검토',   dot: '#E24B4A',  badge: stats ? (stats.pending_reports + stats.auto_blinded) : 0 },
          { id: 'noise',       label: '소음 제보',   dot: '#378ADD',  badge: 0 },
          { id: 'subscribers', label: '구독자 관리', dot: '#BA7517',  badge: 0 },
          { id: 'audit',       label: '감사 로그',   dot: '#7F77DD',  badge: 0 },
        ] as { id: Tab; label: string; dot: string; badge: number }[]).map(item => (
          <button
            key={item.id}
            className={`${styles.menuItem} ${tab === item.id ? styles.menuActive : ''}`}
            onClick={() => setTab(item.id as Tab)}
          >
            <span className={styles.menuDot} style={{ background: item.dot }} />
            {item.label}
            {!!item.badge && <span className={styles.menuBadge}>{item.badge}</span>}
          </button>
        ))}
        <div className={styles.sidebarBottom}>
          <span className={styles.adminEmail}>{user?.email}</span>
        </div>
      </aside>

      {/* 메인 */}
      <main className={styles.main}>

        {/* 대시보드 */}
        {tab === 'dashboard' && (
          <div>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>대시보드</h1>
              <button className={styles.btnRefresh} onClick={loadStats}>새로고침</button>
            </div>
            {statsLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : stats ? (
              <>
                <div className={styles.statsGrid}>
                  {[
                    { label: '대기 중 신고',    val: stats.pending_reports,   sub: `자동 블라인드 ${stats.auto_blinded}건`,   color: stats.pending_reports > 0 ? '#E24B4A' : undefined },
                    { label: '소음 제보 (오늘)', val: stats.today_noise,       sub: `누적 ${stats.total_noise.toLocaleString()}건` },
                    { label: '유료 구독자',      val: stats.total_subscribers, sub: '프리미엄 + 이사 한 번' },
                    { label: 'AI 분석 (오늘)',   val: stats.today_analysis,    sub: '입지 분석 호출 수' },
                  ].map(s => (
                    <div key={s.label} className={styles.statCard}>
                      <div className={styles.statLabel}>{s.label}</div>
                      <div className={styles.statVal} style={{ color: s.color }}>{s.val.toLocaleString()}</div>
                      <div className={styles.statSub}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* 빠른 액션 */}
                {stats.pending_reports > 0 && (
                  <div className={styles.alertBanner}>
                    <span>⚠️ 검토 대기 신고가 <strong>{stats.pending_reports}건</strong> 있습니다.</span>
                    <button className={styles.btnSmall} onClick={() => setTab('reports')}>신고 검토 →</button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.empty}>통계를 불러오는 중...</div>
            )}
          </div>
        )}

        {/* 신고 검토 */}
        {tab === 'reports' && (
          <div>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>신고 검토</h1>
              <div className={styles.filterRow}>
                {['pending', 'auto_blinded', 'all'].map(f => (
                  <button
                    key={f}
                    className={`${styles.filterBtn} ${reportFilter === f ? styles.filterActive : ''}`}
                    onClick={() => { setReportFilter(f); loadReports(f); }}
                  >
                    {f === 'pending' ? '대기' : f === 'auto_blinded' ? '자동 블라인드' : '전체'}
                  </button>
                ))}
                <button className={styles.btnRefresh} onClick={() => loadReports()}>새로고침</button>
              </div>
            </div>

            {reportLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : reports.length === 0 ? (
              <div className={styles.empty}>검토할 신고가 없습니다 ✅</div>
            ) : (
              <div className={styles.panel}>
                {reports.map(r => (
                  <div key={r.id} className={styles.listRow}>
                    <div className={styles.rowLeft}>
                      <span className={`${styles.pill} ${STATUS_PILL[r.status] ?? styles.pillGray}`}>
                        {r.status === 'auto_blinded' ? '자동 블라인드' : r.status === 'pending' ? '대기' : r.status}
                      </span>
                      <span className={styles.rowType}>{TARGET_LABEL[r.target_type] ?? r.target_type}</span>
                      <span className={styles.rowPreview}>{r.preview || '(내용 없음)'}</span>
                    </div>
                    <div className={styles.rowRight}>
                      <span className={styles.rowMeta}>{r.report_count}건 · {timeAgo(r.created_at)}</span>
                      {['pending', 'auto_blinded'].includes(r.status) && (
                        <button
                          className={styles.btnAction}
                          onClick={() => { setActionItem(r); setActionNote(''); }}
                        >처리</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 소음 제보 현황 */}
        {tab === 'noise' && (
          <div>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>소음 제보 현황</h1>
              <Link href="/noise-map" target="_blank" className={styles.btnSmall}>지도 보기 →</Link>
            </div>
            <div className={styles.panel} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>소음 제보는 소음 지도에서 실시간 확인 가능합니다.</p>
              <p style={{ fontSize: 13 }}>블라인드된 제보는 신고 검토 탭에서 관리하세요.</p>
            </div>
          </div>
        )}

        {/* 구독자 관리 */}
        {tab === 'subscribers' && (
          <div>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>구독자 관리</h1>
              <div className={styles.filterRow}>
                {['all', 'premium', 'one_time', 'free'].map(f => (
                  <button
                    key={f}
                    className={`${styles.filterBtn} ${subFilter === f ? styles.filterActive : ''}`}
                    onClick={() => setSubFilter(f)}
                  >
                    {PLAN_LABEL[f] ?? '전체'}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.searchRow}>
              <input
                className={styles.searchInput}
                value={subSearch}
                onChange={e => setSubSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadSubscribers()}
                placeholder="닉네임 검색..."
              />
              <button className={styles.btnRefresh} onClick={loadSubscribers}>검색</button>
            </div>

            {subLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : subscribers.length === 0 ? (
              <div className={styles.empty}>구독자가 없습니다.</div>
            ) : (
              <div className={styles.panel}>
                {subscribers.map(s => (
                  <div key={s.id} className={styles.listRow}>
                    <div className={styles.rowLeft}>
                      <div className={styles.avatar}>{s.nickname?.[0] ?? '?'}</div>
                      <div>
                        <div className={styles.rowName}>{s.nickname || '(닉네임 없음)'}</div>
                        <div className={styles.rowMeta}>
                          분석 {s.analysis_count}회 · 가입 {timeAgo(s.created_at)}
                          {s.is_expired && <span style={{ color: '#E24B4A', marginLeft: 6 }}>만료됨</span>}
                        </div>
                      </div>
                    </div>
                    <div className={styles.rowRight}>
                      <span className={`${styles.pill} ${PLAN_PILL[s.plan] ?? styles.pillGray}`}>
                        {PLAN_LABEL[s.plan] ?? s.plan}
                      </span>
                      {s.plan_expires_at && (
                        <span className={styles.rowMeta}>
                          D-{Math.max(0, Math.ceil((new Date(s.plan_expires_at).getTime() - Date.now()) / 86400000))}
                        </span>
                      )}
                      <button
                        className={styles.btnAction}
                        onClick={() => { setPlanItem(s); setNewPlan(s.plan); setExpireDays(30); }}
                      >플랜 변경</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 감사 로그 */}
        {tab === 'audit' && (
          <div>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>감사 로그</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`${styles.pill} ${styles.pillGray}`} style={{ fontSize: 11 }}>삭제 불가 · 읽기 전용</span>
                <button className={styles.btnRefresh} onClick={loadAudit}>새로고침</button>
              </div>
            </div>

            {auditLoading ? (
              <div className={styles.loading}><div className={styles.spinner} /></div>
            ) : auditLogs.length === 0 ? (
              <div className={styles.empty}>감사 로그가 없습니다.</div>
            ) : (
              <div className={styles.panel}>
                {auditLogs.map(log => (
                  <div key={log.id} className={styles.listRow}>
                    <div className={styles.rowLeft}>
                      <span className={`${styles.pill} ${ACTION_PILL[log.action] ?? styles.pillGray}`} style={{ fontSize: 10 }}>
                        {log.action}
                      </span>
                      <span className={styles.rowPreview}>
                        {log.target_id ? `#${log.target_id.slice(0, 8)}...` : '—'}
                        {log.detail?.note && ` · ${log.detail.note}`}
                      </span>
                    </div>
                    <div className={styles.rowRight}>
                      <span className={styles.rowMeta}>{log.ip} · {timeAgo(log.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 신고 처리 모달 */}
      {actionItem && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setActionItem(null); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>신고 처리</h3>
              <button onClick={() => setActionItem(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                <strong>{TARGET_LABEL[actionItem.target_type]}</strong><br/>
                {actionItem.preview}
              </p>
              <div className={styles.formGroup}>
                <label>처리 메모 (선택)</label>
                <textarea
                  className={styles.formInput}
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  rows={2}
                  placeholder="처리 사유를 입력하세요 (감사 로그에 기록됩니다)"
                  maxLength={200}
                />
              </div>
              <div className={styles.modalActions}>
                <button
                  className={styles.btnKeep}
                  onClick={() => handleAction('keep')}
                  disabled={actionLoading}
                >
                  ✅ 문제 없음 (블라인드 해제)
                </button>
                <button
                  className={styles.btnRemove}
                  onClick={() => handleAction('remove')}
                  disabled={actionLoading}
                >
                  🗑️ 확정 삭제
                </button>
              </div>
              {actionLoading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>처리 중...</p>}
            </div>
          </div>
        </div>
      )}

      {/* 플랜 변경 모달 */}
      {planItem && (
        <div className={styles.modalBg} onClick={e => { if (e.target === e.currentTarget) setPlanItem(null); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h3>플랜 수동 변경</h3>
              <button onClick={() => setPlanItem(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}><strong>{planItem.nickname}</strong> · 현재: {PLAN_LABEL[planItem.plan]}</p>
              <div className={styles.formGroup}>
                <label>변경할 플랜</label>
                <select className={styles.formInput} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                  <option value="free">무료</option>
                  <option value="one_time">이사 한 번</option>
                  <option value="premium">프리미엄</option>
                </select>
              </div>
              {newPlan === 'premium' && (
                <div className={styles.formGroup}>
                  <label>만료 기간 (일)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={expireDays}
                    onChange={e => setExpireDays(Number(e.target.value))}
                    min={1} max={365}
                  />
                </div>
              )}
              <div className={styles.modalActions}>
                <button className={styles.btnKeep} onClick={handlePlanChange} disabled={planLoading}>
                  {planLoading ? '변경 중...' : '변경 저장'}
                </button>
                <button className={styles.btnCancel} onClick={() => setPlanItem(null)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
