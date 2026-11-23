"use client";

import { useEffect, useRef } from "react";

/**
 * 모바일 가상 키보드 대응 모달 폼 훅
 * - 모바일 환경(< 768px)에서 input/textarea/select 포커스 시:
 *   1) 폼 하단에 키보드 높이만큼의 여백(paddingBottom: 340px)을 확보하여
 *      수량, 단가, 배당금 등 하단 필드가 가상 키보드에 가려지지 않도록 함
 *   2) 포커스된 입력 필드를 부드럽게 중앙(또는 편안한 위치)으로 스크롤
 * - 키보드 닫힘/외부 터치 시:
 *   하단 여백(paddingBottom)을 정상 복원하되,
 *   window.scrollTo(0, 0)이나 불필요한 스크롤 강제 이동을 유발하지 않아
 *   상단바가 내려오거나 배경 화면이 밀리는 레이아웃 점프를 원천 차단
 */
export function useMobileKeyboardModal(isOpen) {
  const formRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const focusTimeoutRef = useRef(null);

  useEffect(() => {
    const formEl = formRef.current;
    if (!isOpen || !formEl) return;

    // 모달 오픈 시 초기 상태 설정
    formEl.scrollTop = 0;
    formEl.style.paddingBottom = '';

    const handleFocusIn = (e) => {
      const target = e.target;
      if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // 모바일 뷰 (< 768px) 환경에서 적용
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        // 가상 키보드 높이만큼 스크롤 여백 확보 (340px)
        formEl.style.paddingBottom = '340px';

        if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
        // 가상 키보드가 올라오는 시점(약 120ms)에 맞춰 대상 필드를 중앙으로 스크롤
        focusTimeoutRef.current = setTimeout(() => {
          if (document.activeElement === target && formEl) {
            try {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch {
              const formRect = formEl.getBoundingClientRect();
              const targetRect = target.getBoundingClientRect();
              const currentScroll = formEl.scrollTop;
              const targetTopRelativeToForm = (targetRect.top - formRect.top) + currentScroll;
              formEl.scrollTop = Math.max(0, targetTopRelativeToForm - 80);
            }
          }
        }, 120);
      }
    };

    const handleFocusOut = () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
        const activeEl = document.activeElement;
        const isAnotherInputActive = formEl && formEl.contains(activeEl) && (
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl?.tagName)
        );

        // 입력 폼 내 다른 필드로의 이동이 아닌 경우 (키보드 닫힘 / 완료 / 외부 클릭)
        if (!isAnotherInputActive && formEl) {
          formEl.style.paddingBottom = '';
          // 주의: formEl.scrollTo({ top: 0 })이나 window.scrollTo(0, 0)을 절대 호출하지 않음!
          // 사용자가 입력 완료 후 등록 버튼을 누를 수 있도록 스크롤 위치를 유지하고,
          // 상단바/배경 거래내역의 밀림 현상을 방지함
        }
      }, 150);
    };

    formEl.addEventListener('focusin', handleFocusIn);
    formEl.addEventListener('focusout', handleFocusOut);

    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      formEl.removeEventListener('focusin', handleFocusIn);
      formEl.removeEventListener('focusout', handleFocusOut);
      formEl.style.paddingBottom = '';
    };
  }, [isOpen]);

  return formRef;
}

export default useMobileKeyboardModal;
