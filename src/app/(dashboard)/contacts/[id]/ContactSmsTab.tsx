"use client";

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
}

export default function ContactSmsTab({ smsLogs, smsLoading }: ContactSmsTabProps) {
  return (
    <div className="space-y-2">
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
    </div>
  );
}
