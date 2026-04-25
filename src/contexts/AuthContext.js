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

// 브라우저 창 닫기 감지를 위한 세션 쿠키 가드 함수
const setSessionGuard = () => {
  if (typeof document !== 'undefined') {
    document.cookie = "sb_session_active=true; path=/; SameSite=Lax";
  }
};

const checkSessionGuard = () => {
  if (typeof document === 'undefined') return true;
  return document.cookie.split(';').some((item) => item.trim().startsWith('sb_session_active='));
};

const clearSessionGuard = () => {
  if (typeof document !== 'undefined') {
    document.cookie = "sb_session_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  }
};

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
          console.log('[Auth Info] 신규 신청 요청 발견, 구글 계정 정보로 자동 등록 시도');
          
          const displayName = sessionUser.user_metadata?.full_name || 
                              sessionUser.user_metadata?.name || 
                              sessionUser.email.split('@')[0];

          const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
              user_id: userId,
              email: sessionUser.email,
              display_name: displayName,
              is_approved: false,
              is_admin: false
            }, { onConflict: 'user_id' });
            
          localStorage.removeItem('pendingRegistration');

          if (upsertError && !['23505', '42501'].includes(upsertError.code)) {
            console.error('[Auth Error 상세]', upsertError);
            setProfileError(`등록 오류: ${upsertError.message || upsertError.code}`);
            return false;
          }

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
        
        // 최종 승인된 사용자만 통과
        return true;
      }

      if (error) {
        setProfileError(`권한 확인 중 오류가 발생했습니다. (${error.code})`);
      }
      
      return false;
    } catch (err) {
      console.error('프로필 확인 에러 캐치:', err);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // 세션 처리 중복 방지 및 레이스 컨디션을 막기 위해 useRef 대신 변수 사용 (useEffect 내에서만 관리)
    let sessionHandled = false;

    // 인증 세션 처리 로직 통합 (중복 방지 및 상태 동기화)
    const handleSession = async (session, eventType) => {
      if (!mounted) return;
      
      // 이미 처리가 완료되었거나 진행 중인 경우 INITIAL 중복 실행 방지
      if (sessionHandled && eventType === 'INITIAL') return;
      if (eventType === 'SIGNED_IN') sessionHandled = true;

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

        // [수정] SIGNED_IN인 경우 Profil 확인 전에 미리 쿠키를 생성하여 
        // 동시에 실행되는 INITIAL 체크에서 튕기지 않게 함
        if (eventType === 'SIGNED_IN' || eventType === 'TOKEN_REFRESHED') {
          setSessionGuard();
        }

        // [수정] INITIAL(새로고침/탭열기)인 경우에만 브라우저 종료 여부 체크
        if (eventType === 'INITIAL' && !checkSessionGuard()) {
          // 새 탭이 열릴 때 쿠키 동기화 시간을 위해 아주 잠깐 대기
          await new Promise(r => setTimeout(r, 500));
          
          if (!checkSessionGuard()) {
            console.warn('[Auth] 브라우저 종료 후 재접속 감지 - 이 탭의 로컬 세션만 초기화');
            // 다른 탭에 영향을 주지 않도록 서버 로그아웃 대신 로컬 상태만 비움
            setUser(null);
            setProfile(null);
            setLoading(false);
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
        }

        const isAllowed = await checkProfile(session.user.id);
        if (mounted) {
          if (isAllowed) {
            setUser(session.user);
            setSessionGuard(); // 쿠키 상태 유지 및 갱신
            setProfileError(null);
          } else {
            console.log('[Auth] 승인되지 않은 사용자 - 강제 로그아웃');
            await signOut();
          }
        }
      } catch (err) {
        console.error('[Auth] 프로필 확인 중 오류:', err);
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
            clearSessionGuard();
            setLoading(false);
          }
        } else if (event === 'INITIAL_SESSION') {
          // getSession()과 중복될 수 있으므로 로그만 남김
          console.log('[Auth] 초기 세션 확인됨');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --- 자동 로그아웃 (미활동 30분) 로직 추가 ---
  useEffect(() => {
    if (!user) return;

    let inactivityTimer;

    const resetInactivityTimer = () => {
      // 로컬 스토리지에 마지막 활동 시간 기록 (탭 간 공유 가능)
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

    // 활동 감지 이벤트 리스너 등록
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    // 1분마다 미활동 여부 체크
    inactivityTimer = setInterval(checkInactivity, 60 * 1000);
    resetInactivityTimer(); // 초기화

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (inactivityTimer) clearInterval(inactivityTimer);
    };
  }, [user]); // user 상태가 있을 때만 작동

  const signInWithGoogle = async () => {
    setProfileError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/holdings`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
      }
    });
    
    if (error) {
      console.error('로그인 에러:', error);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setProfileError(null);
      setProfile(null);
      setUser(null);
      localStorage.removeItem('pendingRegistration');
      clearSessionGuard(); // 로그아웃 시 세션 보호 쿠키 삭제
      
      // 전역 로그아웃 시도
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('로그아웃 중 오류:', error);
        // 오류가 나더라도 로컬 데이터는 모두 삭제했으므로 상태를 강제 초기화
      }
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
