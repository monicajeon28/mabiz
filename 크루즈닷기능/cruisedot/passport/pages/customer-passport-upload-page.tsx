'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CustomerPassportUploadPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.reservationId as string;
  
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/customer/passport-upload?reservationId=${reservationId}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || '여권 이미지 업로드에 실패했습니다.');
      }

      setUploaded(true);
      setImageUrl(data.data?.imageUrl || null);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || '여권 이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">여권 이미지 업로드</h1>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {uploaded ? (
            <div className="text-center">
              <div className="mb-4 text-6xl">✅</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">업로드 완료</h2>
              <p className="mb-6 text-gray-600">
                여권 이미지가 성공적으로 업로드되었습니다.
                <br />
                담당자가 확인 후 연락드리겠습니다.
              </p>
              {imageUrl && (
                <div className="mb-4">
                  <img
                    src={imageUrl}
                    alt="업로드된 여권"
                    className="mx-auto max-w-full rounded-lg border border-gray-200"
                  />
                </div>
              )}
              <button
                onClick={() => {
                  setUploaded(false);
                  setImageUrl(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
              >
                다시 업로드하기
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-gray-700">
                  여권 이미지를 업로드해주세요.
                  <br />
                  담당자가 확인 후 여권 정보를 입력해드립니다.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                
                <div className="mb-4 text-6xl">📸</div>
                <p className="mb-2 text-lg font-semibold text-gray-900">
                  여권 이미지 선택
                </p>
                <p className="mb-6 text-sm text-gray-600">
                  JPEG, PNG, WebP 형식 (최대 10MB)
                </p>
                
                <button
                  type="button"
                  onClick={handleFileSelect}
                  disabled={uploading}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {uploading ? '업로드 중...' : '이미지 선택'}
                </button>
              </div>

              {uploading && (
                <div className="text-center">
                  <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="text-sm text-gray-600">업로드 중입니다...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

