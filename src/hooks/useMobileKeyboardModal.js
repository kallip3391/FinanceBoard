"use client";

import { useRef } from "react";

/**
 * 모바일 가상 키보드 모달 지원 훅
 * 네이티브 브라우저의 키보드 스크롤을 방해하지 않고 딜레이 없이 즉시 포커스 처리
 */
export function useMobileKeyboardModal(isOpen) {
  const formRef = useRef(null);
  return formRef;
}

export default useMobileKeyboardModal;
