"use client";

import { memo } from "react";
import { Send, AlarmClock } from "lucide-react";

interface SmsLog {
  id: string;
  phone: string;
  contentPreview: string;
  status: string;
  channel: string;
  sentAt: string;
}

interface ContactSmsTabProps {
  smsLogs: SmsLog[];
  smsLoading: boolean;
  onOpenSmsModal?: () => void;
  onOpenSchedModal?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

function ContactSmsTabComponent({ smsLogs, smsLoading, onOpenSmsModal, onOpenSchedModal, hasMore, onLoadMore }: ContactSmsTabProps) {
  return (
    <div className="space-y-2">
      {/* 발송 바로가기 버튼 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={onOpenSmsModal}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Send className="w-4 h-4" />
          즉시 발송
        </button>
        <button
          onClick={onOpenSchedModal}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <AlarmClock className="w-4 h-4" />
          예약 발송
        </button>
      </div>

      <p className="text-xs font-semibold text-gray-500 px-1 mb-1">발송 내역</p>
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
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-xl mt-2"
        >
          더 보기
        </button>
      )}
    </div>
  );
}

export default memo(ContactSmsTabComponent);
