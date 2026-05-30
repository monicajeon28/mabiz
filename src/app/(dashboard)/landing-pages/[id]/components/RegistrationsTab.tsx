"use client";

import { Users, ChevronLeft, ChevronRight, Download } from "lucide-react";

type Registration = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  utmSource: string | null;
  funnelStarted: boolean;
  createdAt: string;
};

interface Props {
  registrations: Registration[];
  regTotal: number;
  regPage: number;
  regLoading: boolean;
  onPageChange: (page: number) => void;
}

export function RegistrationsTab({ registrations, regTotal, regPage, regLoading, onPageChange }: Props) {
  // T30: CSV 내보내기
  const handleCsvExport = () => {
    const csvData = registrations.map((r) =>
      `${r.name},${r.phone},${r.email ?? ""},${r.createdAt}`
    ).join("\n");
    const blob = new Blob(["이름,전화번호,이메일,신청일\n" + csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `등록자_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (regLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 등록자가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">총 <strong>{regTotal}</strong>명 등록</p>
        {registrations.length > 0 && (
          <button
            onClick={handleCsvExport}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-900 border border-gray-200 hover:border-gray-400 rounded-lg px-2.5 py-1 transition-colors"
          >
            <Download className="w-3 h-3" /> CSV 내보내기
          </button>
        )}
      </div>
      <div className="space-y-2">
        {registrations.map((r) => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{r.phone}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString("ko-KR")}</p>
              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                {r.funnelStarted && (
                  <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">퍼널진입</span>
                )}
                {r.utmSource && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{r.utmSource}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {regTotal > 20 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => onPageChange(regPage - 1)} disabled={regPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500">{regPage} / {Math.ceil(regTotal / 20)}</span>
          <button onClick={() => onPageChange(regPage + 1)} disabled={regPage >= Math.ceil(regTotal / 20)} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
