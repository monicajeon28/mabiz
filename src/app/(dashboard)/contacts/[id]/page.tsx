"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, MessageSquare, Edit2, Trash2,
  Plus, Clock, FileText, Star
} from "lucide-react";

type CallLog = {
  id: string; content: string | null; result: string | null;
  duration: number | null; convictionScore: number | null;
  nextAction: string | null; scheduledAt: string | null; createdAt: string;
};
type Memo = { id: string; content: string; createdAt: string };
type Contact = {
  id: string; name: string; phone: string; email: string | null;
  type: string; cruiseInterest: string | null; budgetRange: string | null;
  adminMemo: string | null; assignedUserId: string | null;
  lastContactedAt: string | null; purchasedAt: string | null;
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[]; memos: Memo[];
};

const RESULT_LABELS: Record<string, string> = {
  INTERESTED: "✅ 관심있음", PENDING: "⏳ 보류",
  REJECTED: "❌ 거절", RESCHEDULED: "📅 재콜예약",
};
const CONVICTION_LABELS = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [tab, setTab] = useState<"call" | "memo">("call");
  const [loading, setLoading] = useState(true);

  // 콜 추가 폼
  const [showCallForm, setShowCallForm] = useState(false);
  const [callForm, setCallForm] = useState({ content: "", result: "INTERESTED", convictionScore: "5", nextAction: "" });

  // 메모 추가
  const [showMemoForm, setShowMemoForm] = useState(false);
  const [memoText, setMemoText] = useState("");

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setContact(d.contact); })
      .finally(() => setLoading(false));
  }, [id]);

  const addCallLog = async () => {
    const res = await fetch(`/api/contacts/${id}/call-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callForm),
    });
    const data = await res.json();
    if (data.ok) {
      setContact((c) => c ? { ...c, callLogs: [data.log, ...c.callLogs] } : c);
      setShowCallForm(false);
      setCallForm({ content: "", result: "INTERESTED", convictionScore: "5", nextAction: "" });
    }
  };

  const addMemo = async () => {
    if (!memoText.trim()) return;
    const res = await fetch(`/api/contacts/${id}/memos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: memoText }),
    });
    const data = await res.json();
    if (data.ok) {
      setContact((c) => c ? { ...c, memos: [data.memo, ...c.memos] } : c);
      setShowMemoForm(false);
      setMemoText("");
    }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );
  if (!contact) return <div className="p-6 text-gray-500">고객을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-navy-900 flex-1">{contact.name}</h1>
        <a href={`tel:${contact.phone}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
          <Phone className="w-5 h-5" />
        </a>
        <button className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
          <MessageSquare className="w-5 h-5" />
        </button>
        <button onClick={() => router.push(`/contacts/${id}/edit`)} className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
          <Edit2 className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* 기본 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">전화번호</span><p className="font-medium mt-0.5">{contact.phone}</p></div>
          {contact.email && <div><span className="text-gray-400">이메일</span><p className="font-medium mt-0.5">{contact.email}</p></div>}
          <div>
            <span className="text-gray-400">상태</span>
            <p className="font-medium mt-0.5">
              {contact.type === "CUSTOMER" ? "✅ 구매완료" : contact.type === "LEAD" ? "🔵 잠재고객" : contact.type}
            </p>
          </div>
          {contact.cruiseInterest && (
            <div><span className="text-gray-400">관심 크루즈</span><p className="font-medium mt-0.5 text-gold-500">{contact.cruiseInterest}</p></div>
          )}
          {contact.budgetRange && (
            <div>
              <span className="text-gray-400">예산</span>
              <p className="font-medium mt-0.5">
                {{ ECONOMY: "100만원 이하", STANDARD: "100~300만원", PREMIUM: "300만원 이상" }[contact.budgetRange] ?? contact.budgetRange}
              </p>
            </div>
          )}
          {contact.lastContactedAt && (
            <div><span className="text-gray-400">마지막 연락</span><p className="font-medium mt-0.5">{new Date(contact.lastContactedAt).toLocaleDateString("ko-KR")}</p></div>
          )}
        </div>
        {contact.groups.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {contact.groups.map((g) => (
              <span key={g.group.id} className="text-xs px-2 py-1 bg-navy-100 text-navy-900 rounded-full">{g.group.name}</span>
            ))}
          </div>
        )}
        {contact.adminMemo && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
            📝 {contact.adminMemo}
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-4">
        {[
          { key: "call", label: `📞 콜기록 (${contact.callLogs.length})` },
          { key: "memo", label: `📝 메모 (${contact.memos.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "call" | "memo")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-gold-500 text-navy-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콜기록 탭 */}
      {tab === "call" && (
        <div>
          <button
            onClick={() => setShowCallForm(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 mb-3 transition-colors"
          >
            <Plus className="w-4 h-4" /> 콜 기록 추가
          </button>

          {/* 콜 추가 폼 */}
          {showCallForm && (
            <div className="bg-white border border-gold-300 rounded-xl p-4 mb-3 space-y-3">
              <textarea
                placeholder="통화 내용을 입력하세요..."
                value={callForm.content}
                onChange={(e) => setCallForm({ ...callForm, content: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">결과</label>
                  <select
                    value={callForm.result}
                    onChange={(e) => setCallForm({ ...callForm, result: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    {Object.entries(RESULT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">확신척도 (1~10)</label>
                  <select
                    value={callForm.convictionScore}
                    onChange={(e) => setCallForm({ ...callForm, convictionScore: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={String(i + 1)}>{i + 1}점 {CONVICTION_LABELS[i + 1]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                placeholder="다음 액션 (예: 4/17 재콜 예약)"
                value={callForm.nextAction}
                onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
              <div className="flex gap-2">
                <button onClick={addCallLog} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-700">저장</button>
                <button onClick={() => setShowCallForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-200">취소</button>
              </div>
            </div>
          )}

          {/* 콜 목록 */}
          <div className="space-y-2">
            {contact.callLogs.map((log) => (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <Clock className="w-3 h-3" />
                  {new Date(log.createdAt).toLocaleString("ko-KR")}
                  {log.result && <span className="text-gray-600">{RESULT_LABELS[log.result] ?? log.result}</span>}
                  {log.convictionScore && (
                    <span className="flex items-center gap-0.5 text-gold-500">
                      <Star className="w-3 h-3 fill-gold-500" /> {log.convictionScore}점
                    </span>
                  )}
                </div>
                {log.content && <p className="text-sm text-gray-700">{log.content}</p>}
                {log.nextAction && <p className="text-xs text-blue-600 mt-1">→ {log.nextAction}</p>}
              </div>
            ))}
            {contact.callLogs.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">콜 기록이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 메모 탭 */}
      {tab === "memo" && (
        <div>
          <button
            onClick={() => setShowMemoForm(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 mb-3 transition-colors"
          >
            <Plus className="w-4 h-4" /> 메모 추가
          </button>

          {showMemoForm && (
            <div className="bg-white border border-gold-300 rounded-xl p-4 mb-3 space-y-2">
              <textarea
                placeholder="메모 내용..."
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
              />
              <div className="flex gap-2">
                <button onClick={addMemo} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium">저장</button>
                <button onClick={() => setShowMemoForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">취소</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {contact.memos.map((m) => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <FileText className="w-3 h-3" />
                  {new Date(m.createdAt).toLocaleString("ko-KR")}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {contact.memos.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">메모가 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
