'use client';

import { useState, useEffect, ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';

// 탭 타입 정의
type TabId = 'overview' | 'customers' | 'affiliate' | 'content' | 'system';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
}

const tabs: Tab[] = [
  { id: 'overview', label: '전체 현황', icon: '📊', description: '대시보드 요약' },
  { id: 'customers', label: '고객 분석', icon: '👥', description: '고객 행동 및 구매 패턴' },
  { id: 'affiliate', label: '어필리에이트', icon: '💰', description: '팀/에이전트 성과' },
  { id: 'content', label: '콘텐츠 분석', icon: '📝', description: '리뷰 및 키워드' },
  { id: 'system', label: '시스템', icon: '⚙️', description: 'PWA 및 백업' },
];

// 로딩 컴포넌트
function TabLoading() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

interface DashboardTabsProps {
  children?: ReactNode;
  defaultTab?: TabId;
  // 각 탭의 콘텐츠를 렌더링하는 함수
  renderOverview?: () => ReactNode;
  renderCustomers?: () => ReactNode;
  renderAffiliate?: () => ReactNode;
  renderContent?: () => ReactNode;
  renderSystem?: () => ReactNode;
}

export default function DashboardTabs({
  defaultTab = 'overview',
  renderOverview,
  renderCustomers,
  renderAffiliate,
  renderContent,
  renderSystem,
}: DashboardTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;

  const [activeTab, setActiveTab] = useState<TabId>(tabParam || defaultTab);
  const [loadedTabs, setLoadedTabs] = useState<Set<TabId>>(new Set([tabParam || defaultTab]));

  // URL 파라미터 변경 시 탭 업데이트
  useEffect(() => {
    if (tabParam && tabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
      setLoadedTabs(prev => new Set([...prev, tabParam]));
    }
  }, [tabParam]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setLoadedTabs(prev => new Set([...prev, tabId]));

    // URL 업데이트 (히스토리에 추가하지 않음)
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url.toString());
  };

  const renderTabContent = (tabId: TabId): ReactNode => {
    switch (tabId) {
      case 'overview':
        return renderOverview?.() || <DefaultOverviewContent />;
      case 'customers':
        return renderCustomers?.() || <DefaultCustomersContent />;
      case 'affiliate':
        return renderAffiliate?.() || <DefaultAffiliateContent />;
      case 'content':
        return renderContent?.() || <DefaultContentContent />;
      case 'system':
        return renderSystem?.() || <DefaultSystemContent />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 탭 네비게이션 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto py-2" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-200 whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-2 border-blue-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={activeTab === tab.id ? 'block' : 'hidden'}
          >
            {/* 탭이 한 번이라도 로드되었으면 콘텐츠 유지 (성능 최적화) */}
            {loadedTabs.has(tab.id) && (
              <Suspense fallback={<TabLoading />}>
                {renderTabContent(tab.id)}
              </Suspense>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 기본 콘텐츠 컴포넌트들 (실제 대시보드 페이지에서 오버라이드됨)
function DefaultOverviewContent() {
  return (
    <div className="text-center py-12 text-gray-500">
      전체 현황 데이터를 불러오는 중...
    </div>
  );
}

function DefaultCustomersContent() {
  return (
    <div className="text-center py-12 text-gray-500">
      고객 분석 데이터를 불러오는 중...
    </div>
  );
}

function DefaultAffiliateContent() {
  return (
    <div className="text-center py-12 text-gray-500">
      어필리에이트 데이터를 불러오는 중...
    </div>
  );
}

function DefaultContentContent() {
  return (
    <div className="text-center py-12 text-gray-500">
      콘텐츠 분석 데이터를 불러오는 중...
    </div>
  );
}

function DefaultSystemContent() {
  return (
    <div className="text-center py-12 text-gray-500">
      시스템 데이터를 불러오는 중...
    </div>
  );
}

// 탭 전용 래퍼 컴포넌트 (URL 파라미터 처리를 위한 Suspense 경계)
export function DashboardTabsWrapper(props: DashboardTabsProps) {
  return (
    <Suspense fallback={<TabLoading />}>
      <DashboardTabs {...props} />
    </Suspense>
  );
}
