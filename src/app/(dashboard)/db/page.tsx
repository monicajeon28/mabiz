"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload, Download, Database, Users, CheckCircle,
  AlertCircle, Loader2, FileSpreadsheet, Info, ChevronDown
} from "lucide-react";
import { IMPORT_CONFIGS, type ImportTarget } from "@/lib/import-config";

type Stats = { total: number; leads: number; customers: number; optOut: number };
type Group = { id: string; name: string; memberCount: number };

export default function DbPage() {
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [exportType,   setExportType]   = useState("all");
  const [groups,       setGroups]       = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [importTarget, setImportTarget] = useState<ImportTarget>("b2c");
  const [errorsOpen,   setErrorsOpen]   = useState(false);
  const [importHint,   setImportHint]   = useState("처리 중...");
  const [rowEstimate,  setRowEstimate]  = useState<number | null>(null);
  const [result,       setResult]       = useState<{
    type: "ok" | "err";
    text: string;
    successCount?: number;
    skipCount?: number;
    validationSkipCount?: number;
    processErrorCount?: number;
    errors?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 통계 로드 (단일 /api/team/crm-stats 호출) ───────────────
  function loadStats(signal?: AbortSignal) {
    fetch("/api/team/crm-stats", signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.summary) {
          setStats({
            total: d.summary.totalContacts ?? 0,
            leads: d.summary.totalLeads ?? 0,
            customers: d.summary.totalCustomers ?? 0,
            optOut: 0,
          });
        }
      })
      .catch(() => { /* silent fail */ });
  }

  // ── 그룹 로드 (AbortController로 stale fetch 방지) ──────────
  function loadGroups(signal?: AbortSignal) {
    fetch("/api/groups", signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setGroups(
          (d.groups ?? []).map((g: { id: string; name: string; _count?: { members: number } }) => ({
            id:          g.id,
            name:        g.name,
            memberCount: g._count?.members ?? 0,
          }))
        );
      })
      .catch(() => { /* 실패 시 기존 목록 유지 — silent fail */ });
  }

  // ── 마운트 시 최초 1회 로드 ────────────────────────────────
  useEffect(() => {
    loadStats();
    loadGroups();
    setGroupsLoaded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 탭 복귀 시 통계·그룹 자동 갱신 (메모리 누수 방지) ──────
  useEffect(() => {
    const ctrl = new AbortController();
    const onVisible = () => {
      if (!document.hidden) {
        loadStats(ctrl.signal);
        loadGroups(ctrl.signal);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      ctrl.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImportNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res  = await fetch(`/api/import?target=${importTarget}`, { method: "POST", body: fd });
      const data = await res.json();

      if (data.ok) {
        const msgParts: string[] = [`✅ ${data.successCount}건 가져오기 완료`];
        if (data.skipCount > 0) msgParts.push(`건너뜀 ${data.skipCount}건`);
        if (data.validationSkipCount > 0) msgParts.push(`검증 제외 ${data.validationSkipCount}건`);
        if (data.processErrorCount > 0) msgParts.push(`처리 오류 ${data.processErrorCount}건`);

        setResult({
          type: "ok",
          text: msgParts.join(" | ") + "\nGoogle Drive에 자동 백업 중...",
          successCount: data.successCount,
          skipCount:    data.skipCount,
          validationSkipCount: data.validationSkipCount,
          processErrorCount: data.processErrorCount,
          errors:       data.errors,
        });
        // 통계 새로고침
        loadStats();
      } else {
        setResult({ type: "err", text: data.message ?? "가져오기 실패" });
      }
    } catch (error) {
      setResult({ type: "err", text: "오류 발생: " + (error instanceof Error ? error.message : "알 수 없음") });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const estimate = Math.ceil(file.size / 1024);
      setRowEstimate(estimate);
      if (estimate > 1000) {
        setImportHint(`⚠️ 약 ${estimate.toLocaleString()}행으로 추정됩니다. 1000행 초과이므로 파일을 나누어 업로드하세요.`);
      } else {
        setImportHint("처리 중...");
      }
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      let params = "";
      if (exportType.startsWith("type:")) {
        params = `?type=${exportType.replace("type:", "").toUpperCase()}`;
      } else if (exportType.startsWith("group:")) {
        params = `?groupId=${exportType.replace("group:", "")}`;
      }
      const res = await fetch(`/api/contacts/export${params}`);

      if (res.ok) {
        const blob     = await res.blob();
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement("a");
        a.href         = url;
        a.download     = `고객목록_${new Date().toLocaleDateString("ko-KR").replace(/\./g, "")}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
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
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-navy-900" />
          <h2 className="font-semibold text-gray-900">엑셀 가져오기</h2>
        </div>

        {/* 대량 업로드 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <p className="font-semibold text-amber-900 mb-2">📋 대량 업로드 안내</p>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• 최대 1000행까지 한 번에 업로드 가능합니다</li>
            <li>• 1000행 초과 시 파일을 나누어 업로드하세요</li>
            <li>• 업로드 중 창을 닫지 마세요</li>
            <li>• 중복 데이터는 자동으로 업데이트됩니다</li>
            <li>• 완료 후 자동으로 Google Drive에 백업됩니다</li>
          </ul>
        </div>

        {/* 탭 */}
        <div className="flex gap-4 border-b border-gray-200 mb-4">
          {(["b2c", "b2b_buyer", "b2b_inquiry"] as const).map((target) => {
            const config = IMPORT_CONFIGS[target];
            const borderColor =
              target === "b2c" ? "border-navy-900" :
              target === "b2b_buyer" ? "border-green-700" :
              "border-blue-600";
            const isActive = importTarget === target;
            return (
              <button
                key={target}
                onClick={() => {
                  setImportTarget(target);
                  setResult(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className={`pb-2 text-sm font-medium transition-colors ${
                  isActive
                    ? `text-gray-900 border-b-2 ${borderColor}`
                    : "text-gray-500 border-b-2 border-transparent hover:text-gray-700"
                }`}
              >
                {config.label}
              </button>
            );
          })}
        </div>

        {/* 컬럼 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium flex items-center gap-1.5">
              <Info className="w-4 h-4" /> 엑셀 파일 형식 안내
            </p>
            <a
              href={`/api/import/sample?target=${importTarget}`}
              download="cruisedot_import_sample.xlsx"
              className="flex items-center gap-1 text-xs bg-white border border-blue-300 text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              샘플 다운로드
            </a>
          </div>
          <p>첫 행이 헤더여야 합니다. 지원 컬럼명:</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {IMPORT_CONFIGS[importTarget].columns.map((col) => (
              <span key={col.name} className="bg-blue-100 px-2 py-0.5 rounded text-xs">
                {col.label}
              </span>
            ))}
          </div>
        </div>

        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          importing ? "border-gray-200 bg-gray-50" : "border-gray-300 hover:border-gold-400 hover:bg-gold-50/30"
        }`}>
          {importing ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{importHint}</span>
            </div>
          ) : (
            <div className="text-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">xlsx 파일 클릭하거나 드래그</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx, .xls 지원</p>
              {rowEstimate && rowEstimate > 1000 && (
                <p className="text-xs text-red-500 mt-2 font-medium">⚠️ 약 {rowEstimate.toLocaleString()}행 (1000행 초과)</p>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              handleFileSelect(e);
              handleImportNew(e);
            }}
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
            <option value="type:LEAD">잠재고객만</option>
            <option value="type:CUSTOMER">구매완료만</option>
            {groupsLoaded && groups.length > 0 && (
              <optgroup label="그룹별">
                {groups.map((g) => (
                  <option key={g.id} value={`group:${g.id}`}>
                    {g.name} ({g.memberCount}명)
                  </option>
                ))}
              </optgroup>
            )}
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
              <button
                onClick={() => setErrorsOpen(!errorsOpen)}
                className="flex items-center gap-1.5 text-xs text-red-600 font-medium hover:text-red-700 transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${errorsOpen ? "rotate-180" : ""}`}
                />
                오류 목록 ({result.errors.length}건)
              </button>
              {errorsOpen && (
                <div className="mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-500">• {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
