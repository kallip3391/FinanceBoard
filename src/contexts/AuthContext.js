"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  profileError: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  clearProfileError: () => {},
});

// 미활동 로그아웃 시간 설정 (30분)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; 

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  const checkProfile = async (userId) => {
    try {
      console.log('[Auth] 프로필 조회 시작:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const isPending = localStorage.getItem('pendingRegistration');
        if (isPending === 'true') {
          const { data: { session } } = await supabase.auth.getSession();
          const sessionUser = session?.user;
          if (sessionUser) {
            const displayName = sessionUser.user_metadata?.full_name || 
                                sessionUser.user_metadata?.name || 
                                sessionUser.email.split('@')[0];

            await supabase.from('profiles').upsert({
              user_id: userId,
              email: sessionUser.email,
              display_name: displayName,
              is_approved: false,
              is_admin: false
            }, { onConflict: 'user_id' });
              
            localStorage.removeItem('pendingRegistration');
            setProfileError('사용자 등록 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
          }
          return false;
        }
        setProfileError('미등록 사용자입니다. 관리자에게 문의해 주세요.');
        return false;
      }

      if (data) {
        setProfile(data);
        console.log('[Auth] 프로필 데이터 로드 완료:', data.display_name);
        if (data.is_approved === false) {
          setProfileError('관리자 승인을 대기 중입니다. 승인 완료 후 이용 가능합니다.');
          return false;
        }
        return true;
      }

      return false;
    } catch (err) {
      console.error('[Auth] 프로필 확인 중 예외 발생:', err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // 인증 세션 처리 로직 통합
    const handleSession = async (session, eventType) => {
      if (!mounted) return;

      try {
        if (!session?.user) {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        console.log(`[Auth] 세션 감지 (${eventType}):`, session.user.email);

        const isTabActive = typeof window !== 'undefined' ? sessionStorage.getItem('finance_session_active') : null;

        if (eventType === 'SIGNED_IN' || eventType === 'TOKEN_REFRESHED') {
          sessionStorage.setItem('finance_session_active', 'true');
        } else if (eventType === 'INITIAL' && !isTabActive) {
          console.warn('[Auth] 비활성 탭 또는 브라우저 재시작 감지 - 세션 종료');
          await signOut();
          return;
        }

        // [최적화] 유저 세션이 이미 있는 경우 UI를 먼저 보여줌 (깜빡임 방지)
        if (session.user && mounted) {
          setUser(session.user);
          if (isTabActive || eventType === 'SIGNED_IN') {
             setLoading(false); 
          }
        }

        const isAllowed = await checkProfile(session.user.id);
        if (mounted) {
          if (isAllowed) {
            setUser(session.user);
            sessionStorage.setItem('finance_session_active', 'true');
            setProfileError(null);
            console.log('[Auth] 로그인 및 승인 확인 완료 ✅');
          } else {
            console.log('[Auth] 승인되지 않은 사용자 - 로그아웃');
            await signOut();
          }
        }
      } catch (err) {
        console.error('[Auth] 처리 중 오류:', err);
      } finally {
        if (mounted) {
          setLoading(false);
          console.log('[Auth] 로딩 상태 종료');
        }
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Auth] 초기화 시작');
        await handleSession(session, 'INITIAL');
      } catch (err) {
        console.error('[Auth] 초기화 에러:', err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log('[Auth] 인증 이벤트 발생:', event);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await handleSession(session, event);
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setProfileError(null);
            sessionStorage.removeItem('finance_session_active');
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- 자동 로그아웃 (미활동 30분) 로직 ---
  useEffect(() => {
    if (!user) return;
    let inactivityTimer;
    const resetTimer = () => localStorage.setItem('lastActivity', Date.now().toString());
    const checkInactivity = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity && (Date.now() - parseInt(lastActivity) >= INACTIVITY_TIMEOUT)) {
        console.log('[Auth] 장시간 미활동 - 자동 로그아웃');
        await signOut();
      }
    };
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    inactivityTimer = setInterval(checkInactivity, 60 * 1000);
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer) clearInterval(inactivityTimer);
    };
  }, [user]);

  const signInWithGoogle = async () => {
    setProfileError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/holdings`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
        scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
      }
    });
    if (error) console.error('로그인 에러:', error);
  };

  const signOut = async () => {
    try {
      console.log('[Auth] signOut 실행 시작');
      setLoading(true);
      setUser(null);
      setProfile(null);
      sessionStorage.removeItem('finance_session_active');
      localStorage.removeItem('pendingRegistration');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] 로그아웃 중 오류:', err);
    } finally {
      if (typeof window !== 'undefined') setLoading(false);
      console.log('[Auth] signOut 완료');
    }
  };

  const clearProfileError = () => setProfileError(null);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, signInWithGoogle, signOut, clearProfileError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
