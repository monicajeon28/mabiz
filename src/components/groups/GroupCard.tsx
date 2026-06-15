'use client';

import { GitBranch, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  funnelId: string | null;
  funnelName: string | null;
  _count: { members: number };
};

interface GroupCardProps {
  group: Group;
  copiedExportId: string | null;
  onClone: (id: string) => void;
  onExport: (id: string) => void;
  onBlast: (id: string) => void;
  children?: React.ReactNode;
}

export function GroupCard({
  group,
  copiedExportId,
  onClone,
  onExport,
  onBlast,
  children,
}: GroupCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        {/* 색상 원 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: group.color ?? '#6B7280' }}
          aria-label={`그룹 색상: ${group.color}`}
          suppressHydrationWarning
        >
          {group.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{group.name}</h3>
            <span className="text-sm text-gray-600" aria-label={`멤버 수: ${group._count.members}명`}>
              {group._count.members}명
            </span>
          </div>
          {group.description ? (
            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{group.description}</p>
          ) : (
            <p className="text-sm text-orange-600 font-medium mt-0.5">
              ⚠️ 아직 자동 메시지를 연결하지 않았나요? 고객이 신청 후 3일간 자동으로 메시지를 받지 못합니다.
            </p>
          )}

          {/* 연결된 퍼널 표시 */}
          {group.funnelId ? (
            <div className="flex items-center gap-1 mt-1.5">
              <GitBranch className="w-3 h-3 text-green-500" aria-hidden="true" />
              <span className="text-sm text-green-600 font-medium">자동 메시지 연결됨: {group.funnelName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-sm text-gray-600">자동 메시지 없음</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap justify-end">
          <Link
            href={`/groups/${group.id}`}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100"
            title="그룹 상세 페이지 (가입)"
          >
            <ArrowRight className="w-3 h-3" aria-hidden="true" /> 보기
          </Link>
          <button
            onClick={() => onClone(group.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100"
            title="그룹 복제"
          >
            📋 복제
          </button>
          <button
            onClick={() => onExport(group.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100"
            title="그룹 내보내기 (JSON 클립보드 복사)"
          >
            {copiedExportId === group.id ? '✅ 복사됨' : '📤 내보내기'}
          </button>
          <button
            onClick={() => onBlast(group.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gold-50 border border-gold-300 text-gold-700 rounded-lg text-sm font-medium hover:bg-gold-100"
            title="그룹 전체에 즉시 문자 발송"
          >
            <Zap className="w-3 h-3" aria-hidden="true" /> 즉시발송
          </button>
        </div>
      </div>

      {/* 일괄 발송 패널 (자식 컴포넌트) */}
      {children}
    </div>
  );
}
