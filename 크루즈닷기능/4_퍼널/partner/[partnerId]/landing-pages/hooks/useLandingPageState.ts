'use client';

import { useReducer } from 'react';

/**
 * 랜딩페이지 목록 조회 상태
 */
export interface LandingPageState {
  pages: any[];
  sharedPages: any[];
  isLoading: boolean;
  error: string | null;
  selectedCategory: string;
  quotas: {
    pageCount: number;
    remainingQuota: number;
    bonusShareCount: number;
    remainingBonusQuota: number;
  };
}

/**
 * 상태 업데이트 액션 정의
 */
export type PageListAction =
  | { type: 'SET_PAGES'; payload: any[] }
  | { type: 'SET_SHARED_PAGES'; payload: any[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_QUOTAS'; payload: Partial<LandingPageState['quotas']> }
  | { type: 'REMOVE_PAGE'; payload: number };

/**
 * 랜딩페이지 상태 리듀서
 * 40개의 useState를 단일 useReducer로 통합
 */
function pageListReducer(
  state: LandingPageState,
  action: PageListAction
): LandingPageState {
  switch (action.type) {
    case 'SET_PAGES':
      return {
        ...state,
        pages: action.payload,
        quotas: {
          ...state.quotas,
          pageCount: action.payload.length,
          remainingQuota: Math.max(0, 20 - action.payload.length),
        },
      };

    case 'SET_SHARED_PAGES':
      return {
        ...state,
        sharedPages: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'SET_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
      };

    case 'SET_QUOTAS':
      return {
        ...state,
        quotas: {
          ...state.quotas,
          ...action.payload,
        },
      };

    case 'REMOVE_PAGE':
      const updatedPages = state.pages.filter((p) => p.id !== action.payload);
      return {
        ...state,
        pages: updatedPages,
        quotas: {
          ...state.quotas,
          pageCount: updatedPages.length,
          remainingQuota: Math.max(0, 20 - updatedPages.length),
        },
      };

    default:
      return state;
  }
}

/**
 * 랜딩페이지 상태 관리 Hook
 * 페이지 목록, 공유 페이지, 로딩 상태, 오류, 선택된 카테고리, 할당량을 통합 관리
 */
export function useLandingPageState() {
  const [state, dispatch] = useReducer(pageListReducer, {
    pages: [],
    sharedPages: [],
    isLoading: true,
    error: null,
    selectedCategory: '전체',
    quotas: {
      pageCount: 0,
      remainingQuota: 20,
      bonusShareCount: 0,
      remainingBonusQuota: 10,
    },
  });

  return {
    state,
    dispatch,
    // 편의 메서드들
    setPages: (pages: any[]) => dispatch({ type: 'SET_PAGES', payload: pages }),
    setSharedPages: (pages: any[]) => dispatch({ type: 'SET_SHARED_PAGES', payload: pages }),
    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    setCategory: (category: string) => dispatch({ type: 'SET_CATEGORY', payload: category }),
    setQuotas: (quotas: Partial<LandingPageState['quotas']>) =>
      dispatch({ type: 'SET_QUOTAS', payload: quotas }),
    removePage: (pageId: number) => dispatch({ type: 'REMOVE_PAGE', payload: pageId }),
  };
}
