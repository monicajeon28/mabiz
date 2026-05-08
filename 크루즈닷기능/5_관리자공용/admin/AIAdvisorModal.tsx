'use client';

import { useState, useEffect } from 'react';
import { FiX, FiSend, FiMessageSquare, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { detectAdvisorType, getAdvisorName, type AdvisorType } from '@/lib/prompts/legal-advisor';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialQuestion?: string;
  context?: string;
}

interface ExampleQuestion {
  type: AdvisorType;
  question: string;
}

const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  { type: 'tax', question: '원천징수 3.3%는 어떻게 계산되나요?' },
  { type: 'tax', question: '종합소득세 신고는 언제 하나요?' },
  { type: 'tax', question: '필요경비는 얼마나 인정받을 수 있나요?' },
  { type: 'legal', question: '계약서에 꼭 포함해야 할 조항이 뭔가요?' },
  { type: 'legal', question: '고객 DB 유출 시 어떤 법적 책임이 있나요?' },
  { type: 'legal', question: '환불 규정은 어떻게 정해야 하나요?' },
  { type: 'labor', question: '프리랜서와 근로자의 차이가 뭔가요?' },
  { type: 'labor', question: '4대보험은 어떻게 처리되나요?' },
  { type: 'labor', question: '독립 사업자 계약 시 주의할 점은?' },
];

const ADVISOR_BADGES: Record<AdvisorType, { label: string; color: string }> = {
  tax: { label: '세무 고문', color: 'bg-green-100 text-green-800' },
  legal: { label: '법률 고문', color: 'bg-blue-100 text-blue-800' },
  labor: { label: '노무 고문', color: 'bg-purple-100 text-purple-800' },
  general: { label: '크루즈닷AI', color: 'bg-gray-100 text-gray-800' },
};

export default function AIAdvisorModal({ isOpen, onClose, initialQuestion = '', context = '' }: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState('');
  const [advisorType, setAdvisorType] = useState<AdvisorType>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion);
    }
  }, [initialQuestion]);

  // 질문 타입 미리보기
  useEffect(() => {
    if (question.trim()) {
      const detectedType = detectAdvisorType(question);
      setAdvisorType(detectedType);
    } else {
      setAdvisorType('general');
    }
  }, [question]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('질문을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setAnswer('');

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: question,
          context,
          useAdvisor: true, // AI 고문 모드 활성화
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'AI 응답 생성에 실패했습니다.');
      }

      setAnswer(data.answer || data.text || '응답을 생성하지 못했습니다.');
    } catch (err) {
      console.error('AI Advisor error:', err);
      setError(err instanceof Error ? err.message : 'AI 응답 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (exampleQuestion: string) => {
    setQuestion(exampleQuestion);
    setAnswer('');
    setError(null);
  };

  const handleReset = () => {
    setQuestion('');
    setAnswer('');
    setError(null);
    setAdvisorType('general');
  };

  if (!isOpen) return null;

  const badge = ADVISOR_BADGES[advisorType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FiMessageSquare className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI 고문</h2>
              <p className="text-sm text-gray-500">세무/법률/노무 관련 질문에 답변합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Question Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  질문
                </label>
                {question.trim() && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.color}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="세무, 법률, 노무 관련 질문을 입력하세요..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                    <span>답변 생성 중...</span>
                  </>
                ) : (
                  <>
                    <FiSend className="w-4 h-4" />
                    <span>질문하기</span>
                  </>
                )}
              </button>
              {(question || answer) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3 text-gray-600 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  초기화
                </button>
              )}
            </div>
          </form>

          {/* Answer */}
          {answer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.color}`}>
                  {badge.label} 답변
                </span>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {answer}
                </div>
              </div>
            </div>
          )}

          {/* Example Questions */}
          {!answer && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">예시 질문</h3>
              <div className="grid grid-cols-1 gap-2">
                {EXAMPLE_QUESTIONS.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example.question)}
                    className="flex items-center gap-3 p-3 text-left bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors group"
                  >
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ADVISOR_BADGES[example.type].color}`}>
                      {ADVISOR_BADGES[example.type].label}
                    </span>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {example.question}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-yellow-50">
          <div className="flex items-start gap-2 text-xs text-yellow-800">
            <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              <strong>주의:</strong> AI 고문의 답변은 일반적인 정보 제공 목적이며, 법적 효력이 없습니다.
              실제 세무/법률/노무 문제는 반드시 공인 전문가(세무사, 변호사, 노무사)와 상담하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
