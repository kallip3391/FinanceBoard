"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({
  user: null,
  loading: true,
  profileError: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  clearProfileError: () => {},
});

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

          // 23505(중복 키) 에러 방지를 위해 upsert 사용
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

          // 중복 에러(23505)나 RLS 정책 에러(42501)는 이미 데이터가 들어갔음을 의미하므로 무시
          if (upsertError && !['23505', '42501'].includes(upsertError.code)) {
            console.error('[Auth Error 상세]', upsertError);
            setProfileError(`등록 오류: ${upsertError.message || upsertError.code}`);
            await supabase.auth.signOut();
            return false;
          }

          // 등록 신청 성공 안내 (미승인 상태)
          setProfileError('사용자 등록 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
          await supabase.auth.signOut();
          return false;
        }

        setProfileError('미등록 사용자입니다. 관리자에게 문의해 주세요.');
        await supabase.auth.signOut();
        return false;
      }

      // 3. 데이터가 존재하지만 승인되지 않은 경우 차단
      if (data) {
        setProfile(data);
        if (data.is_approved === false) {
          setProfileError('관리자 승인을 대기 중입니다. 승인 완료 후 이용 가능합니다.');
          await supabase.auth.signOut();
          return false;
        }
        
        // 최종 승인된 사용자만 통과
        return true;
      }

      // 그 외 기타 에러 처리
      if (error) {
        setProfileError(`권한 확인 중 오류가 발생했습니다. (${error.code})`);
        await supabase.auth.signOut();
      }
      
      return false;
    } catch (err) {
      console.error('프로필 확인 에러 캐치:', err);
      return false;
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn('세션 확인 중 에러 발생:', error.message);
          if (error.message.includes('Refresh Token Not Found') || error.status === 400) {
            await supabase.auth.signOut();
            setUser(null);
          }
        } else if (session?.user) {
          const isAllowed = await checkProfile(session.user.id);
          if (isAllowed) {
            setUser(session.user);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('세션 확인 예외:', err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const isAllowed = await checkProfile(session.user.id);
          if (isAllowed) {
            setUser(session.user);
            setProfileError(null);
          } else {
            setUser(null);
            setProfile(null);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
    setProfileError(null);
    setProfile(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('로그아웃 에러:', error);
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
