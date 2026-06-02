'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface GroupFormProps {
  groups: { id: string; name: string }[];
  funnels: { id: string; name: string }[];
  funnelSmsList: { id: string; title: string }[];
  funnelEmailList: { id: string; name: string }[];
  csrfToken: string;
  onClose: () => void;
  onCreated: () => void;
}

type ReEntryPolicy =
  | 'KEEP_TIME_KEEP_DATA'
  | 'RESET_TIME_KEEP_DATA'
  | 'RESET_ALL_RESTART';

export function GroupForm({
  groups,
  funnels,
  funnelSmsList,
  funnelEmailList,
  csrfToken,
  onClose,
  onCreated,
}: GroupFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [parentGroupId, setParentGroupId] = useState('');
  const [description, setDescription] = useState('');

  // 퍼널톡 3개
  const [funnelIds, setFunnelIds] = useState<[string, string, string]>(['', '', '']);
  // 퍼널문자 3개
  const [funnelSmsIds, setFunnelSmsIds] = useState<[string, string, string]>(['', '', '']);
  // 퍼널메일 3개
  const [funnelEmailIds, setFunnelEmailIds] = useState<[string, string, string]>(['', '', '']);

  const [reEntryPolicy, setReEntryPolicy] = useState<ReEntryPolicy>('KEEP_TIME_KEEP_DATA');

  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [autoMoveDays, setAutoMoveDays] = useState('');
  const [autoMoveTargetGroupId, setAutoMoveTargetGroupId] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleFunnelChange = (idx: number, val: string) => {
    setFunnelIds((prev) => {
      const next = [...prev] as [string, string, string];
      next[idx] = val;
      return next;
    });
  };

  const handleSmsChange = (idx: number, val: string) => {
    setFunnelSmsIds((prev) => {
      const next = [...prev] as [string, string, string];
      next[idx] = val;
      return next;
    });
  };

  const handleEmailChange = (idx: number, val: string) => {
    setFunnelEmailIds((prev) => {
      const next = [...prev] as [string, string, string];
      next[idx] = val;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setFormError('그룹 이름은 필수입니다.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        category: category.trim() || null,
        parentGroupId: parentGroupId || null,
        description: description.trim() || null,
        funnelIds: funnelIds.filter(Boolean),
        funnelSmsIds: funnelSmsIds.filter(Boolean),
        funnelEmailIds: funnelEmailIds.filter(Boolean),
        reEntryPolicy,
        autoMoveEnabled,
      };
      if (autoMoveEnabled) {
        body.autoMoveDays = autoMoveDays ? parseInt(autoMoveDays, 10) : undefined;
        body.autoMoveTargetGroupId = autoMoveTargetGroupId || undefined;
      }

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok: boolean; message?: string; error?: string };
      if (data.ok) {
        onCreated();
        onClose();
      } else {
        setFormError(data.message || data.error || '그룹 생성에 실패했습니다.');
      }
    } catch {
      setFormError('서버와 통신 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">그룹 만들기</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 폼 바디 */}
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <tbody>
              {/* 이름 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 w-28 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  이름 <span className="text-red-500">*</span>
                </td>
                <td className="py-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="그룹 이름을 입력하세요"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </td>
              </tr>

              {/* 대분류 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  대분류
                </td>
                <td className="py-3">
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="※ 카테고리 분류"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </td>
              </tr>

              {/* 그룹묶음 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  그룹묶음
                </td>
                <td className="py-3">
                  <select
                    value={parentGroupId}
                    onChange={(e) => setParentGroupId(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="">그룹들을 묶을수 있습니다</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </td>
              </tr>

              {/* 그룹설명 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  그룹설명
                </td>
                <td className="py-3">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="그룹에 대한 간단한 설명"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </td>
              </tr>

              {/* 퍼널톡 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  퍼널톡
                </td>
                <td className="py-3 space-y-2">
                  {([0, 1, 2] as const).map((i) => (
                    <select
                      key={i}
                      value={funnelIds[i]}
                      onChange={(e) => handleFunnelChange(i, e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                    >
                      <option value="">연결할 퍼널톡 선택</option>
                      {funnels.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ))}
                </td>
              </tr>

              {/* 퍼널문자 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  퍼널문자
                </td>
                <td className="py-3 space-y-2">
                  {([0, 1, 2] as const).map((i) => (
                    <select
                      key={i}
                      value={funnelSmsIds[i]}
                      onChange={(e) => handleSmsChange(i, e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                    >
                      <option value="">연결할 퍼널문자 선택</option>
                      {funnelSmsList.map((f) => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                  ))}
                </td>
              </tr>

              {/* 퍼널메일 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  퍼널메일
                </td>
                <td className="py-3 space-y-2">
                  {([0, 1, 2] as const).map((i) => (
                    <select
                      key={i}
                      value={funnelEmailIds[i]}
                      onChange={(e) => handleEmailChange(i, e.target.value)}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                    >
                      <option value="">연결할 퍼널메일 선택</option>
                      {funnelEmailList.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ))}
                </td>
              </tr>

              {/* 재유입 처리 설정 */}
              <tr className="border-b border-gray-100">
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  재유입 처리 설정
                </td>
                <td className="py-3 space-y-2">
                  {(
                    [
                      {
                        value: 'KEEP_TIME_KEEP_DATA' as ReEntryPolicy,
                        label: '유입시간변경 X, 고객정보변경 O',
                      },
                      {
                        value: 'RESET_TIME_KEEP_DATA' as ReEntryPolicy,
                        label: '유입시간변경 O, 고객정보변경 O',
                      },
                      {
                        value: 'RESET_ALL_RESTART' as ReEntryPolicy,
                        label: '유입시간변경 O, 고객정보변경 O (*0일차 퍼널 부터 다시 시작)',
                      },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reEntryPolicy"
                        value={opt.value}
                        checked={reEntryPolicy === opt.value}
                        onChange={() => setReEntryPolicy(opt.value)}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </td>
              </tr>

              {/* 그룹 자동 이동 설정 */}
              <tr>
                <td className="py-3 pr-4 text-gray-700 font-medium whitespace-nowrap align-top pt-3.5">
                  그룹 자동 이동 설정
                </td>
                <td className="py-3 space-y-3">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="autoMove"
                        checked={!autoMoveEnabled}
                        onChange={() => setAutoMoveEnabled(false)}
                        className="shrink-0"
                      />
                      <span className="text-sm text-gray-700">미사용</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="autoMove"
                        checked={autoMoveEnabled}
                        onChange={() => setAutoMoveEnabled(true)}
                        className="shrink-0"
                      />
                      <span className="text-sm text-gray-700">사용</span>
                    </label>
                  </div>

                  {autoMoveEnabled && (
                    <div className="space-y-2 pl-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-20 shrink-0">대상 일자</span>
                        <input
                          type="number"
                          min={1}
                          value={autoMoveDays}
                          onChange={(e) => setAutoMoveDays(e.target.value)}
                          placeholder="일 수 입력"
                          className="w-32 border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        />
                        <span className="text-sm text-gray-500">일</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-20 shrink-0">대상 그룹</span>
                        <select
                          value={autoMoveTargetGroupId}
                          onChange={(e) => setAutoMoveTargetGroupId(e.target.value)}
                          className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                          <option value="">그룹명 선택</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 에러 */}
          {formError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {formError}
            </p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="px-5 py-2 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
