"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface TagBlastModalProps {
  tags: string[];
  onClose: () => void;
}

export default function TagBlastModal({
  tags, onClose
}: TagBlastModalProps) {
  const [tab, setTab] = useState<'template' | 'direct'>('direct');
  const [message, setMessage] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
  const [preview, setPreview] = useState<{ willSend: number; isOverLimit: boolean; overLimitMsg: string | null } | null>(null);
  const [step, setStep] = useState<'write' | 'preview' | 'done'>('write');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // 템플릿 로드
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/tools/sms-templates', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (d.ok) setTemplates(d.templates ?? []); })
      .catch(err => { if (err instanceof Error && err.name === 'AbortError') return; });
    return () => ctrl.abort();
  }, []);

  const handlePreview = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await fetch('/api/contacts/tag-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, message, dryRun: true }),
    });
    const d = await res.json();
    if (d.ok) {
      setPreview(d);
      setStep('preview');
    } else {
      setSendError(d.error ?? '오류가 발생했습니다.');
    }
    setSending(false);
  };

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    const res = await fetch('/api/contacts/tag-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, message, dryRun: false }),
    });
    const d = await res.json();
    if (d.ok) {
      setStep('done');
    } else {
      setSendError(d.error ?? '발송에 실패했습니다.');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">태그 SMS 발송</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {tags.map(t => `#${t}`).join(' · ')} 태그 보유 고객 (AND 조건)
            </p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="p-5">
          {step === 'write' && (
            <>
              {/* 탭 */}
              <div className="flex gap-2 mb-4">
                {(['direct', 'template'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tab === t ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {t === 'direct' ? '직접 입력' : '템플릿 선택'}
                  </button>
                ))}
              </div>

              {tab === 'direct' ? (
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="발송할 메시지를 입력하세요"
                  className="w-full border rounded-xl p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => { setMessage(t.content); setTab('direct'); }}
                      className="w-full text-left px-3 py-2.5 border rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{t.content}</p>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-600 text-center py-4">등록된 템플릿이 없습니다</p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-600 mt-2">
                * 선택한 태그를 모두 보유한 고객에게만 발송됩니다 (AND 조건)
              </p>

              {sendError && <p className="text-sm text-red-500 mt-2">{sendError}</p>}

              <button
                onClick={handlePreview}
                disabled={!message.trim() || sending}
                className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {sending ? '확인 중...' : '발송 대상 확인'}
              </button>
            </>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 ${preview.isOverLimit ? 'bg-red-50' : 'bg-blue-50'}`}>
                <p className="text-lg font-bold text-center">
                  {preview.willSend}명에게 발송됩니다
                </p>
                {preview.isOverLimit && (
                  <p className="text-sm text-red-600 text-center mt-1">{preview.overLimitMsg}</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm text-gray-500 mb-1">발송 메시지</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{message}</p>
              </div>
              {sendError && <p className="text-sm text-red-500">{sendError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('write')}
                  className="flex-1 py-3 border rounded-xl text-sm text-gray-600">
                  수정
                </button>
                <button onClick={handleSend} disabled={sending}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  {sending ? '발송 중...' : '발송하기'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <p className="font-semibold text-gray-900">발송 완료</p>
              <p className="text-sm text-gray-500 mt-1">{preview?.willSend}명에게 SMS를 발송했습니다</p>
              <button onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-navy-900 text-white rounded-xl text-sm">
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
