"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MessageSquare, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

type Config = {
  id?:             string;
  aligoUserId?:    string;
  senderPhone?:    string;
  isActive?:       boolean;
  senderVerified?: boolean;
  verifiedAt?:     string | null;
  updatedAt?:      string;
};

export default function SmsSettingsPage() {
  const [config, setConfig]       = useState<Config>({});
  const [form, setForm]           = useState({ aligoKey: "", aligoUserId: "", senderPhone: "" });
  const [testPhone, setTestPhone] = useState("");
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [verifying, setVerifying]   = useState(false);
  const [verifyStep, setVerifyStep] = useState<"idle" | "requested" | "done">("idle");
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/sms")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config) {
          setConfig(d.config);
          setForm((f) => ({
            ...f,
            aligoUserId:  d.config.aligoUserId  ?? "",
            senderPhone:  d.config.senderPhone   ?? "",
          }));
        }
      });
  }, []);

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

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-navy-900">SMS 설정</h1>
          <p className="text-sm text-gray-500">Aligo API 연동 (카카오 제외)</p>
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
              {config.senderVerified ? "✅ 발신번호 인증 완료" : "⚠️ 발신번호 미인증 — 문자 발송이 차단될 수 있습니다"}
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
          <p className="text-xs text-gray-400 mt-1">Aligo에 등록된 발신번호와 동일해야 합니다.</p>
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
          <p className="text-xs text-gray-500">
            미인증 번호로 발송하면 통신사에서 차단됩니다. Aligo ARS 인증을 완료하세요.
          </p>
          {verifyStep === "idle" && (
            <button
              onClick={requestVerify}
              disabled={verifying}
              className="w-full border border-yellow-400 text-yellow-800 py-2 rounded-lg text-sm font-medium hover:bg-yellow-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
              인증 전화 요청하기
            </button>
          )}
          {verifyStep === "requested" && (
            <div className="space-y-2">
              <p className="text-xs text-green-700 font-medium">
                ✅ 인증 전화가 발송됩니다. ARS 안내에 따라 인증번호를 입력한 후 아래 버튼을 누르세요.
              </p>
              <button
                onClick={confirmVerify}
                disabled={verifying}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                ARS 입력 완료 — 인증 확인
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
          <p className="text-xs text-gray-400">야간(21시~8시)에는 자동으로 발송이 차단됩니다.</p>
        </div>
      )}

      {/* 결과 메시지 */}
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
    </div>
  );
}
