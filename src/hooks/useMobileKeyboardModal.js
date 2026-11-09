"use client";

import { useEffect, useRef } from "react";

/**
 * 모바일 가상 키보드 대응 모달 폼 훅
 * - 입력 필드 포커스 시: 하단 패딩 확장 및 입력 항목을 화면 상단/중앙으로 부드럽게 스크롤
 * - 입력 완료 시 (엔터키, 블러, 외부 터치, 키보드 닫힘):
 *   하단 패딩 복원 및 모달을 다시 맨 위(scrollTop: 0)로 부드럽게 스크롤
 */
export function useMobileKeyboardModal(isOpen) {
  const formRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const focusTimeoutRef = useRef(null);

  useEffect(() => {
    const formEl = formRef.current;
    if (!isOpen || !formEl) return;

    // 모달 오픈 시 초기 맨 위로 스크롤
    formEl.scrollTo({ top: 0, behavior: 'instant' });
    formEl.style.paddingBottom = '';

    const handleFocusIn = (e) => {
      const target = e.target;
      if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.tagName !== 'SELECT')) {
        return;
      }

      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // 모바일 뷰 (< 768px) 또는 터치 환경에서 적용
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        // 가상 키보드 높이만큼 스크롤 여백 확보 (340px)
        formEl.style.paddingBottom = '340px';

        if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
        // 가상 키보드 슬라이드 애니메이션 완료(약 250ms) 후 스크롤
        focusTimeoutRef.current = setTimeout(() => {
          if (document.activeElement === target && formEl) {
            const formRect = formEl.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const currentScroll = formEl.scrollTop;
            const targetTopRelativeToForm = (targetRect.top - formRect.top) + currentScroll;

            // 폼 상단에서 약 70px 아래에 입력 항목이 오도록 스크롤 (키보드 위로 편안하게 노출)
            formEl.scrollTo({
              top: Math.max(0, targetTopRelativeToForm - 70),
              behavior: 'smooth'
            });

            try {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch {
              // fallback ignore
            }
          }
        }, 250);
      }
    };

    const handleFocusOut = () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
        const activeEl = document.activeElement;
        const isAnotherInputActive = formEl && formEl.contains(activeEl) && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.tagName === 'SELECT'
        );

        // 입력 폼 내 다른 필드로의 이동이 아닌 경우 (키보드 닫힘 / 완료 / 외부 클릭)
        if (!isAnotherInputActive && formEl) {
          formEl.style.paddingBottom = '';
          formEl.scrollTo({ top: 0, behavior: 'smooth' });
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }, 150);
    };

    formEl.addEventListener('focusin', handleFocusIn);
    formEl.addEventListener('focusout', handleFocusOut);

    // iOS / Android 키보드 닫힘(완료 버튼 또는 가상키보드 닫기) 감지
    let lastViewportHeight = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : 0;
    const handleViewportResize = () => {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const currentHeight = window.visualViewport.height;
      // 뷰포트 높이가 120px 이상 급격히 커지면 가상 키보드가 닫힌 상태
      if (lastViewportHeight > 0 && currentHeight - lastViewportHeight > 120) {
        if (document.activeElement && formEl.contains(document.activeElement)) {
          try {
            document.activeElement.blur();
          } catch {
            // fallback ignore
          }
        }
        formEl.style.paddingBottom = '';
        formEl.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      lastViewportHeight = currentHeight;
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      formEl.removeEventListener('focusin', handleFocusIn);
      formEl.removeEventListener('focusout', handleFocusOut);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
      formEl.style.paddingBottom = '';
    };
  }, [isOpen]);

  return formRef;
}

export default useMobileKeyboardModal;
