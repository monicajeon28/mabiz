'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface ContactGroup {
  id: string;
  name: string;
  _count: { members: number };
}

interface StepOneProps {
  formData: { title: string; groupId: string };
  groups: ContactGroup[];
  loading: boolean;
  onNext: () => void;
  onChange: (field: string, value: string) => void;
}

export default function StepOne({
  formData,
  groups,
  loading,
  onNext,
  onChange,
}: StepOneProps) {
  const isValid = formData.title.trim() && formData.groupId;
  const selectedGroup = groups.find((g) => g.id === formData.groupId);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">1단계: 캠페인명 + 타겟 그룹</h2>
        <p className="text-sm text-gray-600 mt-1">캠페인명을 입력하고 발송할 고객 그룹을 선택하세요.</p>
      </div>

      <div className="space-y-4">
        {/* 캠페인명 입력 */}
        <div>
          <label className="block text-sm font-medium mb-2">캠페인명</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="예: 5월 VIP 고객 재구매 캠페인"
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <p className="text-sm text-gray-500 mt-1">{formData.title.length}/100자</p>
        </div>

        {/* 그룹 선택 */}
        <div>
          <label className="block text-sm font-medium mb-2">타겟 그룹</label>
          {groups.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              아직 생성된 그룹이 없습니다. 먼저 고객 그룹을 만들어주세요.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                    formData.groupId === group.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="groupId"
                    value={group.id}
                    checked={formData.groupId === group.id}
                    onChange={(e) => onChange('groupId', e.target.value)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-500">멤버 {group._count.members}명</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 그룹 정보 */}
        {selectedGroup && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              ✓ <strong>{selectedGroup.name}</strong> 그룹의 <strong>{selectedGroup._count.members}</strong>명 고객에게 발송됩니다.
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={onNext}
        disabled={!isValid || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition"
      >
        다음 단계
      </Button>
    </div>
  );
}
