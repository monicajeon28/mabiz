"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

const SMTP_PRESETS = [
  { label: "Gmail",      host: "smtp.gmail.com",     port: 587 },
  { label: "Naver",      host: "smtp.naver.com",      port: 465 },
  { label: "Daum/Kakao", host: "smtp.daum.net",       port: 465 },
  { label: "직접 입력",  host: "",                    port: 587 },
];

export default function EmailSettingsPage() {
  const [form, setForm] = useState({
    senderName: "", senderEmail: "",
    smtpHost: "smtp.gmail.com", smtpPort: 587,
    smtpUser: "", smtpPass: "",
  });
  const [configured, setConfigured] = useState(false);
  const [testEmail, setTestEmail]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/email")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.config) {
          setConfigured(true);
          setForm((f) => ({
            ...f,
            senderName:  d.config.senderName  ?? "",
            senderEmail: d.config.senderEmail ?? "",
            smtpHost:    d.config.smtpHost    ?? "smtp.gmail.com",
            smtpPort:    d.config.smtpPort    ?? 587,
            smtpUser:    d.config.smtpUser    ?? "",
          }));
        }
      });
  }, []);

  const applyPreset = (preset: typeof SMTP_PRESETS[0]) => {
    if (preset.host) setForm((f) => ({ ...f, smtpHost: preset.host, smtpPort: preset.port }));
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    const res  = await fetch("/api/settings/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setMsg({ type: data.ok ? "ok" : "err", text: data.ok ? "저장되었습니다." : (data.message ?? "저장 실패") });
    if (data.ok) setConfigured(true);
    setSaving(false);
  };

  const test = async () => {
    if (!testEmail) return;
    setTesting(true); setMsg(null);
    const res  = await fetch("/api/settings/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testEmail }),
    });
    const data = await res.json();
    setMsg({ type: data.ok ? "ok" : "err", text: data.message ?? (data.ok ? "발송 성공" : "발송 실패") });
    setTesting(false);
  };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-navy-900">이메일 설정</h1>
          <p className="text-sm text-gray-500">내 이메일 주소로 자동 발송 연동</p>
        </div>
      </div>

      {configured && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm font-medium text-green-800">이메일 연동 완료 — {form.senderEmail}</p>
        </div>
      )}

      {/* SMTP 프리셋 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {SMTP_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              form.smtpHost === p.host
                ? "bg-navy-900 text-white border-navy-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발신자 이름</label>
            <input
              type="text"
              value={form.senderName}
              onChange={(e) => setForm({ ...form, senderName: e.target.value })}
              placeholder="홍길동 팀장"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발신 이메일 <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.senderEmail}
              onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
              placeholder="me@gmail.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP 호스트 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.smtpHost}
              onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">포트</label>
            <input
              type="number"
              value={form.smtpPort}
              onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SMTP 계정 <span className="text-red-500">*</span></label>
          <input
            type="email"
            value={form.smtpUser}
            onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
            placeholder="me@gmail.com"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            비밀번호 <span className="text-red-500">*</span>
            {form.smtpHost.includes("gmail") && (
              <span className="ml-1 text-xs text-blue-600 font-normal">Gmail은 앱 비밀번호 사용</span>
            )}
          </label>
          <input
            type="password"
            value={form.smtpPass}
            onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
            placeholder={configured ? "변경 시에만 입력" : "비밀번호"}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
          {form.smtpHost.includes("gmail") && (
            <p className="text-xs text-gray-400 mt-1">
              Google 계정 → 보안 → 2단계 인증 ON → 앱 비밀번호 생성
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-navy-900 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* 테스트 발송 */}
      {configured && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gold-500" /> 테스트 이메일 발송
          </h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="수신 이메일 주소"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
            />
            <button
              onClick={test}
              disabled={testing || !testEmail}
              className="px-4 py-2 bg-gold-500 text-navy-900 rounded-lg text-sm font-medium hover:bg-gold-300 disabled:opacity-50 flex items-center gap-1"
            >
              {testing && <Loader2 className="w-3 h-3 animate-spin" />}
              발송
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mt-3 text-sm ${
          msg.type === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
