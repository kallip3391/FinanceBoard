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
      const { data: { session } } = await supabase.auth.getSession();
      const sessionUser = session?.user;

      // 1. 프로필 조회 시도
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // 2. 데이터가 없는 경우 (최초 등록 신청 시도)
      if (error && error.code === 'PGRST116') {
        const isPending = localStorage.getItem('pendingRegistration');
        
        if (isPending === 'true' && sessionUser) {
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
          return false;
        }

        setProfileError('미등록 사용자입니다. 관리자에게 문의해 주세요.');
        return false;
      }

      // 3. 데이터가 존재하지만 승인되지 않은 경우
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
      console.error('프로필 확인 에러 캐치:', err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // 인증 세션 처리 로직 통합 (sessionStorage 기반)
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

        // --- 단순화된 로그아웃 가드 로직 (sessionStorage 기반) ---
        // sessionStorage는 새로고침(F5) 시 유지되지만, 새 탭이나 창 종료 시에는 사라짐
        const isTabActive = typeof window !== 'undefined' ? sessionStorage.getItem('finance_session_active') : null;

        // 1. 새로운 로그인인 경우 탭 활성화 기록
        if (eventType === 'SIGNED_IN' || eventType === 'TOKEN_REFRESHED') {
          sessionStorage.setItem('finance_session_active', 'true');
        } 
        // 2. 초기 로드(INITIAL)인데 탭 기록이 없다면 (다른 탭 접근 or 브라우저 재시작)
        else if (eventType === 'INITIAL' && !isTabActive) {
          console.warn('[Auth] 비활성 탭 또는 브라우저 재시작 감지 - 세션 종료');
          await signOut();
          return;
        }

        const isAllowed = await checkProfile(session.user.id);
        if (mounted) {
          if (isAllowed) {
            setUser(session.user);
            sessionStorage.setItem('finance_session_active', 'true');
            setProfileError(null);
          } else {
            console.log('[Auth] 승인되지 않은 사용자 - 강제 로그아웃');
            await signOut();
          }
        }
      } catch (err) {
        console.error('[Auth] 처리 중 오류:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // 초기 세션 확인
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleSession(session, 'INITIAL');
      } catch (err) {
        console.error('[Auth] 초기화 오류:', err);
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

    const resetInactivityTimer = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const checkInactivity = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity);
        if (elapsed >= INACTIVITY_TIMEOUT) {
          console.log('[Auth] 30분 미활동으로 자동 로그아웃합니다.');
          await signOut();
        }
      } else {
        resetInactivityTimer();
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    inactivityTimer = setInterval(checkInactivity, 60 * 1000);
    resetInactivityTimer();

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
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
      setLoading(true);
      setProfileError(null);
      setProfile(null);
      setUser(null);
      sessionStorage.removeItem('finance_session_active');
      localStorage.removeItem('pendingRegistration');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('로그아웃 프로세스 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearProfileError = () => setProfileError(null);

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, signInWithGoogle, signOut, clearProfileError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
