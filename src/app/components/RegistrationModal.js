"use client";

import { useState, useEffect } from "react";
import { X, UserPlus, Mail, User, CheckCircle } from "lucide-react";

export default function RegistrationModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    email: '',
    displayName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // ESC: 취소, Enter: 신청 단축키 지원
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // ESC 키인 경우 취소(닫기)
      if (e.key === 'Escape') {
        onClose();
      }
      // Enter 키인 경우 신청 처리 (로딩 중이 아닐 때만)
      if (e.key === 'Enter' && !isSubmitting && !isDone) {
        setIsSubmitting(true);
        onSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSubmit, isSubmitting, isDone]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // 부모 컴포넌트(TopNav)로 데이터 전달하여 처리 위임
      await onSubmit(formData.email, formData.displayName);
      setIsDone(true);
    } catch (err) {
      console.error('Registration error:', err);
      alert('신청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
        <div className="relative bg-white rounded-[2.5rem] p-10 w-[380px] shadow-2xl animate-slide-up text-center border border-slate-100">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">진행 중</h2>
          <p className="text-slate-500 text-[15px] leading-relaxed">
            신청 절차를 위해<br />구글 로그인합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-[480px] overflow-hidden animate-slide-up border border-slate-100 flex flex-col min-h-[420px]">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <UserPlus size={20} className="text-indigo-600" strokeWidth={2.5} />
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">등록 신청</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg cursor-pointer">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex-1 flex flex-col">
          <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 text-center flex-1 flex items-center justify-center mb-8">
            <p className="text-slate-600 text-[16px] leading-relaxed font-medium">
              안전한 이용을 위해 등록이 필요합니다.<br /><br />
              <span className="text-brand font-bold">'신청'</span> 버튼을 누르면 구글 로그인창이 뜨며<br />
              로그인 후 관리자 승인이 완료되면<br />이용 가능합니다.
            </p>
          </div>

          <div className="flex items-center gap-3 mt-auto">
            {/* 좌측 - 취소 버튼 (필터 UI '초기화'와 동일) */}
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all cursor-pointer shadow-sm text-center"
            >
              취소
            </button>

            {/* 우측 - 신청 버튼 (필터 UI '적용'과 동일 - bg-brand 및 shadow-lg) */}
            <button 
              onClick={() => {
                setIsSubmitting(true);
                onSubmit();
              }}
              disabled={isSubmitting}
              className={`flex-1 py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center border-none outline-none ${
                isSubmitting ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-brand text-white hover:bg-brand-dark shadow-brand/30 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                "신청"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
