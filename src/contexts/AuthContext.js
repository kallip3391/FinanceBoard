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

    // 인증 세션 처리 로직 통합
    const handleSession = async (session, eventType) => {
      if (!mounted) return;

      try {
        if (!session?.user) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const isManualLogin = typeof window !== 'undefined' && 
                              sessionStorage.getItem('is_manual_login') === 'true';
        
        // 수동 로그인 클릭 상태가 아니라면 절대 유저 상태를 업데이트하지 않음 (F5 시 Flash 방지)
        if (eventType !== 'INITIAL' && !isManualLogin) {
          console.log('[Auth] 자동 로그인 이벤트 무시 (Purge 진행 중)');
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
        // [최종 최적화] 수동 로그인 완료 또는 초기 확인 완료 시에만 로딩을 해제합니다.
        // F5 강제 로그아웃 중에는 여기서 로딩이 해제되지 않도록 필터링합니다.
        if (mounted) {
          const isManualLogin = typeof window !== 'undefined' && sessionStorage.getItem('is_manual_login') === 'true';
          if (!session?.user || isManualLogin || eventType === 'INITIAL') {
            setLoading(false);
          }
        }
      }
    };

    const initAuth = async () => {
      try {
        setLoading(true); // 시작 즉시 로딩 고정
        const { data: { session } } = await supabase.auth.getSession();
        
        const isManualLogin = typeof window !== 'undefined' && 
                              sessionStorage.getItem('is_manual_login') === 'true';

        // 수동 로그인이 아닌 세션 발견 시, 즉시 로그아웃을 수행하고 완료될 때까지 로딩 유지
        if (session && !isManualLogin) {
          console.log('[Auth] 요구사항에 따라 세션 정밀 초기화 중...');
          await signOut(); 
          if (mounted) setLoading(false);
          return;
        }

        if (session) {
          await handleSession(session, 'INITIAL');
          // [수정] 초기화가 끝난 후 깃발을 제거하여 race condition 방지
          if (typeof window !== 'undefined' && isManualLogin) {
            sessionStorage.removeItem('is_manual_login');
          }
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

        // SIGNED_OUT 이벤트는 항상 수용
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setProfileError(null);
          setLoading(false);
          return;
        }

        // 로그인 관련 이벤트는 handleSession에서 걸러짐
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await handleSession(session, event);
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
      console.log('[Auth] 로그아웃 프로세스 시작');
      // 로컬 상태만 먼저 비워서 UI 차단 시각화
      setUser(null);
      setProfile(null);
      localStorage.removeItem('pendingRegistration');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('is_manual_login');
      }
      await supabase.auth.signOut();
      console.log('[Auth] 로그아웃 프로세스 종료');
    } catch (err) {
      console.error('[Auth] 로그아웃 중 오류:', err);
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
