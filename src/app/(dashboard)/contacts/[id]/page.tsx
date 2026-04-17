"use client";

import { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, MessageSquare, Edit2,
  Plus, Clock, FileText, Star, GitBranch, Calendar, Send, AlarmClock,
  Share2, Users, Building2, X
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
  tags: string[];
  leadScore: number;
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[]; memos: Memo[];
  vipSequences: { id: string; funnelId: string; status: string; startDate: string }[];
};

// 크루즈 여행사 특화 추천 태그
const SUGGESTED_TAGS = [
  "지중해", "알래스카", "카리브해", "북유럽", "동남아", "발틱해",
  "커플", "가족", "부모님", "친구여행", "혼자",
  "100만이하", "200만대", "300만이상", "VIP",
  "봄출발", "여름출발", "가을출발", "겨울출발",
  "재구매가능", "지인추천", "고민중", "계약완료",
];

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

  // WO-22: 즉시 SMS 발송 모달
  const [showSmsModal,  setShowSmsModal]  = useState(false);
  const [smsMsg,        setSmsMsg]        = useState("");
  const [sending,       setSending]       = useState(false);
  const [sendResult,    setSendResult]    = useState("");

  // WO-23: 예약 발송 모달
  const [showSchedModal, setShowSchedModal] = useState(false);

  // WO-28: DB 전달 모달
  const [showSendDb,    setShowSendDb]    = useState(false);
  const [sendDbMode,    setSendDbMode]    = useState<"org" | "agent">("agent");
  const [orgs,          setOrgs]          = useState<{ id: string; name: string }[]>([]);
  const [agents,        setAgents]        = useState<{ userId: string; displayName: string | null; organization: { name: string } }[]>([]);
  const [sendDbTarget,  setSendDbTarget]  = useState("");
  const [sendingDb,     setSendingDb]     = useState(false);
  const [sendDbResult,  setSendDbResult]  = useState("");
  const [schedMsg,       setSchedMsg]       = useState("");
  const [schedAt,        setSchedAt]        = useState("");
  const [scheduling,     setScheduling]     = useState(false);
  const [schedResult,    setSchedResult]    = useState("");

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

  // WO-25C: 태그
  const [tags,          setTags]          = useState<string[]>([]);
  const [tagInput,      setTagInput]      = useState("");
  const [savingTags,    setSavingTags]    = useState(false);

  // 퍼널 직접 등록
  const [funnels,          setFunnels]          = useState<{ id: string; name: string; funnelType: string }[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState('');
  const [enrollStartDate,  setEnrollStartDate]  = useState('');
  const [enrollSendNow,    setEnrollSendNow]    = useState(false);
  const [enrolling,        setEnrolling]        = useState(false);
  const [enrollError,      setEnrollError]      = useState('');

  // 출발일 + 상품명
  const [showDeptForm,  setShowDeptForm]  = useState(false);
  const [deptForm, setDeptForm]           = useState({ departureDate: "", productName: "", bookingRef: "" });
  const [savingDept,    setSavingDept]    = useState(false);

  const fetchContact = () => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((c) => {
        if (c.ok) {
          setContact(c.contact);
          setTags(c.contact.tags ?? []);
          if (c.contact.departureDate) {
            setDeptForm({
              departureDate: c.contact.departureDate.split("T")[0],
              productName:   c.contact.productName ?? "",
              bookingRef:    c.contact.bookingRef  ?? "",
            });
          }
        }
      });
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/contacts/${id}`).then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/funnels").then((r) => r.json()),
    ]).then(([c, g, f]) => {
      if (c.ok) {
        setContact(c.contact);
        setTags(c.contact.tags ?? []);
        if (c.contact.departureDate) {
          setDeptForm({
            departureDate: c.contact.departureDate.split("T")[0],
            productName:   c.contact.productName ?? "",
            bookingRef:    c.contact.bookingRef  ?? "",
          });
        }
      }
      if (g.ok) setAllGroups(g.groups);
      if (f.ok) setFunnels(f.funnels ?? []);
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

  // WO-28: DB 전달 모달 열기 (대상 목록 로드)
  const openSendDb = async () => {
    setShowSendDb(true);
    setSendDbResult("");
    setSendDbTarget("");
    const [orgRes, agentRes] = await Promise.all([
      fetch("/api/org/list").then((r) => r.json()),
      fetch("/api/org/agents").then((r) => r.json()),
    ]);
    if (orgRes.ok)   setOrgs(orgRes.orgs ?? []);
    if (agentRes.ok) setAgents(agentRes.agents ?? []);
  };

  const sendDb = async () => {
    if (!sendDbTarget) return;
    setSendingDb(true);
    const body = sendDbMode === "org"
      ? { targetOrgId: sendDbTarget }
      : { targetUserId: sendDbTarget };
    const res  = await fetch(`/api/contacts/${id}/send-db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSendingDb(false);
    if (data.ok) {
      const label = sendDbMode === "org"
        ? `✅ ${data.targetOrgName}으로 전달 완료`
        : `✅ ${data.agentName ?? "판매원"}에게 할당 완료`;
      setSendDbResult(label);
      setSendDbTarget("");
      setTimeout(() => { setShowSendDb(false); setSendDbResult(""); }, 2000);
    } else {
      setSendDbResult(`❌ ${data.message ?? "전달 실패"}`);
    }
  };

  // WO-25C: 태그 저장
  const saveTag = async (newTags: string[]) => {
    setSavingTags(true);
    await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    });
    setSavingTags(false);
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    saveTag(next);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((tt) => tt !== tag);
    setTags(next);
    saveTag(next);
  };

  // WO-22: 즉시 SMS 발송
  const sendSmsNow = async () => {
    if (!smsMsg.trim()) return;
    setSending(true);
    setSendResult("");
    const res  = await fetch(`/api/contacts/${id}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: smsMsg }),
    });
    const data = await res.json();
    setSending(false);
    if (data.ok) {
      setSendResult("✅ 발송 완료!");
      setSmsMsg("");
      setTimeout(() => { setShowSmsModal(false); setSendResult(""); }, 1500);
    } else {
      setSendResult(`❌ ${data.message ?? "발송 실패"}`);
    }
  };

  // WO-23: 예약 발송 등록
  const scheduleSmsSend = async () => {
    if (!schedMsg.trim() || !schedAt) return;
    setScheduling(true);
    setSchedResult("");
    const res  = await fetch("/api/scheduled-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: id, message: schedMsg, scheduledAt: schedAt }),
    });
    const data = await res.json();
    setScheduling(false);
    if (data.ok) {
      setSchedResult("✅ 예약 완료!");
      setSchedMsg("");
      setSchedAt("");
      setTimeout(() => { setShowSchedModal(false); setSchedResult(""); }, 1500);
    } else {
      setSchedResult(`❌ ${data.message ?? "예약 실패"}`);
    }
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

  const enrolledFunnelIds = useMemo(() => {
    return new Set((contact?.vipSequences ?? []).map((s) => s.funnelId));
  }, [contact]);

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

      {/* WO-28: DB 전달 모달 */}
      {showSendDb && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-500" /> DB 전달
              </h3>
              <button onClick={() => setShowSendDb(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 전달 모드 선택 */}
            <div className="flex gap-2">
              <button
                onClick={() => { setSendDbMode("agent"); setSendDbTarget(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  sendDbMode === "agent"
                    ? "bg-navy-900 text-white border-navy-900"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Users className="w-4 h-4" /> 판매원에게 할당
              </button>
              <button
                onClick={() => { setSendDbMode("org"); setSendDbTarget(""); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  sendDbMode === "org"
                    ? "bg-purple-600 text-white border-purple-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Building2 className="w-4 h-4" /> 대리점 교환
              </button>
            </div>

            {/* 대상 선택 */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                {sendDbMode === "agent" ? "담당 판매원 선택" : "전달할 대리점 선택"}
              </label>
              <select
                value={sendDbTarget}
                onChange={(e) => setSendDbTarget(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-purple-400"
              >
                <option value="">선택하세요...</option>
                {sendDbMode === "agent"
                  ? agents.map((a) => (
                      <option key={a.userId} value={a.userId}>
                        {a.displayName ?? a.userId} ({a.organization.name})
                      </option>
                    ))
                  : orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))
                }
              </select>
              {sendDbMode === "org" && sendDbTarget && (
                <p className="text-xs text-gray-400 mt-1">
                  ℹ️ 원본 데이터는 유지됩니다. 대상 조직에 복사됩니다.
                </p>
              )}
            </div>

            {sendDbResult && (
              <p className={`text-sm font-medium ${sendDbResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                {sendDbResult}
              </p>
            )}

            <button
              onClick={sendDb}
              disabled={sendingDb || !sendDbTarget}
              className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sendingDb ? "전달 중..." : <><Share2 className="w-4 h-4" /> 전달하기</>}
            </button>
          </div>
        </div>
      )}

      {/* WO-22: 즉시 SMS 발송 모달 */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-green-500" /> SMS 즉시 발송
              </h3>
              <button onClick={() => { setShowSmsModal(false); setSendResult(""); }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <p className="text-xs text-gray-500">수신: <strong>{contact?.name}</strong> ({contact?.phone})</p>
            <textarea
              value={smsMsg}
              onChange={(e) => setSmsMsg(e.target.value)}
              placeholder="[고객명], [이름] 치환 사용 가능&#10;예: [고객명]님, 안녕하세요! 크루즈닷입니다."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            <p className="text-xs text-gray-400 text-right">{smsMsg.length}자</p>
            {sendResult && (
              <p className={`text-sm font-medium ${sendResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                {sendResult}
              </p>
            )}
            <button
              onClick={sendSmsNow}
              disabled={sending || !smsMsg.trim()}
              className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? "발송 중..." : <><Send className="w-4 h-4" /> 지금 바로 발송</>}
            </button>
          </div>
        </div>
      )}

      {/* WO-23: 예약 발송 모달 */}
      {showSchedModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <AlarmClock className="w-4 h-4 text-orange-500" /> SMS 예약 발송
              </h3>
              <button onClick={() => { setShowSchedModal(false); setSchedResult(""); }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <p className="text-xs text-gray-500">수신: <strong>{contact?.name}</strong> ({contact?.phone})</p>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">발송 예정 시각</label>
              <input
                type="datetime-local"
                value={schedAt}
                onChange={(e) => setSchedAt(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
              />
            </div>
            <textarea
              value={schedMsg}
              onChange={(e) => setSchedMsg(e.target.value)}
              placeholder="[고객명], [이름] 치환 사용 가능"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            {schedResult && (
              <p className={`text-sm font-medium ${schedResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                {schedResult}
              </p>
            )}
            <button
              onClick={scheduleSmsSend}
              disabled={scheduling || !schedMsg.trim() || !schedAt}
              className="w-full bg-orange-500 text-white py-2.5 rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scheduling ? "예약 중..." : <><AlarmClock className="w-4 h-4" /> 예약 등록</>}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-navy-900 flex-1">{contact.name}</h1>
        <a href={`tel:${contact.phone}`} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
          <Phone className="w-5 h-5" />
        </a>
        <button
          onClick={openSendDb}
          className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100"
          title="DB 전달"
        >
          <Share2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSmsModal(true)}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
          title="SMS 즉시 발송"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSchedModal(true)}
          className="p-2 bg-orange-50 text-orange-500 rounded-lg hover:bg-orange-100"
          title="SMS 예약 발송"
        >
          <AlarmClock className="w-5 h-5" />
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

      {/* WO-25C: 고객 태그 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">🏷️ 태그</p>
          {savingTags && <span className="text-xs text-gray-400">저장 중...</span>}
        </div>

        {/* 현재 태그 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-blue-400 hover:text-blue-700 ml-0.5 font-bold"
              >×</button>
            </span>
          ))}
          {tags.length === 0 && (
            <p className="text-xs text-gray-400">태그 없음 — 아래에서 추가하세요</p>
          )}
        </div>

        {/* 태그 입력 */}
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
            placeholder="태그 직접 입력 후 Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={() => addTag(tagInput)}
            disabled={!tagInput.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
          >추가</button>
        </div>

        {/* 추천 태그 */}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 12).map((tag) => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              className="text-xs bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 px-2 py-0.5 rounded-full transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
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

          {/* 퍼널 직접 등록 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-500" />
              퍼널 직접 등록
            </h3>
            <p className="text-xs text-gray-400 mb-3">그룹 없이 퍼널에 바로 등록합니다</p>

            <div className="space-y-3">
              <select
                value={selectedFunnelId}
                onChange={(e) => setSelectedFunnelId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">퍼널 선택</option>
                {funnels.map((f) => (
                  <option
                    key={f.id}
                    value={f.id}
                    disabled={enrolledFunnelIds.has(f.id)}
                  >
                    {f.name}{enrolledFunnelIds.has(f.id) ? ' (이미 등록됨)' : ''}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={enrollStartDate}
                onChange={(e) => setEnrollStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="시작일 (비우면 오늘)"
              />

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enrollSendNow}
                  onChange={(e) => setEnrollSendNow(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-700">즉시 첫 메시지 발송</span>
              </label>

              {enrollError && <p className="text-xs text-red-500">{enrollError}</p>}

              <button
                onClick={async () => {
                  if (!selectedFunnelId) return;
                  setEnrolling(true);
                  setEnrollError('');
                  const res = await fetch(`/api/funnels/${selectedFunnelId}/enroll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contactId: contact.id,
                      startDate: enrollStartDate || undefined,
                      sendNow: enrollSendNow,
                    }),
                  });
                  const d = await res.json();
                  if (d.ok) {
                    setSelectedFunnelId('');
                    setEnrollStartDate('');
                    setEnrollSendNow(false);
                    fetchContact();
                  } else {
                    setEnrollError(d.message ?? '등록 실패');
                  }
                  setEnrolling(false);
                }}
                disabled={!selectedFunnelId || enrolling}
                className="w-full py-2.5 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-navy-800"
              >
                {enrolling ? '등록 중...' : '퍼널 등록'}
              </button>
            </div>

            {/* 등록된 퍼널 목록 */}
            {(contact.vipSequences ?? []).length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">등록된 퍼널</p>
                <div className="space-y-1.5">
                  {(contact.vipSequences ?? []).map((seq) => {
                    const funnel = funnels.find((f) => f.id === seq.funnelId);
                    return (
                      <div key={seq.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-gray-700">{funnel?.name ?? seq.funnelId}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          seq.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {seq.status === 'ACTIVE' ? '진행중' : seq.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
