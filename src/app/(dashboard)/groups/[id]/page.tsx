"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Lock, Shield, Users } from "lucide-react";
import Link from "next/link";
import { showError, showSuccess } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";
import { TripleChoiceCTA } from "@/components/groups/TripleChoiceCTA";
import { OfferSection } from "@/components/groups/OfferSection";
import { Day0SMSPreview } from "@/components/groups/Day0SMSPreview";
import { TrustBadge } from "@/components/groups/TrustBadge";

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  funnelId: string | null;
  funnelName: string | null;
  _count: { members: number };
};

type MembershipTier = "basic" | "premium" | "vip";

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params?.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // L10 렌즈: 즉시구매 클로징 상태
  const [selectedTier, setSelectedTier] = useState<MembershipTier>("premium"); // 추천값으로 기본 선택
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [crmAction, setCrmAction] = useState<'apply' | 'consult' | null>(null);

  useEffect(() => {
    if (!groupId) return;

    const loadGroup = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        const data = await res.json() as {
          ok: boolean;
          group?: GroupDetail;
          message?: string;
        };

        if (data.ok && data.group) {
          setGroup(data.group);
        } else {
          setError(data.message || "그룹을 불러올 수 없습니다.");
          showError(data.message || "그룹을 불러올 수 없습니다.");
        }
      } catch (err) {
        logger.error("[GroupDetailPage] loadGroup", { err });
        setError("데이터를 불러올 수 없습니다.");
        showError("데이터를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadGroup();
  }, [groupId]);

  const handleJoin = async () => {
    if (!groupId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier, action: 'apply' }),
      });

      const data = await res.json() as {
        ok: boolean;
        message?: string;
        contactId?: string;
      };

      if (data.ok) {
        // L10 렌즈: Day 0 감정적 마무리 SMS 트리거
        // 3가지 변형 중 랜덤 선택 또는 A/B테스트
        const smsVariants = ['family', 'medical', 'timing'] as const;
        const selectedVariant = smsVariants[Math.floor(Math.random() * smsVariants.length)];

        if (data.contactId) {
          // CRM에 Day 0 SMS 발송 요청 (비동기 - 실패해도 계속 진행)
          fetch(`/api/sms/send-day0-emotional-finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactId: data.contactId,
              groupId,
              variant: selectedVariant,
            }),
          }).catch((err) => {
            logger.error('[GroupDetailPage] Day 0 SMS send', { err });
            // SMS 발송 실패는 무시 - 사용자 경험 영향 최소화
          });
        }

        setSubmitSuccess(true);
        setCrmAction('apply');
        showSuccess("가입이 완료되었습니다! 커뮤니티에 즉시 접근할 수 있습니다.");
        setTimeout(() => {
          // 성공 후 리다이렉트 또는 상태 초기화
          window.location.href = "/groups";
        }, 2000);
      } else {
        showError(data.message || "가입에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[GroupDetailPage] handleJoin", { err });
      showError("요청 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * L10 렌즈: 3중선택 CTA 핸들러
   * - "상담받기": CRM 상담 신청 기록 (Day 0 전화 스케줄)
   * - "지금 신청": 즉시 가입 처리 + Day 0 감정적 SMS
   */
  const handleTripleChoiceAction = async (action: 'apply' | 'consult') => {
    if (action === 'apply') {
      await handleJoin();
    } else if (action === 'consult') {
      // 상담 신청: CRM에 일정 자동 생성
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/groups/${groupId}/consult-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'consult' }),
        });

        const data = await res.json() as {
          ok: boolean;
          message?: string;
        };

        if (data.ok) {
          setCrmAction('consult');
          showSuccess("상담 신청이 완료되었습니다. 전문가가 곧 연락드리겠습니다.");
          setTimeout(() => {
            window.location.href = "/groups";
          }, 2000);
        } else {
          showError(data.message || "상담 신청에 실패했습니다.");
        }
      } catch (err) {
        logger.error('[GroupDetailPage] handleTripleChoiceAction consult', { err });
        showError("요청 처리 중 오류가 발생했습니다.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Link href="/groups" className="flex items-center gap-2 text-navy-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          그룹 목록으로
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-red-900 font-semibold">{error || "그룹을 찾을 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  // L10 렌즈 적용: 3가지 선택지 정의
  const tiers: Record<MembershipTier, {
    name: string;
    price: string;
    description: string;
    features: string[];
    recommended?: boolean;
    icon?: React.ReactNode;
  }> = {
    basic: {
      name: "기본",
      price: "$29",
      description: "가입 시 기본 커뮤니티 접근",
      features: [
        "커뮤니티 기본 채널 접근",
        "월 1회 그룹 화상통화",
        "이메일 지원",
      ],
      icon: <Users className="w-5 h-5" />,
    },
    premium: {
      name: "프리미엄",
      price: "$79",
      description: "권장하는 인기 옵션",
      features: [
        "전체 커뮤니티 채널 무제한 접근",
        "주 1회 전문가 상담",
        "월 2회 그룹 화상통화",
        "우선 이메일 지원 (24시간)",
        "리소스 라이브러리 접근",
      ],
      recommended: true,
      icon: <Shield className="w-5 h-5" />,
    },
    vip: {
      name: "VIP",
      price: "$199",
      description: "최고의 경험",
      features: [
        "모든 프리미엄 혜택",
        "주 2회 1:1 개인 상담",
        "주 1회 VIP 전용 화상통화",
        "24시간 우선 전화/채팅 지원",
        "월 1회 전략 수립 세션",
        "VIP 전용 커뮤니티 채널",
      ],
      icon: <Lock className="w-5 h-5" />,
    },
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 헤더: L7+L9 신뢰 강조 */}
      <div className="mb-8">
        <Link href="/groups" className="flex items-center gap-2 text-navy-900 hover:text-navy-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          그룹 목록으로
        </Link>

        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: group.color ?? "#6B7280" }}
          >
            {group.name[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-navy-900">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-gray-600 mt-1">{group.description}</p>
            )}
            <p className="text-sm text-purple-700 mt-2 font-semibold">
              👨‍👩‍👧‍👦 함께라서 더 강해져요 | 🏥 의료진 24시간 지원
            </p>
          </div>
        </div>
      </div>

      {/* L7 + L9: 신뢰 배지 섹션 */}
      <TrustBadge groupName={group.name} />

      {/* L10 렌즈: 특별 혜택 섹션 (시간/가격/수량 희소성) */}
      <OfferSection
        discountPercent={40}
        originalPrice={1500000}
        deadlineAt={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()}
        remainingSlots={3}
      />

      {/* L10 렌즈: 3중선택 CTA - 거부 불가능한 심리학 */}
      <TripleChoiceCTA
        groupId={groupId}
        groupName={group.name}
        onApply={() => handleTripleChoiceAction('apply')}
        onConsult={() => handleTripleChoiceAction('consult')}
        isLoading={isSubmitting}
      />

      {/* L10 렌즈: Day 0 감정적 마무리 SMS 미리보기 */}
      <Day0SMSPreview customerName="고객님" />

      {/* 멤버십 티어 상세 설명 (하단 참고용) */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 mt-8">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-navy-900 mb-2">
            멤버십 플랜 비교
          </h2>
          <p className="text-sm text-gray-600">
            가입 완료 시 <span className="font-semibold text-green-600">즉시 커뮤니티에 접근</span>할 수 있습니다.
          </p>
        </div>

        {/* 참고: 멤버십 플랜 상세 비교표 */}
        <div className="grid md:grid-cols-3 gap-4">
          {(Object.entries(tiers) as Array<[MembershipTier, typeof tiers[MembershipTier]]>).map(
            ([tierId, tier]) => (
              <div
                key={tierId}
                className={`relative border rounded-xl p-5 transition-all ${
                  tier.recommended
                    ? "border-green-400 bg-green-50 shadow-md ring-2 ring-green-200"
                    : "border-gray-200 bg-white"
                }`}
              >
                {/* 추천 배지 */}
                {tier.recommended && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      ⭐ 권장
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  {tier.icon && <span className="text-navy-900">{tier.icon}</span>}
                  <span className="font-bold text-gray-900">{tier.name}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{tier.description}</p>

                <div className="mb-4 pt-3 border-t border-gray-200">
                  <p className="text-2xl font-bold text-navy-900">{tier.price}</p>
                  <p className="text-xs text-gray-500">/월</p>
                </div>

                <ul className="space-y-2 text-xs text-gray-700">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </div>

      {/* 추가 정보 섹션 */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        {/* 퍼널 정보 */}
        {group.funnelId && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">🔗 연결된 퍼널</p>
            <p className="text-sm font-medium text-blue-900">{group.funnelName}</p>
            <p className="text-xs text-blue-700 mt-2">
              가입 후 자동으로 이 퍼널이 시작됩니다.
            </p>
          </div>
        )}

        {/* 멤버 정보 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">👥 커뮤니티</p>
          <p className="text-2xl font-bold text-navy-900">{group._count.members}</p>
          <p className="text-xs text-gray-600 mt-1">명의 활성 멤버</p>
        </div>
      </div>
    </div>
  );
}
