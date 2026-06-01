'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type Funnel = { id: string; name: string };

interface GroupFormProps {
  form: { name: string; description: string; color: string; funnelId: string };
  setForm: (form: { name: string; description: string; color: string; funnelId: string }) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (errors: Record<string, string>) => void;
  formError: string | null;
  setFormError: (error: string | null) => void;
  saving: boolean;
  funnels: Funnel[];
  onSubmit: () => void;
  onCancel: () => void;
}

const COLOR_OPTIONS = [
  "#1E2D4E", "#C9A84C", "#10B981", "#3B82F6",
  "#8B5CF6", "#EF4444", "#F59E0B", "#6B7280",
];

const COLOR_NAMES: Record<string, string> = {
  "#1E2D4E": "네이비",
  "#C9A84C": "골드",
  "#10B981": "초록",
  "#3B82F6": "파랑",
  "#8B5CF6": "보라",
  "#EF4444": "빨강",
  "#F59E0B": "주황",
  "#6B7280": "회색",
};

export function GroupForm({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  formError,
  setFormError,
  saving,
  funnels,
  onSubmit,
  onCancel,
}: GroupFormProps) {
  return (
    <div className="bg-white border border-gold-300 rounded-xl p-5 mb-4 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-4">새 그룹 만들기</h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-gray-700 mb-1">
            그룹 이름 *
          </label>
          <input
            id="group-name"
            type="text"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setFieldErrors({ ...fieldErrors, name: '' });
            }}
            placeholder="예: 지중해 관심 고객"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
              fieldErrors.name
                ? 'border-red-500 focus:border-red-500'
                : 'border-gray-200 focus:border-gold-500'
            }`}
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? 'error-name' : undefined}
          />
          {fieldErrors.name && (
            <p id="error-name" className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="group-description" className="block text-sm font-medium text-gray-700 mb-1">
            설명
          </label>
          <input
            id="group-description"
            type="text"
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              setFieldErrors({ ...fieldErrors, description: '' });
            }}
            placeholder="이 그룹에 대한 간단한 설명"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
              fieldErrors.description
                ? 'border-red-500 focus:border-red-500'
                : 'border-gray-200 focus:border-gold-500'
            }`}
            aria-invalid={!!fieldErrors.description}
            aria-describedby={fieldErrors.description ? 'error-description' : undefined}
          />
          {fieldErrors.description && (
            <p id="error-description" className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.description}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setForm({ ...form, color: c });
                  setFieldErrors({ ...fieldErrors, color: '' });
                }}
                className={`w-7 h-7 rounded-full transition-transform ${
                  form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`${COLOR_NAMES[c]} 색상 선택`}
                title={`${COLOR_NAMES[c]} (${c})`}
                suppressHydrationWarning
              />
            ))}
          </div>
          {fieldErrors.color && (
            <p className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.color}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="group-funnel" className="block text-sm font-medium text-gray-700 mb-1">
            연결할 퍼널 <span className="text-sm text-gray-600 ml-1">(그룹 배정 시 자동 시작)</span>
          </label>
          <select
            id="group-funnel"
            value={form.funnelId}
            onChange={(e) => {
              setForm({ ...form, funnelId: e.target.value });
              setFieldErrors({ ...fieldErrors, funnelId: '' });
            }}
            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none ${
              fieldErrors.funnelId
                ? 'border-red-500 focus:border-red-500'
                : 'border-gray-200 focus:border-gold-500'
            }`}
            aria-invalid={!!fieldErrors.funnelId}
            aria-describedby={fieldErrors.funnelId ? 'error-funnelId' : undefined}
          >
            <option value="">퍼널 없음 (수동 발송만)</option>
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {fieldErrors.funnelId && (
            <p id="error-funnelId" className="text-base text-red-600 mt-2 font-medium bg-red-50 p-2 rounded">
              ⚠️ {fieldErrors.funnelId}
            </p>
          )}
          {form.funnelId && !fieldErrors.funnelId && (
            <p className="text-sm text-green-600 mt-1">✅ 이 그룹에 고객 배정 시 즉시 퍼널 시작</p>
          )}
        </div>
      </div>

      {formError && (
        <p className="text-base text-red-600 mt-3 font-medium bg-red-50 p-3 rounded">⚠️ {formError}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSubmit}
          disabled={saving || !form.name.trim()}
          className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-base font-medium hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? '저장 중...' : '그룹 만들기'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-200"
        >
          취소
        </button>
      </div>
    </div>
  );
}
