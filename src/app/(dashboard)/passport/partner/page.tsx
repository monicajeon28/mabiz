'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
  X,
  Info,
  Link as LinkIcon,
  Copy,
} from 'lucide-react';
import { showError, showSuccess } from '@/components/ui/Toast';

type PassportRequest = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  passportRequestedAt: string | null;
  passportCompletedAt: string | null;
  createdAt: string;
};

type PassportRequestTemplate = {
  id: number;
  title: string;
  body: string;
  isDefault: boolean;
  updatedAt: string;
};

type ManualResult = {
  link: string;
  message: string;
  token: string;
  submissionId: number;
  expiresAt: string;
};

export default function PartnerPassportRequestsPage() {
  const [requests, setRequests] = useState<PassportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PassportRequest | null>(null);
  const [templates, setTemplates] = useState<PassportRequestTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<ManualResult | null>(null);

  const defaultTemplate = useMemo(() => {
    if (!templates.length) return null;
    return templates.find((tpl) => tpl.isDefault) ?? templates[0];
  }, [templates]);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) {
        params.set('q', searchQuery);
      }

      const res = await fetch(`/api/passport/partner/requests?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.message || '여권 요청 목록을 불러오지 못했습니다.');
      }

      setRequests(json.customers || []);
    } catch (error: any) {
      console.error('[PartnerPassportRequests] load error', error);
      showError(error.message || '여권 요청 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const res = await fetch('/api/passport/partner/templates', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '템플릿을 불러올 수 없습니다.');
      }
      setTemplates(json.templates ?? []);
      if (json.templates?.length) {
        const tpl = json.templates.find((t: PassportRequestTemplate) => t.isDefault) ?? json.templates[0];
        setSelectedTemplateId(tpl.id);
        setMessageBody(tpl.body || '');
      }
    } catch (error: any) {
      console.error('[PartnerPassportRequests] template load error', error);
      showError(error.message || '템플릿을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleOpenModal = (request: PassportRequest) => {
    if (request.passportRequestedAt) {
      showError('이미 여권 요청이 진행 중입니다.');
      return;
    }
    setSelectedRequest(request);
    setGenerateResult(null);
    const tpl = defaultTemplate;
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      setMessageBody(tpl.body || '');
    } else {
      setSelectedTemplateId(null);
      setMessageBody('');
    }
    setExpiresInHours(72);
    setShowModal(true);
  };

  const handleTemplateChange = (templateId: number) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((template) => template.id === templateId);
    if (tpl) {
      setMessageBody(tpl.body || '');
    }
    setGenerateResult(null);
  };

  const handleGenerateLink = async () => {
    if (!selectedRequest) return;
    setIsGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/passport/partner/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          leadId: selectedRequest.id,
          templateId: selectedTemplateId ?? undefined,
          messageBody,
          expiresInHours,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '여권 제출 링크 생성에 실패했습니다.');
      }
      setGenerateResult(json.result);
      showSuccess('여권 제출 링크가 생성되었습니다. 메시지를 복사해 고객에게 전달하세요.');
      loadRequests();
    } catch (error: any) {
      console.error('[PartnerPassportRequests] manual error', error);
      showError(error.message || '여권 제출 링크를 생성하지 못했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(`${label} 복사 완료`);
    } catch {
      showError('클립보드에 복사하지 못했습니다. 직접 선택해서 복사해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10 md:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/passport"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">여권 요청 관리</h1>
        </div>

        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">여권 요청 목록</h2>
              <p className="text-sm text-gray-600 mt-1">고객에게 전달할 링크와 메시지를 손쉽게 생성하세요.</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="고객명 또는 전화번호 검색..."
                  className="pl-10 rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                onClick={loadRequests}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                <RefreshCw className="h-4 w-4" />
                새로고침
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">고객명</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">전화번호</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">요청일</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">완료일</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                      여권 요청 목록을 불러오는 중입니다...
                    </td>
                  </tr>
                )}
                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                      아직 여권 요청이 없습니다.
                    </td>
                  </tr>
                )}
                {!loading &&
                  requests.map((request) => (
                    <tr key={request.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>{request.customerName ?? '이름 없음'}</span>
                          {request.passportCompletedAt && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              여권 완료
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{request.customerPhone ?? '-'}</td>
                      <td className="px-4 py-4 text-sm">
                        {request.passportCompletedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                            <CheckCircle className="h-3 w-3" /> 완료
                          </span>
                        ) : request.passportRequestedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
                            <Clock className="h-3 w-3" /> 확인 중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-600">
                            대기중
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {request.passportRequestedAt
                          ? new Date(request.passportRequestedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {request.passportCompletedAt
                          ? new Date(request.passportCompletedAt).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {!request.passportRequestedAt && (
                          <button
                            onClick={() => handleOpenModal(request)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            <LinkIcon className="h-3 w-3" />
                            링크 생성
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {showModal && selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">여권 제출 링크 생성</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    메시지를 복사해 고객에게 직접 전달하면 제출 현황이 자동으로 갱신됩니다.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedRequest(null);
                    setGenerateResult(null);
                  }}
                  className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-6 py-6 space-y-6">
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <div className="flex items-start gap-3 text-sm text-blue-900">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold">복사해서 보내는 방식으로 변경되었습니다</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-800">
                        <li>링크를 생성하면 고객별 제출 페이지가 만들어집니다.</li>
                        <li>완성된 메시지와 링크를 복사해서 카카오톡/문자로 직접 보내주세요.</li>
                        <li>제출이 완료되면 이 화면에 상태가 자동으로 표시됩니다.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">고객 정보</p>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-semibold text-gray-800">고객명:</span> {selectedRequest.customerName ?? '이름 없음'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">전화번호:</span> {selectedRequest.customerPhone ?? '-'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-700">사용할 템플릿</span>
                    <select
                      value={selectedTemplateId ?? ''}
                      onChange={(e) => handleTemplateChange(Number(e.target.value))}
                      disabled={templatesLoading || !templates.length}
                      className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.title} {template.isDefault ? '(기본)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-gray-700">링크 만료 시간 (최대 14일)</span>
                    <input
                      type="number"
                      min={1}
                      max={336}
                      value={expiresInHours}
                      onChange={(e) => setExpiresInHours(Math.max(1, Math.min(336, Number(e.target.value) || 1)))}
                      className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">메시지 기본 내용</label>
                  <textarea
                    value={messageBody}
                    onChange={(e) => {
                      setMessageBody(e.target.value);
                      setGenerateResult(null);
                    }}
                    rows={8}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="템플릿 내용을 입력하거나 수정하세요."
                  />
                  <p className="text-sm text-gray-500">
                    사용 가능한 변수: <code>{'{고객명}'}</code>, <code>{'{링크}'}</code>, <code>{'{상품명}'}</code>,{' '}
                    <code>{'{출발일}'}</code>
                  </p>
                </div>

                <button
                  onClick={handleGenerateLink}
                  disabled={isGenerating || !messageBody.trim() || templatesLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      링크 생성하기
                    </>
                  )}
                </button>

                {generateResult && (
                  <div className="space-y-4 border border-green-200 bg-green-50 rounded-2xl p-4">
                    <div>
                      <p className="text-sm font-semibold text-green-800 mb-2">완성된 메시지</p>
                      <textarea
                        value={generateResult.message}
                        readOnly
                        rows={6}
                        className="w-full rounded-xl border border-green-200 bg-white px-4 py-3 text-sm text-green-900"
                      />
                      <button
                        onClick={() => handleCopy(generateResult.message, '메시지')}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        메시지 복사
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800 mb-2">제출 링크</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          value={generateResult.link}
                          readOnly
                          className="flex-1 rounded-xl border border-green-200 bg-white px-4 py-2 text-sm text-green-900"
                        />
                        <button
                          onClick={() => handleCopy(generateResult.link, '링크')}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                          링크 복사
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-green-700">
                        만료 예정: {new Date(generateResult.expiresAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
