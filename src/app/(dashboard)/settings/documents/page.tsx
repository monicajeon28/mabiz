"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Upload, Loader2, AlertTriangle, ArrowLeft, ExternalLink, Link2 } from "lucide-react";

type DocStatus = {
  ok: boolean;
  hasIdCard: boolean;
  hasBankBook: boolean;
  idCardUrl: string | null;
  bankbookUrl: string | null;
  idCardName: string | null;
  bankbookName: string | null;
};

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

function DocUploadCard({
  label,
  description,
  hasDoc,
  docUrl,
  docName,
  uploadState,
  onSelect,
}: {
  label: string;
  description: string;
  hasDoc: boolean;
  docUrl: string | null;
  docName: string | null;
  uploadState: UploadState;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`rounded-xl border-2 p-5 transition-all ${
      hasDoc ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start gap-3 mb-4">
        {hasDoc ? (
          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p className="font-bold text-gray-900">{label}</p>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          {hasDoc && docName && (
            <p className="text-xs text-green-700 mt-1">✓ {docName}</p>
          )}
        </div>
        {hasDoc && docUrl && (
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-green-700 underline"
          >
            <ExternalLink className="w-3 h-3" />보기
          </a>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = '';
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploadState === 'uploading'}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          hasDoc
            ? 'border-2 border-green-300 text-green-700 hover:bg-green-100 disabled:opacity-50'
            : 'bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50'
        }`}
      >
        {uploadState === 'uploading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" />업로드 중...</>
        ) : (
          <><Upload className="w-4 h-4" />{hasDoc ? '다시 업로드' : '파일 선택 후 업로드'}</>
        )}
      </button>

      {uploadState === 'done' && (
        <p className="mt-2 text-xs text-green-700 text-center">✓ 업로드 완료</p>
      )}
      {uploadState === 'error' && (
        <p className="mt-2 text-xs text-red-600 text-center">업로드 실패. 다시 시도해주세요.</p>
      )}
    </div>
  );
}

export default function DocumentsSettingPage() {
  const router = useRouter();
  const [status, setStatus]   = useState<DocStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [idCardState,   setIdCardState]   = useState<UploadState>('idle');
  const [bankbookState, setBankbookState] = useState<UploadState>('idle');
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = `${window.location.origin}/settings/documents`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    });
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/documents/upload');
      const data = await res.json();
      if (data.ok) setStatus(data);
      else setError(data.message ?? '조회 실패');
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const upload = async (type: 'idCard' | 'bankbook', file: File) => {
    const setState = type === 'idCard' ? setIdCardState : setBankbookState;
    setState('uploading');

    try {
      const form = new FormData();
      form.append('type', type);
      form.append('file', file);

      const res = await fetch('/api/settings/documents/upload', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();

      if (data.ok) {
        setState('done');
        await loadStatus();
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">서류 제출</h1>
          <p className="text-sm text-gray-500">신분증, 통장사본을 제출하면 정산 승인이 더 빠릅니다.</p>
        </div>
        <button
          onClick={copyLink}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
            copied
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
          }`}
        >
          <Link2 className="w-4 h-4" />
          {copied ? '복사됨!' : '링크 복사'}
        </button>
      </div>

      {/* 안내 배너 */}
      <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">정산 승인 필수 서류</p>
          <ul className="space-y-0.5 text-amber-700">
            <li>• JPG, PNG, PDF 형식 (최대 10MB)</li>
            <li>• 신분증: 주민등록증 또는 운전면허증 앞면</li>
            <li>• 통장사본: 본인 명의 통장 또는 인터넷뱅킹 화면</li>
          </ul>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 업로드 카드 */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-36 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : (
        <div className="space-y-4">
          <DocUploadCard
            label="신분증"
            description="주민등록증 또는 운전면허증 앞면"
            hasDoc={status?.hasIdCard ?? false}
            docUrl={status?.idCardUrl ?? null}
            docName={status?.idCardName ?? null}
            uploadState={idCardState}
            onSelect={(file) => upload('idCard', file)}
          />
          <DocUploadCard
            label="통장사본"
            description="본인 명의 통장 또는 인터넷뱅킹 화면"
            hasDoc={status?.hasBankBook ?? false}
            docUrl={status?.bankbookUrl ?? null}
            docName={status?.bankbookName ?? null}
            uploadState={bankbookState}
            onSelect={(file) => upload('bankbook', file)}
          />
        </div>
      )}

      {/* 완료 안내 */}
      {!loading && status?.hasIdCard && status?.hasBankBook && (
        <div className="mt-5 bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <p className="font-semibold">서류 제출 완료</p>
            <p className="mt-0.5">신분증과 통장사본이 모두 제출됐습니다. 정산 담당자 확인 후 승인됩니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
