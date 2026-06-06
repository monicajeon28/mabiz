'use client';

import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useToast } from '@/lib/api/use-toast';

interface ShortLink {
  id: string;
  code: string;
  title?: string;
  clickCount?: number;
  category?: string;
}

interface CreateABTestModalProps {
  open: boolean;
  links: ShortLink[];
  onCreate: (
    testName: string,
    variantA_id: string,
    variantB_id: string
  ) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function CreateABTestModal({
  open,
  links,
  onCreate,
  onOpenChange,
}: CreateABTestModalProps) {
  const [testName, setTestName] = useState('');
  const [variantA, setVariantA] = useState<string>('');
  const [variantB, setVariantB] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreate = async () => {
    // 검증
    if (!testName.trim()) {
      setError('테스트 이름을 입력하세요');
      return;
    }
    if (!variantA || !variantB) {
      setError('A와 B 링크를 모두 선택하세요');
      return;
    }
    if (variantA === variantB) {
      setError('같은 링크를 선택할 수 없습니다');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onCreate(testName, variantA, variantB);

      // 성공 시 폼 초기화
      setTestName('');
      setVariantA('');
      setVariantB('');
      toast({
        title: '성공',
        description: '테스트가 생성되었습니다.',
      });
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '테스트 생성 실패';
      setError(errorMessage);
      toast({
        title: '오류',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            새 A/B 테스트 생성
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 바디 */}
        <div className="space-y-4 px-6 py-4">
          {/* 테스트 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              테스트 이름
            </label>
            <input
              type="text"
              placeholder="예: 6월 프로모션 배너 비교"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              무엇을 테스트하는지 명확하게
            </p>
          </div>

          {/* A 링크 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              A 링크
            </label>
            <select
              value={variantA}
              onChange={(e) => setVariantA(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {links.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.title || link.code}
                  {link.clickCount ? ` (${link.clickCount} 클릭)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* B 링크 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              B 링크
            </label>
            <select
              value={variantB}
              onChange={(e) => setVariantB(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {links.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.title || link.code}
                  {link.clickCount ? ` (${link.clickCount} 클릭)` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              💡 팁: 한 번에 하나만 다르게! (문구만 변경, 또는 이미지만)
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? '생성 중...' : '테스트 시작하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
