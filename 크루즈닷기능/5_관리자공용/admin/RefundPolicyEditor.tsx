// components/admin/RefundPolicyEditor.tsx
// 환불/취소 규정 구조화 에디터 — 출발일 기준 위약금 슬롯 입력

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2, FiSave, FiFolder, FiX } from 'react-icons/fi';
import { logger } from '@/lib/logger';
import { csrfFetch } from '@/lib/csrf-client';

interface RefundSlot {
  daysBeforeDep: number;  // 이 기간 이상 남았을 때 적용 (출발 X일 전 이상)
  penaltyRate: number;    // 위약금 % (0~100)
  refundRate?: number;    // 환불율 % (자동계산: 100 - penaltyRate)
  label?: string;
}

interface RefundPolicyEditorProps {
  content: string;
  onChange: (content: string) => void;
}

interface RefundPolicyGroup {
  id: number;
  name: string;
  description?: string;
  content: string;
  createdAt: string;
}

const DEFAULT_SLOTS: RefundSlot[] = [
  { daysBeforeDep: 121, penaltyRate: 0,   label: '위약금 없음' },
  { daysBeforeDep: 91,  penaltyRate: 10,  label: '신청금' },
  { daysBeforeDep: 71,  penaltyRate: 25  },
  { daysBeforeDep: 46,  penaltyRate: 50  },
  { daysBeforeDep: 21,  penaltyRate: 75  },
  { daysBeforeDep: 0,   penaltyRate: 100, label: '당일 포함' },
];

// 슬롯 배열 → text 문자열 (parseRefundPolicyText가 파싱 가능한 형식)
function slotsToText(slots: RefundSlot[]): string {
  if (!slots.length) return '';
  const sorted = [...slots].sort((a, b) => b.daysBeforeDep - a.daysBeforeDep);
  return sorted.map((s, i) => {
    const next = sorted[i + 1];
    if (s.penaltyRate === 0) {
      return `${s.daysBeforeDep}일 전 = 취소 수수료 없음`;
    }
    const upper = next ? `${next.daysBeforeDep + 1}` : `${s.daysBeforeDep}`;
    const dayLabel = s.daysBeforeDep === 0 ? '출발일' : `${s.daysBeforeDep}일`;
    const rangeLabel = `여행 출발일 기준 ${upper}일 ~ ${dayLabel} 전까지`;
    if (s.label === '신청금') return `${rangeLabel} = 신청금`;
    return `${rangeLabel} = 여행 총액의 ${s.penaltyRate}%`;
  }).join('\n');
}

// text → 슬롯 배열 파싱 (기존 저장 데이터 복원용)
function textToSlots(text: string): RefundSlot[] {
  if (!text?.trim()) return DEFAULT_SLOTS;
  const slots: RefundSlot[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const noFee = line.match(/(\d+)일\s*전[^=]*=\s*취소\s*수수료\s*없음/);
    if (noFee) { slots.push({ daysBeforeDep: parseInt(noFee[1]), penaltyRate: 0, label: '위약금 없음' }); continue; }
    const rangePct = line.match(/(\d+)일\s*~\s*(\d+)일\s*전[^=]*=\s*여행\s*총액의\s*(\d+)%/);
    if (rangePct) { slots.push({ daysBeforeDep: parseInt(rangePct[2]), penaltyRate: parseInt(rangePct[3]) }); continue; }
    const toDepPct = line.match(/(\d+)일\s*~\s*출발일[^=]*=\s*여행\s*총액의\s*(\d+)%/);
    if (toDepPct) { slots.push({ daysBeforeDep: 0, penaltyRate: parseInt(toDepPct[2]), label: '당일 포함' }); continue; }
    const deposit = line.match(/(\d+)일\s*~\s*(\d+)일\s*전[^=]*=\s*신청금/);
    if (deposit) { slots.push({ daysBeforeDep: parseInt(deposit[2]), penaltyRate: 10, label: '신청금' }); continue; }
  }
  return slots.length > 0 ? slots : DEFAULT_SLOTS;
}

export default function RefundPolicyEditor({ content, onChange }: RefundPolicyEditorProps) {
  const [slots, setSlots] = useState<RefundSlot[]>(() => textToSlots(content));
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [savedGroups, setSavedGroups] = useState<RefundPolicyGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');

  // 슬롯 변경 시 text 문자열로 변환해서 부모에 전달
  const pushChange = useCallback((s: RefundSlot[]) => {
    onChange(slotsToText(s));
  }, [onChange]);

  // 외부에서 content가 바뀌면 슬롯 재파싱 (초기 로드 등)
  useEffect(() => {
    const parsed = textToSlots(content);
    setSlots(parsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 1회만

  // content가 비어있으면 기본값 설정
  useEffect(() => {
    if (!content?.trim()) {
      const def = DEFAULT_SLOTS;
      setSlots(def);
      pushChange(def);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSlot = (idx: number, field: keyof RefundSlot, value: string | number) => {
    const next = slots.map((s, i) => {
      if (i === idx) {
        const updated = { ...s, [field]: typeof value === 'string' ? value : Number(value) };
        // penaltyRate 변경 시 refundRate 자동계산
        if (field === 'penaltyRate') {
          updated.refundRate = 100 - Number(value);
        }
        return updated;
      }
      return s;
    });
    setSlots(next);
    pushChange(next);
  };

  const addSlot = () => {
    const next = [...slots, { daysBeforeDep: 0, penaltyRate: 0 }];
    setSlots(next);
    pushChange(next);
  };

  const removeSlot = (idx: number) => {
    const next = slots.filter((_, i) => i !== idx);
    setSlots(next);
    pushChange(next);
  };

  const sorted = [...slots].sort((a, b) => b.daysBeforeDep - a.daysBeforeDep);

  // 그룹 관리
  const loadGroups = async () => {
    try {
      const res = await fetch('/api/admin/refund-policy-groups', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); if (d.ok) setSavedGroups(d.groups || []); }
    } catch (e) { logger.error('Failed to load groups:', e); }
  };

  useEffect(() => { loadGroups(); }, []);

  const saveAsGroup = async () => {
    if (!newGroupName.trim()) return;
    const text = slotsToText(slots);
    try {
      const res = await csrfFetch('/api/admin/refund-policy-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim(), description: `슬롯 ${slots.length}개`, content: text }),
      });
      if (res.ok) { const d = await res.json(); if (d.ok) { setNewGroupName(''); loadGroups(); } }
    } catch (e) { logger.error('Failed to save group:', e); }
  };

  const loadGroup = async (groupId: number) => {
    try {
      const res = await fetch(`/api/admin/refund-policy-groups/${groupId}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        if (d.ok && d.group) {
          const parsed = textToSlots(d.group.content);
          setSlots(parsed);
          pushChange(parsed);
          setShowGroupManager(false);
        }
      }
    } catch (e) { logger.error('Failed to load group:', e); }
  };

  const deleteGroup = async (groupId: number) => {
    try {
      const res = await csrfFetch(`/api/admin/refund-policy-groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) loadGroups();
    } catch (e) { logger.error('Failed to delete group:', e); }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">환불/취소 규정</h3>
          <p className="text-xs text-gray-500 mt-0.5">출발일 기준 위약금 구간을 설정하세요. 저장 시 자동으로 계산에 활용됩니다.</p>
        </div>
        <button
          onClick={() => setShowGroupManager(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          <FiFolder size={14} />
          그룹 관리
        </button>
      </div>

      {/* 슬롯 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">출발 X일 전 이상</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">위약금 (%)</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">환불 (%)</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">메모</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((slot, i) => {
              const origIdx = slots.indexOf(slot);
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={slot.daysBeforeDep}
                      onChange={e => updateSlot(origIdx, 'daysBeforeDep', e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="ml-1.5 text-gray-500">일</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={slot.penaltyRate}
                      onChange={e => updateSlot(origIdx, 'penaltyRate', e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <span className="ml-1 text-gray-500">%</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-semibold ${slot.penaltyRate === 0 ? 'text-green-600' : slot.penaltyRate >= 100 ? 'text-red-600' : 'text-orange-600'}`}>
                      {100 - slot.penaltyRate}%
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={slot.label || ''}
                      onChange={e => updateSlot(origIdx, 'label', e.target.value)}
                      placeholder="메모 (선택)"
                      className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 focus:ring-1 focus:ring-blue-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => removeSlot(origIdx)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={addSlot}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <FiPlus size={16} />
            구간 추가
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        예: 출발 30일 이상 전 → 위약금 0% = 전액 환불 / 출발 0일 이상(당일) → 위약금 100% = 환불 불가
      </p>

      {/* 그룹 관리 모달 */}
      {showGroupManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">환불규정 그룹 관리</h3>
              <button onClick={() => setShowGroupManager(false)} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">저장된 그룹 불러오기</p>
                {savedGroups.length === 0
                  ? <p className="text-sm text-gray-500">저장된 그룹이 없습니다.</p>
                  : (
                    <div className="space-y-2">
                      {savedGroups.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{g.name}</p>
                            <p className="text-xs text-gray-400">{new Date(g.createdAt).toLocaleDateString('ko-KR')}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => loadGroup(g.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">불러오기</button>
                            <button onClick={() => deleteGroup(g.id)} className="px-3 py-1.5 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200">삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">현재 규정 저장</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="그룹 이름 (예: 기본 환불규정)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => e.key === 'Enter' && saveAsGroup()}
                  />
                  <button onClick={saveAsGroup} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                    <FiSave size={14} />저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
