'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/components/useAuth';
import AuthButton from '@/app/components/AuthButton';
import AuthModal from '@/app/components/AuthModal';
import { getSupabase } from '@/lib/supabase';
import styles from './mypage.module.css';

type Tab = 'profile' | 'history' | 'alerts' | 'security';

function MypageContent() {
  const { user, loading, signOut } = useAuth();
  const router      = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'profile');

  // 비로그인 시 홈으로
  useEffect(() => {
    if (!loading && !user) router.replace('/?auth=login');
  }, [user, loading, router]);

  // ── 프로필 탭 state ───────────────────────────────────────
  const [nickname,     setNickname]     = useState('');
  const [profileSaving,setProfileSaving]= useState(false);
  const [profileMsg,   setProfileMsg]   = useState('');

  // ── 히스토리 탭 state ─────────────────────────────────────
  const [history,      setHistory]      = useState<string[]>([]);

  // ── 알림 탭 state ─────────────────────────────────────────
  const [watched,      setWatched]      = useState<{address:string;lat:number;lng:number}[]>([]);

  // ── 보안 탭 state ─────────────────────────────────────────
  const [newPw,        setNewPw]        = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');
  const [secMsg,       setSecMsg]       = useState('');
  const [secLoading,   setSecLoading]   = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname ?? '');

    const sid = typeof window !== 'undefined' ? localStorage.getItem('moveiq_session_id') ?? '' : '';
    if (!sid) return;

    fetch(`/api/user-preferences?session_id=${encodeURIComponent(sid)}`)
      .then(r => r.json())
      .then(json => {
        if (json.search_history)  setHistory(json.search_history);
        if (json.community_dongs) {} // 커뮤니티 관심동네 (마이페이지에서 관리 가능)
      })
      .catch(() => {});

    // 소음 알림 목록
    try {
      const w = JSON.parse(localStorage.getItem('moveiq_watched') ?? '[]');
      setWatched(w);
    } catch {}
  }, [user]);

  // 닉네임 변경
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || nickname.trim().length < 2) { setProfileMsg('닉네임은 2자 이상이어야 합니다.'); return; }
    setProfileSaving(true); setProfileMsg('');
    try {
      const { error } = await getSupabase().auth.updateUser({ data: { nickname: nickname.trim() } });
      if (error) { setProfileMsg('저장 실패: ' + error.message); }
      else { setProfileMsg('저장되었습니다 ✅'); }
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
      if (error) { setSecMsg('변경 실패: ' + error.message); }
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
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) { await signOut(); router.replace('/'); }
      else alert('탈퇴 처리 중 오류가 발생했습니다.');
    } catch { alert('네트워크 오류가 발생했습니다.'); }
  }

  // 히스토리 삭제
  function removeHistory(addr: string) {
    const next = history.filter(h => h !== addr);
    setHistory(next);
    const sid = localStorage.getItem('moveiq_session_id') ?? '';
    if (sid) {
      fetch('/api/user-preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id: sid, search_history: next }) }).catch(()=>{});
    }
  }

  if (loading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.loadingSpinner}/>
      <p>로딩 중...</p>
    </div>
  );

  if (!user) return null;

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key:'profile',  label:'프로필',      icon:'👤' },
    { key:'history',  label:'분석 히스토리', icon:'🕐' },
    { key:'alerts',   label:'소음 알림',    icon:'🔔' },
    { key:'security', label:'보안',         icon:'🔐' },
  ];

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <header className={styles.header}>
        <a href="/" className={styles.logo}>📍 무브IQ</a>
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
              <button
                key={t.key}
                className={`${styles.sideNavItem} ${tab===t.key ? styles.sideNavActive : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </nav>

          <button className={styles.backToHomeBtn} onClick={() => router.push('/')}>
            ← 홈으로
          </button>
        </aside>

        {/* 콘텐츠 */}
        <div className={styles.content}>

          {/* ── 프로필 탭 ── */}
          {tab==='profile' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>프로필 설정</h2>
              <form onSubmit={saveProfile} className={styles.profileForm}>
                <div className={styles.formField}>
                  <label>이메일</label>
                  <input type="email" value={user.email} disabled className={`${styles.input} ${styles.inputDisabled}`}/>
                  <span className={styles.fieldHint}>이메일은 변경할 수 없습니다.</span>
                </div>
                <div className={styles.formField}>
                  <label>닉네임</label>
                  <input type="text" value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={10} className={styles.input} placeholder="2~10자"/>
                  <span className={styles.fieldHint}>{nickname.length}/10</span>
                </div>
                {profileMsg && <p className={profileMsg.includes('✅') ? styles.msgOk : styles.msgErr}>{profileMsg}</p>}
                <button type="submit" className={styles.saveBtn} disabled={profileSaving}>
                  {profileSaving ? '저장 중...' : '저장'}
                </button>
              </form>
            </section>
          )}

          {/* ── 분석 히스토리 탭 ── */}
          {tab==='history' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>분석 히스토리</h2>
              {history.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🏙️</div>
                  <p>아직 분석한 지역이 없습니다.</p>
                  <a href="/" className={styles.emptyAction}>입지 분석 시작하기 →</a>
                </div>
              ) : (
                <div className={styles.historyList}>
                  {history.map((addr, i) => (
                    <div key={i} className={styles.historyItem}>
                      <div className={styles.historyLeft}>
                        <span className={styles.historyIcon}>📍</span>
                        <span className={styles.historyAddr}>{addr}</span>
                      </div>
                      <div className={styles.historyRight}>
                        <a href={`/?addr=${encodeURIComponent(addr)}`} className={styles.historyAnalyze}>재분석</a>
                        <button className={styles.historyDel} onClick={() => removeHistory(addr)}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button
                    className={styles.clearAllBtn}
                    onClick={() => {
                      if (confirm('히스토리를 모두 삭제할까요?')) {
                        setHistory([]);
                        const sid = localStorage.getItem('moveiq_session_id') ?? '';
                        if (sid) fetch('/api/user-preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id: sid, search_history: [] }) }).catch(()=>{});
                      }
                    }}
                  >전체 삭제</button>
                </div>
              )}
            </section>
          )}

          {/* ── 소음 알림 탭 ── */}
          {tab==='alerts' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>소음 알림 설정</h2>
              <div className={styles.alertInfo}>
                <span>🔔</span>
                <p>관심 주소 반경 내 새 소음 제보 발생 시 브라우저 알림을 받을 수 있습니다.</p>
              </div>
              {watched.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🔕</div>
                  <p>등록된 관심 주소가 없습니다.</p>
                  <a href="/#noise" className={styles.emptyAction}>소음 지도에서 등록하기 →</a>
                </div>
              ) : (
                <div className={styles.watchList}>
                  {watched.map((w, i) => (
                    <div key={i} className={styles.watchItem}>
                      <div className={styles.watchLeft}>
                        <span className={styles.watchIcon}>📍</span>
                        <div>
                          <div className={styles.watchAddr}>{w.address}</div>
                          <div className={styles.watchCoord}>{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</div>
                        </div>
                      </div>
                      <button
                        className={styles.watchDel}
                        onClick={() => {
                          const next = watched.filter((_, j) => j !== i);
                          setWatched(next);
                          localStorage.setItem('moveiq_watched', JSON.stringify(next));
                        }}
                      >삭제</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── 보안 탭 ── */}
          {tab==='security' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>보안 설정</h2>

              <div className={styles.subSection}>
                <h3 className={styles.subTitle}>비밀번호 변경</h3>
                <form onSubmit={savePassword} className={styles.profileForm}>
                  <div className={styles.formField}>
                    <label>새 비밀번호</label>
                    <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="8자 이상" className={styles.input}/>
                  </div>
                  <div className={styles.formField}>
                    <label>새 비밀번호 확인</label>
                    <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} placeholder="비밀번호 재입력" className={styles.input}/>
                  </div>
                  {secMsg && <p className={secMsg.includes('✅') ? styles.msgOk : styles.msgErr}>{secMsg}</p>}
                  <button type="submit" className={styles.saveBtn} disabled={secLoading || !newPw || !confirmPw}>
                    {secLoading ? '변경 중...' : '비밀번호 변경'}
                  </button>
                </form>
              </div>

              <div className={styles.subSection}>
                <h3 className={styles.subTitle}>로그아웃</h3>
                <p className={styles.subDesc}>현재 기기에서 로그아웃합니다.</p>
                <button className={styles.logoutBtn} onClick={() => { signOut(); router.replace('/'); }}>로그아웃</button>
              </div>

              <div className={styles.dangerZone}>
                <h3 className={styles.dangerTitle}>위험 구역</h3>
                <p className={styles.dangerDesc}>계정을 탈퇴하면 모든 데이터가 영구 삭제되며 복구할 수 없습니다.</p>
                <button className={styles.deleteBtn} onClick={deleteAccount}>계정 탈퇴</button>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}

export default function MypagePage() {
  return (
    <Suspense fallback={<div style={{padding:40,textAlign:'center'}}>로딩 중...</div>}>
      <MypageContent />
    </Suspense>
  );
}
