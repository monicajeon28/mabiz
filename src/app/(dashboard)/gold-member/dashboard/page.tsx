"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, DollarSign, Heart, Users, FileText, Loader2, AlertCircle,
  CheckCircle, Clock, Phone, Mail
} from "lucide-react";

type GoldMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  memberCode: string;
  courseType: string;
  joinDate: string;
  paymentDay: number;
  totalPayments: number;
  paidCount: number;
  status: string;
  memo?: string;
};

const PLAN_DETAILS: Record<string, { name: string; monthlyPrice: number; healthCheckups: number; broadcast: string; benefits: string[] }> = {
  A: {
    name: "기본 플랜",
    monthlyPrice: 33000,
    healthCheckups: 2,
    broadcast: "주 1회",
    benefits: [
      "연 2회 건강검진",
      "월 여행보험 + 건강보험",
      "주 1회 라이브방송 접근",
      "전담 매니저 배정",
    ],
  },
  B: {
    name: "프리미엄 플랜",
    monthlyPrice: 66000,
    healthCheckups: 4,
    broadcast: "주 3회",
    benefits: [
      "연 4회 건강검진",
      "월 여행보험 + 건강보험 + 스파",
      "주 3회 라이브방송 + 1:1 상담",
      "전담 매니저 + VIP 지원팀",
      "크루즈 50% 할인권",
    ],
  },
  C: {
    name: "C 플랜",
    monthlyPrice: 49500,
    healthCheckups: 3,
    broadcast: "주 2회",
    benefits: [
      "연 3회 건강검진",
      "월 여행보험 + 건강보험",
      "주 2회 라이브방송 접근",
      "전담 매니저 배정",
    ],
  },
  HEALTH: {
    name: "건강 플랜",
    monthlyPrice: 27000,
    healthCheckups: 2,
    broadcast: "-",
    benefits: [
      "연 2회 건강검진",
      "건강관리 서비스",
      "전담 매니저 배정",
    ],
  },
};

const STATUS_INFO = {
  PENDING: {
    label: "결제 대기",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
    desc: "첫 결제를 기다리는 중입니다.",
  },
  ACTIVE: {
    label: "활성",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
    desc: "모든 서비스를 이용할 수 있습니다.",
  },
  SUSPENDED: {
    label: "일시정지",
    color: "bg-orange-100 text-orange-800",
    icon: AlertCircle,
    desc: "결제가 필요합니다.",
  },
  CANCELLED: {
    label: "해지",
    color: "bg-red-100 text-red-800",
    icon: AlertCircle,
    desc: "회원 서비스가 종료되었습니다.",
  },
};

export default function GoldMemberDashboard() {
  const router = useRouter();
  const [member, setMember] = useState<GoldMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    // URL에서 memberId 가져오기 또는 localStorage에서 조회
    const loadMember = async () => {
      try {
        // 현재 로그인 사용자의 골드회원 정보 조회
        const res = await fetch("/api/gold-members?limit=1", { signal: ctrl.signal });
        if (!res.ok) {
          setError("회원 정보를 불러올 수 없습니다.");
          return;
        }

        const data = await res.json();
        if (data.ok && data.goldMembers && data.goldMembers.length > 0) {
          setMember(data.goldMembers[0]);
        } else {
          setError("회원 정보를 찾을 수 없습니다.");
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    };

    loadMember();
    return () => ctrl.abort();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
          <button
            onClick={() => router.push("/gold-member/signup")}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            신청하기
          </button>
        </div>
      </div>
    );
  }

  const plan = PLAN_DETAILS[member.courseType];
  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
            알 수 없는 플랜 유형입니다: {member.courseType}
          </div>
        </div>
      </div>
    );
  }
  const statusInfo = STATUS_INFO[member.status as keyof typeof STATUS_INFO] || STATUS_INFO.PENDING;
  const StatusIcon = statusInfo.icon;
  const remainingPayments = member.totalPayments - member.paidCount;
  const progressPercent = member.totalPayments > 0
    ? (member.paidCount / member.totalPayments) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            {member.name}님의 골드회원
          </h1>
          <p className="text-gray-600">
            회원 코드: <span className="font-mono font-bold text-blue-600">{member.memberCode}</span>
          </p>
        </div>

        {/* 상태 카드 */}
        <div className={`rounded-lg shadow-lg p-6 sm:p-8 mb-6 ${statusInfo.color}`}>
          <div className="flex items-start gap-3">
            <StatusIcon className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold">{statusInfo.label}</h2>
              <p className="text-sm mt-1">{statusInfo.desc}</p>
            </div>
          </div>
        </div>

        {/* 플랜 정보 */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* 플랜 카드 */}
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">현재 플랜</h2>

            <h3 className="text-2xl font-bold text-blue-600 mb-4">{plan.name}</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">월 결제액</span>
                <span className="font-bold text-gray-900">
                  {plan.monthlyPrice.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">건강검진</span>
                <span className="font-bold text-gray-900">연 {plan.healthCheckups}회</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">라이브방송</span>
                <span className="font-bold text-gray-900">{plan.broadcast}</span>
              </div>
            </div>

            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm">
              플랜 변경하기
            </button>
          </div>

          {/* 납부 진행률 */}
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">납부 현황</h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-700">진행률</span>
                  <span className="text-sm font-bold text-gray-900">
                    {member.paidCount} / {member.totalPayments}개월
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-600 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {remainingPayments > 0 && (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <span className="font-bold">{remainingPayments}개월</span>이 남았습니다.
                    </p>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">다음 결제일</span>
                    <span className="font-bold text-gray-900">
                      {member.paymentDay}일
                    </span>
                  </div>
                </>
              )}

              {remainingPayments === 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-900 font-semibold">
                    ✓ 모든 납부가 완료되었습니다!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 혜택 목록 */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">플랜 혜택</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {plan.benefits.map((benefit, idx) => (
              <div key={idx} className="flex gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
                <span className="text-gray-900 font-semibold text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 다음 액션 */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">다음 액션</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <button className="p-4 border-2 border-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left">
              <Heart className="w-6 h-6 text-blue-600 mb-2" />
              <p className="font-semibold text-gray-900">건강검진 예약</p>
              <p className="text-xs text-gray-600 mt-1">
                140개 병원에서 무료로 받기
              </p>
            </button>

            <button className="p-4 border-2 border-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-left">
              <Users className="w-6 h-6 text-purple-600 mb-2" />
              <p className="font-semibold text-gray-900">혼자 여행자 매칭</p>
              <p className="text-xs text-gray-600 mt-1">
                비슷한 성향의 사람들 찾기
              </p>
            </button>

            <button className="p-4 border-2 border-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-left">
              <Calendar className="w-6 h-6 text-orange-600 mb-2" />
              <p className="font-semibold text-gray-900">여행 상담</p>
              <p className="text-xs text-gray-600 mt-1">
                전담 매니저와 대화하기
              </p>
            </button>
          </div>
        </div>

        {/* 연락처 정보 */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <a
            href={`tel:${member.phone}`}
            className="flex-1 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors justify-center"
          >
            <Phone className="w-5 h-5" />
            통화하기
          </a>
          <a
            href={`mailto:${member.email}`}
            className="flex-1 flex items-center gap-2 px-4 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors justify-center"
          >
            <Mail className="w-5 h-5" />
            이메일 보내기
          </a>
        </div>
      </div>
    </div>
  );
}
