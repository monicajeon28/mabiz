'use client';

import { useState, useRef, useEffect } from 'react';

interface TermPopoverProps {
  term: string;
  definition?: string;
  className?: string;
}

const TERM_DEFINITIONS: Record<string, string> = {
  인솔자:
    '함께 가는 현지 가이드. 여행 중 문제 발생 시 바로 도와주는 사람. 크루즈닷의 인솔자는 평균 10년 이상의 경험을 가지고 있습니다.',
  세미패키지:
    '자유 여행 + 인솔자 동반의 조합. 자유로우면서도 안전한 여행 방식으로, 필요할 때만 가이드의 도움을 받을 수 있습니다.',
  베테랑:
    '경험이 풍부한 전문가. 우리 인솔자들은 평균 10년 이상 경험 보유하며, 모든 상황에 대응할 수 있습니다.',
  선사직결:
    '크루즈 회사와 직접 연결되어 있다는 의미. 문제 해결이 빠르고 환불이 보장되며, 중간 수수료가 없습니다.',
  크루즈항:
    '배가 떠나고 드는 항구. 보통 매우 크기 때문에 길을 잃기 쉬운데, 우리 인솔자가 함께하면 안전합니다.',
  환불보장:
    '여행을 가지 않기로 결정하셨을 때 받은 금액을 100% 돌려받을 수 있다는 뜻입니다.',
  할부수수료:
    '매달 나누어 내실 때 추가로 내야 하는 이자나 수수료. 크루즈닷은 이를 0원으로 책정했습니다.',
  은행계좌투명관리:
    '여행 비용이 직접 은행 계좌로 관리되어, 투명하고 안전합니다. 불법 이체나 사기 걱정이 없습니다.'
};

/**
 * TermPopover 컴포넌트
 *
 * 역할:
 * - 용어 설명 팝오버 표시
 * - 접근성: ARIA labels, 키보드 네비게이션
 * - 다크모드 지원
 * - 모바일 반응형
 */
export default function TermPopover({
  term,
  definition,
  className = ''
}: TermPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const def =
    definition || TERM_DEFINITIONS[term as keyof typeof TERM_DEFINITIONS] || term;

  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // 바깥쪽 클릭으로 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Tab으로 포커스 이동 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none rounded px-1 py-0.5 cursor-help"
        aria-label={`${term} 설명 보기`}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? `popover-${term}` : undefined}
        type="button"
      >
        {term}
        <span className="ml-1 text-xs">?</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          id={`popover-${term}`}
          className="absolute z-20 w-64 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg bottom-full mb-2 left-1/2 transform -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="tooltip"
        >
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
            {def}
          </p>

          {/* 화살표 포인터 */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-gray-300 dark:border-gray-600 rotate-45"></div>
        </div>
      )}

      {/* 모바일 전용: 클릭 가이드 (44px 터치 타깃) */}
      <div className="absolute -inset-2 md:hidden pointer-events-none rounded"></div>
    </div>
  );
}

/**
 * TermPopover 배치 컴포넌트
 * 여러 용어를 한 번에 적용할 때 사용
 */
export function TermBatch({
  text,
  terms,
  className = ''
}: {
  text: string;
  terms: string[]; // 강조할 용어 목록
  className?: string;
}) {
  // 텍스트를 용어별로 분해하고 강조
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length); // 긴 용어부터

  const result = sortedTerms.reduce((acc: string | React.ReactNode[], term) => {
    if (typeof acc !== 'string') return acc;

    const pattern = new RegExp(`(${term})`, 'g');
    const parts = acc.split(pattern);

    return parts.map((part: string, idx: number) =>
      part === term ? (
        <TermPopover key={`${term}-${idx}`} term={term} />
      ) : (
        <span key={`text-${idx}`}>{part}</span>
      )
    );
  }, text);

  return (
    <span className={className}>
      {result}
    </span>
  );
}
