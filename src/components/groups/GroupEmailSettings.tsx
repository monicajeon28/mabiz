"use client";

/**
 * 그룹 이메일 설정 탭 컴포넌트
 * Steve Jobs 50대 친화적 UI (제목 20px, 본문 16px, 버튼 48px)
 * 2026-06-16
 */

import { useState, useEffect, useCallback } from "react";
import { showError, showSuccess } from "@/components/ui/Toast";
import { logger } from "@/lib/logger";

// ─── 타입 ────────────────────────────────────────────────────────────────────

type EmailProvider = "GMAIL" | "SMTP" | "SENDGRID";

interface EmailConfig {
  id: string;
  groupId: string;
  emailProvider: EmailProvider;
  senderName: string;
  senderEmail: string;
  replyToEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpSecure: boolean | null;
  isActive: boolean;
  isVerified: boolean;
  testedAt: string | null;
  testResult: string | null;
}

interface FormState {
  emailProvider: EmailProvider;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  // SMTP
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecure: boolean;
  // 테스트
  testEmail: string;
}

interface Props {
  groupId: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function GroupEmailSettings({ groupId }: Props) {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [form, setForm] = useState<FormState>({
    emailProvider: "SMTP",
    senderName: "",
    senderEmail: "",
    replyToEmail: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUsername: "",
    smtpPassword: "",
    smtpSecure: false,
    testEmail: "",
  });

  // ─── 설정 조회 ──────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/email-config`);
      if (res.status === 200) {
        const data = await res.json() as EmailConfig | { message: string };
        // 설정이 없으면 message 필드만 있음
        if ("id" in data) {
          setConfig(data as EmailConfig);
          // 폼에 기존 값 채우기
          setForm((prev) => ({
            ...prev,
            emailProvider: (data as EmailConfig).emailProvider ?? "SMTP",
            senderName: (data as EmailConfig).senderName ?? "",
            senderEmail: (data as EmailConfig).senderEmail ?? "",
            replyToEmail: (data as EmailConfig).replyToEmail ?? "",
            smtpHost: (data as EmailConfig).smtpHost ?? "",
            smtpPort: String((data as EmailConfig).smtpPort ?? 587),
            smtpUsername: (data as EmailConfig).smtpUsername ?? "",
            smtpSecure: (data as EmailConfig).smtpSecure ?? false,
          }));
        }
      }
    } catch (err) {
      logger.error("[GroupEmailSettings] loadConfig", { err });
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ─── 저장 ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.senderName.trim()) {
      showError("보내는 사람 이름을 입력해주세요.");
      return;
    }
    if (!form.senderEmail.trim()) {
      showError("이메일 주소를 입력해주세요.");
      return;
    }
    if (form.emailProvider === "SMTP") {
      if (!form.smtpHost.trim()) { showError("서버 주소를 입력해주세요."); return; }
      if (!form.smtpUsername.trim()) { showError("아이디를 입력해주세요."); return; }
      if (!form.smtpPassword.trim() && !config) {
        showError("비밀번호를 입력해주세요."); return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        emailProvider: form.emailProvider,
        senderName: form.senderName.trim(),
        senderEmail: form.senderEmail.trim(),
        replyToEmail: form.replyToEmail.trim() || undefined,
      };

      if (form.emailProvider === "SMTP") {
        body.smtpHost = form.smtpHost.trim();
        body.smtpPort = Number(form.smtpPort) || 587;
        body.smtpUsername = form.smtpUsername.trim();
        body.smtpSecure = form.smtpSecure;
        if (form.smtpPassword.trim()) {
          body.smtpPassword = form.smtpPassword;
        }
      }

      const res = await fetch(`/api/groups/${groupId}/email-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { message?: string; error?: string; config?: EmailConfig };

      if (res.ok) {
        showSuccess("이메일 설정이 저장됐습니다!");
        // 저장 후 최신 설정 다시 불러오기
        await loadConfig();
      } else {
        showError(data.error || "저장에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[GroupEmailSettings] handleSave", { err });
      showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 테스트 이메일 ──────────────────────────────────────────────────────────

  const handleTest = async () => {
    if (!config?.id) {
      showError("먼저 설정을 저장해주세요.");
      return;
    }
    if (!form.testEmail.trim()) {
      showError("테스트 이메일 주소를 입력해주세요.");
      return;
    }

    setTesting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/email-config/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailConfigId: config.id,
          testEmail: form.testEmail.trim(),
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (data.success) {
        showSuccess(data.message || "테스트 이메일이 발송됐습니다!");
        await loadConfig();
      } else {
        showError(data.message || data.error || "테스트에 실패했습니다.");
      }
    } catch (err) {
      logger.error("[GroupEmailSettings] handleTest", { err });
      showError("테스트 중 오류가 발생했습니다.");
    } finally {
      setTesting(false);
    }
  };

  // ─── 공통 입력 스타일 ────────────────────────────────────────────────────────

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";

  // ─── 로딩 ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse mb-4 w-1/3" />
        <div className="h-6 bg-gray-100 rounded animate-pulse mb-2 w-2/3" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ─── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── 섹션 제목 ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">📧 이메일 자동 발송 설정</h2>
        <p className="mt-2 text-base text-gray-600">
          이 그룹에 신청한 분들에게 이메일을 보낼 계정을 연결하세요.
        </p>
      </div>

      {/* ── 현재 상태 배지 ────────────────────────────────────────────── */}
      {config && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
          <span
            className={`inline-block w-3 h-3 rounded-full shrink-0 ${
              config.isActive && config.isVerified ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <div>
            <span className="text-base font-semibold text-gray-800">
              {config.isActive && config.isVerified ? "연결됨" : "미연결 (테스트 필요)"}
            </span>
            {config.testedAt && (
              <p className="text-sm text-gray-500 mt-0.5">
                마지막 테스트:{" "}
                {new Date(config.testedAt).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── 이메일 계정 선택 ──────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <p className="text-base font-semibold text-gray-800">
          어떤 이메일 계정을 쓰실건가요?
        </p>

        {(
          [
            { value: "GMAIL" as EmailProvider, label: "지메일 (구글 계정)", hint: "가장 쉬운 방법" },
            { value: "SMTP" as EmailProvider, label: "회사 이메일 서버 (SMTP)", hint: "" },
            { value: "SENDGRID" as EmailProvider, label: "SendGrid", hint: "" },
          ] as { value: EmailProvider; label: string; hint: string }[]
        ).map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
              form.emailProvider === opt.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            style={{ minHeight: "48px" }}
          >
            <input
              type="radio"
              name="emailProvider"
              value={opt.value}
              checked={form.emailProvider === opt.value}
              onChange={() =>
                setForm((prev) => ({ ...prev, emailProvider: opt.value }))
              }
              className="w-5 h-5 accent-blue-500 shrink-0"
            />
            <span className="text-base font-medium text-gray-800">
              {opt.label}
            </span>
            {opt.hint && (
              <span className="ml-auto text-sm text-blue-600 font-medium">
                ← {opt.hint}
              </span>
            )}
          </label>
        ))}
      </div>

      {/* ── 지메일 선택 시 안내 ───────────────────────────────────────── */}
      {form.emailProvider === "GMAIL" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
          <p className="text-base font-semibold text-yellow-900">
            🔧 지메일 연동 준비 중
          </p>
          <p className="text-base text-yellow-800">
            지메일 OAuth 연동은 곧 지원됩니다. 지금은{" "}
            <strong>회사 이메일 서버(SMTP)</strong>를 선택해주세요.
          </p>
          <p className="text-sm text-yellow-700">
            지메일 앱 비밀번호를 SMTP로 설정하면 지금도 사용할 수 있습니다.
            <br />
            서버: smtp.gmail.com / 포트: 587 / 보안: TLS 사용
          </p>
        </div>
      )}

      {/* ── SendGrid 선택 시 안내 ─────────────────────────────────────── */}
      {form.emailProvider === "SENDGRID" && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
          <p className="text-base font-semibold text-purple-900">
            🔧 SendGrid 연동 준비 중
          </p>
          <p className="text-base text-purple-800 mt-1">
            SendGrid 연동은 곧 지원됩니다. 지금은{" "}
            <strong>회사 이메일 서버(SMTP)</strong>를 선택해주세요.
          </p>
        </div>
      )}

      {/* ── SMTP 폼 ───────────────────────────────────────────────────── */}
      {form.emailProvider === "SMTP" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

          {/* 보내는 사람 이름 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              보내는 사람 이름
            </label>
            <input
              type="text"
              value={form.senderName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, senderName: e.target.value }))
              }
              placeholder="마비즈 크루즈"
              className={inputClass}
              style={{ height: "48px" }}
            />
          </div>

          {/* 이메일 주소 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              이메일 주소
            </label>
            <input
              type="email"
              value={form.senderEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, senderEmail: e.target.value }))
              }
              placeholder="marketing@company.com"
              className={inputClass}
              style={{ height: "48px" }}
            />
          </div>

          {/* 답장받을 이메일 (선택) */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              답장받을 이메일{" "}
              <span className="font-normal text-gray-500">(선택)</span>
            </label>
            <input
              type="email"
              value={form.replyToEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, replyToEmail: e.target.value }))
              }
              placeholder="reply@company.com"
              className={inputClass}
              style={{ height: "48px" }}
            />
          </div>

          <hr className="border-gray-100" />

          {/* 서버 주소 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              서버 주소
            </label>
            <input
              type="text"
              value={form.smtpHost}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtpHost: e.target.value }))
              }
              placeholder="smtp.gmail.com"
              className={inputClass}
              style={{ height: "48px" }}
            />
          </div>

          {/* 포트번호 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              포트번호
            </label>
            <input
              type="number"
              value={form.smtpPort}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtpPort: e.target.value }))
              }
              placeholder="587"
              className={inputClass}
              style={{ height: "48px" }}
            />
            <p className="mt-1 text-sm text-gray-500">
              일반적으로 587 (TLS) 또는 465 (SSL)을 사용합니다.
            </p>
          </div>

          {/* 아이디 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              아이디
            </label>
            <input
              type="email"
              value={form.smtpUsername}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtpUsername: e.target.value }))
              }
              placeholder="user@gmail.com"
              className={inputClass}
              style={{ height: "48px" }}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              비밀번호{config && <span className="font-normal text-gray-500 ml-1">(변경하려면 새 비밀번호 입력)</span>}
            </label>
            <input
              type="password"
              value={form.smtpPassword}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtpPassword: e.target.value }))
              }
              placeholder={config ? "••••••••  (변경 없으면 비워두세요)" : "앱 비밀번호 입력"}
              className={inputClass}
              style={{ height: "48px" }}
              autoComplete="new-password"
            />
          </div>

          {/* 보안 연결 */}
          <label
            className="flex items-center gap-3 cursor-pointer"
            style={{ minHeight: "48px" }}
          >
            <input
              type="checkbox"
              checked={form.smtpSecure}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, smtpSecure: e.target.checked }))
              }
              className="w-5 h-5 accent-blue-500 shrink-0"
            />
            <span className="text-base text-gray-800">
              ✅ 보안 연결 사용 (TLS/SSL)
            </span>
          </label>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition"
            style={{ height: "52px", fontSize: "16px" }}
          >
            {saving ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                저장 중...
              </>
            ) : (
              "💾 저장하기"
            )}
          </button>
        </div>
      )}

      {/* ── 테스트 이메일 섹션 (SMTP + 저장된 설정 있을 때) ─────────── */}
      {form.emailProvider === "SMTP" && config?.id && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <p className="text-base font-semibold text-gray-800">
            📨 테스트 이메일 보내기
          </p>
          <p className="text-sm text-gray-600">
            실제로 이메일이 잘 가는지 확인해보세요.
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              테스트 받을 이메일 주소
            </label>
            <input
              type="email"
              value={form.testEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, testEmail: e.target.value }))
              }
              placeholder="test@example.com"
              className={inputClass}
              style={{ height: "48px" }}
            />
          </div>

          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-xl transition"
            style={{ height: "52px", fontSize: "16px" }}
          >
            {testing ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                테스트 중...
              </>
            ) : (
              "📨 테스트 이메일 보내기"
            )}
          </button>

          {/* 마지막 테스트 결과 */}
          {config.testResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                config.testResult === "SUCCESS"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              <span className="shrink-0">
                {config.testResult === "SUCCESS" ? "✅" : "❌"}
              </span>
              <span>
                {config.testResult === "SUCCESS"
                  ? "마지막 테스트 성공 — 이메일이 정상적으로 발송됩니다."
                  : "마지막 테스트 실패 — 설정을 다시 확인해주세요."}
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
