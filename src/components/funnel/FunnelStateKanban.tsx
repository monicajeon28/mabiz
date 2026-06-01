'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getStateLabel,
  getStateColor,
  type FunnelState,
} from '@/lib/funnel-state-machine';

interface FunnelStateKanbanProps {
  states: Array<{
    id: string;
    status: FunnelState;
    contact: {
      id: string;
      name: string;
      phone: string;
      email?: string;
    };
    updatedAt: string;
  }>;
  isLoading?: boolean;
  onCardClick?: (stateId: string) => void;
}

export default function FunnelStateKanban({
  states,
  isLoading = false,
  onCardClick,
}: FunnelStateKanbanProps) {
  const statuses: FunnelState[] = [
    'PENDING',
    'ACTIVE',
    'WAITING',
    'COMPLETED',
    'FAILED',
    'ARCHIVED',
  ];

  const groupedByStatus = statuses.reduce(
    (acc, status) => {
      acc[status] = states.filter((s) => s.status === status);
      return acc;
    },
    {} as Record<FunnelState, typeof states>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 overflow-x-auto">
      {statuses.map((status) => (
        <div
          key={status}
          className="flex flex-col rounded-lg bg-gray-50 p-4 min-w-[300px]"
        >
          {/* 컬럼 헤더 */}
          <div className="mb-4">
            <h3 className="font-semibold text-sm mb-1">
              {getStateLabel(status)}
            </h3>
            <div className="text-sm text-gray-500">
              {groupedByStatus[status].length}명
            </div>
          </div>

          {/* 카드 목록 */}
          <div className="space-y-2 flex-1">
            {groupedByStatus[status].map((state) => (
              <div
                key={state.id}
                className="cursor-pointer"
                onClick={() => onCardClick?.(state.id)}
              >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm truncate">
                    {state.contact.name}
                  </h4>
                  <p className="text-sm text-gray-500 truncate">
                    {state.contact.phone}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-sm font-medium px-2 py-1 rounded ${getStateColor(
                        status
                      )}`}
                    >
                      {getStateLabel(status)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(state.updatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
              </div>
            ))}

            {groupedByStatus[status].length === 0 && (
              <div className="flex items-center justify-center h-20 text-gray-600">
                <p className="text-sm">데이터 없음</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
