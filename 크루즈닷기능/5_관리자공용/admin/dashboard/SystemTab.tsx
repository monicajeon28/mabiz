'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import StatCard, { StatCardGrid } from '../StatCard';

interface PWAStats {
  genie: number;
  mall: number;
  both: number;
  total: number;
  recentInstalls: Array<{
    id: number;
    type: 'genie' | 'mall';
    createdAt: string;
  }>;
  dailyTrends: Array<{
    date: string;
    genie: number;
    mall: number;
  }>;
}

interface BackupStatus {
  lastBackup: string | null;
  backupCount: number;
  totalSize: string;
  status: 'success' | 'failed' | 'pending';
}

interface AutomationStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastRun: string | null;
  nextRun: string | null;
  errorMessage?: string;
}

export default function SystemTab() {
  const [pwaStats, setPwaStats] = useState<PWAStats | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [automations, setAutomations] = useState<AutomationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingBackup, setTestingBackup] = useState(false);

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pwaRes, dashboardRes] = await Promise.all([
        fetch('/api/admin/pwa-stats', { credentials: 'include' }).catch(() => null),
        fetch('/api/admin/dashboard', { credentials: 'include' }).catch(() => null),
      ]);

      // PWA 통계
      if (pwaRes?.ok) {
        const pwaData = await pwaRes.json();
        if (pwaData.ok) {
          setPwaStats({
            genie: pwaData.stats?.genie || 0,
            mall: pwaData.stats?.mall || 0,
            both: pwaData.stats?.both || 0,
            total: pwaData.stats?.total || 0,
            recentInstalls: pwaData.recentInstalls || [],
            dailyTrends: pwaData.dailyTrends || [],
          });
        }
      }

      // 대시보드에서 PWA 데이터 보완
      if (dashboardRes?.ok) {
        const dashData = await dashboardRes.json();
        if (dashData.ok && dashData.dashboard?.pwaInstalls) {
          const pwa = dashData.dashboard.pwaInstalls;
          setPwaStats(prev => prev || {
            genie: pwa.genie || 0,
            mall: pwa.mall || 0,
            both: pwa.both || 0,
            total: (pwa.genie || 0) + (pwa.mall || 0) - (pwa.both || 0),
            recentInstalls: [],
            dailyTrends: [],
          });
        }
      }

      // 자동화 상태 (현재는 더미 데이터, 실제 API 연동 필요)
      setAutomations([
        {
          name: 'APIS 스프레드시트 동기화',
          status: 'running',
          lastRun: new Date().toISOString(),
          nextRun: null,
        },
        {
          name: '수당 계산',
          status: 'running',
          lastRun: new Date().toISOString(),
          nextRun: null,
        },
        {
          name: '여권 알림 발송',
          status: 'running',
          lastRun: new Date().toISOString(),
          nextRun: null,
        },
      ]);

    } catch (err: any) {
      console.error('System data load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runBackupTest = async () => {
    try {
      setTestingBackup(true);
      const res = await fetch('/api/admin/test/backup', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        alert('백업 테스트 완료');
        loadSystemData();
      } else {
        alert(`백업 테스트 실패: ${data.error}`);
      }
    } catch (err: any) {
      alert(`백업 테스트 오류: ${err.message}`);
    } finally {
      setTestingBackup(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">시스템 현황</h2>

      {/* PWA 통계 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">PWA 설치 현황</h3>
        <StatCardGrid columns={4}>
          <StatCard
            title="크루즈닷 앱"
            value={pwaStats?.genie || 0}
            subtitle="바탕화면 추가"
            color="pink"
          />
          <StatCard
            title="크루즈몰"
            value={pwaStats?.mall || 0}
            subtitle="바탕화면 추가"
            color="blue"
          />
          <StatCard
            title="둘 다 설치"
            value={pwaStats?.both || 0}
            subtitle="크루즈닷 + 몰"
            color="purple"
          />
          <StatCard
            title="총 설치"
            value={pwaStats?.total || 0}
            subtitle="순 사용자"
            color="green"
            gradient
          />
        </StatCardGrid>
      </div>

      {/* 자동화 상태 */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">자동화 시스템</h3>
          <span className="text-sm text-gray-500">
            실시간 상태
          </span>
        </div>
        <div className="space-y-3">
          {automations.map((auto, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    auto.status === 'running' ? 'bg-green-500' :
                    auto.status === 'error' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`}
                />
                <span className="font-medium">{auto.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`px-2 py-1 rounded ${
                  auto.status === 'running' ? 'bg-green-100 text-green-700' :
                  auto.status === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {auto.status === 'running' ? '실행 중' :
                   auto.status === 'error' ? '오류' : '중지됨'}
                </span>
                {auto.lastRun && (
                  <span className="text-gray-500">
                    마지막: {format(new Date(auto.lastRun), 'MM.dd HH:mm', { locale: ko })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 백업 관리 */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">구글 드라이브 백업</h3>
          <button
            onClick={runBackupTest}
            disabled={testingBackup}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              testingBackup
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {testingBackup ? '테스트 중...' : '백업 테스트'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-500">계약서 PDF</p>
            <p className="text-lg font-bold text-green-600">자동 백업</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-500">문서 (신분증, 통장)</p>
            <p className="text-lg font-bold text-blue-600">자동 백업</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-500">APIS 스프레드시트</p>
            <p className="text-lg font-bold text-purple-600">실시간 동기화</p>
          </div>
        </div>
      </div>

      {/* 시스템 정보 */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">시스템 정보</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">프레임워크</span>
            <span className="font-medium">Next.js 14</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">데이터베이스</span>
            <span className="font-medium">PostgreSQL + Prisma</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">스토리지</span>
            <span className="font-medium">Google Drive</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-500">스프레드시트</span>
            <span className="font-medium">Google Sheets API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
