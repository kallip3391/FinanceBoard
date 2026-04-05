"use client";

import { useState } from "react";
import { Menu, TrendingUp, LogOut, User, UserPlus, Settings } from "lucide-react";
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
  const { user, profile, loading, profileError, signInWithGoogle, signOut } = useAuth();
  const { summary } = useAssets();
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

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
      <div className="flex items-center justify-between px-4 py-3 h-16 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-bold">
              <TrendingUp size={18} />
              <span>FINANCE BOARD</span>
            </div>

            {/* 관리자 승인 설정 버튼 (우측 '평가' 항목과 동일 UI) */}
            {profile?.is_admin && (
              <button 
                onClick={() => setIsAdminModalOpen(true)}
                className="hidden sm:flex items-center gap-2 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100/50 hover:bg-amber-100 transition-colors cursor-pointer shadow-sm"
              >
                <Settings size={16} />
                <span className="text-sm font-bold">승인 설정</span>
              </button>
            )}
          </div>

          {!loading ? (
            user ? (
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-sm leading-none">
                  <div className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center shrink-0">
                    <User size={12} />
                  </div>
                  <span className="text-sm font-bold">{getDisplayName(user)}</span>
                </div>
                <button onClick={signOut} className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors cursor-pointer shadow-sm">
                  <LogOut size={16} />
                  <span className="text-sm font-bold">로그아웃</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-3">
                {/* 1. 로그인 버튼 */}
                <button onClick={signInWithGoogle} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm cursor-pointer">
                  <User size={16} />
                  <span className="text-sm font-bold">로그인</span>
                </button>

                {/* 2. 등록 신청 버튼 */}
                <button 
                  onClick={() => setIsRegModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-all font-bold shadow-md shadow-indigo-100 cursor-pointer"
                >
                  <UserPlus size={16} />
                  <span className="text-sm">등록 신청</span>
                </button>

                {/* 3. 인증 관련 메시지 */}
                {profileError && (
                  <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold animate-shake ${
                    profileError.includes('완료') 
                      ? 'bg-blue-50 text-blue-600 border-blue-100' 
                      : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    {profileError}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="w-24 h-9 bg-slate-100 animate-pulse rounded-lg hidden sm:block"></div>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm font-medium">
          {user && (
            <>
              <div className="hidden lg:flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <span>매수 <span className="text-slate-900 font-bold ml-1">{formatCurrency(summary.totalEvaluation - summary.totalProfit)}</span></span>
              </div>
              <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-lg border border-slate-200 text-blue-600 relative min-w-[120px] shadow-sm">
                <span>평가 <span className="text-blue-600 font-bold ml-1">{formatCurrency(summary.totalEvaluation)}</span></span>
                {summary.isLoading && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${summary.totalProfit > 0 ? 'bg-red-50 text-red-600 border-red-100' : (summary.totalProfit < 0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200')}`}>
                <span>수익 <span className="font-bold ml-1">{formatCurrency(summary.totalProfit)} ({summary.avgProfitRate.toFixed(2)}%)</span></span>
              </div>
            </>
          )}
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
    </header>
  );
}
