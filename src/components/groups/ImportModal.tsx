'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ImportModalProps {
  csrfToken: string;
  onClose: () => void;
  onDone: () => void;
}

export function ImportModal({ csrfToken, onClose, onDone }: ImportModalProps) {
  const [tab, setTab] = useState<'file' | 'text'>('file');
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ groupName?: string; funnelName?: string; stageCount?: number } | null>(null);

  const parseJson = (text: string) => {
    try {
      const parsed = JSON.parse(text) as { groupName?: string; funnelName?: string; stages?: unknown[] };
      setPreview({
        groupName: parsed.groupName,
        funnelName: parsed.funnelName,
        stageCount: parsed.stages?.length ?? 0,
      });
      setError('');
      return parsed;
    } catch {
      setError('JSON 형식이 올바르지 않습니다');
      setPreview(null);
      return null;
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError(`파일이 너무 큽니다 (최대 1MB, 현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      parseJson(text);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (text: string) => {
    setJsonText(text);
    if (text.trim()) parseJson(text);
    else {
      setPreview(null);
      setError('');
    }
  };

  const handleImport = async () => {
    const parsed = parseJson(jsonText);
    if (!parsed) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/groups/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: jsonText,
      });
      const d = await res.json() as { ok: boolean; message?: string };
      if (d.ok) {
        onDone();
        onClose();
      } else setError(d.message ?? '가져오기 실패');
    } catch (err) {
      logger.error('[ImportModal] handleImport', { err });
      setError('네트워크 오류가 발생했습니다');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold">그룹/퍼널 가져오기</h2>
            <p className="text-xs text-gray-500 mt-0.5">JSON 파일 업로드 또는 직접 입력</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="가져오기 모달 닫기"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 탭 */}
          <div className="flex gap-2">
            {(['file', 'text'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-navy-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t === 'file' ? '파일 업로드' : '직접 입력'}
              </button>
            ))}
          </div>

          {tab === 'file' ? (
            <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 transition-colors">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-500">JSON 파일을 여기에 끌어놓거나 클릭</p>
              <p className="text-xs text-gray-400 mt-1">.json 파일만 지원</p>
              <input type="file" accept=".json" onChange={handleFile} className="hidden" />
            </label>
          ) : (
            <textarea
              value={jsonText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder='{"groupName":"그룹명","funnelName":"퍼널명","stages":[...]}'
              className="w-full h-36 border rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="JSON 직접 입력"
            />
          )}

          {/* 미리보기 */}
          {preview && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-blue-800">파싱 결과</p>
              <div className="mt-1.5 space-y-0.5 text-blue-700 text-xs">
                {preview.groupName && <p>그룹명: {preview.groupName}</p>}
                {preview.funnelName && <p>퍼널명: {preview.funnelName}</p>}
                {preview.stageCount !== undefined && <p>스테이지: {preview.stageCount}개</p>}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleImport}
            disabled={!jsonText.trim() || importing || !!error}
            className="w-full py-3 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {importing ? '가져오는 중...' : '가져오기 실행'}
          </button>

          {/* JSON 형식 안내 */}
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">JSON 형식 예시 보기</summary>
            <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-xs overflow-x-auto">
{`{
  "groupName": "VIP 고객",
  "funnelName": "VIP 케어",
  "funnelType": "VIP_CARE",
  "stages": [
    {
      "name": "환영 문자",
      "order": 1,
      "triggerType": "DDAY",
      "triggerOffset": 0,
      "channel": "SMS",
      "messageContent": "[고객명]님 환영합니다"
    }
  ]
}`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
