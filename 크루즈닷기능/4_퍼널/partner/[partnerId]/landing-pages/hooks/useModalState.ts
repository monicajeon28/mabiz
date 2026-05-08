'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 모달 상태 객체
 */
export interface ModalState {
  isOpen: boolean;
  data: any;
  isLoading: boolean;
}

/**
 * 모달 상태 관리 Hook
 * 7개 모달(Shortcut, Stats, Share, ShareManage, Data 등)의 상태를 일관되게 관리
 *
 * 특징:
 * - isOpen, data, isLoading 표준화
 * - close() 시 100ms 후 데이터 자동 초기화 (애니메이션 보호)
 * - open(data, options) 한 번의 호출로 모달 열기 가능
 */
export function useModalState(initialData: any = null) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    data: initialData,
    isLoading: false,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const open = useCallback(
    (data: any = null, isLoading: boolean = false) => {
      setModal({
        isOpen: true,
        data: data ?? initialData,
        isLoading,
      });
    },
    [initialData]
  );

  const close = useCallback(() => {
    setModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
    // 기존 타이머 취소
    if (timerRef.current) clearTimeout(timerRef.current);

    // 100ms 후 데이터 초기화 (CSS 닫기 애니메이션 완료 대기)
    timerRef.current = setTimeout(() => {
      setModal({
        isOpen: false,
        data: initialData,
        isLoading: false,
      });
      timerRef.current = null;
    }, 100);
  }, [initialData]);

  const setLoading = useCallback((isLoading: boolean) => {
    setModal((prev) => ({
      ...prev,
      isLoading,
    }));
  }, []);

  const setData = useCallback((data: any) => {
    setModal((prev) => ({
      ...prev,
      data,
    }));
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    isOpen: modal.isOpen,
    data: modal.data,
    isLoading: modal.isLoading,
    open,
    close,
    setLoading,
    setData,
    // 직접 상태 업데이트가 필요한 경우
    setState: setModal,
  };
}
