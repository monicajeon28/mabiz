'use client';

import { useRef, useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { showSuccess } from '@/components/ui/Toast';

interface OCRResult {
  korName: string;
  engSurname: string;
  engGivenName: string;
  passportNumber: string;
  nationality: string;
  sex: string;
  dateOfBirth: string;
  dateOfIssue: string;
  passportExpiryDate: string;
  confidence: number;
  warnings: string[];
  hasMinimum: boolean;
}

interface OCRUploadModalProps {
  onClose: () => void;
  onResult: (data: OCRResult) => void;
}

export function OCRUploadModal({ onClose, onResult }: OCRUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPassportNumber, setShowPassportNumber] = useState(false);

  // 파일 선택
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 파일 검증
    if (!selectedFile.type.startsWith('image/')) {
      setError('이미지 파일을 선택하세요');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  // 드래그 앤 드롭
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const input = fileInputRef.current;
      if (input) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(droppedFile);
        input.files = dataTransfer.files;
        handleFileSelect({
          target: input,
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // OCR 요청
  const handleOCR = async () => {
    if (!file) {
      setError('파일을 선택하세요');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/passport/admin/ocr', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'OCR 처리 실패');
        return;
      }

      setResult(data.data);
      setStep('preview');
      showSuccess(`OCR 처리 완료 (신뢰도: ${data.data.confidence}%)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR 처리 중 오류 발생';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 결과 적용
  const handleApply = () => {
    if (!result) return;
    onResult(result);
    showSuccess('여권 정보가 입력되었습니다.');
    onClose();
  };

  // 다시 촬영
  const handleRetry = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">여권 OCR 인식</h2>
              <p className="text-sm text-gray-500 mt-0.5">여권 사진을 업로드하면 자동 인식해 입력합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            {/* 드래그 앤 드롭 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50"
            >
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">여권 사진을 업로드하세요</p>
                  <p className="text-sm text-gray-500 mt-1">드래그 앤 드롭 또는 클릭해서 선택</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">JPG, PNG, WebP (최대 5MB)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* 미리보기 */}
            {preview && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">미리보기</p>
                <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={preview} alt="여권 미리보기" className="w-full h-full object-contain" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetry}
                    className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    다른 사진 선택
                  </button>
                  <button
                    onClick={handleOCR}
                    disabled={loading}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        인식 중...
                      </>
                    ) : (
                      'OCR 인식 시작'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                  <p className="text-sm text-red-600 mt-1">다른 사진을 시도하거나 수동으로 입력하세요.</p>
                </div>
              </div>
            )}

            {/* 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 space-y-2">
              <p className="font-medium">📸 촬영 팁</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>여권을 평평하게 펴고 정면으로 촬영하세요</li>
                <li>밝은 환경에서 촬영해 텍스트가 명확하게 보이도록 하세요</li>
                <li>여권의 정보 페이지(앞면) 전체가 보이도록 촬영하세요</li>
                <li>기울임이나 그림자가 없도록 주의하세요</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && result && (
          <div className="space-y-4">
            {/* 신뢰도 표시 */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-2">신뢰도</p>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-colors ${
                      result.confidence >= 90
                        ? 'bg-green-500'
                        : result.confidence >= 70
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${result.confidence}%` }}
                  />
                </div>
                <p className="text-sm font-bold mt-1">{result.confidence}%</p>
              </div>
              {result.confidence >= 90 && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">매우 높음</span>
                </div>
              )}
              {result.confidence >= 70 && result.confidence < 90 && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">보통</span>
                </div>
              )}
              {result.confidence < 70 && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">낮음</span>
                </div>
              )}
            </div>

            {/* 인식된 정보 */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">인식된 정보</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">한글 이름</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.korName || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">영문 성</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.engSurname || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">영문 이름</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.engGivenName || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">국적</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.nationality || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">성별</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {result.sex === 'M' ? '남' : result.sex === 'F' ? '여' : '—'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">생년월일</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.dateOfBirth || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">발급일</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.dateOfIssue || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">만료일</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{result.passportExpiryDate || '—'}</p>
                </div>
              </div>

              {/* 여권번호 (마스킹) */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500 font-medium">여권번호</label>
                  <button
                    onClick={() => setShowPassportNumber(!showPassportNumber)}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    {showPassportNumber ? (
                      <>
                        <EyeOff className="w-3 h-3" /> 숨기기
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> 보기
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm font-mono font-medium text-gray-900 mt-1">
                  {showPassportNumber ? result.passportNumber : result.passportNumber.replace(/./g, '•')}
                </p>
              </div>
            </div>

            {/* 경고/누락 정보 */}
            {result.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-amber-800">⚠️ 확인 필요</p>
                <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}이 확인되지 않았습니다</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={handleRetry}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                다시 촬영
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                이 정보로 입력
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
