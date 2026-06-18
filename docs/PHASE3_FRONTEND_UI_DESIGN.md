# Phase 3: 판매 대시보드 프론트엔드 UI 설계 (2026-06-18)

**목표**: 초등학생도 클릭할 수 있는 수준의 판매 대시보드 UI
**기준**: Steve Jobs 50대 친화적 디자인 + sonoimready 수준 클린함
**예상 라인 수**: 1,200줄 (4명 병렬 4시간)

---

## 📋 대시보드 3가지 페이지

```
┌──────────────────────────────────────────────┐
│ /sales/dashboard                             │
│ (관리자/대리점장/판매원 공통)                 │
│                                              │
│ 📊 내 판매 현황 (Hero 영역)                  │
│    - 이번 달 판매액 (크고 파랑)              │
│    - 대기 중인 주문 (누각 카운트)            │
│    - 전환율 (%)                             │
│    - 수익률 (%)                             │
│                                              │
│ 📈 주문 현황 (테이블)                        │
│    - 신청 / 진행 중 / 완료                   │
│    - 각 탭별 테이블 표시                    │
│                                              │
│ 🤝 팀원 현황 (팀장만)                        │
│    - 팀원 이름 / 판매액 / 주문수             │
│    - Team A ~ Team C 필터                    │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ /sales/team-members                          │
│ (팀장용 팀원 관리)                            │
│                                              │
│ 🔍 팀원 검색 (검색박스)                       │
│ 👥 팀원 목록 (카드 형식)                      │
│    - 이름 / 직급 / 판매액 / 연락처           │
│    - [상세보기] 버튼                         │
│                                              │
│ 📱 팀원별 성과 (바 차트)                     │
│    - 팀원1: ████ 100만원                     │
│    - 팀원2: ██  50만원                       │
│    - 팀원3: ███ 75만원                       │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ /sales/commission-settle (관리자만)          │
│                                              │
│ 💰 월별 정산 관리                             │
│    [2024-06 정산] [2024-05 정산]             │
│    [2024-04 정산] [+ 새로 만들기]            │
│                                              │
│ 📋 정산 상세 내역                             │
│    - 팀원 / 총판매 / 수수료 / 상태            │
│    - [승인] [거절] 버튼                      │
│                                              │
│ 📊 정산 통계                                  │
│    - 총액 / 지급액 / 대기액                   │
└──────────────────────────────────────────────┘
```

---

## 🎨 디자인 규칙 (Steve Jobs 원칙)

### 1️⃣ 타이포그래피 (초등학생 기준)

```
제목 (Hero)        → 32px, 진검정, 굵음 (간격 3줄)
제목 (섹션)       → 20px, 진검정, 굵음 (간격 2줄)
본문 (설명)       → 16px, 검정, 일반 (간격 1.6줄)
라벨 (버튼/필드)  → 14px, 진검정, 일반
도움말            → 14px, 회색, 기울임
```

### 2️⃣ 버튼 규칙 (손가락 굵기 기준)

```
기본 버튼    → 48px × 48px (최소)
패딩        → 12px (상하좌우)
간격        → 16px (버튼 사이)
호버        → 배경 색상 -10% 어두움
포커스      → 2px 파랑 테두리
활성화      → 색 진해짐 + 텍스트 강조
비활성화    → 회색 + 커서 금지
```

### 3️⃣ 색상 팔레트

```
기본색
  - 파랑 (#4A90E2) → 행동 CTA (조회, 승인)
  - 초록 (#27AE60) → 성공 (완료, 생성)
  - 빨강 (#E74C3C) → 거절, 주의 (에러, 위험)
  - 회색 (#95A5A6) → 보조, 비활성화
  - 검정 (#1A1A1A) → 텍스트 (기본)

배경색
  - 흰색 (#FFFFFF) → 카드, 섹션
  - 연파랑 (#EBF4FF) → 강조 배경
  - 연회색 (#F5F5F5) → 인터페이스 배경
  - 빨강 배경 (#FADBD8) → 경고 영역
```

### 4️⃣ 간격 (공기감)

```
페이지 여백    → 상하좌우 24px
섹션 간격      → 상하 24px, 좌우 0px
카드 간격      → 상하좌우 16px
텍스트 간격    → 라인 높이 1.6 (16px × 1.6)
문단 간격      → 16px
```

---

## 🏗️ 파일 구조 (4개 페이지)

```
src/app/(dashboard)/sales/
├── page.tsx                    ← 메인 대시보드
├── dashboard/
│   └── page.tsx               ← 대시보드 상세
├── team-members/
│   └── page.tsx               ← 팀원 목록
└── commission-settle/
    └── page.tsx               ← 정산 관리

src/components/sales/
├── DashboardHero.tsx           ← 상단 통계 (4개 카드)
├── OrderStatusTabs.tsx         ← 주문 상태 탭
├── TeamMembersCard.tsx         ← 팀원 카드
├── CommissionTable.tsx         ← 정산 테이블
└── StatisticChart.tsx          ← 바 차트
```

---

## 💻 구현 코드 (초등학생 수준)

### 1. `src/app/(dashboard)/sales/page.tsx` (메인 대시보드, ~220줄)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import DashboardHero from '@/components/sales/DashboardHero';
import OrderStatusTabs from '@/components/sales/OrderStatusTabs';
import TeamMembersSection from '@/components/sales/TeamMembersSection';
import CommissionSection from '@/components/sales/CommissionSection';

// ============================================
// 📌 메인 판매 대시보드
// URL: /sales
// ============================================

export default function SalesDashboard() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [error, setError] = useState('');

  // 📌 Step 1: 데이터 로드 (마운트 시)
  useEffect(() => {
    if (!session?.user?.id) return;

    async function fetchData() {
      try {
        setLoading(true);
        
        // API 1: 대시보드 통계
        const summaryRes = await fetch('/api/sales/summary');
        if (!summaryRes.ok) throw new Error('대시보드 데이터 로드 실패');
        const summaryData = await summaryRes.json();
        setSummary(summaryData.data);

        // API 2: 팀원 목록 (팀장인 경우만)
        if (session.user.role === 'OWNER') {
          const membersRes = await fetch('/api/sales/team-members');
          if (membersRes.ok) {
            const membersData = await membersRes.json();
            setTeamMembers(membersData.data);
          }
        }

        setError('');
      } catch (err) {
        console.error('❌ 데이터 로드 오류:', err);
        setError('데이터를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  // 📌 Step 2: 로딩 상태 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  // 📌 Step 3: 에러 표시
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-bold mb-2">오류 발생</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 📌 Step 4: 메인 UI 렌더링
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 제목 */}
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        📊 판매 대시보드
      </h1>

      {/* 1️⃣ 상단 통계 (Hero 영역) */}
      <DashboardHero data={summary} />

      {/* 2️⃣ 주문 상태 탭 */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          📋 주문 현황
        </h2>
        <OrderStatusTabs />
      </div>

      {/* 3️⃣ 팀원 현황 (팀장인 경우만) */}
      {session?.user?.role === 'OWNER' && teamMembers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            🤝 팀원 현황
          </h2>
          <TeamMembersSection members={teamMembers} />
        </div>
      )}

      {/* 4️⃣ 정산 현황 (관리자인 경우만) */}
      {session?.user?.role === 'GLOBAL_ADMIN' && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            💰 정산 현황
          </h2>
          <CommissionSection />
        </div>
      )}
    </div>
  );
}
```

### 2. `src/components/sales/DashboardHero.tsx` (상단 통계, ~180줄)

```typescript
'use client';

interface DashboardHeroProps {
  data: any;
}

// ============================================
// 📌 상단 4개 통계 카드
// ============================================

export default function DashboardHero({ data }: DashboardHeroProps) {
  // 📌 Step 1: 데이터 정리
  const stats = [
    {
      title: '이번 달 판매액',
      value: data?.totalSales || 0,
      format: 'currency', // 💰 형식
      color: 'blue',
      icon: '💵',
    },
    {
      title: '대기 중인 주문',
      value: data?.pendingOrders || 0,
      format: 'number',
      color: 'yellow',
      icon: '⏳',
    },
    {
      title: '완료된 주문',
      value: data?.completedOrders || 0,
      format: 'number',
      color: 'green',
      icon: '✅',
    },
    {
      title: '전환율',
      value: data?.conversionRate || 0,
      format: 'percent', // % 형식
      color: 'purple',
      icon: '📈',
    },
  ];

  // 📌 Step 2: 숫자 포맷 함수
  function formatValue(value: number, format: string): string {
    if (format === 'currency') {
      // 💰 100,000원 → 100K 형식
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      return `${(value / 1000).toFixed(0)}K`;
    }
    if (format === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  }

  // 📌 Step 3: 색상 선택
  function getCardColor(color: string) {
    const colors = {
      blue: 'bg-blue-50 border-blue-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      green: 'bg-green-50 border-green-200',
      purple: 'bg-purple-50 border-purple-200',
    };
    return colors[color as keyof typeof colors];
  }

  function getTitleColor(color: string) {
    const colors = {
      blue: 'text-blue-900',
      yellow: 'text-yellow-900',
      green: 'text-green-900',
      purple: 'text-purple-900',
    };
    return colors[color as keyof typeof colors];
  }

  // 📌 Step 4: UI 렌더링
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={`
            p-6 rounded-lg border-2
            ${getCardColor(stat.color)}
            hover:shadow-lg transition-shadow
          `}
        >
          {/* 아이콘 + 제목 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${getTitleColor(stat.color)}`}>
              {stat.title}
            </h3>
            <span className="text-2xl">{stat.icon}</span>
          </div>

          {/* 큰 숫자 */}
          <div className={`text-3xl font-bold ${getTitleColor(stat.color)}`}>
            {formatValue(stat.value, stat.format)}
          </div>

          {/* 작은 설명 (선택) */}
          <p className="text-xs text-gray-500 mt-3">
            {idx === 0 && '✨ 이번 달 총 판매액'}
            {idx === 1 && '⏳ 현재 처리 중인 주문'}
            {idx === 2 && '🎉 완성된 주문'}
            {idx === 3 && '📊 신청 대비 완료율'}
          </p>
        </div>
      ))}
    </div>
  );
}
```

### 3. `src/components/sales/OrderStatusTabs.tsx` (주문 탭, ~200줄)

```typescript
'use client';

import { useState, useEffect } from 'react';

// ============================================
// 📌 주문 상태 탭 (신청 / 진행 중 / 완료)
// ============================================

export default function OrderStatusTabs() {
  const [activeTab, setActiveTab] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // 📌 Step 1: 탭 목록
  const tabs = [
    { id: 'pending', label: '신청 중', icon: '🔔', color: 'yellow' },
    { id: 'processing', label: '진행 중', icon: '⚙️', color: 'blue' },
    { id: 'completed', label: '완료', icon: '✅', color: 'green' },
  ];

  // 📌 Step 2: 탭 변경 시 데이터 로드
  useEffect(() => {
    async function fetchOrders() {
      try {
        setLoading(true);
        const res = await fetch(`/api/sales/orders?status=${activeTab}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.data);
        }
      } catch (err) {
        console.error('❌ 주문 로드 오류:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [activeTab]);

  // 📌 Step 3: 색상 선택 함수
  function getTabColor(color: string) {
    const colors = {
      yellow: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      blue: 'bg-blue-100 text-blue-900 border-blue-300',
      green: 'bg-green-100 text-green-900 border-green-300',
    };
    return colors[color as keyof typeof colors];
  }

  // 📌 Step 4: UI 렌더링
  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
      {/* 탭 버튼 */}
      <div className="flex border-b-2 border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-6 py-4 text-center font-semibold
              transition-all border-b-4
              ${
                activeTab === tab.id
                  ? `${getTabColor(tab.color)} border-b-4 border-${tab.color}-500`
                  : 'text-gray-600 border-b-4 border-transparent hover:bg-gray-50'
              }
            `}
          >
            <span className="text-2xl mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="p-6">
        {loading && <p className="text-center text-gray-500">로딩 중...</p>}

        {!loading && orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-gray-500">주문이 없습니다</p>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="pb-3 font-semibold text-gray-900">주문 ID</th>
                  <th className="pb-3 font-semibold text-gray-900">고객명</th>
                  <th className="pb-3 font-semibold text-gray-900">금액</th>
                  <th className="pb-3 font-semibold text-gray-900">신청일</th>
                  <th className="pb-3 font-semibold text-gray-900">작업</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 font-mono text-sm text-blue-600">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="py-4 font-semibold text-gray-900">
                      {order.customerName}
                    </td>
                    <td className="py-4 font-semibold text-gray-900">
                      {(order.totalPrice / 1000).toFixed(0)}K
                    </td>
                    <td className="py-4 text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-4">
                      <a
                        href={`/sales/orders/${order.id}`}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
                      >
                        상세보기
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4. `src/components/sales/TeamMembersSection.tsx` (팀원 카드, ~180줄)

```typescript
'use client';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

interface TeamMembersSectionProps {
  members: TeamMember[];
}

// ============================================
// 📌 팀원 목록 (카드 형식)
// ============================================

export default function TeamMembersSection({
  members,
}: TeamMembersSectionProps) {
  // 📌 Step 1: 직급 한글 변환
  function getRoleLabel(role: string) {
    const roles = {
      OWNER: '팀장',
      AGENT: '판매원',
      FREE_SALES: '자유판매원',
    };
    return roles[role as keyof typeof roles] || role;
  }

  // 📌 Step 2: UI 렌더링
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {members.map((member) => (
        <div
          key={member.id}
          className="bg-white rounded-lg border-2 border-gray-200 p-6 hover:shadow-lg transition-shadow"
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                👤 {member.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {getRoleLabel(member.role)}
              </p>
            </div>
          </div>

          {/* 이메일 */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              📧 {member.email}
            </p>
          </div>

          {/* 가입일 */}
          <div className="mb-6">
            <p className="text-xs text-gray-500">
              가입일: {new Date(member.createdAt).toLocaleDateString('ko-KR')}
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <a
              href={`/sales/team-members/${member.id}`}
              className="flex-1 px-4 py-3 bg-blue-600 text-white text-center rounded font-semibold hover:bg-blue-700 transition-colors text-sm"
            >
              상세보기
            </a>
            <button
              onClick={() => {
                // TODO: 메시지 발송 기능
                alert(`${member.name}에게 메시지를 보낼 수 있습니다`);
              }}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-900 text-center rounded font-semibold hover:bg-gray-300 transition-colors text-sm"
            >
              메시지
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5. `src/components/sales/CommissionSection.tsx` (정산 섹션, ~200줄)

```typescript
'use client';

import { useState, useEffect } from 'react';

// ============================================
// 📌 정산 현황 (관리자만)
// ============================================

export default function CommissionSection() {
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  // 📌 Step 1: 최근 6개월 목록 생성
  useEffect(() => {
    const monthList = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      monthList.push({
        value: month,
        label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
      });
    }
    setMonths(monthList);
    if (monthList.length > 0) {
      setSelectedMonth(monthList[0].value);
    }
  }, []);

  // 📌 Step 2: 정산 데이터 로드
  useEffect(() => {
    if (!selectedMonth) return;

    async function fetchSettlements() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/sales/commission-settle?month=${selectedMonth}`
        );
        if (res.ok) {
          const data = await res.json();
          setSettlements(data.data);
        }
      } catch (err) {
        console.error('❌ 정산 데이터 로드 오류:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSettlements();
  }, [selectedMonth]);

  // 📌 Step 3: 새 정산 생성
  async function handleCreateSettlement() {
    const newMonth = `${new Date().getFullYear()}${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}`;

    try {
      setCreatingNew(true);
      const res = await fetch('/api/sales/commission-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: newMonth }),
      });

      if (res.ok) {
        alert('✅ 새로운 정산이 생성되었습니다');
        setSelectedMonth(newMonth);
        window.location.reload();
      } else {
        const err = await res.json();
        alert(`❌ ${err.error}`);
      }
    } catch (err) {
      console.error('❌ 정산 생성 오류:', err);
      alert('정산 생성에 실패했습니다');
    } finally {
      setCreatingNew(false);
    }
  }

  // 📌 Step 4: UI 렌더링
  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      {/* 월 선택 + 생성 버튼 */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-3 border-2 border-gray-200 rounded font-semibold focus:outline-none focus:border-blue-500"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleCreateSettlement}
          disabled={creatingNew}
          className="px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 disabled:bg-gray-400 transition-colors"
        >
          {creatingNew ? '생성 중...' : '+ 새로 만들기'}
        </button>
      </div>

      {/* 정산 테이블 */}
      {loading && <p className="text-center text-gray-500">로딩 중...</p>}

      {!loading && settlements.length === 0 && (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">💼</p>
          <p className="text-gray-500">정산 내역이 없습니다</p>
        </div>
      )}

      {!loading && settlements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="pb-3 font-semibold text-gray-900">팀원 이름</th>
                <th className="pb-3 font-semibold text-gray-900">총 판매액</th>
                <th className="pb-3 font-semibold text-gray-900">수수료</th>
                <th className="pb-3 font-semibold text-gray-900">상태</th>
                <th className="pb-3 font-semibold text-gray-900">작업</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => (
                <tr
                  key={settlement.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-4 font-semibold text-gray-900">
                    {settlement.user?.name || '(삭제됨)'}
                  </td>
                  <td className="py-4 text-gray-900">
                    {(settlement.totalSales / 1000).toFixed(0)}K
                  </td>
                  <td className="py-4 font-semibold text-blue-600">
                    {(settlement.commission / 1000).toFixed(0)}K
                  </td>
                  <td className="py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold
                      ${
                        settlement.status === 'PAID'
                          ? 'bg-green-100 text-green-900'
                          : settlement.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-yellow-100 text-yellow-900'
                      }
                    `}
                    >
                      {settlement.status === 'PAID'
                        ? '✅ 지급완료'
                        : settlement.status === 'APPROVED'
                        ? '✔️ 승인됨'
                        : '⏳ 대기중'}
                    </span>
                  </td>
                  <td className="py-4">
                    {settlement.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                          승인
                        </button>
                        <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                          거절
                        </button>
                      </div>
                    )}
                    {settlement.status !== 'PENDING' && (
                      <span className="text-gray-500 text-sm">처리완료</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 CSS 스타일 (Tailwind, 이미 위에 포함됨)

모든 컴포넌트는 **Tailwind CSS** 사용:
- `text-{size}` (14px, 16px, 20px, 32px)
- `p-{size}` (패딩)
- `mb-{size}` (아래 여백)
- `bg-{color}-{shade}` (배경색)
- `border-{size} border-{color}` (테두리)
- `rounded-lg` (모서리)
- `hover:` (호버 상태)
- `transition-{property}` (부드러운 변화)

---

## 📋 구현 체크리스트

### Phase 3 구현 (4시간, 4명 병렬)

| 에이전트 | 파일 | 라인 | 작업 |
|---------|------|------|------|
| **Agent-UI-1** | `src/app/(dashboard)/sales/page.tsx` | 220줄 | 메인 대시보드 페이지 |
| **Agent-UI-2** | `src/components/sales/DashboardHero.tsx` | 180줄 | 상단 통계 4개 카드 |
| **Agent-UI-3** | `src/components/sales/OrderStatusTabs.tsx` | 200줄 | 주문 상태 탭 |
| **Agent-UI-4** | `src/components/sales/CommissionSection.tsx` | 200줄 | 정산 섹션 |
| **(보너스)** | `src/components/sales/TeamMembersSection.tsx` | 180줄 | 팀원 카드 |

### 구현 후 검증

```powershell
# 타입 체크
npx tsc --noEmit

# 페이지 렌더링 확인
# http://localhost:3000/sales

# 브라우저 개발자도구 (F12)
# → 콘솔 에러 0개
# → Network: API 응답 200
```

---

## 🚀 다음 단계 (Phase 4)

- [ ] API 통합 테스트 (Postman 또는 Jest)
- [ ] E2E 테스트 (Playwright)
- [ ] 접근성 감사 (a11y 기준)
- [ ] 성능 최적화 (Lighthouse 90+)
- [ ] 배포 (Vercel)

---

**작성 일**: 2026-06-18
**버전**: 1.0 (Phase 3 초기 설계)
**다음**: Phase 4 통합 테스트 + 배포
