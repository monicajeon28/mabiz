"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Mail, CheckCircle, AlertCircle, Loader2, Shield, User } from "lucide-react";
import Link from "next/link";

const SMTP_PRESETS = [
  { label: "Gmail",      host: "smtp.gmail.com",  port: 587 },
  { label: "Naver",      host: "smtp.naver.com",  port: 465 },
  { label: "Daum/Kakao", host: "smtp.daum.net",   port: 465 },
  { label: "직접 입력",  host: "",                port: 587 },
];

type UserRole = "GLOBAL_ADMIN" | "OWNER" | "AGENT" | "FREE_SALES";

interface PersonalConfig {
  senderName: string;
  senderEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpSecure: boolean;
  isActive: boolean;
  isVerified: boolean;
  testedAt?: string | null;
  testResult?: string | null;
  testErrorMessage?: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// 개인 이메일 설정 폼 (AGENT / OWNER 공통)
// ──────────────────────────────────────────────────────────────────────────────
function PersonalEmailForm({ role }: { role: UserRole }) {
  const [form, setForm] = useState({
    senderName: "",
    senderEmail: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUsername: "",
    smtpPass: "",
    smtpSecure: false,
  });
  const [config, setConfig] = useState<PersonalConfig | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [msg, setMsg]             = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/settings/email/personal", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.config) {
          const cfg: PersonalConfig = d.config;
          setConfig(cfg);
          setForm((f) => ({
            ...f,
            senderName:  cfg.senderName  ?? "",
            senderEmail: cfg.senderEmail ?? "",
            smtpHost:    cfg.smtpHost    ?? "smtp.gmail.com",
            smtpPort:    cfg.smtpPort    ?? 587,
            smtpUsername: cfg.smtpUsername ?? "",
            smtpSecure:  cfg.smtpSecure  ?? false,
          }));
        }
      })
      .catch((e) => { if (e.name !== "AbortError") { /* 로드 실패 시 빈 폼 유지 */ } });
    return () => ctrl.abort();
  }, []);

  const applyPreset = (preset: typeof SMTP_PRESETS[0]) => {
    if (preset.host) {
      setForm((f) => ({ ...f, smtpHost: preset.host, smtpPort: preset.port }));
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/email/personal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName:  form.senderName,
          senderEmail: form.senderEmail,
          smtpHost:    form.smtpHost,
          smtpPort:    form.smtpPort,
          smtpUsername: form.smtpUsername,
          smtpPassword: form.smtpPass,
          smtpSecure:  form.smtpSecure,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: "ok", text: "설정이 저장되었습니다. 아래에서 테스트 이메일을 보내보세요." });
        setConfig((prev) => ({
          ...(prev ?? {} as PersonalConfig),
          ...data.config,
          isVerified: false,
        }));
        setForm((f) => ({ ...f, smtpPass: "" }));
      } else {
        setMsg({ type: "err", text: data.message ?? "저장 실패. 입력 내용을 다시 확인하세요." });
      }
    } catch {
      setMsg({ type: "err", text: "설정 저장 중 오류가 발생했습니다. 잠시 후 다시 시도하세요." });
    }
    setSaving(false);
  };

  const test = async () => {
    if (!testEmail) return;
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/email/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: "ok", text: data.message ?? "발송 완료! 수신함 또는 스팸함을 확인하세요." });
        setConfig((prev) => prev ? { ...prev, isVerified: true, testResult: "SUCCESS" } : prev);
      } else {
        setMsg({ type: "err", text: data.message ?? "발송 실패. SMTP 설정을 다시 확인하세요." });
        setConfig((prev) => prev ? { ...prev, isVerified: false, testResult: "FAILED" } : prev);
      }
    } catch {
      setMsg({ type: "err", text: "테스트 이메일 발송 중 오류가 발생했습니다." });
    }
    setTesting(false);
  };

  const deactivate = async () => {
    if (!confirm("이메일 설정을 비활성화할까요? 자동 이메일 발송이 중단됩니다.")) return;
    setDeleting(true);
    setMsg(null);
    try {
      const res  = await fetch("/api/settings/email/personal", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setConfig(null);
        setForm({ senderName: "", senderEmail: "", smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUsername: "", smtpPass: "", smtpSecure: false });
        setMsg({ type: "ok", text: "이메일 설정이 비활성화되었습니다." });
      } else {
        setMsg({ type: "err", text: data.message ?? "비활성화 실패" });
      }
    } catch {
      setMsg({ type: "err", text: "비활성화 중 오류가 발생했습니다." });
    }
    setDeleting(false);
  };

  const isConnected = config?.isActive && config?.isVerified;

  return (
    <div className="space-y-4">
      {/* 연결 상태 배너 */}
      {config && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          isConnected
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        }`}>
          {isConnected ? (
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-base font-semibold ${isConnected ? "text-green-800" : "text-amber-800"}`}>
              {isConnected ? "연결됨 — 자동 이메일 발송 중" : "미확인 — 아래에서 테스트 이메일을 보내주세요"}
            </p>
            <p className={`text-sm mt-0.5 ${isConnected ? "text-green-700" : "text-amber-700"}`}>
              {config.senderName
                ? `${config.senderName} <${config.senderEmail}>`
                : config.senderEmail}
              {config.testedAt && (
                <span className="ml-2 text-xs opacity-75">
                  마지막 테스트: {new Date(config.testedAt).toLocaleString("ko-KR")}
                </span>
              )}
            </p>
            {config.testErrorMessage && (
              <p className="text-sm text-red-700 mt-1 font-mono bg-red-50 rounded px-2 py-1 mt-2">
                오류: {config.testErrorMessage.slice(0, 200)}
              </p>
            )}
          </div>
          {config.isActive && (
            <button
              onClick={deactivate}
              disabled={deleting}
              className="shrink-0 text-xs text-gray-500 hover:text-red-600 underline"
            >
              {deleting ? "처리 중..." : "해제"}
            </button>
          )}
        </div>
      )}

      {/* SMTP 프리셋 버튼 */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">이메일 서비스 선택</p>
        <div className="flex gap-2 flex-wrap">
          {SMTP_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-4 py-3 text-base rounded-full border transition-colors min-h-[48px] ${
                form.smtpHost === p.host && p.host !== ""
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 폼 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        {/* 발신자 정보 */}
        <div>
          <p className="text-base font-semibold text-gray-800 mb-3">발신자 정보</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">보내는 사람 이름</label>
              <input
                type="text"
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                placeholder="홍길동 팀장"
                className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
              <p className="text-sm text-gray-500 mt-1">이메일에 표시되는 이름</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일 주소 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.senderEmail}
                onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                placeholder="hong@gmail.com"
                className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
              <p className="text-sm text-gray-500 mt-1">발신 이메일 주소</p>
            </div>
          </div>
        </div>

        {/* SMTP 서버 설정 */}
        <div>
          <p className="text-base font-semibold text-gray-800 mb-1.5">이메일 서버 설정</p>
          {form.smtpHost.includes("gmail") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
              <strong>Gmail 사용 시:</strong> 구글 계정에서{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                앱 비밀번호 만들기 →
              </a>{" "}
              후 아래 비밀번호 칸에 입력하세요. (일반 구글 비밀번호는 사용 불가)
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                서버 주소 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">포트 번호</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })}
                className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                아이디 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.smtpUsername}
                onChange={(e) => setForm({ ...form, smtpUsername: e.target.value })}
                placeholder="hong@gmail.com"
                className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호 <span className="text-red-500">*</span>
                {config && <span className="ml-1 text-sm text-gray-400 font-normal">(변경 시에만 입력)</span>}
              </label>
              <input
                type="password"
                value={form.smtpPass}
                onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                placeholder={config ? "변경하지 않으려면 비워두세요" : "비밀번호 입력"}
                autoComplete="current-password"
                className="w-full h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-blue-600"
              />
              <span className="text-base text-gray-700">
                보안 연결 사용 (포트 465 사용 시 체크)
              </span>
            </label>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-12 bg-navy-900 text-white rounded-lg font-semibold text-base hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              저장 중...
            </>
          ) : (
            "💾  설정 저장하기"
          )}
        </button>
      </div>

      {/* 테스트 이메일 발송 */}
      {config?.isActive && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">테스트 이메일 보내기</h2>
          </div>
          <p className="text-sm text-gray-600">
            설정이 올바른지 확인합니다. 수신함 또는 스팸함을 확인하세요.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") test(); }}
              placeholder="수신 이메일 주소 입력"
              className="flex-1 h-12 px-4 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
            <button
              onClick={test}
              disabled={testing || !testEmail}
              className="h-12 px-6 bg-blue-600 text-white rounded-lg text-base font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  발송 중
                </>
              ) : (
                "보내기"
              )}
            </button>
          </div>
        </div>
      )}

      {/* 역할별 안내 */}
      {role === "OWNER" && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-700">대리점장 안내</p>
            <p className="text-sm text-gray-600 mt-1">
              개인 이메일을 등록하면 내 이름으로 고객에게 발송됩니다.
              팀 전체의 발송 설정은{" "}
              <Link href="/settings/email" className="text-blue-600 underline">
                조직 이메일 설정
              </Link>
              에서 관리할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 피드백 메시지 */}
      {msg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl text-base ${
          msg.type === "ok"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {msg.type === "ok"
            ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────────────────────────────────────
export default function EmailSettingsPage() {
  const [role, setRole]   = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.role) setRole(d.role as UserRole);
      })
      .catch(() => { /* 역할 조회 실패 시 AGENT 기본값으로 처리 */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings"
          className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-navy-900">이메일 설정</h1>
          <p className="text-sm text-gray-500">내 이메일 계정으로 고객에게 자동 발송</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && role === "GLOBAL_ADMIN" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-semibold text-blue-800">시스템 관리자 안내</p>
            <p className="text-base text-blue-700 mt-1 leading-relaxed">
              관리자는 조직별 이메일 설정을 통해 관리합니다.
            </p>
            <Link
              href="/settings/organization"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-blue-700 underline hover:text-blue-900"
            >
              조직 설정으로 이동 →
            </Link>
          </div>
        </div>
      )}

      {!loading && role !== null && role !== "GLOBAL_ADMIN" && (
        <>
          {/* 상단 설명 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-base font-semibold text-gray-800">내 이메일로 고객에게 발송</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Gmail, Naver, 회사 이메일을 연결하면 고객에게 보내는 자동 이메일이
                내 이름과 주소로 발송됩니다.
              </p>
            </div>
          </div>

          <PersonalEmailForm role={role} />
        </>
      )}

      {!loading && role === null && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-base">로그인 정보를 확인할 수 없습니다.</p>
          <Link href="/login" className="text-blue-600 underline mt-2 inline-block">
            다시 로그인 →
          </Link>
        </div>
      )}
    </div>
  );
}
