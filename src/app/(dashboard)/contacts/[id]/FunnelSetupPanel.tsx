"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";
import { useToast } from "@/lib/api/use-toast";
import { logger } from "@/lib/logger";

interface FunnelTemplate {
  id: string;
  lens: "L1" | "L3" | "L10";
  name: string;
  badge: "추천" | "인기" | "최신";
  messages: {
    day0: string;
    day1: string;
    day2: string;
    day3: string;
  };
  description: string;
}

const FUNNEL_TEMPLATES: Record<string, FunnelTemplate[]> = {
  L1: [
    {
      id: "l1_value_redefinition",
      lens: "L1",
      name: "가치 재정의",
      badge: "추천",
      description: "가격이 비싼 고객들께 가치를 강조하는 전략",
      messages: {
        day0: "가격이 아닌 가치를 봐주세요",
        day1: "월 60만원 = 5성급 호텔 1박",
        day2: "할부 가능합니다",
        day3: "지금 신청하면 30만원 할인",
      },
    },
    {
      id: "l1_easy_payment",
      lens: "L1",
      name: "쉬운 결제",
      badge: "인기",
      description: "결제 방식을 강조하는 전략",
      messages: {
        day0: "결제가 걱정되세요?",
        day1: "신용카드 무이자 할부 가능",
        day2: "선금 50만원만 먼저 내시고",
        day3: "남은 금액은 출발 전 결제",
      },
    },
    {
      id: "l1_dont_give_up",
      lens: "L1",
      name: "포기하지 마세요",
      badge: "최신",
      description: "감정적 재연결을 통한 전략",
      messages: {
        day0: "가격 때문에 포기하고 싶으신가요?",
        day1: "한국인 고객의 평균 비용입니다",
        day2: "한 번의 기회를 놓치면...",
        day3: "다음 해는 더 비싸집니다!",
      },
    },
  ],
  L3: [
    {
      id: "l3_comparison_table",
      lens: "L3",
      name: "비교표 제시",
      badge: "추천",
      description: "경쟁사와의 직접 비교를 보여주는 전략",
      messages: {
        day0: "Royal과 비교해보셨나요?",
        day1: "우리만의 5가지 강점입니다",
        day2: "비교 문서를 다운로드하세요",
        day3: "결국 우리가 더 좋습니다",
      },
    },
    {
      id: "l3_korean_guide",
      lens: "L3",
      name: "한국인 가이드",
      badge: "인기",
      description: "한국인 가이드 서비스를 차별화하는 전략",
      messages: {
        day0: "Royal은 있지만 우리만 있어요",
        day1: "한국인 24시간 투어 가이드",
        day2: "긴급 상황 때 한국말로 즉시",
        day3: "이 서비스는 우리만 제공합니다",
      },
    },
    {
      id: "l3_customer_reviews",
      lens: "L3",
      name: "고객 후기",
      badge: "최신",
      description: "실제 고객 후기로 신뢰도를 높이는 전략",
      messages: {
        day0: "Royal 다녀왔던 고객들 이야기",
        day1: '"Royal보다 우리가 낫더라"',
        day2: '"한국인 가이드 때문에 선택했어"',
        day3: '"다음에도 우리로 가겠습니다"',
      },
    },
  ],
  L10: [
    {
      id: "l10_discount_emphasis",
      lens: "L10",
      name: "할인 강조",
      badge: "추천",
      description: "긴급 할인을 강조하는 전략",
      messages: {
        day0: "이미 결정하셨나요?",
        day1: "지금이 최저가입니다",
        day2: "내일 가격이 올라갑니다",
        day3: "지금 신청하면 30% 추가할인!",
      },
    },
    {
      id: "l10_scarcity",
      lens: "L10",
      name: "남은 자리",
      badge: "인기",
      description: "희소성을 강조하는 전략",
      messages: {
        day0: "남은 자리가 2석입니다",
        day1: "이 가격은 마지막입니다",
        day2: "내일이 마감일입니다",
        day3: "지금이 최후의 기회입니다",
      },
    },
    {
      id: "l10_loss_aversion",
      lens: "L10",
      name: "포기 방지",
      badge: "최신",
      description: "손실회피 심리를 활용하는 전략",
      messages: {
        day0: "이 기회를 놓치면...",
        day1: "다음 크루즈는 90일 뒤",
        day2: "그땐 가격이 400만원",
        day3: "지금 신청하세요! 250만원",
      },
    },
  ],
};

interface FunnelSetupPanelProps {
  contactId: string;
  contactName: string;
}

export function FunnelSetupPanel({ contactId, contactName }: FunnelSetupPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [l1Enabled, setL1Enabled] = useState(false);
  const [l1Template, setL1Template] = useState<string>("l1_value_redefinition");
  const [l3Enabled, setL3Enabled] = useState(false);
  const [l3Template, setL3Template] = useState<string>("l3_comparison_table");
  const [l10Enabled, setL10Enabled] = useState(false);
  const [l10Template, setL10Template] = useState<string>("l10_discount_emphasis");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState<"L1" | "L3" | "L10" | null>(null);

  const handleSave = async () => {
    if (!l1Enabled && !l3Enabled && !l10Enabled) {
      toast({
        title: "설정 필요",
        description: "최소 1개 이상의 렌즈를 활성화해주세요.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/funnel-setup`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          l1_enabled: l1Enabled,
          l1_template: l1Template,
          l3_enabled: l3Enabled,
          l3_template: l3Template,
          l10_enabled: l10Enabled,
          l10_template: l10Template,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({
          title: "저장 완료",
          description: "자동 메시지 설정이 저장되었습니다.",
          variant: "default",
        });
        setIsOpen(false);
      } else {
        toast({
          title: "저장 실패",
          description: data.message ?? "다시 시도해주세요.",
          variant: "destructive",
        });
        logger.error("[FunnelSetupPanel] save error", { message: data.message });
      }
    } catch (err) {
      toast({
        title: "네트워크 오류",
        description: "설정 저장에 실패했습니다.",
        variant: "destructive",
      });
      logger.error("[FunnelSetupPanel] network error", { err });
    } finally {
      setSaving(false);
    }
  };

  const getSelectedTemplate = (lens: "L1" | "L3" | "L10"): FunnelTemplate | undefined => {
    const templates = FUNNEL_TEMPLATES[lens];
    const templateId = lens === "L1" ? l1Template : lens === "L3" ? l3Template : l10Template;
    return templates.find((t) => t.id === templateId);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-lg">🔄</span>
          신청 후 자동 메시지 설정 (4일간)
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="px-4 py-4 border-t border-gray-100 space-y-6">
          {/* Info Banner */}
          <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">고객 유형별 자동 메시지 발송</p>
              <p className="text-xs mt-1">
                고객 성향에 맞게 신청 후 4일간 자동으로 메시지가 발송됩니다. 드롭다운 선택만으로 완성!
              </p>
            </div>
          </div>

          {/* Lens Configuration Sections */}
          <div className="space-y-5">
            {/* L1: Price Sensitivity */}
            <LensSection
              lens="L1"
              lensName="🔴 가격이 부담스러운 고객"
              description="가격이 비싼 고객들께 보낼 메시지"
              enabled={l1Enabled}
              onEnabledChange={setL1Enabled}
              template={l1Template}
              onTemplateChange={setL1Template}
              templates={FUNNEL_TEMPLATES.L1}
              showPreview={showPreview === "L1"}
              onShowPreview={() => setShowPreview(showPreview === "L1" ? null : "L1")}
              selectedTemplate={getSelectedTemplate("L1")}
            />

            {/* L3: Competitive Comparison */}
            <LensSection
              lens="L3"
              lensName="🔵 다른 상품과 비교하는 고객"
              description="경쟁사와 비교하는 고객들께 보낼 메시지"
              enabled={l3Enabled}
              onEnabledChange={setL3Enabled}
              template={l3Template}
              onTemplateChange={setL3Template}
              templates={FUNNEL_TEMPLATES.L3}
              showPreview={showPreview === "L3"}
              onShowPreview={() => setShowPreview(showPreview === "L3" ? null : "L3")}
              selectedTemplate={getSelectedTemplate("L3")}
            />

            {/* L10: Immediate Purchase */}
            <LensSection
              lens="L10"
              lensName="🟢 바로 구매하고 싶은 고객"
              description="지금 바로 사고 싶어하는 고객들께 보낼 메시지"
              enabled={l10Enabled}
              onEnabledChange={setL10Enabled}
              template={l10Template}
              onTemplateChange={setL10Template}
              templates={FUNNEL_TEMPLATES.L10}
              showPreview={showPreview === "L10"}
              onShowPreview={() => setShowPreview(showPreview === "L10" ? null : "L10")}
              selectedTemplate={getSelectedTemplate("L10")}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving || (!l1Enabled && !l3Enabled && !l10Enabled)}
              className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface LensSectionProps {
  lens: "L1" | "L3" | "L10";
  lensName: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  template: string;
  onTemplateChange: (template: string) => void;
  templates: FunnelTemplate[];
  showPreview: boolean;
  onShowPreview: () => void;
  selectedTemplate?: FunnelTemplate;
}

function LensSection({
  lensName,
  description,
  enabled,
  onEnabledChange,
  template,
  onTemplateChange,
  templates,
  showPreview,
  onShowPreview,
  selectedTemplate,
}: LensSectionProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-purple-600 cursor-pointer"
            aria-label={`${lensName} 활성화`}
          />
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">{lensName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
      </div>

      {/* Template Selector (Enabled Only) */}
      {enabled && (
        <>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 block">
              📝 메시지 템플릿 선택
            </label>
            <div className="relative">
              <select
                value={template}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.badge === "추천" ? "💡" : t.badge === "인기" ? "✨" : "🔥"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview Button */}
          <button
            onClick={onShowPreview}
            className="w-full mt-3 px-3 py-2 text-xs font-medium text-purple-600 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
          >
            {showPreview ? "미리보기 닫기" : "📱 Day 0-3 미리보기"}
          </button>

          {/* Preview Panel */}
          {showPreview && selectedTemplate && (
            <PreviewPanel selectedTemplate={selectedTemplate} />
          )}
        </>
      )}
    </div>
  );
}

interface PreviewPanelProps {
  selectedTemplate: FunnelTemplate;
}

function PreviewPanel({ selectedTemplate }: PreviewPanelProps) {
  return (
    <div className="mt-4 space-y-3 bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-600 mb-3">📱 발송 미리보기</p>

      {/* Day 0 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-1">
        <p className="text-xs font-bold text-purple-900">📱 Day 0 (신청 직후)</p>
        <p className="text-sm text-purple-800 leading-relaxed">{selectedTemplate.messages.day0}</p>
        <p className="text-xs text-purple-600 mt-1">⏰ 신청 후 즉시 발송</p>
      </div>

      {/* Day 1 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
        <p className="text-xs font-bold text-blue-900">📱 Day 1 (1일 후)</p>
        <p className="text-sm text-blue-800 leading-relaxed">{selectedTemplate.messages.day1}</p>
        <p className="text-xs text-blue-600 mt-1">⏰ 내일 오전 10시</p>
      </div>

      {/* Day 2 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
        <p className="text-xs font-bold text-green-900">📱 Day 2 (2일 후)</p>
        <p className="text-sm text-green-800 leading-relaxed">{selectedTemplate.messages.day2}</p>
        <p className="text-xs text-green-600 mt-1">⏰ 모레 오전 10시</p>
      </div>

      {/* Day 3 */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
        <p className="text-xs font-bold text-orange-900">📱 Day 3 (3일 후)</p>
        <p className="text-sm text-orange-800 leading-relaxed">{selectedTemplate.messages.day3}</p>
        <p className="text-xs text-orange-600 mt-1">⏰ 모레 오후 오전 10시</p>
      </div>

      {/* Info */}
      <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
        💡 이 메시지들은 저장 후 고객에게 자동으로 발송됩니다.
      </div>
    </div>
  );
}
