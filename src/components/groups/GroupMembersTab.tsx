"use client";

import { useState, useEffect, useCallback } from "react";

interface Member {
  contactId: string;
  name: string;
  phone: string;
  addedAt: string;
  daysSince: number;
  ipAddress: string | null;
  deviceType: string | null;
  referer: string | null;
  source: string | null;
  landingTitle: string | null;
}

function deviceLabel(d: string | null): string {
  if (d === "mobile") return "📱 휴대폰";
  if (d === "desktop") return "💻 PC";
  return "—";
}

/** 그룹에 들어온 신청 고객 목록 + 어디서·어떤 기기·어떤 IP로 신청했는지 표시. */
export function GroupMembersTab({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/groups/${groupId}/members?limit=100`);
      const data = await r.json();
      if (data?.ok) {
        setMembers(data.members);
        setTotal(data.total);
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <p className="text-base text-gray-600">
          이 그룹에 들어온 신청 고객 <b>{total}</b>명 · 어디서·어떤 기기로 신청했는지 보여요
        </p>
        <button
          type="button"
          onClick={load}
          className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-base text-gray-700"
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-base text-gray-400">불러오는 중…</p>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-base text-gray-500">
          아직 신청한 고객이 없어요.
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div
              key={m.contactId}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-navy-900">{m.name}</span>
                <span className="text-sm text-gray-500">
                  {m.daysSince === 0 ? "오늘 신청" : `${m.daysSince}일 전 신청`}
                </span>
              </div>
              <div className="mt-1 text-base text-gray-700">📞 {m.phone}</div>

              {/* 신청 출처/기기 — 랜딩 신청 기록 있을 때 */}
              <div className="mt-3 grid grid-cols-1 gap-1.5 rounded-lg bg-slate-50 p-3 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <span className="text-gray-400">어디서</span>{" "}
                  {m.landingTitle ? (
                    <span className="font-medium">{m.landingTitle}</span>
                  ) : (
                    <span className="text-gray-400">신청 경로 정보 없음</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">기기</span> {deviceLabel(m.deviceType)}
                </div>
                <div>
                  <span className="text-gray-400">IP</span>{" "}
                  {m.ipAddress ? (
                    <span className="font-mono">{m.ipAddress}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">유입</span>{" "}
                  {m.source ? <span>{m.source}</span> : <span className="text-gray-400">직접/기타</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        ※ IP·기기·유입 정보는 랜딩페이지로 신청한 고객만 표시돼요. (이 그룹과 연결된 랜딩 기준)
      </p>
    </div>
  );
}
