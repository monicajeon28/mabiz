"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, MessageSquare, Edit2,
  Plus, Clock, FileText, Star, GitBranch, Calendar, Package
} from "lucide-react";
import { logger } from "@/lib/logger";

type CallLog = {
  id: string; content: string | null; result: string | null;
  duration: number | null; convictionScore: number | null;
  nextAction: string | null; scheduledAt: string | null; createdAt: string;
};
type Memo = { id: string; content: string; createdAt: string };
type Group = { id: string; name: string; funnelId?: string | null };
type Contact = {
  id: string; name: string; phone: string; email: string | null;
  type: string; cruiseInterest: string | null; budgetRange: string | null;
  adminMemo: string | null; assignedUserId: string | null;
  lastContactedAt: string | null; purchasedAt: string | null;
  departureDate: string | null; productName: string | null; bookingRef: string | null;
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[]; memos: Memo[];
};

const RESULT_LABELS: Record<string, string> = {
  INTERESTED: "✅ 관심있음", PENDING: "⏳ 보류",
  REJECTED: "❌ 거절", RESCHEDULED: "📅 재콜예약",
};

type TimelineItem = {
  id: string;
  type: "call" | "memo" | "sms";
  createdAt: string;
  summary: string;
  badge?: string;
};

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [contact,       setContact]       = useState<Contact | null>(null);
  const [tab,           setTab]           = useState<"call" | "memo" | "group" | "sms">("call");
  const [loading,       setLoading]       = useState(true);
  const [smsLogs,       setSmsLogs]       = useState<{ id: string; phone: string; contentPreview: string; status: string; channel: string; sentAt: string }[]>([]);
  const [smsLoading,    setSmsLoading]    = useState(false);

  // 콜 기록 폼
  const [showCallForm, setShowCallForm]   = useState(false);
  const [callForm, setCallForm]           = useState({ content: "", result: "INTERESTED", convictionScore: "5", nextAction: "" });

  // 메모 폼
  const [showMemoForm, setShowMemoForm]   = useState(false);
  const [memoText, setMemoText]           = useState("");

  // 그룹 배정
  const [allGroups,     setAllGroups]     = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [assigning,     setAssigning]     = useState(false);
  const [assignMsg,     setAssignMsg]     = useState("");

  // 출발일 + 상품명
  const [showDeptForm,  setShowDeptForm]  = useState(false);
  const [deptForm, setDeptForm]           = useState({ departureDate: "", productName: "", bookingRef: "" });
  const [savingDept,    setSavingDept]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/contacts/${id}`).then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
    ]).then(([c, g]) => {
      if (c.ok) {
        setContact(c.contact);
        if (c.contact.departureDate) {
          setDeptForm({
            departureDate: c.contact.departureDate.split("T")[0],
            productName:   c.contact.productName ?? "",
            bookingRef:    c.contact.bookingRef  ?? "",
          });
        }
      }
      if (g.ok) setAllGroups(g.groups);
    }).finally(() => setLoading(false));
  }, [id]);

  const addCallLog = async () => {
    const res  = await fetch(`/api/contacts/${id}/call-logs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
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
    const res  = await fetch(`/api/contacts/${id}/memos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: memoText }),
    });
    const data = await res.json();
    if (data.ok) {
      setContact((c) => c ? { ...c, memos: [data.memo, ...c.memos] } : c);
      setShowMemoForm(false);
      setMemoText("");
    }
  };

  // 그룹 배정 → 퍼널 자동 시작
  const assignGroup = async () => {
    if (!selectedGroup) return;
    setAssigning(true);
    setAssignMsg("");
    const res  = await fetch(`/api/groups/${selectedGroup}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: [id] }),
    });
    const data = await res.json();
    if (data.ok) {
      const g    = allGroups.find((g) => g.id === selectedGroup);
      const msg  = g?.funnelId
        ? `✅ "${g.name}" 그룹 배정 + 퍼널 자동 시작!`
        : `✅ "${g?.name}" 그룹 배정 완료`;
      setAssignMsg(msg);
      setContact((c) => c ? { ...c, groups: [...c.groups, { group: { id: g!.id, name: g!.name } }] } : c);
      setSelectedGroup("");
    }
    setAssigning(false);
  };

  // 출발일 저장
  const saveDeparture = async () => {
    setSavingDept(true);
    const res  = await fetch(`/api/contacts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departureDate: deptForm.departureDate ? new Date(deptForm.departureDate).toISOString() : null,
        productName:   deptForm.productName   || null,
        bookingRef:    deptForm.bookingRef     || null,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setContact((c) => c ? {
        ...c,
        departureDate: data.contact.departureDate,
        productName:   data.contact.productName,
        bookingRef:    data.contact.bookingRef,
      } : c);
      setShowDeptForm(false);
    }
    setSavingDept(false);
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );
  if (!contact) return <div className="p-6 text-gray-500">고객을 찾을 수 없습니다.</div>;

  const currentGroups = contact.groups.map((g) => g.group);
  const availableGroups = allGroups.filter((g) => !currentGroups.some((cg) => cg.id === g.id));

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

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">전화번호</span><p className="font-medium mt-0.5">{contact.phone}</p></div>
          <div>
            <span className="text-gray-400">상태</span>
            <p className="font-medium mt-0.5">
              {contact.type === "CUSTOMER" ? "✅ 구매완료" : contact.type === "LEAD" ? "🔵 잠재고객" : contact.type}
            </p>
          </div>
          {contact.cruiseInterest && (
            <div><span className="text-gray-400">관심 크루즈</span><p className="font-medium mt-0.5 text-gold-500">{contact.cruiseInterest}</p></div>
          )}
        </div>

        {/* ★ 출발일 + 상품 정보 (VIP 케어 핵심) */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gold-500" />
              VIP 케어 출발 정보
            </p>
            <button
              onClick={() => setShowDeptForm(!showDeptForm)}
              className="text-xs text-blue-600 hover:underline"
            >
              {contact.departureDate ? "수정" : "입력"}
            </button>
          </div>

          {contact.departureDate ? (
            <div className="bg-gold-100 rounded-lg p-3 space-y-1">
              <p className="text-sm font-bold text-navy-900">
                🗓 출발일: {new Date(contact.departureDate).toLocaleDateString("ko-KR")}
              </p>
              {contact.productName && (
                <p className="text-sm text-gray-700">🚢 상품: {contact.productName}</p>
              )}
              {contact.bookingRef && (
                <p className="text-sm text-gray-700">📋 예약번호: {contact.bookingRef}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">출발일 미입력 — 입력하면 D-150~D+2 자동 계산</p>
          )}

          {showDeptForm && (
            <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">출발일 *</label>
                <input
                  type="date"
                  value={deptForm.departureDate}
                  onChange={(e) => setDeptForm({ ...deptForm, departureDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">크루즈 상품명</label>
                <input
                  type="text"
                  value={deptForm.productName}
                  onChange={(e) => setDeptForm({ ...deptForm, productName: e.target.value })}
                  placeholder="예: 지중해 7박 MSC 크루즈"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">예약 번호</label>
                <input
                  type="text"
                  value={deptForm.bookingRef}
                  onChange={(e) => setDeptForm({ ...deptForm, bookingRef: e.target.value })}
                  placeholder="PNR 또는 예약 번호"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveDeparture}
                  disabled={savingDept || !deptForm.departureDate}
                  className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {savingDept ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowDeptForm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 현재 그룹 태그 */}
        {currentGroups.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {currentGroups.map((g) => (
              <span key={g.id} className="text-xs px-2 py-1 bg-navy-100 text-navy-900 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 최근 활동 타임라인 */}
      {(() => {
        const items: TimelineItem[] = [
          ...contact.callLogs.map((log): TimelineItem => ({
            id: log.id,
            type: "call",
            createdAt: log.createdAt,
            summary: ((log.result ? (RESULT_LABELS[log.result] ?? log.result) + " " : "") + (log.content ?? "")).slice(0, 30),
            badge: log.result ? (RESULT_LABELS[log.result] ?? log.result) : undefined,
          })),
          ...contact.memos.map((m): TimelineItem => ({
            id: m.id,
            type: "memo",
            createdAt: m.createdAt,
            summary: m.content.slice(0, 30),
          })),
          ...smsLogs.map((s): TimelineItem => ({
            id: s.id,
            type: "sms",
            createdAt: s.sentAt,
            summary: s.contentPreview.slice(0, 30),
            badge: s.status === "SENT" ? "발송완료" : s.status === "BLOCKED" ? "차단" : "실패",
          })),
        ]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        if (items.length === 0) return null;

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gold-500" />
              최근 활동
            </h3>
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.type === "sms" ? "sms" : item.type === "memo" ? "memo" : "call")}
                  className="w-full flex items-start gap-3 text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <span className="mt-0.5 text-gray-400 shrink-0">
                    {item.type === "call" && <Phone className="w-4 h-4" />}
                    {item.type === "memo" && <FileText className="w-4 h-4" />}
                    {item.type === "sms" && <MessageSquare className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.summary || "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  {item.badge && (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-4">
        {[
          { key: "call",  label: `📞 콜기록 (${contact.callLogs.length})` },
          { key: "memo",  label: `📝 메모 (${contact.memos.length})` },
          { key: "group", label: "👥 그룹 배정" },
          { key: "sms",   label: "💬 발송내역" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key as typeof tab);
              if (t.key === "sms" && smsLogs.length === 0) {
                setSmsLoading(true);
                fetch(`/api/sms-logs?contactId=${contact.id}&days=90`)
                  .then(r => r.json())
                  .then(d => { if (d.ok) setSmsLogs(d.logs ?? []); setSmsLoading(false); })
                  .catch(() => { logger.error("[ContactDetail] SMS 로그 fetch 실패", { contactId: contact.id }); setSmsLoading(false); });
              }
            }}
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
                    {Object.entries(RESULT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
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
                      <option key={i + 1} value={String(i + 1)}>{i + 1}점</option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                placeholder="다음 액션"
                value={callForm.nextAction}
                onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
              <div className="flex gap-2">
                <button onClick={addCallLog} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium">저장</button>
                <button onClick={() => setShowCallForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">취소</button>
              </div>
            </div>
          )}

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
                  <FileText className="w-3 h-3" /> {new Date(m.createdAt).toLocaleString("ko-KR")}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {contact.memos.length === 0 && <p className="text-center text-sm text-gray-400 py-8">메모가 없습니다.</p>}
          </div>
        </div>
      )}

      {/* 그룹 배정 탭 */}
      {tab === "group" && (
        <div className="space-y-4">
          {/* 그룹 배정 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-gold-500" />
              그룹 배정 → 퍼널 자동 시작
            </h3>
            <p className="text-xs text-gray-400 mb-3">그룹에 퍼널이 연결되어 있으면 배정 즉시 자동 문자 발송 시작</p>

            <div className="flex gap-2">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold-500"
              >
                <option value="">그룹 선택...</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.funnelId ? "🔄" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={assignGroup}
                disabled={assigning || !selectedGroup}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
              >
                {assigning ? "배정 중..." : "배정"}
              </button>
            </div>

            {assignMsg && (
              <p className="mt-2 text-sm text-green-600 font-medium">{assignMsg}</p>
            )}

            <p className="text-xs text-gray-400 mt-2">
              🔄 = 퍼널 연결됨 (배정 즉시 자동 문자 발송)
            </p>
          </div>

          {/* 현재 소속 그룹 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-3">현재 소속 그룹</h3>
            {currentGroups.length === 0 ? (
              <p className="text-sm text-gray-400">아직 그룹에 속하지 않았습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentGroups.map((g) => (
                  <span key={g.id} className="flex items-center gap-1.5 bg-navy-100 text-navy-900 px-3 py-1.5 rounded-full text-sm font-medium">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SMS 발송 내역 탭 */}
      {tab === "sms" && (
        <div className="space-y-2">
          {smsLoading ? (
            <div className="text-center text-sm text-gray-400 py-8">불러오는 중...</div>
          ) : smsLogs.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">발송 내역이 없습니다.</p>
          ) : (
            smsLogs.map((log) => (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    log.status === "SENT"    ? "bg-green-100 text-green-700" :
                    log.status === "BLOCKED" ? "bg-yellow-100 text-yellow-700" :
                                              "bg-red-100 text-red-700"
                  }`}>
                    {log.status === "SENT" ? "✅ 발송완료" : log.status === "BLOCKED" ? "🚫 차단" : "❌ 실패"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(log.sentAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{log.contentPreview}</p>
                <p className="text-xs text-gray-400 mt-1">{log.phone} · {log.channel}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
