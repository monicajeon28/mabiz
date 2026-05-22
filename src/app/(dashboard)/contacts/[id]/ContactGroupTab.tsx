"use client";

import { useMemo, memo } from "react";
import { GitBranch } from "lucide-react";

interface Group {
  id: string;
  name: string;
  funnelId?: string | null;
}

interface Funnel {
  id: string;
  name: string;
  funnelType: string;
}

interface TransferLog {
  id: string;
  createdAt: string;
  transferType: string;
  newContactId: string | null;
  transferredBy: string;
  fromOrg: { name: string } | null;
  toOrg: { name: string } | null;
  toUserName: string | null;
  toUserOrgName: string | null;
  canRecall: boolean;
}

interface VipSequence {
  id: string;
  funnelId: string;
  status: string;
  startDate: string;
}

interface Contact {
  id: string;
  groups: { group: { id: string; name: string } }[];
  vipSequences?: VipSequence[];
}

interface ContactGroupTabProps {
  contact: Contact;
  allGroups: Group[];
  selectedGroup: string;
  setSelectedGroup: (id: string) => void;
  assigning: boolean;
  assignMsg: string;
  assignGroup: () => Promise<void>;
  funnels: Funnel[];
  selectedFunnelId: string;
  setSelectedFunnelId: (id: string) => void;
  enrollStartDate: string;
  setEnrollStartDate: (date: string) => void;
  enrollSendNow: boolean;
  setEnrollSendNow: (send: boolean) => void;
  enrolling: boolean;
  setEnrolling: (enrolling: boolean) => void;
  enrollError: string;
  setEnrollError: (error: string) => void;
  handleFunnelEnroll: () => Promise<void>;
  transferLogs: TransferLog[];
  loadingTransfer: boolean;
}

function ContactGroupTabComponent({
  contact, allGroups, selectedGroup, setSelectedGroup, assigning, assignMsg, assignGroup,
  funnels, selectedFunnelId, setSelectedFunnelId, enrollStartDate, setEnrollStartDate,
  enrollSendNow, setEnrollSendNow, enrolling, setEnrolling, enrollError, setEnrollError,
  handleFunnelEnroll, transferLogs, loadingTransfer,
}: ContactGroupTabProps) {
  const currentGroups = contact.groups.map((g) => g.group);
  const availableGroups = allGroups.filter((g) => !currentGroups.some((cg) => cg.id === g.id));
  const enrolledFunnelIds = useMemo(() => {
    return new Set((contact.vipSequences ?? []).map((s) => s.funnelId));
  }, [contact.vipSequences]);

  return (
    <div className="space-y-4">
      {/* 그룹 배정 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gold-500" />
          그룹 배정 → 퍼널 자동 시작
        </h3>
        <p className="text-xs text-gray-400 mb-3">그룹에 퍼널이 연결되어 있으면 배정 즉시 자동 문자 발송 시작</p>

        <div className="flex gap-2">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-gold-500"
          >
            <option value="">그룹 선택...</option>
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.funnelId ? "🔄" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={assignGroup}
            disabled={assigning || !selectedGroup}
            className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-50"
          >
            {assigning ? "배정 중..." : "배정"}
          </button>
        </div>

        {assignMsg && (
          <p className="mt-2 text-sm text-green-600 font-medium">{assignMsg}</p>
        )}

        <p className="text-xs text-gray-400 mt-2">
          🔄 = 퍼널 연결됨 (배정 즉시 자동 문자 발송)
        </p>
      </div>

      {/* 현재 소속 그룹 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-3">현재 소속 그룹</h3>
        {currentGroups.length === 0 ? (
          <p className="text-sm text-gray-400">아직 그룹에 속하지 않았습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {currentGroups.map((g) => (
              <span key={g.id} className="flex items-center gap-1.5 bg-navy-100 text-navy-900 px-3 py-1.5 rounded-full text-sm font-medium">
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 퍼널 직접 등록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-blue-500" />
          퍼널 직접 등록
        </h3>
        <p className="text-xs text-gray-400 mb-3">그룹 없이 퍼널에 바로 등록합니다</p>

        <div className="space-y-3">
          <select
            value={selectedFunnelId}
            onChange={(e) => setSelectedFunnelId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">퍼널 선택</option>
            {funnels.map((f) => (
              <option
                key={f.id}
                value={f.id}
                disabled={enrolledFunnelIds.has(f.id)}
              >
                {f.name}{enrolledFunnelIds.has(f.id) ? ' (이미 등록됨)' : ''}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={enrollStartDate}
            onChange={(e) => setEnrollStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="시작일 (비우면 오늘)"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enrollSendNow}
              onChange={(e) => setEnrollSendNow(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600"
            />
            <span className="text-sm text-gray-700">즉시 첫 메시지 발송</span>
          </label>

          {enrollError && <p className="text-xs text-red-500">{enrollError}</p>}

          <button
            onClick={handleFunnelEnroll}
            disabled={!selectedFunnelId || enrolling}
            className="w-full py-2.5 bg-navy-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-navy-800"
          >
            {enrolling ? '등록 중...' : '퍼널 등록'}
          </button>
        </div>

        {/* 등록된 퍼널 목록 */}
        {(contact.vipSequences ?? []).length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">등록된 퍼널</p>
            <div className="space-y-1.5">
              {(contact.vipSequences ?? []).map((seq) => {
                const funnel = funnels.find((f) => f.id === seq.funnelId);
                return (
                  <div key={seq.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-gray-700">{funnel?.name ?? seq.funnelId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      seq.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {seq.status === 'ACTIVE' ? '진행중' : seq.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 이관 이력 */}
      {(transferLogs.length > 0 || loadingTransfer) && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">DB 이관 이력</h3>
          {loadingTransfer ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {transferLogs.map(log => (
                <div key={log.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                  <span className="text-gray-500 shrink-0">
                    {new Date(log.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-700 truncate">
                    {log.fromOrg?.name ?? '외부'} → {log.toOrg?.name ?? '외부'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ContactGroupTabComponent);
