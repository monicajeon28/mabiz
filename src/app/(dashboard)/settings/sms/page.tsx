"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MessageSquare, CheckCircle, AlertCircle, Loader2, User, Building2, Unlink, Link2 } from "lucide-react";
import Link from "next/link";

type OrgConfig = {
  id?:             string;
  aligoUserId?:    string;
  senderPhone?:    string;
  isActive?:       boolean;
  senderVerified?: boolean;
  verifiedAt?:     string | null;
  reEngageMsg1?:   string | null;
  reEngageMsg2?:   string | null;
  updatedAt?:      string;
};

type UserConfig = {
  id:             string;
  aligoUserId:    string;
  senderPhone:    string;
  aligoKeyTail:   string;
  senderVerified: boolean;
  verifiedAt:     string | null;
  isActive:       boolean;
  updatedAt:      string;
} | null;

type UserRole = "GLOBAL_ADMIN" | "OWNER" | "AGENT" | "FREE_SALES";

export default function SmsSettingsPage() {
  // ── 로그인 역할 (조직 공용 섹션은 GLOBAL_ADMIN에게만 노출) ──
  const [role, setRole]       = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // ── 조직 설정 ──
  const [config, setConfig]       = useState<OrgConfig>({});
  const [form, setForm]           = useState({ aligoKey: "", aligoUserId: "", senderPhone: "" });
  const [testPhone, setTestPhone] = useState("");
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [verifyStep, setVerifyStep] = useState<"idle" | "requested" | "done">("idle");
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [reEngageMsg1, setReEngageMsg1] = useState("");
  const [reEngageMsg2, setReEngageMsg2] = useState("");
  const [savingReEngage, setSavingReEngage] = useState(false);

  // ── 개인 설정 ──
  const [userConfig, setUserConfig]   = useState<UserConfig>(null);
  const [userForm, setUserForm]       = useState({ aligoKey: "", aligoUserId: "", senderPhone: "" });
  const [userLoading, setUserLoading] = useState(true);
  const [userSaving, setUserSaving]   = useState(false);
  const [userDeleting, setUserDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [userVerifying, setUserVerifying]   = useState(false);
  const [userVerifyStep, setUserVerifyStep] = useState<"idle" | "requested" | "done">("idle");
  const [userMsg, setUserMsg]   = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── 상담 링크 ──
  const [consultingLink, setConsultingLink] = useState<{ id: string; title: string; targetUrl: string; code: string } | null>(null);
  const [consultingForm, setConsultingForm] = useState({ targetUrl: '', title: '' });
  const [consultingLoading, setConsultingLoading] = useState(true);
  const [consultingSaving, setConsultingSaving] = useState(false);
  const [consultingMsg, setConsultingMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── 초기 로드 ──
  useEffect(() => {
    const ctrl = new AbortController();

    // 로그인 역할 조회 (GLOBAL_ADMIN 여부 판단용)
    fetch("/api/auth/me", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (d?.role) setRole(d.role as UserRole); })
      .catch((e) => { if (e.name !== "AbortError") { /* 역할 조회 실패 시 비관리자로 처리 */ } })
      .finally(() => setRoleLoading(false));

    fetch("/api/settings/sms", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config) {
          setConfig(d.config);
          setForm((f) => ({
            ...f,
            aligoUserId:  d.config.aligoUserId  ?? "",
            senderPhone:  d.config.senderPhone   ?? "",
          }));
          setReEngageMsg1(d.config.reEngageMsg1 ?? "");
          setReEngageMsg2(d.config.reEngageMsg2 ?? "");
        }
      })
      .catch((e) => { if (e.name !== 'AbortError') setMsg({ type: "err", text: "조직 SMS 설정 로드 실패" }); });

    fetch("/api/settings/sms-config", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setUserConfig(d.config ?? null);
          if (d.config) {
            setUserForm((f) => ({
              ...f,
              aligoUserId: d.config.aligoUserId ?? "",
              senderPhone: d.config.senderPhone  ?? "",
            }));
          }
        }
      })
      .catch((e) => { if (e.name !== 'AbortError') { /* 개인 SMS 설정 로드 실패 무시 */ } })
      .finally(() => setUserLoading(false));

    fetch('/api/settings/consulting-link', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setConsultingLink(d.link ?? null);
          if (d.link) setConsultingForm({ targetUrl: d.link.targetUrl, title: d.link.title ?? '' });
        }
      })
      .catch(() => {})
      .finally(() => setConsultingLoading(false));

    return () => ctrl.abort();
  }, []);

  // ── 조직 설정 저장 ──
  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res  = await fetch("/api/settings/sms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setMsg({ type: data.ok ? "ok" : "err", text: data.ok ? "저장되었습니다." : (data.message ?? "저장 실패") });
    if (data.ok) setConfig((c) => ({ ...c, aligoUserId: form.aligoUserId, senderPhone: form.senderPhone }));
    setSaving(false);
  };

  const requestVerify = async () => {
    setVerifying(true); setMsg(null);
    const res  = await fetch("/api/settings/sms/verify", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setVerifyStep("requested");
      setMsg({ type: "ok", text: data.message });
    } else {
      setMsg({ type: "err", text: data.message ?? "인증 요청 실패" });
    }
    setVerifying(false);
  };

  const confirmVerify = async () => {
    setVerifying(true); setMsg(null);
    const res  = await fetch("/api/settings/sms/verify", { method: "PUT" });
    const data = await res.json();
    if (data.ok) {
      setVerifyStep("done");
      setConfig((c) => ({ ...c, senderVerified: true, verifiedAt: new Date().toISOString() }));
      setMsg({ type: "ok", text: data.message });
    } else {
      setMsg({ type: "err", text: data.message ?? "인증 실패" });
    }
    setVerifying(false);
  };

  const saveReEngageMsg = async () => {
    setSavingReEngage(true);
    const res = await fetch("/api/settings/sms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reEngageMsg1: reEngageMsg1 || null, reEngageMsg2: reEngageMsg2 || null }),
    });
    const data = await res.json();
    setMsg({ type: data.ok ? "ok" : "err", text: data.ok ? "재진입 메시지 저장됨" : "저장 실패" });
    setSavingReEngage(false);
  };

  const test = async () => {
    if (!testPhone) return;
    setTesting(true);
    setMsg(null);
    const res  = await fetch("/api/settings/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testPhone }),
    });
    const data = await res.json();
    setMsg({ type: data.ok ? "ok" : "err", text: data.message ?? (data.ok ? "발송 성공" : "발송 실패") });
    setTesting(false);
  };

  // ── 개인 설정 저장 ──
  const saveUserConfig = async () => {
    if (!userForm.aligoKey.trim() && !userConfig) {
      setUserMsg({ type: "err", text: "API Key를 입력해주세요." }); return;
    }
    if (!userForm.aligoUserId.trim() || !userForm.senderPhone.trim()) {
      setUserMsg({ type: "err", text: "User ID와 발신번호는 필수입니다." }); return;
    }
    setUserSaving(true); setUserMsg(null);
    try {
      const res = await fetch("/api/settings/sms-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aligoKey:    userForm.aligoKey.trim() || undefined,
          aligoUserId: userForm.aligoUserId.trim(),
          senderPhone: userForm.senderPhone.trim(),
        }),
      });
      const data = await res.json() as { ok: boolean; message?: string };
      if (data.ok) {
        setUserMsg({ type: "ok", text: "내 알리고 계정이 연결되었습니다." });
        setUserForm((f) => ({ ...f, aligoKey: "" }));
        // 갱신
        const r2 = await fetch("/api/settings/sms-config");
        const d2 = await r2.json() as { ok: boolean; config: UserConfig };
        if (d2.ok) setUserConfig(d2.config ?? null);
      } else {
        setUserMsg({ type: "err", text: data.message ?? "저장 실패" });
      }
    } catch {
      setUserMsg({ type: "err", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setUserSaving(false);
    }
  };

  const deleteUserConfig = async () => {
    setUserDeleting(true); setUserMsg(null);
    try {
      const res = await fetch("/api/settings/sms-config", { method: "DELETE" });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setUserConfig(null);
        setUserForm({ aligoKey: "", aligoUserId: "", senderPhone: "" });
        setUserVerifyStep("idle");
        setConfirmDelete(false);
        setUserMsg({ type: "ok", text: "알리고 연결이 해제되었습니다." });
      }
    } catch {
      setUserMsg({ type: "err", text: "해제 중 오류가 발생했습니다." });
    } finally {
      setUserDeleting(false);
    }
  };

  const requestUserVerify = async () => {
    setUserVerifying(true); setUserMsg(null);
    try {
      const res = await fetch("/api/settings/sms-config/verify", { method: "POST" });
      const data = await res.json() as { ok: boolean; message?: string };
      if (data.ok) {
        setUserVerifyStep("requested");
        setUserMsg({ type: "ok", text: data.message ?? "Aligo 콘솔에서 발신번호 등록 후 인증 완료 버튼을 눌러주세요." });
      } else {
        setUserMsg({ type: "err", text: data.message ?? "인증 요청 실패" });
      }
    } catch {
      setUserMsg({ type: "err", text: "인증 요청 중 오류가 발생했습니다." });
    } finally {
      setUserVerifying(false);
    }
  };

  const confirmUserVerify = async () => {
    setUserVerifying(true); setUserMsg(null);
    try {
      const res = await fetch("/api/settings/sms-config/verify", { method: "PUT" });
      const data = await res.json() as { ok: boolean; message?: string };
      if (data.ok) {
        setUserVerifyStep("done");
        setUserConfig((c) => c ? { ...c, senderVerified: true, verifiedAt: new Date().toISOString() } : c);
        setUserMsg({ type: "ok", text: data.message ?? "발신번호 인증이 완료되었습니다." });
      } else {
        setUserMsg({ type: "err", text: data.message ?? "인증 실패" });
      }
    } finally {
      setUserVerifying(false);
    }
  };

  const saveConsultingLink = async () => {
    if (!consultingForm.targetUrl.trim()) { setConsultingMsg({ type: 'err', text: 'URL을 입력하세요' }); return; }
    setConsultingSaving(true); setConsultingMsg(null);
    try {
      const res = await fetch('/api/settings/consulting-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consultingForm),
      });
      const data = await res.json() as { ok: boolean; link?: typeof consultingLink; message?: string };
      if (data.ok) {
        setConsultingLink(data.link ?? null);
        setConsultingMsg({ type: 'ok', text: '상담 링크가 저장되었습니다.' });
      } else {
        setConsultingMsg({ type: 'err', text: data.message ?? '저장 실패' });
      }
    } catch { setConsultingMsg({ type: 'err', text: '저장 중 오류' }); }
    finally { setConsultingSaving(false); }
  };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-navy-900">문자(SMS) 설정</h1>
          <p className="text-sm text-gray-500">알리고 문자 발송 서비스 연동</p>
        </div>
      </div>

      {/* 환경 안내 배너 */}
      <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-purple-900 mb-2">
              🌍 현재 환경: <span className="inline-block px-2 py-0.5 bg-purple-200 rounded text-xs font-mono">
                {typeof window !== "undefined" && window.location.hostname === "localhost"
                  ? "로컬 (localhost)"
                  : "운영 (mabizcruisedot.com)"}
              </span>
            </p>
            <ul className="space-y-1.5 text-purple-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                <span>
                  <strong>로컬 (localhost):</strong> 내 개인 알리고 사용
                  {typeof window !== "undefined" && window.location.hostname === "localhost" && (
                    <span className="block text-xs text-purple-600 mt-0.5">
                      아래의 "내 개인 알리고 연결"에서 설정한 계정으로 발송됩니다.
                    </span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-0.5">→</span>
                <span>
                  <strong>운영 (mabizcruisedot.com):</strong> 회사 공용 알리고 사용
                  {typeof window !== "undefined" && window.location.hostname !== "localhost" && (
                    <span className="block text-xs text-purple-600 mt-0.5">
                      아래의 "조직 공용 설정"에서 설정한 계정으로 발송됩니다.
                    </span>
                  )}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">📌 어떤 계정을 설정해야 하나요?</p>
        <ul className="space-y-1 text-blue-700">
          <li>• <strong>내 개인 계정</strong> — 나만의 발신번호로 문자를 보내고 싶을 때 (위 섹션)</li>
          <li>• <strong>조직 공용 계정</strong> — 팀 전체가 같은 발신번호로 보낼 때 (관리자 전용)</li>
        </ul>
        <p className="mt-1.5 text-blue-600">개인 계정을 연결하면 내 발신번호가 우선 사용됩니다.</p>
        <p className="mt-2 pt-2 border-t border-blue-200 text-amber-700 font-medium">
          ⚠️ 발송 서버 IP는 알리고(aligo.in) 콘솔에서 <strong>반드시 비워두세요(전체 허용).</strong>
          특정 IP를 등록하면 문자 발송이 막힙니다. (발송 서버 IP가 자주 바뀌고 여러 서버가 공유하기 때문)
          API Key·User ID·발신번호만 입력하면 됩니다.
        </p>
      </div>

      {/* ━━━━ 내 상담 링크 ━━━━ */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-emerald-500" />
          <h2 className="text-base font-semibold text-gray-800">내 상담 링크</h2>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-sm rounded-full">개인</span>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          퍼널 문자 만들기에서 [상담링크] 버튼 클릭 시 자동으로 표시됩니다.
        </p>
        {consultingLoading ? (
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse mb-3" />
        ) : consultingLink ? (
          <div className="border rounded-xl p-3 mb-3 bg-emerald-50 border-emerald-200 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div className="text-sm flex-1 min-w-0">
              <p className="font-medium text-emerald-800">현재 상담 링크</p>
              <p className="text-emerald-600 text-xs mt-0.5 truncate">{consultingLink.targetUrl}</p>
            </div>
          </div>
        ) : (
          <div className="border rounded-xl p-3 mb-3 bg-amber-50 border-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">상담 링크가 설정되지 않았습니다.</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상담 링크 URL <span className="text-red-500">*</span></label>
            <input
              type="url"
              value={consultingForm.targetUrl}
              onChange={e => setConsultingForm(f => ({ ...f, targetUrl: e.target.value }))}
              placeholder="https://open.kakao.com/o/... 또는 https://..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">링크 이름 (선택)</label>
            <input
              type="text"
              value={consultingForm.title}
              onChange={e => setConsultingForm(f => ({ ...f, title: e.target.value }))}
              placeholder="예: 카카오 오픈채팅, 상담 예약"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>
          <button
            onClick={saveConsultingLink}
            disabled={consultingSaving}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {consultingSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {consultingLink ? '상담 링크 업데이트' : '상담 링크 저장'}
          </button>
        </div>
        {consultingMsg && (
          <div className={`flex items-center gap-2 p-3 rounded-xl mt-2 text-sm ${consultingMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {consultingMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {consultingMsg.text}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          내 개인 알리고 연결
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-blue-500" />
          <h2 className="text-base font-semibold text-gray-800">내 개인 알리고 연결</h2>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-sm rounded-full">개인</span>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          내 알리고 계정을 연결하면 문자 발송 시 내 발신번호가 사용됩니다.
          연결하지 않으면 조직 공용 계정으로 발송됩니다.
        </p>

        {/* 로컬 환경 안내 */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 mb-3 text-sm">
          <p className="font-medium text-indigo-900 mb-2">💡 로컬 개발 환경에서만 적용됩니다</p>
          <div className="space-y-2 text-indigo-700">
            <div className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold mt-0.5">•</span>
              <div>
                <strong>localhost:</strong> 이 설정을 사용합니다
                <p className="text-xs text-indigo-600 mt-0.5">내 개인 알리고 연결 → 내 발신번호로 발송</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold mt-0.5">•</span>
              <div>
                <strong>mabizcruisedot.com:</strong> 이 설정은 무시됩니다
                <p className="text-xs text-indigo-600 mt-0.5">항상 아래의 "조직 공용 설정"을 사용합니다</p>
              </div>
            </div>
          </div>
        </div>

        {/* 연결 상태 배너 */}
        {userLoading ? (
          <div className="h-14 bg-gray-100 rounded-xl animate-pulse mb-3" />
        ) : userConfig ? (
          <div className="border rounded-xl p-3.5 mb-3 bg-green-50 border-green-200 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-green-800">✅ 내 알리고 계정 연결됨</p>
              <p className="text-green-600 text-sm mt-0.5">
                ID: {userConfig.aligoUserId} · 발신번호: {userConfig.senderPhone} · API Key: ****{userConfig.aligoKeyTail}
                {userConfig.senderVerified && " · 인증완료"}
              </p>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm text-red-600">정말요?</span>
                <button onClick={deleteUserConfig} disabled={userDeleting}
                  className="px-2 py-1 text-sm bg-red-600 text-white rounded disabled:opacity-50 flex items-center gap-1">
                  {userDeleting && <Loader2 className="w-3 h-3 animate-spin" />}예
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded">아니오</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={userDeleting}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
                <Unlink className="w-3 h-3" /> 해제
              </button>
            )}
          </div>
        ) : (
          <div className="border rounded-xl p-3.5 mb-3 bg-amber-50 border-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">내 알리고 계정이 연결되지 않았습니다. 아래에서 연결하세요.</p>
          </div>
        )}

        {/* 개인 연결 폼 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aligo API Key {!userConfig && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              value={userForm.aligoKey}
              onChange={(e) => setUserForm({ ...userForm, aligoKey: e.target.value })}
              placeholder={userConfig ? "변경 시에만 입력 (****" + userConfig.aligoKeyTail + ")" : "내 Aligo API Key"}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aligo User ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={userForm.aligoUserId}
              onChange={(e) => setUserForm({ ...userForm, aligoUserId: e.target.value })}
              placeholder="내 aligo 아이디"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              발신번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={userForm.senderPhone}
              onChange={(e) => setUserForm({ ...userForm, senderPhone: e.target.value })}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
            <p className="text-sm text-gray-600 mt-1">내 Aligo 계정에 등록된 발신번호와 동일해야 합니다.</p>
          </div>
          <button
            onClick={saveUserConfig}
            disabled={userSaving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {userSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {userConfig ? "계정 정보 업데이트" : "내 알리고 연결"}
          </button>
        </div>

        {/* 개인 발신번호 인증 */}
        {userConfig && !userConfig.senderVerified && (
          <div className="bg-white rounded-xl border border-yellow-200 p-4 mt-3 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">📞 발신번호 인증 (필수)</h3>
            <p className="text-sm text-gray-500">
              Aligo 콘솔에서 발신번호 등록 후 ARS 인증을 완료하세요.
            </p>
            {userVerifyStep === "idle" && (
              <button
                onClick={requestUserVerify}
                disabled={userVerifying}
                className="w-full border border-yellow-400 text-yellow-800 py-2 rounded-lg text-sm font-medium hover:bg-yellow-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {userVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
                Aligo 콘솔에서 인증 완료 안내 보기
              </button>
            )}
            {userVerifyStep === "requested" && (
              <div className="space-y-2">
                <a
                  href="https://smartsms.aligo.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full border border-blue-400 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  Aligo 콘솔 열기
                </a>
                <button
                  onClick={confirmUserVerify}
                  disabled={userVerifying}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {userVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
                  인증 완료 확인
                </button>
              </div>
            )}
          </div>
        )}

        {/* 개인 설정 결과 메시지 */}
        {userMsg && (
          <div className={`flex items-center gap-2 p-3 rounded-xl mt-2 text-sm ${
            userMsg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {userMsg.type === "ok"
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {userMsg.text}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          조직 공용 알리고 설정 — 관리자(GLOBAL_ADMIN) 전용
          (라벨만이 아니라 섹션 전체를 관리자에게만 렌더)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {!roleLoading && role === "GLOBAL_ADMIN" && (
      <>
      {/* 구분선 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 border-t border-gray-200" />
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Building2 className="w-3.5 h-3.5" /> 조직 공용 설정
        </div>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* 조직 설정 안내 */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm">
        <p className="font-medium text-red-900 mb-2">⚠️ 관리자만 수정 가능 (GLOBAL_ADMIN)</p>
        <div className="space-y-2 text-red-700">
          <div>
            이 설정은 Vercel 배포 시 사용됩니다 (mabizcruisedot.com).
            <p className="text-xs text-red-600 mt-0.5">변경 시 팀 전체에 영향을 줍니다. 신중하게 진행하세요.</p>
          </div>
          <div>
            <strong>Vercel 발신 IP:</strong> 76.76.x.x (고정 IP가 아니므로 알리고에 등록하지 마세요)
          </div>
        </div>
      </div>

      {/* 현재 상태 */}
      {config.id && (
        <div className={`border rounded-xl p-4 mb-5 flex items-center gap-3 ${
          config.senderVerified
            ? "bg-green-50 border-green-200"
            : "bg-yellow-50 border-yellow-200"
        }`}>
          {config.senderVerified
            ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />}
          <div className="text-sm flex-1">
            <p className={`font-medium ${config.senderVerified ? "text-green-800" : "text-yellow-800"}`}>
              {config.senderVerified ? "✅ 조직 발신번호 인증 완료" : "⚠️ 조직 발신번호 미인증 — 문자 발송이 차단될 수 있습니다"}
            </p>
            <p className={`mt-0.5 ${config.senderVerified ? "text-green-600" : "text-yellow-700"}`}>
              발신번호: {config.senderPhone}
              {config.senderVerified && config.verifiedAt && ` · 인증일: ${new Date(config.verifiedAt).toLocaleDateString("ko-KR")}`}
            </p>
          </div>
        </div>
      )}

      {/* Aligo 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        <p className="font-medium mb-1">📱 Aligo API 발급 방법</p>
        <ol className="space-y-1 list-decimal list-inside text-blue-700">
          <li>aligo.in 접속 → 로그인</li>
          <li>마이페이지 → API KEY 확인</li>
          <li>발신번호 등록 (사업자 인증 필요)</li>
        </ol>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aligo API Key <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={form.aligoKey}
            onChange={(e) => setForm({ ...form, aligoKey: e.target.value })}
            placeholder={config.id ? "변경 시에만 입력" : "Aligo API Key"}
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aligo User ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.aligoUserId}
            onChange={(e) => setForm({ ...form, aligoUserId: e.target.value })}
            placeholder="aligo 아이디"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            발신번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.senderPhone}
            onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
            placeholder="010-1234-5678 (등록된 번호)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
          <p className="text-sm text-gray-600 mt-1">Aligo에 등록된 발신번호와 동일해야 합니다.</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-navy-900 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-navy-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* 발신번호 인증 */}
      {config.id && !config.senderVerified && (
        <div className="bg-white rounded-xl border border-yellow-200 p-5 mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">📞 발신번호 인증 (필수)</h2>
          <p className="text-sm text-gray-500">
            미인증 번호로 발송하면 통신사에서 차단됩니다. Aligo 콘솔에서 ARS 인증을 완료하세요.
          </p>
          {verifyStep === "idle" && (
            <button
              onClick={requestVerify}
              disabled={verifying}
              className="w-full border border-yellow-400 text-yellow-800 py-2 rounded-lg text-sm font-medium hover:bg-yellow-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
              Aligo 콘솔에서 인증 완료 안내
            </button>
          )}
          {verifyStep === "requested" && (
            <div className="space-y-2">
              <p className="text-sm text-blue-700 font-medium">
                Aligo 콘솔에서 발신번호 등록 → ARS 인증 완료 후 아래 버튼을 클릭하세요.
              </p>
              <a
                href="https://smartsms.aligo.in"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full border border-blue-400 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 flex items-center justify-center gap-2"
              >
                Aligo 콘솔 열기
              </a>
              <button
                onClick={confirmVerify}
                disabled={verifying}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                인증 완료 확인
              </button>
            </div>
          )}
        </div>
      )}

      {/* 테스트 발송 */}
      {config.id && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gold-500" /> 테스트 발송
          </h2>
          <div className="flex gap-2">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="수신 전화번호"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
            <button
              onClick={test}
              disabled={testing || !testPhone}
              className="px-4 py-2 bg-gold-500 text-navy-900 rounded-lg text-sm font-medium hover:bg-gold-300 disabled:opacity-50 flex items-center gap-1"
            >
              {testing && <Loader2 className="w-3 h-3 animate-spin" />}
              발송
            </button>
          </div>
          <p className="text-sm text-gray-600">야간(21시~8시)에는 자동으로 발송이 차단됩니다.</p>
        </div>
      )}

      {/* 재진입 메시지 커스터마이즈 */}
      {config.id && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">🔄 이탈 고객 재진입 메시지</h2>
            <p className="text-sm text-gray-600">
              14일 이상 무응답 LEAD에게 매일 오전 10시 자동 발송. 비워두면 시스템 기본 메시지 사용.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">1차 메시지 (첫 재진입)</label>
            <textarea
              value={reEngageMsg1}
              onChange={(e) => setReEngageMsg1(e.target.value)}
              placeholder={"[고객명]님, 안녕하세요! 크루즈닷입니다 🚢\n새로운 크루즈 일정이 출시됐어요. 잠깐 확인해보세요!"}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            <p className="text-sm text-gray-600 text-right mt-0.5">{reEngageMsg1.length}자</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1.5 block">2차 메시지 (7일 후)</label>
            <textarea
              value={reEngageMsg2}
              onChange={(e) => setReEngageMsg2(e.target.value)}
              placeholder={"[고객명]님, 크루즈닷입니다.\n지난번에 관심 보여주셨는데 혹시 아직 고민 중이신가요?\n편한 시간에 연락 주시면 최적의 일정을 찾아드릴게요 🙏"}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            <p className="text-sm text-gray-600 text-right mt-0.5">{reEngageMsg2.length}자</p>
          </div>
          <button
            onClick={saveReEngageMsg}
            disabled={savingReEngage}
            className="w-full bg-navy-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {savingReEngage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            재진입 메시지 저장
          </button>
          <p className="text-sm text-gray-600">치환변수: [고객명] [이름]</p>
        </div>
      )}

      {/* 조직 결과 메시지 */}
      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mt-3 text-sm ${
          msg.type === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {msg.type === "ok"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}
      </>
      )}

      {/* 최종 정리: 어떤 알리고로 발송되나 */}
      <div className="mt-8 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-5 text-sm">
        <p className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          📌 요약: 어떤 알리고로 발송되나요?
        </p>
        <div className="space-y-3">
          <div className="bg-white rounded-lg p-3.5 border border-slate-200">
            <p className="font-medium text-slate-800 mb-2">🏠 로컬 (localhost)</p>
            <p className="text-slate-600 text-sm">
              <strong>내 개인 알리고 사용</strong>
            </p>
            <p className="text-slate-500 text-xs mt-1.5">
              → "내 개인 알리고 연결"에서 설정한 계정으로 발송<br/>
              → 미설정 시 "조직 공용 설정"으로 폴백
            </p>
          </div>
          <div className="bg-white rounded-lg p-3.5 border border-slate-200">
            <p className="font-medium text-slate-800 mb-2">🌐 운영 (mabizcruisedot.com)</p>
            <p className="text-slate-600 text-sm">
              <strong>항상 조직 공용 알리고 사용</strong>
            </p>
            <p className="text-slate-500 text-xs mt-1.5">
              → "조직 공용 설정"에서만 발송<br/>
              → 개인 설정은 무시됨
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-slate-600 text-xs">
            💡 <strong>팁:</strong> 로컬에서 개인 계정으로 테스트한 후 운영 환경에서 조직 공용 설정으로 배포하세요.
            개인 계정과 공용 계정을 구분하여 테스트할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 도움말 링크 */}
      <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
        <p className="mb-3">더 자세한 정보가 필요하신가요?</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="https://smartsms.aligo.in"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
          >
            Aligo 대시보드
          </a>
          <a
            href="https://docs.aligo.in"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 text-blue-700 font-medium transition-colors"
          >
            Aligo API 가이드
          </a>
        </div>
      </div>
    </div>
  );
}
