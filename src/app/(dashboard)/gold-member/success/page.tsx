"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle, Mail, Phone, ArrowRight, Download, Loader2 } from "lucide-react";

type Member = {
  id: string;
  name: string;
  email: string;
  memberCode: string;
  courseType: string;
  joinDate: string;
};

export default function SuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("id");
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!memberId) {
      setError("유효하지 않은 요청입니다.");
      setLoading(false);
      return;
    }

    const fetchMember = async () => {
      try {
        const res = await fetch(`/api/gold-members/${memberId}`);
        if (!res.ok) {
          setError("회원 정보를 불러올 수 없습니다.");
          return;
        }
        const data = await res.json();
        if (data.ok && data.member) {
          setMember(data.member);
        }
      } catch (err) {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchMember();
  }, [memberId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto text-center mt-20">
          <h1 className="text-3xl font-bold text-red-700 mb-4">오류 발생</h1>
          <p className="text-gray-600 mb-6">{error || "알 수 없는 오류가 발생했습니다."}</p>
          <button
            onClick={() => router.push("/gold-member")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* 성공 메시지 */}
        <div className="text-center mb-12 mt-10">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-20 h-20 text-green-600 animate-bounce" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            가입이 완료되었습니다!
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {member.name}님의 골드회원 가입이 성공적으로 처리되었습니다.
          </p>
        </div>

        {/* 회원 정보 카드 */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-6">가입 정보</h2>

          <div className="flex flex-col sm:flex-row sm:justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-gray-700 font-semibold">회원 코드</span>
            <span className="text-lg font-mono font-bold text-blue-600 mt-2 sm:mt-0">
              {member.memberCode}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold mb-1">이름</p>
              <p className="text-base font-semibold text-gray-900">{member.name}</p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold mb-1">플랜</p>
              <p className="text-base font-semibold text-gray-900">
                {member.courseType === "A" ? "기본 플랜" : "프리미엄 플랜"}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold mb-1">가입일</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(member.joinDate).toLocaleDateString("ko-KR")}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-semibold mb-1">이메일</p>
              <p className="text-base font-semibold text-gray-900 truncate">
                {member.email}
              </p>
            </div>
          </div>
        </div>

        {/* 다음 단계 */}
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">다음 단계</h2>

          <div className="space-y-4">
            {/* 단계 1: 확인 이메일 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  확인 이메일 받기
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {member.email}로 계약서와 영수증이 발송되었습니다.
                </p>
                <p className="text-xs text-gray-500">
                  이메일을 찾을 수 없으면 스팸 폴더를 확인해주세요.
                </p>
              </div>
            </div>

            {/* 단계 2: 건강검진 예약 */}
            <div className="flex gap-4 pt-4 border-t">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100">
                  <span className="text-emerald-600 font-bold">2</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  건강검진 예약하기
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {member.courseType === "A"
                    ? "연 2회 건강검진을 140개 병원에서 무료로 받을 수 있습니다."
                    : "연 4회 건강검진을 140개 병원에서 무료로 받을 수 있습니다."}
                </p>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors text-sm">
                  건강검진 예약
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 단계 3: 전담 매니저 연락 */}
            <div className="flex gap-4 pt-4 border-t">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100">
                  <Phone className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  전담 매니저로부터 연락
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  3일 이내에 전담 매니저가 연락하여 맞춤형 여행 상담을 제공합니다.
                </p>
                <p className="text-xs text-gray-500">
                  편한 시간대를 미리 알려주시면 그 시간에 연락드립니다.
                </p>
              </div>
            </div>

            {/* 단계 4: 혼자 여행자 매칭 */}
            <div className="flex gap-4 pt-4 border-t">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-100">
                  <span className="text-orange-600 font-bold">4</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  혼자 여행자 매칭 신청 (선택)
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  비슷한 연령대와 관심사를 가진 여행자들과 매칭될 수 있습니다.
                </p>
                <button className="inline-flex items-center gap-2 px-4 py-2 border-2 border-orange-600 text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors text-sm">
                  매칭 신청
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 혜택 안내 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 sm:p-8 mb-8 border border-blue-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">지금부터 누릴 수 있는 혜택</h2>
          <ul className="space-y-3">
            <li className="flex gap-3 text-sm text-gray-700">
              <span className="text-blue-600 font-bold">✓</span>
              <span>라이브방송 접근권 (주 1-3회)</span>
            </li>
            <li className="flex gap-3 text-sm text-gray-700">
              <span className="text-blue-600 font-bold">✓</span>
              <span>월별 건강보험 + 여행보험 혜택</span>
            </li>
            <li className="flex gap-3 text-sm text-gray-700">
              <span className="text-blue-600 font-bold">✓</span>
              <span>전담 매니저의 1:1 상담</span>
            </li>
            <li className="flex gap-3 text-sm text-gray-700">
              <span className="text-blue-600 font-bold">✓</span>
              <span>
                {member.courseType === "A"
                  ? "연 2회 무료 건강검진"
                  : "연 4회 무료 건강검진 + 크루즈 50% 할인권"}
              </span>
            </li>
          </ul>
        </div>

        {/* 행동 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => router.push("/gold-member/dashboard")}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            내 정보 보기
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => router.push("/")}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>

        {/* 하단 지원 */}
        <p className="text-center text-xs sm:text-sm text-gray-600 mt-6">
          문제가 있으신가요?{" "}
          <a href="tel:02-1234-5678" className="text-blue-600 font-semibold hover:underline">
            고객 지원 전화
          </a>{" "}
          또는{" "}
          <a href={`mailto:support@cruisedot.com`} className="text-blue-600 font-semibold hover:underline">
            이메일
          </a>
          로 문의해주세요.
        </p>
      </div>
    </div>
  );
}
