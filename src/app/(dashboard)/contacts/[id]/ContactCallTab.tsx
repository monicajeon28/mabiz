"use client";

import { useState, useMemo, memo } from "react";
import {
  Plus, Clock, Star, FileText, Check, Copy, CloudUpload, Trash2, FileDown, ChevronDown, Share2,
} from "lucide-react";
import CallScriptPanel from "./CallScriptPanel";
import { getObjectionData } from "@/lib/objections/validation";
import objectionsData from "@/../../TRACK_A_OBJECTIONS.json";
import { CallLog } from "@/types/contact";
import { CallForm } from "@/types/call-form";
import { ObjectionData } from "@/lib/objections/validation";

interface Contact {
  id: string; age?: number | null; maritalStatus?: string | null;
  childrenCount?: number | null;
  callLogs: CallLog[];
  sharedCallLogs?: (CallLog & { _sharedFrom: string })[];
}

const RESULT_LABELS: Record<string, string> = {
  INTERESTED: "✅ 관심있음", PENDING: "⏳ 보류",
  REJECTED: "❌ 거절", RESCHEDULED: "📅 재콜예약",
};

// [T-005] nullable 필드 처리 강화: Optional Chaining
const getResultLabel = (result: string | null): string => {
  if (!result) return "미기록";
  return RESULT_LABELS[result] ?? result;
};

interface ContactCallTabProps {
  contact: Contact;
  contactId: string;
  callForm: CallForm;
  setCallForm: (form: CallForm) => void;
  showCallForm: boolean;
  setShowCallForm: (show: boolean) => void;
  selectedObjectionModal: ObjectionData | null;
  setSelectedObjectionModal: (modal: ObjectionData | null) => void;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  copiedLogId: string | null;
  backing: boolean;
  backupResult: { url: string; count: number } | null;
  addCallLog: () => Promise<void>;
  deleteCallLog: (logId: string) => Promise<void>;
  deleteAllCallLogs: () => Promise<void>;
  backupCallLogs: () => Promise<void>;
  copyCallLog: (log: CallLog) => void;
}

function ContactCallTabComponent({
  contact, contactId, callForm, setCallForm, showCallForm, setShowCallForm,
  selectedObjectionModal, setSelectedObjectionModal, expandedLogId, setExpandedLogId,
  copiedLogId, backing, backupResult, addCallLog, deleteCallLog, deleteAllCallLogs,
  backupCallLogs, copyCallLog,
}: ContactCallTabProps) {
  return (
    <div>
      <CallScriptPanel
        contact={{
          age: contact.age ?? undefined,
          maritalStatus: contact.maritalStatus ?? undefined,
          childrenCount: contact.childrenCount ?? undefined,
        }}
        isExpanded={true}
      />

      <div className="flex gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setShowCallForm(true)}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> 콜 기록 추가
        </button>
        {contact.callLogs.length > 0 && (
          <>
            <button
              onClick={backupCallLogs}
              disabled={backing}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-600 rounded-xl text-xs hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              {backing ? "백업 중..." : "Drive 백업"}
            </button>
            <button
              onClick={deleteAllCallLogs}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> 전체 삭제
            </button>
          </>
        )}
      </div>

      {backupResult && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-blue-700">✅ {backupResult.count}건 Drive 백업 완료</span>
          <a href={backupResult.url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">파일 열기 →</a>
        </div>
      )}

      {showCallForm && (
        <div className="bg-white border border-gold-300 rounded-xl p-4 mb-3 space-y-3">
          <textarea
            placeholder="통화 내용을 입력하세요..."
            value={callForm.content}
            onChange={(e) => setCallForm({ ...callForm, content: e.target.value })}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">결과</label>
              <select
                value={callForm.result}
                onChange={(e) => setCallForm({ ...callForm, result: e.target.value as CallForm['result'] })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                {Object.entries(RESULT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">확신척도 (1~10)</label>
              <select
                value={callForm.convictionScore}
                onChange={(e) => setCallForm({ ...callForm, convictionScore: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                {[...Array(10)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}점</option>
                ))}
              </select>
            </div>
          </div>
          <input
            placeholder="다음 액션"
            value={callForm.nextAction}
            onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
          />
          <input
            type="datetime-local"
            placeholder="다음 콜 날짜"
            value={callForm.scheduledAt}
            onChange={(e) => setCallForm({ ...callForm, scheduledAt: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
          />

          {/* Track A 이의처리 섹션 */}
          <div className="border-t border-gray-200 pt-3 mt-3">
            <label className="text-xs text-gray-500 mb-2 block font-semibold">📞 이의처리 기록 (선택)</label>
            <select
              value={callForm.objectionId}
              onChange={(e) => {
                const selectedId = e.target.value;
                setCallForm({ ...callForm, objectionId: selectedId });
                if (selectedId) {
                  const objData = getObjectionData(selectedId);
                  setSelectedObjectionModal(objData);
                }
              }}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white mb-2"
            >
              <option value="">이의 없음</option>
              {objectionsData.objections.map((obj: any) => (
                <option key={obj.id} value={obj.id}>
                  {obj.id} - {obj.categoryName}: {obj.subcategoryName}
                </option>
              ))}
            </select>

            {callForm.objectionId && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">고객 반응</label>
                  <select
                    value={callForm.customerReaction}
                    onChange={(e) => setCallForm({ ...callForm, customerReaction: e.target.value as CallForm['customerReaction'] })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="positive">긍정 (해결됨)</option>
                    <option value="neutral">중립</option>
                    <option value="negative">부정 (악화됨)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">해결 여부</label>
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                    <input
                      type="checkbox"
                      checked={callForm.recovered}
                      onChange={(e) => setCallForm({ ...callForm, recovered: e.target.checked })}
                    />
                    <span className="text-sm">성공 처리</span>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">해결 소요 시간 (초)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="30초"
                    value={callForm.recoveryTime}
                    onChange={(e) => setCallForm({ ...callForm, recoveryTime: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
              </div>
            )}

            {selectedObjectionModal && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-semibold text-yellow-900 text-xs mb-2">💡 즉각 대응 스크립트</div>
                <div className="text-sm text-yellow-800 whitespace-pre-wrap font-mono">
                  {selectedObjectionModal.immediateResponse}
                </div>
                <div className="text-xs text-yellow-700 mt-2">
                  {selectedObjectionModal.responseMetrics?.wordCount ?? 0}단어 / {selectedObjectionModal.responseMetrics?.estimatedSeconds ?? 0}초
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={addCallLog} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium">저장</button>
            <button onClick={() => setShowCallForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {contact.callLogs.map((log) => {
          const isOpen = expandedLogId === log.id;
          return (
            <div key={log.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString("ko-KR")}
                </span>
                {log.result && (
                  <span className="text-xs text-gray-600 shrink-0">{RESULT_LABELS[log.result] ?? log.result}</span>
                )}
                {log.convictionScore && (
                  <span className="flex items-center gap-0.5 text-xs text-gold-500 shrink-0">
                    <Star className="w-3 h-3 fill-gold-500" />{log.convictionScore}점
                  </span>
                )}
                {log.content && !isOpen && (
                  <span className="text-xs text-gray-500 truncate flex-1 ml-1">{log.content}</span>
                )}
                {log._authorName && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                    {log._authorName}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                  {log.content && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.content}</p>
                  )}
                  {log.nextAction && (
                    <p className="text-xs text-blue-600">→ {log.nextAction}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => copyCallLog(log)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="콜 기록 복사"
                    >
                      {copiedLogId === log.id
                        ? <><Check className="w-3 h-3 text-green-500" /> 복사됨</>
                        : <><Copy className="w-3 h-3" /> 복사</>
                      }
                    </button>
                    {log.scheduledAt && (
                      <a
                        href={`/api/contacts/${contactId}/call-logs/${log.id}/ics`}
                        download={`call-${log.id}.ics`}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <FileDown className="w-3 h-3" /> 캘린더
                      </a>
                    )}
                    <button
                      onClick={() => deleteCallLog(log.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors ml-auto focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="콜 기록 삭제"
                    >
                      <Trash2 className="w-3 h-3" /> 삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {contact.callLogs.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">콜 기록이 없습니다.</p>
        )}
      </div>

      {(contact.sharedCallLogs?.length ?? 0) > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-purple-100" />
            <span className="text-xs font-semibold text-purple-500 flex items-center gap-1">
              <Share2 className="w-3 h-3" /> 공유된 콜 기록
            </span>
            <div className="h-px flex-1 bg-purple-100" />
          </div>
          <div className="space-y-2">
            {contact.sharedCallLogs!.map((log) => (
              <div key={log.id} className="bg-purple-50 border border-purple-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3">
                  <Clock className="w-3 h-3 text-purple-300 shrink-0" />
                  <span className="text-xs text-purple-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString("ko-KR")}
                  </span>
                  {log.result && (
                    <span className="text-xs text-purple-600 shrink-0">{RESULT_LABELS[log.result] ?? log.result}</span>
                  )}
                  {log.convictionScore && (
                    <span className="text-xs text-gold-500 shrink-0">
                      <Star className="w-3 h-3 fill-gold-400 inline" />{log.convictionScore}점
                    </span>
                  )}
                  {log.content && (
                    <span className="text-xs text-purple-500 truncate flex-1">{log.content}</span>
                  )}
                  {log._authorName && (
                    <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                      {log._authorName}
                    </span>
                  )}
                  <span className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">
                    {log._sharedFrom}
                  </span>
                </div>
                {log.nextAction && (
                  <div className="px-4 pb-3 text-xs text-blue-500">→ {log.nextAction}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ContactCallTabComponent);
