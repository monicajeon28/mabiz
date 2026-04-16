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
  reEngageMsg1?:   string | null;
  reEngageMsg2?:   string | null;
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
  const [reEngageMsg1, setReEngageMsg1] = useState("");
  const [reEngageMsg2, setReEngageMsg2] = useState("");
  const [savingReEngage, setSavingReEngage] = useState(false);

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
          setReEngageMsg1(d.config.reEngageMsg1 ?? "");
          setReEngageMsg2(d.config.reEngageMsg2 ?? "");
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
              <p className="text-xs text-blue-700 font-medium">
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
          <p className="text-xs text-gray-400">야간(21시~8시)에는 자동으로 발송이 차단됩니다.</p>
        </div>
      )}

      {/* 재진입 메시지 커스터마이즈 (WO-26) */}
      {config.id && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">🔄 이탈 고객 재진입 메시지</h2>
            <p className="text-xs text-gray-400">
              14일 이상 무응답 LEAD에게 매일 오전 10시 자동 발송. 비워두면 시스템 기본 메시지 사용.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">1차 메시지 (첫 재진입)</label>
            <textarea
              value={reEngageMsg1}
              onChange={(e) => setReEngageMsg1(e.target.value)}
              placeholder={"[고객명]님, 안녕하세요! 크루즈닷입니다 🚢\n새로운 크루즈 일정이 출시됐어요. 잠깐 확인해보세요!"}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{reEngageMsg1.length}자</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">2차 메시지 (7일 후)</label>
            <textarea
              value={reEngageMsg2}
              onChange={(e) => setReEngageMsg2(e.target.value)}
              placeholder={"[고객명]님, 크루즈닷입니다.\n지난번에 관심 보여주셨는데 혹시 아직 고민 중이신가요?\n편한 시간에 연락 주시면 최적의 일정을 찾아드릴게요 🙏"}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{reEngageMsg2.length}자</p>
          </div>
          <button
            onClick={saveReEngageMsg}
            disabled={savingReEngage}
            className="w-full bg-navy-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {savingReEngage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            재진입 메시지 저장
          </button>
          <p className="text-xs text-gray-400">치환변수: [고객명] [이름]</p>
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
