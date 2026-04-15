"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload, Download, Database, Users, CheckCircle,
  AlertCircle, Loader2, FileSpreadsheet, Info
} from "lucide-react";

type Stats = { total: number; leads: number; customers: number; optOut: number };

export default function DbPage() {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [importing,  setImporting]  = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [exportType, setExportType] = useState("all");
  const [result,     setResult]     = useState<{
    type: "ok" | "err";
    text: string;
    successCount?: number;
    skipCount?: number;
    errors?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/contacts?limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          // 간략 통계 (별도 API 없이 total 활용)
          setStats({ total: d.total, leads: 0, customers: 0, optOut: 0 });
        }
      });
    // 상세 통계
    Promise.all([
      fetch("/api/contacts?limit=1&type=LEAD").then((r) => r.json()),
      fetch("/api/contacts?limit=1&type=CUSTOMER").then((r) => r.json()),
    ]).then(([leads, customers]) => {
      setStats((prev) =>
        prev
          ? { ...prev, leads: leads.total ?? 0, customers: customers.total ?? 0 }
          : null
      );
    });
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);

    const res  = await fetch("/api/contacts/import", { method: "POST", body: fd });
    const data = await res.json();

    if (data.ok) {
      setResult({
        type: "ok",
        text: `✅ ${data.successCount}명 가져오기 완료` + (data.skipCount > 0 ? ` (건너뜀 ${data.skipCount}건)` : ""),
        successCount: data.successCount,
        skipCount:    data.skipCount,
        errors:       data.errors,
      });
      // 통계 새로고침
      fetch("/api/contacts?limit=1")
        .then((r) => r.json())
        .then((d) => setStats((prev) => prev ? { ...prev, total: d.total } : null));
    } else {
      setResult({ type: "err", text: data.message ?? "가져오기 실패" });
    }

    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleExport = async () => {
    setExporting(true);
    const params = exportType !== "all" ? `?type=${exportType.toUpperCase()}` : "";
    const res    = await fetch(`/api/contacts/export${params}`);

    if (res.ok) {
      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = url;
      a.download     = `고객목록_${new Date().toLocaleDateString("ko-KR").replace(/\./g, "")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-navy-900 mb-6">DB 관리</h1>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "전체 고객",  value: stats.total,     color: "bg-navy-900 text-white" },
            { label: "잠재고객",   value: stats.leads,     color: "bg-blue-50 text-blue-800" },
            { label: "구매완료",   value: stats.customers, color: "bg-green-50 text-green-800" },
            { label: "수신거부",   value: stats.optOut,    color: "bg-gray-50 text-gray-600" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
              <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
              <p className="text-sm mt-0.5 opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* 가져오기 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-5 h-5 text-navy-900" />
          <h2 className="font-semibold text-gray-900">엑셀 가져오기</h2>
        </div>

        {/* 컬럼 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          <p className="font-medium mb-1 flex items-center gap-1.5">
            <Info className="w-4 h-4" /> 엑셀 파일 형식 안내
          </p>
          <p>첫 행이 헤더여야 합니다. 지원 컬럼명:</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {["이름(필수)", "전화번호(필수)", "이메일", "관심크루즈", "예산", "메모", "유형"].map((c) => (
              <span key={c} className="bg-blue-100 px-2 py-0.5 rounded text-xs">{c}</span>
            ))}
          </div>
        </div>

        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          importing ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-gold-400 hover:bg-gold-50/30"
        }`}>
          {importing ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">처리 중...</span>
            </div>
          ) : (
            <div className="text-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">xlsx 파일 클릭하거나 드래그</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx, .xls 지원</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* 내보내기 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-5 h-5 text-navy-900" />
          <h2 className="font-semibold text-gray-900">엑셀 내보내기</h2>
        </div>

        <div className="flex gap-2">
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold-500"
          >
            <option value="all">전체 고객</option>
            <option value="lead">잠재고객만</option>
            <option value="customer">구매완료만</option>
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-navy-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "다운로드 중..." : "엑셀 다운로드"}
          </button>
        </div>
      </div>

      {/* 결과 메시지 */}
      {result && (
        <div className={`flex flex-col gap-2 p-4 rounded-xl ${
          result.type === "ok"
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200"
        }`}>
          <div className="flex items-center gap-2">
            {result.type === "ok"
              ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
            <p className={`text-sm font-medium ${result.type === "ok" ? "text-green-800" : "text-red-800"}`}>
              {result.text}
            </p>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="ml-7">
              <p className="text-xs text-red-600 font-medium mb-1">오류 목록:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">• {e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
