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
    // [최적화] 이미 현재 유저의 프로필 정보가 메모리에 있다면 DB 조회를 스킵
    if (profile && profile.user_id === userId) {
      console.log('[Auth] 캐시된 프로필 정보를 사용합니다.');
      return true;
    }

    if (isCheckingProfile.current) {
      console.log('[Auth] 이미 프로필 조회가 진행 중입니다.');
      return false;
    }
    
    isCheckingProfile.current = true;
    console.log('[Auth] DB 프로필 조회 시작:', userId);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log('[Auth] DB 응답 확인 완료');

      if (error && error.code === 'PGRST116') {
        const isPending = localStorage.getItem('pendingRegistration');
        if (isPending === 'true' && sessionUser) {
          const displayName = sessionUser.user_metadata?.full_name || 
                              sessionUser.user_metadata?.name || 
                              sessionUser.email.split('@')[0];

          const { data: newData, error: upsertError } = await supabase.from('profiles').upsert({
            user_id: userId,
            email: sessionUser.email,
            display_name: displayName,
            is_approved: false,
            is_admin: false
          }, { onConflict: 'user_id' }).select().single();
            
          if (!upsertError && newData) setProfile(newData);
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

        const isTabActive = typeof window !== 'undefined' ? sessionStorage.getItem('finance_session_active') : null;

        if (eventType === 'SIGNED_IN' || eventType === 'TOKEN_REFRESHED') {
          sessionStorage.setItem('finance_session_active', 'true');
        } else if (eventType === 'INITIAL' && !isTabActive) {
          console.warn('[Auth] 비활성 탭 감지 - 로그아웃');
          await signOut();
          return;
        }

        // UI를 빠르게 보여주기 위해 유저 정보를 먼저 설정
        if (mounted) {
          setUser(session.user);
          if (isTabActive || eventType === 'SIGNED_IN') setLoading(false);
        }

        // [핵심] 프로필 확인 (메모리에 있다면 스킵됨)
        const isAllowed = await checkProfile(session.user.id, session.user);
        
        if (mounted) {
          if (isAllowed) {
            setUser(session.user);
            sessionStorage.setItem('finance_session_active', 'true');
            setProfileError(null);
          } else {
            // 다른 사유로 인한 로그아웃 시에만signOut 호출
            if (eventType === 'INITIAL' && !isTabActive) await signOut();
          }
        }
      } catch (err) {
        console.error('[Auth] handleSession error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[Auth] 초기 접속 세션 확인');
        await handleSession(session, 'INITIAL');
      } catch (err) {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log('[Auth] 인증 이벤트:', event);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await handleSession(session, event);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setProfileError(null);
          sessionStorage.removeItem('finance_session_active');
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [profile]); // profile이 변경될 때 handleSession도 최신 profile을 알 수 있도록 함

  useEffect(() => {
    if (!user) return;
    let inactivityTimer;
    const resetTimer = () => localStorage.setItem('lastActivity', Date.now().toString());
    const checkInactivity = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity && (Date.now() - parseInt(lastActivity) >= INACTIVITY_TIMEOUT)) {
        console.warn('[Auth] 30분 미활동 로그아웃');
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
      console.log('[Auth] signOut 호출됨');
      setLoading(true);
      setUser(null);
      setProfile(null);
      sessionStorage.removeItem('finance_session_active');
      localStorage.removeItem('pendingRegistration');
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
