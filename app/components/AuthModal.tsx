'use client';
// AuthModal.tsx — 로그인 / 회원가입 통합 모달
// Supabase Auth (이메일+비밀번호, Google OAuth)
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import styles from './AuthModal.module.css';

type Mode = 'login' | 'signup' | 'reset';

interface Props {
  onClose: () => void;
  onSuccess?: (user: any) => void;
  initialMode?: Mode;
}

export default function AuthModal({ onClose, onSuccess, initialMode = 'login' }: Props) {
  const [mode,        setMode]        = useState<Mode>(initialMode);
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [nickname,    setNickname]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const supabase = getSupabase();

  function reset() { setError(''); setSuccess(''); }

  // ── 이메일 로그인 ─────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); reset(); setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login')) setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        else if (error.message.includes('Email not confirmed')) setError('이메일 인증이 필요합니다. 받은편지함을 확인해주세요.');
        else setError(error.message);
        return;
      }
      onSuccess?.(data.user);
      onClose();
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  // ── 회원가입 ──────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (nickname.trim().length < 2) { setError('닉네임은 2자 이상이어야 합니다.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nickname: nickname.trim() } },
      });
      if (error) { setError(error.message); return; }
      if (data.user?.identities?.length === 0) {
        setError('이미 가입된 이메일입니다. 로그인해주세요.');
        return;
      }
      setSuccess('가입 완료! 이메일 인증 링크를 확인해주세요.');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  // ── 비밀번호 재설정 ───────────────────────────────────────
  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); reset(); setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/mypage?tab=security`,
      });
      if (error) { setError(error.message); return; }
      setSuccess('비밀번호 재설정 링크를 이메일로 발송했습니다.');
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setLoading(false); }
  }

  // ── Google OAuth ──────────────────────────────────────────
  async function handleGoogle() {
    reset(); setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
    } catch { setError('Google 로그인 오류가 발생했습니다.'); setLoading(false); }
  }

  const isLogin  = mode === 'login';
  const isSignup = mode === 'signup';
  const isReset  = mode === 'reset';

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={isLogin ? '로그인' : isSignup ? '회원가입' : '비밀번호 재설정'}>

        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.logo}>📍 무브IQ</div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {/* 탭 (로그인 / 회원가입) */}
        {!isReset && (
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${isLogin ? styles.tabActive : ''}`} onClick={() => { setMode('login'); reset(); }}>로그인</button>
            <button className={`${styles.tab} ${isSignup ? styles.tabActive : ''}`} onClick={() => { setMode('signup'); reset(); }}>회원가입</button>
          </div>
        )}
        {isReset && <h2 className={styles.resetTitle}>🔐 비밀번호 재설정</h2>}

        {/* 에러 / 성공 메시지 */}
        {error   && <div className={styles.errorBox}  role="alert">⚠️ {error}</div>}
        {success && <div className={styles.successBox} role="status">✅ {success}</div>}

        {/* ── 로그인 폼 ── */}
        {isLogin && !success && (
          <>
            <form onSubmit={handleLogin} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="auth-email">이메일</label>
                <input id="auth-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email" required className={styles.input}/>
              </div>
              <div className={styles.field}>
                <label htmlFor="auth-pw">
                  비밀번호
                  <button type="button" className={styles.showPwBtn} onClick={()=>setShowPw(v=>!v)}>{showPw?'숨기기':'보기'}</button>
                </label>
                <input id="auth-pw" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호 입력" autoComplete="current-password" required className={styles.input}/>
              </div>
              <div className={styles.forgotRow}>
                <button type="button" className={styles.forgotBtn} onClick={()=>{ setMode('reset'); reset(); }}>비밀번호 찾기</button>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={loading || !email || !password}>
                {loading ? <span className={styles.spinner}/> : '로그인'}
              </button>
            </form>

            {/* 소셜 로그인 */}
            <div className={styles.divider}><span>또는</span></div>
            <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none"><path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/><path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z" fill="#FF3D00"/><path d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.6C29.6 37 26.9 38 24 38c-6.1 0-11.3-4.1-13.1-9.7l-7.1 5.5C7.6 41.3 15.3 46 24 46z" fill="#4CAF50"/><path d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.7-4.9 6.1l6.6 5.6C41.4 36.8 45 30.9 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/></svg>
              Google로 계속하기
            </button>
          </>
        )}

        {/* ── 회원가입 폼 ── */}
        {isSignup && !success && (
          <form onSubmit={handleSignup} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="su-email">이메일</label>
              <input id="su-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email" required className={styles.input}/>
            </div>
            <div className={styles.field}>
              <label htmlFor="su-nickname">닉네임</label>
              <input id="su-nickname" type="text" value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="2~10자 (예: 이사준비중)" maxLength={10} autoComplete="off" required className={styles.input}/>
              <span className={styles.hint}>{nickname.length}/10</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="su-pw">
                비밀번호
                <button type="button" className={styles.showPwBtn} onClick={()=>setShowPw(v=>!v)}>{showPw?'숨기기':'보기'}</button>
              </label>
              <input id="su-pw" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8자 이상" autoComplete="new-password" required className={styles.input}/>
              {password && (
                <div className={styles.pwStrength}>
                  <div className={styles.pwBar}>
                    <div className={styles.pwFill} style={{width: password.length>=12&&/[^a-zA-Z0-9]/.test(password)?'100%':password.length>=10?'66%':password.length>=8?'33%':'10%', background: password.length>=12&&/[^a-zA-Z0-9]/.test(password)?'#27ae60':password.length>=10?'#f39c12':'#e74c3c'}}/>
                  </div>
                  <span>{password.length>=12&&/[^a-zA-Z0-9]/.test(password)?'강함':password.length>=10?'보통':'약함'}</span>
                </div>
              )}
            </div>
            <p className={styles.terms}>
              가입 시 <a href="/terms" target="_blank">이용약관</a> 및 <a href="/privacy" target="_blank">개인정보처리방침</a>에 동의합니다.
            </p>
            <button type="submit" className={styles.submitBtn} disabled={loading || !email || !password || !nickname}>
              {loading ? <span className={styles.spinner}/> : '무료로 시작하기'}
            </button>

            <div className={styles.divider}><span>또는</span></div>
            <button type="button" className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none"><path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/><path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z" fill="#FF3D00"/><path d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.6C29.6 37 26.9 38 24 38c-6.1 0-11.3-4.1-13.1-9.7l-7.1 7.1C7.6 41.3 15.3 46 24 46z" fill="#4CAF50"/><path d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.7-4.9 6.1l6.6 5.6C41.4 36.8 45 30.9 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/></svg>
              Google로 계속하기
            </button>
          </form>
        )}

        {/* ── 비밀번호 재설정 ── */}
        {isReset && !success && (
          <form onSubmit={handleReset} className={styles.form} noValidate>
            <p className={styles.resetDesc}>가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.</p>
            <div className={styles.field}>
              <label htmlFor="reset-email">이메일</label>
              <input id="reset-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email" required className={styles.input}/>
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading || !email}>
              {loading ? <span className={styles.spinner}/> : '재설정 링크 보내기'}
            </button>
            <button type="button" className={styles.backBtn} onClick={()=>{ setMode('login'); reset(); }}>← 로그인으로 돌아가기</button>
          </form>
        )}
      </div>
    </div>
  );
}
