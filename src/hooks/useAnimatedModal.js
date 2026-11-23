"use client";

import { useState, useEffect, useRef } from "react";

/**
 * 팝업 열림/닫힘(Slide-down & Fade-out) 애니메이션을 제어하는 훅
 * 빠른 반응성을 위해 기본 duration 100ms 적용
 * @param {boolean} isOpen - 모달 오픈 여부
 * @param {number} [duration=100] - 퇴장 애니메이션 시간(ms)
 */
export function useAnimatedModal(isOpen, duration = 100) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef(null);

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

export function useAnimatedDataModal(data, duration = 100) {
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
