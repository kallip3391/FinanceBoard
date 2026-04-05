"use client";

import { useState, useEffect, useRef } from "react";
import { X, UserCheck, UserX, Shield, Mail, RotateCcw, ChevronDown, Check, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminApprovalModal({ isOpen, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  
  const [currentStatus, setCurrentStatus] = useState("pending");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [successModal, setSuccessModal] = useState({ show: false, message: "", type: "success", userName: "" }); // 추가: 완료 후 확인 팝업

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('사용자 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 확인 팝업이 열려있지 않을 때만 ESC로 메인 모달 닫기
      if (e.key === "Escape" && isOpen && !successModal.show) {
        onClose();
      }
    };
    
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isOpen) {
      fetchUsers();
      window.addEventListener("keydown", handleKeyDown);
    }
    
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, isDropdownOpen, successModal.show]);

  const handleToggleApproval = async (userId, currentApprovalStatus) => {
    if (isUpdating === userId) return;
    
    setIsUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: !currentApprovalStatus })
        .eq('user_id', userId);

      if (error) throw error;
      
      setUsers(prevUsers => 
        prevUsers.map(u => u.user_id === userId ? { ...u, is_approved: !currentApprovalStatus } : u)
      );

      const targetUser = users.find(u => u.user_id === userId);
      const userName = targetUser?.display_name || '사용자';
      
      if (!currentApprovalStatus) {
        setSuccessModal({ show: true, message: '사용승인이 완료되었습니다.', type: 'success', userName: userName });
      } else {
        setSuccessModal({ show: true, message: '사용취소가 완료되었습니다.', type: 'info', userName: userName });
      }
    } catch (err) {
      console.error('처리 오류:', err);
      showToast(err.message || '처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingUsers = filteredUsers.filter(u => !u.is_approved);
  const approvedUsers = filteredUsers.filter(u => u.is_approved && !u.is_admin);
  const displayUsers = currentStatus === "pending" ? pendingUsers : approvedUsers;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Toast 알림 (슬림한 캡슐 형태의 프리미엄 UI) */}
        {toast.show && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[150] animate-bounce-in">
            <div className={`px-5 py-2.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-2.5 border backdrop-blur-xl ${
              toast.type === "success" 
                ? "bg-emerald-500/90 text-white border-emerald-400/50 shadow-emerald-500/20" 
                : "bg-rose-500/90 text-white border-rose-400/50 shadow-rose-500/20"
            }`}>
              {toast.type === "success" ? (
                <Check size={16} strokeWidth={3} />
              ) : (
                <X size={16} strokeWidth={3} />
              )}
              <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Header (국내거래 필터 팝업 1:1 매칭) */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-indigo-600" />
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">사용자 승인 관리</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Filters Row (상태 선택/구분 & 사용자 조회/종목) */}
        <div className="p-6 pb-2">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative" ref={dropdownRef} style={{ width: '130px' }}>
                <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1 leading-none">상태</label>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full px-1 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 bg-slate-50 cursor-pointer shadow-sm text-center flex items-center justify-center gap-1 min-h-[48px]"
                  >
                    <span className={`text-[14px] ${currentStatus === "pending" ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {currentStatus === "pending" ? "승인 대기" : "승인 완료"}
                    </span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute top-0 left-0 w-full bg-white border border-slate-200 shadow-2xl z-[70] overflow-hidden animate-slide-up" style={{ borderRadius: '12px' }}>
                      <button onClick={() => { setCurrentStatus("pending"); setIsDropdownOpen(false); }} className="w-full px-1 py-3 text-[14px] font-bold text-center hover:bg-slate-50 transition-colors text-amber-600" style={{ minHeight: '48px' }}>승인 대기</button>
                      <button onClick={() => { setCurrentStatus("approved"); setIsDropdownOpen(false); }} className="w-full px-1 py-3 text-[14px] font-bold text-center hover:bg-slate-50 transition-colors text-emerald-600 border-t border-slate-50" style={{ minHeight: '48px' }}>승인 완료</button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`flex-1 relative ${displayUsers.length >= 3 ? 'mr-[17px]' : ''}`}>
                <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1 leading-none">사용자 조회</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="이름 또는 이메일 검색 (엔터)"
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 focus:bg-white focus:border-brand transition-all font-bold text-[14px] text-slate-700 bg-slate-50 shadow-sm text-center h-[48px] placeholder:text-slate-400"
                    value={tempSearch}
                    onChange={(e) => setTempSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSearchTerm(tempSearch); }}
                  />
                  <button onClick={() => setSearchTerm(tempSearch)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-brand transition-colors cursor-pointer">
                    <Search size={18} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className={`flex items-center justify-between px-1 border-b border-slate-100 pb-2 ${displayUsers.length >= 3 ? 'pr-[17px]' : ''}`}>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${currentStatus === "pending" ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  {currentStatus === "pending" ? "Pending Requests" : "Verified Members"}
                </span>
                <span className="ml-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                  {displayUsers.length}
                </span>
              </div>
              <button onClick={fetchUsers} className="text-slate-300 hover:text-brand transition-colors" title="새로고침">
                <RotateCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        {/* User List Area (정확히 3개 보여주고 스크롤) */}
        <div 
          className="overflow-y-auto p-6 pt-2 custom-scrollbar flex-none"
          style={{ minHeight: '100px', maxHeight: '235px' }}
        >
          {loading && users.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400 text-sm font-medium">데이터 로딩 중...</p>
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="flex items-center justify-center h-[72px] text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl mx-1 shadow-sm px-4">
              <p className="text-slate-400 text-sm font-bold">
                {currentStatus === "pending" ? "승인 대기 사용자가 없습니다." : "승인 완료 사용자가 없습니다."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayUsers.map((u) => (
                <div key={u.user_id} className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${u.is_approved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {u.is_approved ? <UserCheck size={20} /> : <UserX size={20} />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 truncate text-[14px] leading-tight">{u.display_name || '이름 없음'}</h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 font-medium">
                        <Mail size={10} className="shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleToggleApproval(u.user_id, u.is_approved)}
                    disabled={isUpdating === u.user_id}
                    className={`px-6 py-2.5 rounded-xl text-[13px] font-black transition-all shrink-0 ${
                      u.is_approved 
                        ? 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 border border-slate-200' 
                        : 'bg-brand text-white hover:bg-brand-dark shadow-sm'
                    } disabled:opacity-50 cursor-pointer text-center`}
                  >
                    {isUpdating === u.user_id ? '처리 중...' : (u.is_approved ? '취소' : '승인')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand/20 cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>

      {/* Style 1: Centered Success/Info Popup (국내거래 필터와 1:1 디자인 동기화) */}
      {successModal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-slide-up text-center border border-slate-100">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
              successModal.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-500'
            }`}>
              {successModal.type === 'success' ? <Check size={32} strokeWidth={3} /> : <RotateCcw size={32} strokeWidth={3} />}
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {successModal.type === 'success' ? '승인이 완료되었습니다.' : '취소가 완료되었습니다.'}
            </h3>
            <div className="text-slate-500 mb-8 leading-relaxed font-semibold">
              <span className="text-slate-900">&quot;{successModal.userName}&quot;님 </span>
              <span className={`${successModal.type === 'success' ? 'text-brand' : 'text-rose-500'}`}>
                {successModal.type === 'success' ? '사용승인' : '사용취소'}
              </span>
              <span>이 완료되었습니다.</span>
            </div>

            <button
              onClick={() => setSuccessModal({ ...successModal, show: false })}
              className={`w-full py-4 rounded-xl font-bold text-[16px] text-white shadow-lg transition-all cursor-pointer ${
                successModal.type === 'success' 
                  ? 'bg-brand hover:bg-brand-dark shadow-brand/30' 
                  : 'bg-slate-800 hover:bg-slate-900 shadow-slate-200'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
