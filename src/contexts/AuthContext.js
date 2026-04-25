"use client";

import { createContext, useContext, useEffect, useState, useRef } from 'react';
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

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; 

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const isCheckingProfile = useRef(false);

  const checkProfile = async (userId, sessionUser) => {
    if (isCheckingProfile.current) return false;
    isCheckingProfile.current = true;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        const isPending = localStorage.getItem('pendingRegistration');
        if (isPending === 'true' && sessionUser) {
          const displayName = sessionUser.user_metadata?.full_name || 
                              sessionUser.user_metadata?.name || 
                              sessionUser.email.split('@')[0];

          const { data: newData } = await supabase.from('profiles').upsert({
            user_id: userId,
            email: sessionUser.email,
            display_name: displayName,
            is_approved: false,
            is_admin: false
          }, { onConflict: 'user_id' }).select().single();
          if (newData) setProfile(newData);
          localStorage.removeItem('pendingRegistration');
          setProfileError('사용자 등록 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
        } else {
          setProfileError('미등록 사용자입니다. 관리자에게 문의해 주세요.');
        }
        return false;
      }

      if (data) {
        setProfile(data);
        if (data.is_approved === false) {
          setProfileError('관리자 승인을 대기 중입니다. 승인 완료 후 이용 가능합니다.');
          return false;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Auth] 프로필 확인 중 오류:', err);
      return false;
    } finally {
      isCheckingProfile.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session, eventType) => {
      if (!mounted) return;

      try {
        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        console.log(`[Auth] 세션 처리 (${eventType}):`, session.user.email);
        setUser(session.user);
        
        const isAllowed = await checkProfile(session.user.id, session.user);
        
        if (mounted) {
          if (isAllowed) {
            setUser(session.user);
            setProfileError(null);
          } else {
            await signOut();
          }
        }
      } catch (err) {
        console.error('[Auth] handleSession error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // 직접 버튼을 눌러 로그인했는지 여부 확인 (F5/새탭 로그아웃 예외 조건)
        const isManualLogin = typeof window !== 'undefined' && 
                              sessionStorage.getItem('is_manual_login') === 'true';

        // 세션이 있는데 수동 로그인이 아니라면? (즉, F5 새로고침이나 직접 접속)
        if (session && !isManualLogin) {
          console.log('[Auth] 요구사항에 따라 세션 초기화 (F5/새탭/직접접속)');
          await signOut();
          return;
        }

        // 로그인 절차가 끝났으면 플래그 제거
        if (isManualLogin) {
          sessionStorage.removeItem('is_manual_login');
        }

        if (session) {
          await handleSession(session, 'INITIAL');
        } else {
          setLoading(false);
        }
      } catch (err) {
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
          setUser(null);
          setProfile(null);
          setProfileError(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 미활동 자동 로그아웃 (기존 유지)
  useEffect(() => {
    if (!user) return;
    let inactivityTimer;
    const resetTimer = () => localStorage.setItem('lastActivity', Date.now().toString());
    const checkInactivity = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity && (Date.now() - parseInt(lastActivity) >= INACTIVITY_TIMEOUT)) {
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
    // [핵심] 로그인 버튼을 눌렀음을 명시적으로 기록
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('is_manual_login', 'true');
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/holdings`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
        scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
      }
    });
  };

  const signOut = async () => {
    try {
      console.log('[Auth] 로그아웃 실행');
      setLoading(true);
      setUser(null);
      setProfile(null);
      localStorage.removeItem('pendingRegistration');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('is_manual_login');
      }
      await supabase.auth.signOut();
    } finally {
      if (typeof window !== 'undefined') setLoading(false);
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
