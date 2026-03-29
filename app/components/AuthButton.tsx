'use client';
// AuthButton — 헤더의 로그인/유저 버튼 + 드롭다운 메뉴
import { useState, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import AuthModal from './AuthModal';
import styles from './AuthButton.module.css';

export default function AuthButton() {
  const { user, loading, signOut } = useAuth();
  const [showModal,    setShowModal]    = useState(false);
  const [modalMode,    setModalMode]    = useState<'login'|'signup'>('login');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) return <div className={styles.skeleton} />;

  if (!user) {
    return (
      <>
        <div className={styles.authBtns}>
          <button className={styles.loginBtn} onClick={() => { setModalMode('login'); setShowModal(true); }}>로그인</button>
          <button className={styles.signupBtn} onClick={() => { setModalMode('signup'); setShowModal(true); }}>회원가입</button>
        </div>
        {showModal && <AuthModal initialMode={modalMode} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  // 로그인 상태 — 아바타 + 드롭다운
  const initial = user.nickname?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className={styles.wrapper} ref={dropRef}>
      <button className={styles.avatarBtn} onClick={() => setDropdownOpen(v => !v)} aria-label="내 계정">
        {user.avatar
          ? <img src={user.avatar} alt={user.nickname} className={styles.avatarImg} />
          : <div className={styles.avatarInitial}>{initial}</div>
        }
        <span className={styles.nickname}>{user.nickname}</span>
        <svg className={`${styles.chevron} ${dropdownOpen ? styles.chevronUp : ''}`} width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </button>

      {dropdownOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropHeader}>
            <div className={styles.dropAvatar}>
              {user.avatar
                ? <img src={user.avatar} alt="" className={styles.dropAvatarImg} />
                : <div className={styles.dropAvatarInitial}>{initial}</div>
              }
            </div>
            <div>
              <div className={styles.dropName}>{user.nickname}</div>
              <div className={styles.dropEmail}>{user.email}</div>
            </div>
          </div>
          <div className={styles.dropDivider} />
          <a href="/mypage" className={styles.dropItem}>
            <span>👤</span> 마이페이지
          </a>
          <a href="/mypage?tab=history" className={styles.dropItem}>
            <span>🕐</span> 분석 히스토리
          </a>
          <a href="/mypage?tab=alerts" className={styles.dropItem}>
            <span>🔔</span> 소음 알림 설정
          </a>
          <div className={styles.dropDivider} />
          <button className={`${styles.dropItem} ${styles.dropSignout}`} onClick={() => { signOut(); setDropdownOpen(false); }}>
            <span>🚪</span> 로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
