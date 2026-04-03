'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/useAuth';
import AuthButton from '@/app/components/AuthButton';
import AuthModal from '@/app/components/AuthModal';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import styles from './mypage.module.css';

type Tab = 'profile' | 'history' | 'alerts' | 'security' | 'feedback';

// ── 분석 히스토리 항목 타입 ──────────────────────────────
interface HistoryItem {
  id:          string;
  address:     string;
  total_score: number | null;
  grade:       string | null;
  created_at:  string;
}

// ── 불편사항 항목 타입 ───────────────────────────────────
interface FeedbackItem {
  id:         string;
  type:       string;
  content:    string;
  status:     string;
  created_at: string;
}

function MypageContent() {
  const { user, loading, signOut } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'profile');

  useEffect(() => {
    if (!loading && !user) router.replace('/?auth=login');
  }, [user, loading, router]);

  // ── 프로필 ──────────────────────────────────────────────
  const [nickname,      setNickname]      = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState('');

  // ── 분석 히스토리 (DB) ──────────────────────────────────
  const [historyItems,   setHistoryItems]   = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── 소음 알림 ───────────────────────────────────────────
  const [watched, setWatched] = useState<{ address: string; lat: number; lng: number }[]>([]);

  // ── 보안 ────────────────────────────────────────────────
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [secMsg,     setSecMsg]     = useState('');
  const [secLoading, setSecLoading] = useState(false);

  // ── 불편사항 내역 (DB) ──────────────────────────────────
  const [feedbackItems,   setFeedbackItems]   = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ── sessionId ───────────────────────────────────────────
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sid = localStorage.getItem('moveiq_session_id') ?? '';
      setSessionId(sid);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    if (!user || !sessionId) return;
    setNickname(user.nickname ?? '');

    // 소음 알림 목록 (localStorage + DB 동기화)
    fetch(`/api/user-preferences?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(json => {
        // watched_addresses: DB 우선, fallback localStorage
        if (json.watched_addresses?.length) {
          setWatched(json.watched_addresses);
          localStorage.setItem('moveiq_watched', JSON.stringify(json.watched_addresses));
        } else {
          try { setWatched(JSON.parse(localStorage.getItem('moveiq_watched') ?? '[]')); } catch {}
        }
      })
      .catch(() => {
        try { setWatched(JSON.parse(localStorage.getItem('moveiq_watched') ?? '[]')); } catch {}
      });
  }, [user, sessionId]);

  // 히스토리 탭 클릭 시 DB 로드
  useEffect(() => {
    if (tab !== 'history' || !sessionId) return;
    setHistoryLoading(true);
    fetch(`/api/analyze?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(json => { if (json.success) setHistoryItems(json.data ?? []); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [tab, sessionId]);

  // 불편사항 탭 클릭 시 DB 로드
  useEffect(() => {
    if (tab !== 'feedback' || !sessionId) return;
    setFeedbackLoading(true);
    fetch(`/api/feedback?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(json => { if (json.success) setFeedbackItems(json.data ?? []); })
      .catch(() => {})
      .finally(() => setFeedbackLoading(false));
  }, [tab, sessionId]);

  // 닉네임 변경
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || nickname.trim().length < 2) { setProfileMsg('닉네임은 2자 이상이어야 합니다.'); return; }
    setProfileSaving(true); setProfileMsg('');
    try {
      const { error } = await getSupabase().auth.updateUser({ data: { nickname: nickname.trim() } });
      if (error) setProfileMsg('저장 실패: ' + error.message);
      else       setProfileMsg('저장되었습니다 ✅');
    } catch { setProfileMsg('네트워크 오류가 발생했습니다.'); }
    finally { setProfileSaving(false); }
  }

  // 비밀번호 변경
  async function savePassword(e: React.FormEvent) {
    e.preventDefault(); setSecMsg('');
    if (newPw.length < 8) { setSecMsg('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (newPw !== confirmPw) { setSecMsg('비밀번호가 일치하지 않습니다.'); return; }
    setSecLoading(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: newPw });
      if (error) setSecMsg('변경 실패: ' + error.message);
      else { setSecMsg('비밀번호가 변경되었습니다 ✅'); setNewPw(''); setConfirmPw(''); }
    } catch { setSecMsg('네트워크 오류가 발생했습니다.'); }
    finally { setSecLoading(false); }
  }

  // 계정 탈퇴
  async function deleteAccount() {
    if (!confirm('정말 탈퇴하시겠어요? 모든 데이터가 삭제되며 복구할 수 없습니다.')) return;
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token ?? '';
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { await signOut(); router.replace('/'); }
      else alert('탈퇴 처리 중 오류가 발생했습니다.');
    } catch { alert('네트워크 오류가 발생했습니다.'); }
  }

  // 히스토리 항목 삭제 (로컬 상태만 — DB 삭제는 보안상 서버 구현 필요)
  function removeHistoryItem(id: string) {
    setHistoryItems(prev => prev.filter(h => h.id !== id));
  }

  // 알림 주소 삭제
  async function removeWatched(address: string) {
    const next = watched.filter(w => w.address !== address);
    setWatched(next);
    localStorage.setItem('moveiq_watched', JSON.stringify(next));
    if (sessionId) {
      fetch('/api/user-preferences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, watched_addresses: next }),
      }).catch(() => {});
    }
  }

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    pending:   { label: '접수됨',  color: '#e0a84b' },
    reviewing: { label: '검토 중', color: '#2563EB' },
    resolved:  { label: '처리 완료', color: '#16a34a' },
    closed:    { label: '종료',    color: '#999' },
  };

  if (loading) return (
    <div className={styles.loadingWrap}><div className={styles.loadingSpinner}/><p>로딩 중...</p></div>
  );
  if (!user) return null;

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'profile',  label: '프로필',       icon: '👤' },
    { key: 'history',  label: '분석 히스토리', icon: '🕐' },
    { key: 'alerts',   label: '소음 알림',     icon: '🔔' },
    { key: 'feedback', label: '불편사항 내역',  icon: '📋' },
    { key: 'security', label: '보안',          icon: '🔐' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark} />무브IQ
        </Link>
        <AuthButton />
      </header>

      <main className={styles.main}>
        {/* 사이드바 */}
        <aside className={styles.sidebar}>
          <div className={styles.sideProfile}>
            <div className={styles.sideAvatar}>
              {user.avatar
                ? <img src={user.avatar} alt={user.nickname} className={styles.sideAvatarImg} />
                : <div className={styles.sideAvatarInitial}>{user.nickname?.charAt(0)?.toUpperCase()}</div>
              }
            </div>
            <div className={styles.sideNickname}>{user.nickname}</div>
            <div className={styles.sideEmail}>{user.email}</div>
          </div>
          <nav className={styles.sideNav}>
            {TABS.map(t => (
              <button key={t.key}
                className={`${styles.sideNavItem} ${tab === t.key ? styles.sideNavActive : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <button onClick={signOut} className={styles.signoutBtn}>로그아웃</button>
        </aside>

        {/* 콘텐츠 */}
        <div className={styles.content}>

          {/* ══ 프로필 탭 ══ */}
          {tab === 'profile' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>프로필 설정</h2>
              <form onSubmit={saveProfile} className={styles.profileForm}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>이메일</label>
                  <input type="email" value={user.email} disabled className={`${styles.input} ${styles.inputDisabled}`} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>닉네임</label>
                  <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className={styles.input} placeholder="닉네임 입력" minLength={2} maxLength={20} required />
                </div>
                {profileMsg && <p className={profileMsg.includes('✅') ? styles.msgOk : styles.msgErr}>{profileMsg}</p>}
                <button type="submit" className={styles.saveBtn} disabled={profileSaving}>
                  {profileSaving ? '저장 중...' : '저장'}
                </button>
              </form>
            </div>
          )}

          {/* ══ 분석 히스토리 탭 ══ */}
          {tab === 'history' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>분석 히스토리</h2>
              <p className={styles.cardDesc}>입지 분석을 실행한 주소 기록입니다.</p>

              {historyLoading ? (
                <div className={styles.emptyState}><div className={styles.loadingSpinner} /></div>
              ) : historyItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                  <p>아직 분석 기록이 없습니다.</p>
                  <Link href="/analysis" className={styles.emptyBtn}>입지 분석 시작하기 →</Link>
                </div>
              ) : (
                <div className={styles.historyList}>
                  {historyItems.map(item => (
                    <div key={item.id} className={styles.historyItem}>
                      <div className={styles.historyLeft}>
                        <span className={styles.historyIcon}>📍</span>
                        <div>
                          <div className={styles.historyAddr}>{item.address}</div>
                          <div className={styles.historyDate}>
                            {new Date(item.created_at).toLocaleDateString('ko-KR', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div className={styles.historyRight}>
                        {item.total_score != null && (
                          <span className={styles.historyScore} style={{ color: item.total_score >= 80 ? 'var(--main)' : item.total_score >= 60 ? '#7a8b5e' : '#e0a84b' }}>
                            {item.total_score}점 {item.grade}
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link href={`/analysis?address=${encodeURIComponent(item.address)}`} className={styles.historyBtn}>다시 보기</Link>
                          <button onClick={() => removeHistoryItem(item.id)} className={styles.historyDelBtn}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ 소음 알림 탭 ══ */}
          {tab === 'alerts' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>소음 알림 설정</h2>
              <p className={styles.cardDesc}>관심 주소에 새 소음 제보가 발생하면 브라우저 알림으로 알려드립니다.</p>
              {watched.length === 0 ? (
                <div className={styles.emptyState}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔔</div>
                  <p>등록된 관심 주소가 없습니다.</p>
                  <Link href="/noise-map" className={styles.emptyBtn}>소음 지도에서 등록하기 →</Link>
                </div>
              ) : (
                <div className={styles.watchList}>
                  {watched.map(w => (
                    <div key={w.address} className={styles.watchItem}>
                      <div className={styles.watchLeft}>
                        <span>📍</span>
                        <span className={styles.watchAddr}>{w.address}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/noise-map?address=${encodeURIComponent(w.address)}`} className={styles.historyBtn}>지도 보기</Link>
                        <button onClick={() => removeWatched(w.address)} className={styles.historyDelBtn}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ 불편사항 내역 탭 ══ */}
          {tab === 'feedback' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>불편사항 접수 내역</h2>
              <p className={styles.cardDesc}>제출하신 불편사항의 처리 상태를 확인할 수 있습니다.</p>

              {feedbackLoading ? (
                <div className={styles.emptyState}><div className={styles.loadingSpinner} /></div>
              ) : feedbackItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                  <p>접수된 불편사항이 없습니다.</p>
                  <Link href="/#faq" className={styles.emptyBtn}>불편사항 접수하기 →</Link>
                </div>
              ) : (
                <div className={styles.feedbackList}>
                  {feedbackItems.map(item => {
                    const st = STATUS_LABEL[item.status] ?? { label: item.status, color: '#999' };
                    return (
                      <div key={item.id} className={styles.feedbackItem}>
                        <div className={styles.feedbackTop}>
                          <span className={styles.feedbackType}>{item.type}</span>
                          <span className={styles.feedbackStatus} style={{ color: st.color, background: st.color + '18', border: `1px solid ${st.color}40` }}>
                            {st.label}
                          </span>
                        </div>
                        <p className={styles.feedbackContent}>{item.content}</p>
                        <div className={styles.feedbackDate}>
                          {new Date(item.created_at).toLocaleDateString('ko-KR', { year:'numeric', month:'short', day:'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ 보안 탭 ══ */}
          {tab === 'security' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>보안 설정</h2>
              <form onSubmit={savePassword} className={styles.profileForm}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>새 비밀번호</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className={styles.input} placeholder="8자 이상" minLength={8} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>비밀번호 확인</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={styles.input} placeholder="비밀번호 재입력" />
                </div>
                {secMsg && <p className={secMsg.includes('✅') ? styles.msgOk : styles.msgErr}>{secMsg}</p>}
                <button type="submit" className={styles.saveBtn} disabled={secLoading || !newPw || !confirmPw}>
                  {secLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </form>

              <div className={styles.dangerZone}>
                <h3 className={styles.dangerTitle}>위험 구역</h3>
                <p className={styles.dangerDesc}>계정을 탈퇴하면 모든 데이터(분석 히스토리, 소음 제보, 설정)가 영구 삭제됩니다.</p>
                <button onClick={deleteAccount} className={styles.deleteBtn}>계정 탈퇴</button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function MypagePage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#7a8570' }}>로딩 중...</div>}>
      <MypageContent />
    </Suspense>
  );
}
