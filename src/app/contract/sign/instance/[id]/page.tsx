'use client';

import { useState, useEffect, useRef } from 'react';
import { showError, showSuccess } from '@/components/ui/Toast';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';

interface ContractData {
  status: string;
  templateName: string;
  renderedHtml: string;
  boundData: Record<string, unknown>;
  expiresAt: string | null;
  alreadySigned: boolean;
  signedAt: string | null;
}

type Step = 'loading' | 'confirm' | 'sign' | 'complete' | 'error' | 'expired' | 'already-signed';

const CanvasSignature = ({ onSignatureCapture }: { onSignatureCapture: (dataUrl: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    setContext(ctx);
  }, []);

  const handleMouseDown = () => setIsDrawing(true);
  const handleMouseUp = () => setIsDrawing(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawing) {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const handleMouseOut = () => setIsDrawing(false);

  const handleClear = () => {
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleConfirm = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onSignatureCapture(dataUrl);
    }
  };

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseOut}
        className="w-full border-2 border-gray-300 rounded-lg bg-white cursor-crosshair"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          초기화
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="ml-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          확인
        </button>
      </div>
    </div>
  );
};

export default function ContractSignPage({ params }: { params: { id: string } }) {
  const [step, setStep] = useState<Step>('loading');
  const [contract, setContract] = useState<ContractData | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'auto' | 'image'>('draw');
  const [autoSignName, setAutoSignName] = useState('');
  const [autoSignFont, setAutoSignFont] = useState<'brush' | 'comic' | 'hand' | 'modern' | 'classic'>('brush');
  const [autoSignPreview, setAutoSignPreview] = useState<string | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [dragOverDrop, setDragOverDrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const contractId = params.id;

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await fetch(`/api/public/contract-instances/${contractId}`);
        const data = await res.json();

        if (!res.ok) {
          if (data.expired) {
            setStep('expired');
          } else {
            setStep('error');
          }
          return;
        }

        setContract(data);
        if (data.alreadySigned) {
          setStep('already-signed');
        } else {
          setStep('confirm');
        }
      } catch (e) {
        setStep('error');
      }
    };

    fetchContract();
  }, [contractId]);

  const handleGeneratePreview = async () => {
    if (!autoSignName.trim()) {
      showError('이름을 입력해주세요');
      return;
    }

    setGeneratingPreview(true);
    try {
      const res = await fetch('/api/contract/generate-auto-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: autoSignName,
          font: autoSignFont,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.message || '서명 생성 실패');
        return;
      }

      setAutoSignPreview(data.signatureImage);
    } catch (e) {
      showError('서명 생성 실패');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const processImageFile = (file: File) => {
    const validMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      showError('PNG, JPG, GIF, WebP 형식만 지원합니다');
      return;
    }

    if (file.size > 500 * 1024) {
      showError('파일 크기가 500KB를 초과합니다');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const base64 = e.target?.result as string;
        setUploadedImageBase64(base64);
      } catch (err) {
        showError('파일 읽기 실패');
      }
    };
    reader.onerror = () => {
      showError('파일 읽기 실패');
    };
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDrop(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  const resetSignatureMode = () => {
    if (signatureMode === 'auto') {
      setAutoSignPreview(null);
      setAutoSignName('');
    } else if (signatureMode === 'image') {
      setUploadedImageBase64(null);
    }
    setSignatureImage(null);
  };

  const handleSubmitSignature = async () => {
    if (!signatureImage) {
      showError('서명을 선택해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/contract-instances/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName,
          signatureImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.message || '서명 제출 실패');
        return;
      }

      showSuccess('서명이 완료되었습니다!');
      setStep('complete');
    } catch (e) {
      showError('오류 발생');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">계약서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">서명 기한 만료</h1>
          <p className="mt-2 text-gray-600">서명 기한이 만료되었습니다. 담당자에게 문의해주세요.</p>
        </div>
      </div>
    );
  }

  if (step === 'already-signed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">이미 서명 완료</h1>
          <p className="mt-2 text-gray-600">이 계약서는 이미 서명이 완료되었습니다.</p>
          {contract?.signedAt && (
            <p className="mt-2 text-sm text-gray-500">
              서명일: {new Date(contract.signedAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-red-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">오류 발생</h1>
          <p className="mt-2 text-gray-600">
            계약서를 불러올 수 없습니다. 담당자에게 문의해주세요.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">서명 완료</h1>
          <p className="mt-2 text-gray-600">계약서 서명이 완료되었습니다.</p>
          <p className="mt-4 text-sm text-gray-500">감사추적 인증서가 이메일로 발송되었습니다.</p>
          <button
            onClick={() => window.close()}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            페이지 닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold">CRUISEDOT</h1>
          <p className="text-sm text-slate-300 mt-1">전자계약서 서명</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {step === 'confirm' && contract && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 1. 계약서 확인</h2>
              <p className="text-gray-600">
                아래 계약서 내용을 확인하신 후 다음 단계로 진행해주세요.
              </p>
            </div>

            <div className="border-2 border-gray-300 rounded-lg p-8 bg-white">
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(contract.renderedHtml, {
                    ALLOWED_TAGS: [
                      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                      'table', 'tr', 'td', 'th', 'thead', 'tbody', 'br',
                      'strong', 'em', 'b', 'i', 'u', 'img', 'a',
                      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
                    ],
                    ALLOWED_ATTR: ['class', 'id', 'style', 'src', 'alt', 'href', 'target', 'rel'],
                    FORCE_BODY: true,
                    RETURN_DOM: false,
                  }),
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="confirm" className="w-4 h-4 text-blue-600" />
              <label htmlFor="confirm" className="text-sm text-gray-700">
                계약서 내용을 확인했습니다
              </label>
            </div>

            <button
              onClick={() => setStep('sign')}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              다음 →
            </button>
          </div>
        )}

        {step === 'sign' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2. 서명 입력</h2>
              <p className="text-gray-600">가장 편한 방식을 선택하여 서명을 입력해주세요.</p>
            </div>

            {/* 서명 방식 선택 라디오 버튼 */}
            <div className="border-2 border-gray-300 rounded-lg p-6 bg-white space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                📌 서명 방식 선택
              </h3>

              {/* 직접 그리기 */}
              <label className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                signatureMode === 'draw' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="signature-mode"
                  value="draw"
                  checked={signatureMode === 'draw'}
                  onChange={(e) => {
                    setSignatureMode(e.target.value as 'draw' | 'auto' | 'image');
                    setSignatureImage(null);
                  }}
                  className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">✏️ 직접 그리기</p>
                  <p className="text-sm text-gray-600 mt-1">마우스나 터치로 서명을 그려주세요</p>
                </div>
              </label>

              {/* 자동생성 */}
              <label className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                signatureMode === 'auto' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="signature-mode"
                  value="auto"
                  checked={signatureMode === 'auto'}
                  onChange={(e) => {
                    setSignatureMode(e.target.value as 'draw' | 'auto' | 'image');
                    setSignatureImage(null);
                    setAutoSignPreview(null);
                  }}
                  className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">🎨 자동생성</p>
                  <p className="text-sm text-gray-600 mt-1">폰트를 선택하고 자동 생성된 서명 사용</p>
                </div>
              </label>

              {/* 이미지업로드 */}
              <label className={`flex items-start gap-4 p-4 border-2 rounded-lg cursor-pointer transition ${
                signatureMode === 'image' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="signature-mode"
                  value="image"
                  checked={signatureMode === 'image'}
                  onChange={(e) => {
                    setSignatureMode(e.target.value as 'draw' | 'auto' | 'image');
                    setSignatureImage(null);
                    setUploadedImageBase64(null);
                  }}
                  className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">📸 이미지업로드</p>
                  <p className="text-sm text-gray-600 mt-1">기존 서명 이미지를 업로드해주세요</p>
                </div>
              </label>
            </div>

            {/* 모드별 렌더링 */}
            {signatureMode === 'draw' && !signatureImage && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">서명을 그려주세요</h3>
                <CanvasSignature onSignatureCapture={setSignatureImage} />
              </div>
            )}

            {signatureMode === 'auto' && !signatureImage && (
              <div className="border-2 border-gray-300 rounded-lg p-6 bg-white space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">자동 서명 생성</h3>

                {/* 이름 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이름 <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={autoSignName}
                    onChange={(e) => setAutoSignName(e.target.value.slice(0, 20))}
                    placeholder="이름을 입력해주세요"
                    maxLength={20}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">{autoSignName.length} / 20자</p>
                </div>

                {/* 폰트 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    폰트 선택
                  </label>
                  <select
                    value={autoSignFont}
                    onChange={(e) => setAutoSignFont(e.target.value as typeof autoSignFont)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="brush">손글씨 스타일 (Brush)</option>
                    <option value="comic">만화체 (Comic)</option>
                    <option value="hand">손写 필기체 (Hand)</option>
                    <option value="modern">모던체 (Modern)</option>
                    <option value="classic">클래식 (Classic)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">폰트를 선택하면 미리보기가 업데이트됩니다</p>
                </div>

                {/* 미리보기 생성 버튼 */}
                <button
                  onClick={handleGeneratePreview}
                  disabled={generatingPreview || !autoSignName.trim()}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPreview ? '생성 중...' : '미리보기'}
                </button>

                {/* 생성된 서명 미리보기 */}
                {autoSignPreview && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">생성된 서명</p>
                    <div className="border-2 border-gray-300 rounded-lg p-6 bg-gray-50">
                      <img src={autoSignPreview} alt="자동생성 서명" className="h-32 mx-auto" />
                    </div>
                    <button
                      onClick={() => {
                        setSignatureImage(autoSignPreview);
                      }}
                      className="w-full mt-4 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
                    >
                      이 서명 사용
                    </button>
                  </div>
                )}
              </div>
            )}

            {signatureMode === 'image' && !signatureImage && (
              <div className="border-2 border-gray-300 rounded-lg p-6 bg-white space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">이미지 업로드</h3>

                {/* 드래그드롭 영역 */}
                <div
                  onDrop={handleImageDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDrop(true);
                  }}
                  onDragLeave={() => setDragOverDrop(false)}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                    dragOverDrop ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <p className="text-3xl mb-2">📸</p>
                  <p className="text-gray-900 font-medium">이미지를 여기에 드래그하거나</p>
                  <p className="text-sm text-gray-600 mt-1">아래 버튼을 클릭하여 파일을 선택해주세요</p>
                  <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF, WebP (최대 500KB)</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                  >
                    파일 선택
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={handleImageFileSelect}
                    className="hidden"
                  />
                </div>

                {/* 업로드된 이미지 표시 */}
                {uploadedImageBase64 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">업로드된 서명</p>
                    <div className="border-2 border-gray-300 rounded-lg p-6 bg-gray-50">
                      <img src={uploadedImageBase64} alt="업로드 서명" className="h-32 mx-auto object-contain" />
                    </div>
                    <button
                      onClick={() => {
                        setSignatureImage(uploadedImageBase64);
                      }}
                      className="w-full mt-4 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
                    >
                      이 이미지 사용
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 선택된 서명 확인 및 제출 */}
            {signatureImage && (
              <div className="space-y-6 border-2 border-green-300 rounded-lg p-6 bg-green-50">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">선택된 서명</h3>
                  <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                    <img src={signatureImage} alt="선택된 서명" className="h-32 mx-auto" />
                  </div>
                </div>

                <button
                  onClick={resetSignatureMode}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  다시 선택
                </button>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    서명자 이름 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="이름을 입력해주세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button
                  onClick={handleSubmitSignature}
                  disabled={submitting}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '제출 중...' : '서명 완료'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
