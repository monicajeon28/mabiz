'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Monitor,
  Image as ImageIcon,
  Code,
  CreditCard,
  MessageSquare,
  Mail,
  Globe,
  Settings,
  User,
  Phone,
  AtSign,
  MapPin,
  Calendar,
  Heart,
  CheckCircle2,
} from 'lucide-react';

/* ──────────────────────────── Types ──────────────────────────── */

interface FieldConfig {
  enabled: boolean;
  required: boolean;
}

interface AdditionalField {
  id: string;
  name: string;
  required: boolean;
}

interface FormState {
  title: string;
  slug: string;
  htmlContent: string;
  editorMode: 'html' | 'image';
  partnerId: string;
  formConfig: {
    fields: {
      name: FieldConfig;
      phone: FieldConfig;
      email: FieldConfig;
      gender: FieldConfig;
      birthDate: FieldConfig;
      address: FieldConfig;
      marketingConsent: FieldConfig;
    };
    additionalFields: AdditionalField[];
    b2bEduType: string;
  };
  buttonTitle: string;
  paymentEnabled: boolean;
  paymentType: string;
  productName: string;
  productPrice: string;
  cycleDay: string;
  expireDate: string;
  commentEnabled: boolean;
  regEmailEnabled: boolean;
  regEmailSubject: string;
  regEmailContent: string;
  exposureTitle: string;
  exposureImage: string;
  footerText: string;
  completionPageUrl: string;
  description: string;
  headerScript: string;
}

type FieldKey = keyof FormState['formConfig']['fields'];

/* ──────────────────────────── Constants ──────────────────────────── */

const FIELD_LABELS: Record<FieldKey, { label: string; icon: React.ReactNode }> = {
  name: { label: '이름', icon: <User size={14} /> },
  phone: { label: '연락처', icon: <Phone size={14} /> },
  email: { label: '이메일', icon: <AtSign size={14} /> },
  gender: { label: '성별', icon: <Heart size={14} /> },
  birthDate: { label: '생년월일', icon: <Calendar size={14} /> },
  address: { label: '주소', icon: <MapPin size={14} /> },
  marketingConsent: { label: '마케팅동의', icon: <CheckCircle2 size={14} /> },
};

const INITIAL_STATE: FormState = {
  title: '',
  slug: '',
  htmlContent: '',
  editorMode: 'html',
  partnerId: '',
  formConfig: {
    fields: {
      name: { enabled: true, required: true },
      phone: { enabled: true, required: true },
      email: { enabled: false, required: false },
      gender: { enabled: false, required: false },
      birthDate: { enabled: false, required: false },
      address: { enabled: false, required: false },
      marketingConsent: { enabled: false, required: false },
    },
    additionalFields: [],
    b2bEduType: '',
  },
  buttonTitle: '신청하기',
  paymentEnabled: false,
  paymentType: 'onetime',
  productName: '',
  productPrice: '',
  cycleDay: '',
  expireDate: '',
  commentEnabled: false,
  regEmailEnabled: false,
  regEmailSubject: '',
  regEmailContent: '',
  exposureTitle: '',
  exposureImage: '',
  footerText: '',
  completionPageUrl: '',
  description: '',
  headerScript: '',
};

/* ──────────────────────────── Collapsible Section ──────────────────────────── */

function Section({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-gray-700">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

/* ──────────────────────────── Main Page ──────────────────────────── */

export default function B2BEditorNewPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /* ── helpers ── */

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleField = useCallback((key: FieldKey) => {
    setForm((prev) => {
      const field = prev.formConfig.fields[key];
      const enabled = !field.enabled;
      return {
        ...prev,
        formConfig: {
          ...prev.formConfig,
          fields: {
            ...prev.formConfig.fields,
            [key]: { enabled, required: enabled ? field.required : false },
          },
        },
      };
    });
  }, []);

  const setFieldRequired = useCallback((key: FieldKey, required: boolean) => {
    setForm((prev) => ({
      ...prev,
      formConfig: {
        ...prev.formConfig,
        fields: {
          ...prev.formConfig.fields,
          [key]: { ...prev.formConfig.fields[key], required },
        },
      },
    }));
  }, []);

  const addAdditionalField = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      formConfig: {
        ...prev.formConfig,
        additionalFields: [
          ...prev.formConfig.additionalFields,
          { id: crypto.randomUUID(), name: '', required: false },
        ],
      },
    }));
  }, []);

  const removeAdditionalField = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      formConfig: {
        ...prev.formConfig,
        additionalFields: prev.formConfig.additionalFields.filter((f) => f.id !== id),
      },
    }));
  }, []);

  const updateAdditionalField = useCallback(
    (id: string, patch: Partial<AdditionalField>) => {
      setForm((prev) => ({
        ...prev,
        formConfig: {
          ...prev.formConfig,
          additionalFields: prev.formConfig.additionalFields.map((f) =>
            f.id === id ? { ...f, ...patch } : f,
          ),
        },
      }));
    },
    [],
  );

  /* ── save ── */

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('페이지 제목을 입력해주세요.');
      return;
    }
    if (!form.slug.trim()) {
      setError('슬러그를 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        htmlContent: form.htmlContent,
        editorMode: form.editorMode,
        formConfig: form.formConfig,
        buttonTitle: form.buttonTitle || '신청하기',
        commentEnabled: form.commentEnabled,
        paymentEnabled: form.paymentEnabled,
      };

      if (form.partnerId) body.partnerId = form.partnerId;
      if (form.paymentEnabled) {
        body.paymentType = form.paymentType;
        body.productName = form.productName;
        body.productPrice = form.productPrice;
        if (form.paymentType === 'subscription') {
          body.cycleDay = form.cycleDay;
          body.expireDate = form.expireDate;
        }
      }
      if (form.regEmailEnabled) {
        body.regEmailEnabled = true;
        body.regEmailSubject = form.regEmailSubject;
        body.regEmailContent = form.regEmailContent;
      }
      if (form.exposureTitle) body.exposureTitle = form.exposureTitle;
      if (form.exposureImage) body.exposureImage = form.exposureImage;
      if (form.footerText) body.footerText = form.footerText;
      if (form.completionPageUrl) body.completionPageUrl = form.completionPageUrl;
      if (form.description) body.description = form.description;
      if (form.headerScript) body.headerScript = form.headerScript;

      const res = await fetch('/api/b2b-landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message || '저장에 실패했습니다.');
      }

      router.push(`/b2b-editor/${data.page.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  /* ── preview html ── */

  const previewHtml = useMemo(() => {
    const enabledFields = (
      Object.entries(form.formConfig.fields) as [FieldKey, FieldConfig][]
    )
      .filter(([, v]) => v.enabled)
      .map(
        ([k, v]) =>
          `<div style="margin-bottom:12px">
            <label style="display:block;font-size:13px;color:#374151;margin-bottom:4px;font-weight:500">
              ${FIELD_LABELS[k].label}${v.required ? ' <span style="color:#ef4444">*</span>' : ''}
            </label>
            <input style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none" placeholder="${FIELD_LABELS[k].label}" />
          </div>`,
      )
      .join('\n');

    const additionalHtml = form.formConfig.additionalFields
      .filter((f) => f.name.trim())
      .map(
        (f) =>
          `<div style="margin-bottom:12px">
            <label style="display:block;font-size:13px;color:#374151;margin-bottom:4px;font-weight:500">
              ${f.name}${f.required ? ' <span style="color:#ef4444">*</span>' : ''}
            </label>
            <input style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none" placeholder="${f.name}" />
          </div>`,
      )
      .join('\n');

    const paymentHtml = form.paymentEnabled
      ? `<div style="margin:16px 0;padding:12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
          <strong>${form.productName || '상품명'}</strong> — ${form.productPrice ? Number(form.productPrice).toLocaleString() + '원' : '가격 미정'}
          ${form.paymentType === 'subscription' ? '<br/><span style="font-size:12px">정기 결제</span>' : ''}
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; color:#111827; }
    .content { padding:20px 16px; }
    .form-area { padding:0 16px 24px; }
    .btn { display:block; width:100%; padding:14px; background:#eab308; color:#fff; font-size:16px; font-weight:700; border:none; border-radius:10px; cursor:pointer; text-align:center; }
    .btn:hover { background:#ca8a04; }
  </style>
</head>
<body>
  <div class="content">
    ${form.htmlContent || '<div style="text-align:center;padding:40px 0;color:#9ca3af;font-size:14px">HTML 콘텐츠를 입력하세요</div>'}
  </div>
  <div class="form-area">
    ${enabledFields}
    ${additionalHtml}
    ${paymentHtml}
    <button class="btn">${form.buttonTitle || '신청하기'}</button>
  </div>
</body>
</html>`;
  }, [form.htmlContent, form.formConfig, form.buttonTitle, form.paymentEnabled, form.paymentType, form.productName, form.productPrice]);

  /* ──────────────────────────── Render ──────────────────────────── */

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* ═══ LEFT PANEL ═══ */}
      <div className="flex-1 overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="페이지 제목"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="flex-1 text-lg font-bold border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
              <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-300 select-none">
                /b2b/p/
              </span>
              <input
                type="text"
                placeholder="slug"
                value={form.slug}
                onChange={(e) =>
                  set('slug', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))
                }
                className="w-40 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              <Save size={16} />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}
        </div>

        {/* Editor Content */}
        <div className="p-6 space-y-5 max-w-3xl">
          {/* ── Editor Mode Toggle ── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => set('editorMode', 'image')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.editorMode === 'image'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ImageIcon size={15} />
              이미지형
            </button>
            <button
              onClick={() => set('editorMode', 'html')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.editorMode === 'html'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Code size={15} />
              HTML형
            </button>
          </div>

          {form.editorMode === 'html' ? (
            <textarea
              value={form.htmlContent}
              onChange={(e) => set('htmlContent', e.target.value)}
              placeholder="HTML 콘텐츠를 입력하세요..."
              className="w-full min-h-[400px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white resize-y"
            />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center text-sm text-yellow-700">
              <ImageIcon size={24} className="mx-auto mb-2 text-yellow-500" />
              이미지 업로드는 저장 후 편집에서 가능합니다
            </div>
          )}

          {/* ── 파트너 설정 ── */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <User size={14} className="inline mr-1" />
              파트너 설정
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="파트너 ID (비워두면 글로벌)"
                value={form.partnerId}
                onChange={(e) => set('partnerId', e.target.value.trim())}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              {!form.partnerId && (
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                  글로벌(전체)
                </span>
              )}
            </div>
          </div>

          {/* ── 폼 필드 설정 ── */}
          <Section title="폼 필드 설정" icon={<Monitor size={16} />} defaultOpen>
            <div className="space-y-3">
              {/* Standard fields */}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(form.formConfig.fields) as FieldKey[]).map((key) => {
                  const field = form.formConfig.fields[key];
                  const meta = FIELD_LABELS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleField(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        field.enabled
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }`}
                    >
                      {meta.icon}
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {/* Required toggles for enabled fields */}
              <div className="space-y-2 mt-3">
                {(Object.keys(form.formConfig.fields) as FieldKey[])
                  .filter((k) => form.formConfig.fields[k].enabled)
                  .map((key) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={form.formConfig.fields[key].required}
                        onChange={(e) => setFieldRequired(key, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {FIELD_LABELS[key].label} - 필수
                    </label>
                  ))}
              </div>

              {/* Additional fields */}
              {form.formConfig.additionalFields.map((af) => (
                <div key={af.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="질문 이름"
                    value={af.name}
                    onChange={(e) => updateAdditionalField(af.id, { name: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={af.required}
                      onChange={(e) =>
                        updateAdditionalField(af.id, { required: e.target.checked })
                      }
                      className="rounded border-gray-300"
                    />
                    필수
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAdditionalField(af.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addAdditionalField}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus size={14} />
                질문 추가
              </button>

              {/* Button title */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm text-gray-600 mb-1">버튼 텍스트</label>
                <input
                  type="text"
                  value={form.buttonTitle}
                  onChange={(e) => set('buttonTitle', e.target.value)}
                  placeholder="신청하기"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              {/* B2B edu type */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm text-gray-600 mb-2">B2B 유형</label>
                <div className="flex gap-3">
                  {[
                    { value: 'inquiry', label: '문의자' },
                    { value: 'buyer', label: '구매자' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="b2bEduType"
                        value={opt.value}
                        checked={form.formConfig.b2bEduType === opt.value}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            formConfig: { ...prev.formConfig, b2bEduType: e.target.value },
                          }))
                        }
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── 결제 설정 ── */}
          <Section title="결제 설정" icon={<CreditCard size={16} />}>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.paymentEnabled}
                  onChange={(e) => set('paymentEnabled', e.target.checked)}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 w-5 h-5"
                />
                결제 기능 활성화
              </label>

              {form.paymentEnabled && (
                <div className="space-y-3 pl-2 border-l-2 border-yellow-300">
                  <div className="flex gap-3">
                    {[
                      { value: 'onetime', label: '1회 결제' },
                      { value: 'subscription', label: '정기 결제' },
                    ].map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="radio"
                          name="paymentType"
                          value={opt.value}
                          checked={form.paymentType === opt.value}
                          onChange={(e) => set('paymentType', e.target.value)}
                          className="text-yellow-500 focus:ring-yellow-400"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="상품명"
                    value={form.productName}
                    onChange={(e) => set('productName', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <input
                    type="text"
                    placeholder="금액 (원)"
                    value={form.productPrice}
                    onChange={(e) =>
                      set('productPrice', e.target.value.replace(/[^0-9]/g, ''))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />

                  {form.paymentType === 'subscription' && (
                    <input
                      type="text"
                      placeholder="결제 주기일 (예: 15)"
                      value={form.cycleDay}
                      onChange={(e) =>
                        set('cycleDay', e.target.value.replace(/[^0-9]/g, ''))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* ── 후기 설정 ── */}
          <Section title="후기 설정" icon={<MessageSquare size={16} />}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.commentEnabled}
                  onChange={(e) => set('commentEnabled', e.target.checked)}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 w-5 h-5"
                />
                후기 섹션 활성화
              </label>
              <p className="text-xs text-gray-400">
                저장 후 AI 후기 자동 생성 가능
              </p>
            </div>
          </Section>

          {/* ── 이메일 설정 ── */}
          <Section title="이메일 설정" icon={<Mail size={16} />}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.regEmailEnabled}
                  onChange={(e) => set('regEmailEnabled', e.target.checked)}
                  className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 w-5 h-5"
                />
                신청 완료 이메일 발송
              </label>

              {form.regEmailEnabled && (
                <div className="space-y-3 pl-2 border-l-2 border-yellow-300">
                  <input
                    type="text"
                    placeholder="[고객명]님, 신청이 완료되었습니다"
                    value={form.regEmailSubject}
                    onChange={(e) => set('regEmailSubject', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <textarea
                    placeholder="이메일 본문을 입력하세요..."
                    value={form.regEmailContent}
                    onChange={(e) => set('regEmailContent', e.target.value)}
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                  />
                </div>
              )}
            </div>
          </Section>

          {/* ── OG/노출 설정 ── */}
          <Section title="OG/노출 설정" icon={<Globe size={16} />}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">노출 제목</label>
                <input
                  type="text"
                  placeholder="검색엔진/SNS 공유 시 표시될 제목"
                  value={form.exposureTitle}
                  onChange={(e) => set('exposureTitle', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">푸터 텍스트</label>
                <textarea
                  placeholder="페이지 하단에 표시될 텍스트"
                  value={form.footerText}
                  onChange={(e) => set('footerText', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                />
              </div>
            </div>
          </Section>

          {/* ── 고급 설정 ── */}
          <Section title="고급 설정" icon={<Settings size={16} />}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">완료 후 리다이렉트 URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/thank-you"
                  value={form.completionPageUrl}
                  onChange={(e) => set('completionPageUrl', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">설명 (내부 메모)</label>
                <input
                  type="text"
                  placeholder="이 페이지에 대한 내부 메모"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">헤더 스크립트</label>
                <textarea
                  placeholder="<script>...</script> 또는 추적 코드"
                  value={form.headerScript}
                  onChange={(e) => set('headerScript', e.target.value)}
                  rows={4}
                  className="w-full font-mono text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                />
              </div>
            </div>
          </Section>

          {/* Spacer at bottom */}
          <div className="h-10" />
        </div>
      </div>

      {/* ═══ RIGHT PANEL — iPhone Preview ═══ */}
      <div className="w-[380px] flex-shrink-0 border-l border-gray-200 bg-gray-100 flex items-start justify-center p-6 overflow-y-auto">
        <div className="relative">
          {/* iPhone Frame */}
          <div className="w-[320px] h-[640px] bg-black rounded-[40px] p-[10px] shadow-2xl">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />

            {/* Screen */}
            <div className="w-full h-full bg-white rounded-[30px] overflow-hidden relative">
              {/* Status bar area */}
              <div className="h-[44px] bg-white flex items-end justify-center pb-1">
                <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                  {form.title || '새 페이지'}
                </span>
              </div>

              {/* Content */}
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: 'calc(100% - 68px)' }}
                sandbox="allow-same-origin"
                title="미리보기"
              />

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-gray-300 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
