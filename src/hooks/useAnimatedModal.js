"use client";

import { useState, useEffect, useRef } from "react";

/**
 * 팝업 열림/닫힘(Slide-down & Fade-out) 애니메이션을 제어하는 훅 (boolean 상태용)
 * 공식 React '렌더링 중 이전 상태 비교 패턴' 적용 (Cascading render 방지)
 * @param {boolean} isOpen - 모달 오픈 여부
 * @param {number} [duration=220] - 퇴장 애니메이션 시간(ms)
 */
export function useAnimatedModal(isOpen, duration = 220) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef(null);

  // 렌더링 단계에서 상태 변화 감지 및 동기화 (React 공식 권장 패턴)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      setIsClosing(true);
    }
  }

  useEffect(() => {
    if (isClosing) {
      timerRef.current = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isClosing, duration]);

  return {
    mounted,
    isClosing
  };
}

/**
 * 데이터 기반 팝업 열림/닫힘 애니메이션 제어 훅
 * @param {any} data - 선택된 모달 데이터 (객체 또는 null)
 * @param {number} [duration=220] - 퇴장 애니메이션 시간(ms)
 */
export function useAnimatedDataModal(data, duration = 220) {
  const [prevData, setPrevData] = useState(data);
  const [cachedData, setCachedData] = useState(data);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef(null);

  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setCachedData(data);
      setIsClosing(false);
    } else if (cachedData) {
      setIsClosing(true);
    }
  }

  useEffect(() => {
    if (isClosing) {
      timerRef.current = setTimeout(() => {
        setCachedData(null);
        setIsClosing(false);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isClosing, duration]);

  return {
    data: data || cachedData,
    isOpen: !!(data || cachedData),
    isClosing
  };
}

export default useAnimatedModal;
