'use client';
// useAuth — Supabase 세션 관리 훅
// 전역 싱글턴: 각 컴포넌트에서 개별 구독 없이 공유
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

export interface AuthUser {
  id:       string;
  email:    string;
  nickname: string;
  avatar?:  string;
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id:       user.id,
    email:    user.email ?? '',
    nickname: user.user_metadata?.nickname ?? user.email?.split('@')[0] ?? '회원',
    avatar:   user.user_metadata?.avatar_url,
  };
}

export function useAuth() {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    // 초기 세션 로드
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(toAuthUser(data.session?.user ?? null));
      setLoading(false);
    });

    // 세션 변화 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(toAuthUser(session?.user ?? null));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  return { user, session, loading, signOut };
}
