'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Download, ExternalLink } from 'lucide-react';

interface BackupRecord {
  id: string;
  backupAt: string;
  contactCount: number;
  driveFileId?: string;
  driveViewLink?: string;
  backupType: 'MANUAL' | 'AUTO';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  errorMessage?: string;
}

export default function BackupSettingsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastBackup, setLastBackup] = useState<BackupRecord | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // 백업 기록 조회
  useEffect(() => {
    const fetchBackups = async () => {
      try {
        setPageLoading(true);
        const res = await fetch('/api/settings/backup');
        const data = await res.json();

        if (data.ok && data.backups) {
          setBackups(data.backups);
          if (data.backups.length > 0) {
            setLastBackup(data.backups[0]);
          }

          // Google Drive 연동 여부 판정 (최근 백업이 Google Drive에 저장됨)
          setIsGoogleConnected(data.backups.some((b: BackupRecord) => b.driveFileId));
        }
      } catch (err) {
        console.error('백업 기록 조회 실패:', err);
      } finally {
        setPageLoading(false);
      }
    };

    fetchBackups();
  }, []);

  // 수동 백업 실행
  const handleManualBackup = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/settings/backup', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.ok) {
        alert(`✅ ${data.backup?.contactCount || 0}명 Contact 백업되었습니다`);
        // 기록 새로고침
        window.location.reload();
      } else {
        setError(data.error || '백업 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">📥 데이터 백업</h1>
        <p className="text-gray-600 mt-2">Contact 정보를 Google Drive에 자동 백업합니다</p>
      </div>

      {/* Google Drive 연동 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isGoogleConnected ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Google Drive 연동 완료
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                Google Drive 미연동
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGoogleConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                ✅ Google Drive에 자동으로 백업됩니다.
              </p>

              {lastBackup && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">마지막 백업:</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {new Date(lastBackup.backupAt).toLocaleString('ko-KR')}
                  </p>
                  <p className="text-sm text-gray-700">
                    {lastBackup.contactCount}명 Contact
                  </p>
                  {lastBackup.backupType === 'MANUAL' && (
                    <p className="text-xs text-green-600 mt-1">수동 백업</p>
                  )}
                </div>
              )}

              <Button
                onClick={handleManualBackup}
                disabled={loading}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="w-4 h-4" />
                {loading ? '백업 중...' : '지금 백업하기'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-900">
                ⚠️ Google Drive 연동이 필요합니다
              </p>
              <p className="text-sm text-yellow-700">
                관리자에게 요청하여 Google Drive 연동을 설정해주세요. 연동 후 자동 백업이 시작됩니다.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 자동 백업 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            자동 백업 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-900">
              ⏰ 매일 자동 백업 (자정 기준 UTC+9)
            </p>
            <p className="text-xs text-blue-700 mt-1">
              일일 자동 백업으로 데이터 손실을 방지합니다. Contact 최대 1,000명까지 매일 Excel 형식으로 백업됩니다.
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">
              💡 자동 백업은 서버에서 자동으로 실행되며, 별도로 설정할 필요가 없습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 백업 기록 */}
      <Card>
        <CardHeader>
          <CardTitle>📊 백업 기록</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            {backups.length > 0
              ? `총 ${backups.length}개의 백업 기록`
              : '백업 기록이 없습니다'}
          </p>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">아직 백업 기록이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">
                "지금 백업하기" 버튼을 클릭하거나 자동 백업 예약을 기다려주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {backups.map((backup, idx) => (
                <div
                  key={backup.id}
                  className="border border-gray-200 rounded-lg p-3 md:p-4 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* 상태 아이콘 */}
                    <div className="shrink-0 mt-0.5">
                      {backup.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : backup.status === 'PENDING' ? (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">
                          {new Date(backup.backupAt).toLocaleString('ko-KR')}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            backup.backupType === 'AUTO'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {backup.backupType === 'AUTO' ? '자동' : '수동'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mt-1">
                        {backup.contactCount}명 Contact 백업
                      </p>

                      {backup.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">
                          오류: {backup.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 링크 */}
                  {backup.driveViewLink && (
                    <a
                      href={backup.driveViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                      title="Google Drive에서 보기"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">보기</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 백업 데이터 정보 */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-sm">💾 백업되는 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs md:text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 shrink-0">✓</span>
              <span>고객 기본 정보 (이름, 전화, 이메일, 예산범위 등)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 shrink-0">✓</span>
              <span>콜 기록 (최근 50개)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 shrink-0">✓</span>
              <span>메모 (최근 20개)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 shrink-0">✓</span>
              <span>그룹 정보 및 전달 이력</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 보안 정보 */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            보안 및 개인정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs text-amber-900">
            <li className="flex items-start gap-2">
              <span className="shrink-0">•</span>
              <span>백업 파일은 Google Drive에 안전하게 저장됩니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0">•</span>
              <span>조직의 승인된 사용자만 접근 가능합니다</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0">•</span>
              <span>최대 1,000명의 Contact까지 백업됩니다</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
