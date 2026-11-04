"use client";

import { useState, useEffect } from "react";
import { Menu, TrendingUp, LogOut, User, UserPlus, Settings, AlertCircle, Clock, CheckCircle2, X } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useAssets } from '@/contexts/AssetContext';
import RegistrationModal from "./RegistrationModal";
import AdminApprovalModal from "./AdminApprovalModal";

const getDisplayName = (user) => {
  if (user?.user_metadata?.display_name) return user.user_metadata.display_name;
  if (user?.user_metadata?.name) return user.user_metadata.name;
  if (user?.email) return user.email.split('@')[0];
  return user?.email || '사용자';
};

export default function TopNav({ onMenuClick }) {
  const { user, profile, loading, profileError, signInWithGoogle, signOut, clearProfileError } = useAuth();
  const { summary } = useAssets();
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // 알림 메시지가 뜬 경우 8초 후 자동 닫기
  useEffect(() => {
    if (!profileError) return;
    const timer = setTimeout(() => {
      clearProfileError();
    }, 8000);
    return () => clearTimeout(timer);
  }, [profileError, clearProfileError]);

  // 등록 신청 핸들러
  const handleRegistrationSubmit = async () => {
    localStorage.setItem('pendingRegistration', 'true');
    await signInWithGoogle();
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return "0";
    // 10원 단위 반올림 처리 (사용자 요청 사항 반영)
    const roundedValue = Math.round(value / 10) * 10;
    return new Intl.NumberFormat('ko-KR').format(roundedValue);
  };

  return (
    <header className="w-full bg-white shadow-sm border-b border-slate-100 sticky top-0 z-30">
      <div className="flex items-center justify-between px-3 md:px-4 py-3 h-14 md:h-16 w-full max-w-[1600px] mx-auto">
        {/* 좌측: 햄버거 + 로고(데스크톱만) */}
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          <button onClick={onMenuClick} className="p-2 -ml-1 md:-ml-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
            <Menu size={22} />
          </button>
          
          <div className="desktop-only items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-bold border border-emerald-100/50 shrink-0">
            <TrendingUp size={16} />
            <span className="whitespace-nowrap text-sm">FINANCE BOARD</span>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1 shrink-0 desktop-only"></div>
        </div>

        {/* 우측: 인증 버튼 + 자산요약(데스크톱만) */}
        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          {/* Auth Section */}
          {!loading ? (
            user ? (
              <div className="flex items-center gap-1 md:gap-3">
                {profile?.is_admin && (
                  <button 
                    onClick={() => setIsAdminModalOpen(true)}
                    className="flex items-center gap-1 md:gap-2 bg-amber-50 text-amber-600 px-2 md:px-3 py-1.5 rounded-lg border border-amber-200/50 hover:bg-amber-100 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 whitespace-nowrap"
                  >
                    <Settings size={14} />
                    <span className="text-xs md:text-sm font-bold">승인 설정</span>
                  </button>
                )}
                <div className="flex items-center gap-1 md:gap-2 bg-slate-100 text-slate-700 px-2 md:px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm leading-none min-w-0 justify-center shrink-0">
                  <div className="w-4 h-4 md:w-5 md:h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center shrink-0">
                    <User size={10} />
                  </div>
                  <span className="text-xs md:text-sm font-bold whitespace-nowrap">{getDisplayName(user)}</span>
                </div>
                <button onClick={signOut} className="flex items-center gap-1 md:gap-2 bg-red-50 text-red-600 px-2 md:px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-200 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 whitespace-nowrap">
                  <LogOut size={14} />
                  <span className="text-xs md:text-sm font-bold">로그아웃</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 md:gap-3">
                <button onClick={signInWithGoogle} className="flex items-center gap-1 md:gap-2 bg-brand text-white px-3 md:px-5 py-2 rounded-lg hover:bg-brand-dark transition-all shadow-md shadow-brand/20 cursor-pointer active:scale-95 justify-center shrink-0 whitespace-nowrap">
                  <User size={14} />
                  <span className="text-xs md:text-sm font-bold">로그인</span>
                </button>
                <button 
                  onClick={() => setIsRegModalOpen(true)}
                  className="flex items-center gap-1 md:gap-2 bg-indigo-500 text-white px-3 md:px-5 py-2 rounded-lg hover:bg-indigo-600 transition-all font-bold shadow-md shadow-indigo-100 cursor-pointer active:scale-95 justify-center shrink-0 whitespace-nowrap"
                >
                  <UserPlus size={14} />
                  <span className="text-xs md:text-sm">등록 신청</span>
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1 md:gap-3">
              <div className="w-[80px] md:w-[100px] h-9 bg-slate-200 animate-pulse rounded-lg"></div>
              <div className="w-[80px] md:w-[120px] h-9 bg-slate-200/60 animate-pulse rounded-lg"></div>
            </div>
          )}

          {/* 자산 요약 (데스크톱 전용) */}
          <div className="desktop-only items-center gap-3 text-sm font-medium shrink-0">
            {user && (
              <>
                <div className="hidden lg:flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                  <span>매수 <span className="text-slate-900 font-bold ml-1">{formatCurrency(summary.totalEvaluation - summary.totalProfit)}</span></span>
                </div>
                <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-lg border border-slate-200 text-blue-600 relative min-w-[120px] shadow-sm shrink-0">
                  <span>평가 <span className="text-blue-600 font-bold ml-1">{formatCurrency(summary.totalEvaluation)}</span></span>
                  {summary.isLoading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm shrink-0 ${summary.totalProfit > 0 ? 'bg-red-50 text-red-600 border-red-100' : (summary.totalProfit < 0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200')}`}>
                  <span>수익 <span className="font-bold ml-1">{formatCurrency(summary.totalProfit)} ({summary.avgProfitRate.toFixed(2)}%)</span></span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 등록 신청 모달 */}
      <RegistrationModal 
        isOpen={isRegModalOpen} 
        onClose={() => setIsRegModalOpen(false)} 
        onSubmit={handleRegistrationSubmit}
      />

      {/* 관리자 승인 설정 모달 */}
      <AdminApprovalModal 
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      {/* 권한/등록신청 상태 알림 배너 */}
      {profileError && (
        <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg animate-fade-in">
          <div className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md ${
            profileError.includes('완료') 
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-500/10'
              : profileError.includes('대기')
                ? 'bg-amber-50/95 border-amber-200 text-amber-900 shadow-amber-500/10'
                : 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-500/10'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {profileError.includes('완료') ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : profileError.includes('대기') ? (
                <Clock size={18} className="text-amber-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
              )}
              <span className="text-xs md:text-sm font-semibold leading-relaxed">
                {profileError}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {profileError.includes('등록 신청') && (
                <button
                  onClick={() => {
                    clearProfileError();
                    setIsRegModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                >
                  신청하기
                </button>
              )}
              <button 
                onClick={clearProfileError}
                className="p-1 hover:bg-black/5 rounded-lg text-slate-500 transition-colors cursor-pointer"
                title="닫기"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
