"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function NewContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    type: "LEAD",
    cruiseInterest: "",
    budgetRange: "",
    adminMemo: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/contacts/${data.contact.id}`);
      } else {
        setError(data.message ?? "저장 실패. 다시 시도해주세요.");
      }
    } catch {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-navy-900">새 고객 추가</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-1234-5678"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="example@email.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>

          {/* 고객 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">고객 유형</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
            >
              <option value="LEAD">잠재고객</option>
              <option value="CUSTOMER">구매완료</option>
            </select>
          </div>

          {/* 관심 크루즈 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">관심 크루즈</label>
            <select
              value={form.cruiseInterest}
              onChange={(e) => setForm({ ...form, cruiseInterest: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
            >
              <option value="">선택 안함</option>
              <option value="지중해">지중해</option>
              <option value="카리브해">카리브해</option>
              <option value="알래스카">알래스카</option>
              <option value="북유럽">북유럽</option>
              <option value="동남아">동남아</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 예산 구간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">예산 구간</label>
            <select
              value={form.budgetRange}
              onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
            >
              <option value="">선택 안함</option>
              <option value="ECONOMY">100만원 이하</option>
              <option value="STANDARD">100~300만원</option>
              <option value="PREMIUM">300만원 이상</option>
            </select>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              value={form.adminMemo}
              onChange={(e) => setForm({ ...form, adminMemo: e.target.value })}
              placeholder="고객 관련 메모..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-navy-900 text-white py-3 rounded-xl font-medium hover:bg-navy-700 transition-colors disabled:opacity-50"
        >
          {loading ? "저장 중..." : "고객 추가하기"}
        </button>
      </form>
    </div>
  );
}
