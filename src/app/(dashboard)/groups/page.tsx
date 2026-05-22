"use client";

import { useState, useEffect } from "react";
import { Plus, Users, ArrowRight, Upload } from "lucide-react";
import { showError } from "@/components/ui/Toast";
import { GroupForm } from "@/components/groups/GroupForm";
import { GroupCard } from "@/components/groups/GroupCard";
import { BlastPanel } from "@/components/groups/BlastPanel";
import { RegionalSetup } from "@/components/groups/RegionalSetup";
import { ImportModal } from "@/components/groups/ImportModal";
import { logger } from "@/lib/logger";

type Group = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  funnelId: string | null;
  funnelName: string | null;
  _count: { members: number };
};
type Funnel = { id: string; name: string };

export default function GroupsPage() {
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ name: "", description: "", color: "#6B7280", funnelId: "" });
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 지역 그룹 초기화 상태
  const [setupMsg,     setSetupMsg]     = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const initRegionalGroups = async () => {
    if (setupLoading) return;
    setSetupLoading(true);
    setSetupMsg(null);
    try {
      const res  = await fetch('/api/setup/regional-groups', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken || '' },
      });
      const data = await res.json() as { ok: boolean; created?: string[]; skipped?: string[]; message?: string };
      if (data.ok) {
        const createdCount = data.created?.length ?? 0;
        const skippedCount = data.skipped?.length ?? 0;
        if (createdCount === 0) {
          setSetupMsg('이미 설정되어 있습니다');
        } else {
          setSetupMsg(`${createdCount}개 그룹 생성 완료${skippedCount > 0 ? ` (${skippedCount}개 스킵)` : ''}`);
          await loadGroups();
        }
      } else {
        const msg = data.message ?? '초기화에 실패했습니다.';
        setSetupMsg(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = '네트워크 오류가 발생했습니다.';
      logger.error('[GroupsPage] initRegionalGroups', { err });
      setSetupMsg(msg);
      showError(msg);
    } finally {
      setSetupLoading(false);
    }
  };

  // 복제·내보내기·가져오기 상태
  const [copiedExportId, setCopiedExportId] = useState<string | null>(null);
  const [showImport,     setShowImport]     = useState(false);

  const loadGroups = async () => {
    setError(null);
    const [gResult, fResult] = await Promise.allSettled([
      fetch('/api/groups').then((r) => r.json()),
      fetch('/api/funnels').then((r) => r.json()),
    ]);

    if (gResult.status === 'fulfilled' && gResult.value.ok) {
      setGroups(gResult.value.groups);
    } else if (gResult.status === 'rejected') {
      logger.error('[loadGroups] groups fetch', { err: gResult.reason });
    }

    if (fResult.status === 'fulfilled' && fResult.value.ok) {
      setFunnels(fResult.value.funnels);
    } else if (fResult.status === 'rejected') {
      logger.error('[loadGroups] funnels fetch', { err: fResult.reason });
    }
  };

  const cloneGroup = async (id: string) => {
    const res = await fetch(`/api/groups/${id}/clone`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken || '' },
    });
    const d   = await res.json() as { ok: boolean; group?: { name: string }; message?: string };
    if (d.ok) { await loadGroups(); }
    else showError(d.message || '복제 실패');
  };

  const exportGroup = async (id: string) => {
    const res = await fetch(`/api/groups/${id}/export`);
    const d   = await res.json() as { ok: boolean; data?: unknown; message?: string };
    if (d.ok) {
      await navigator.clipboard.writeText(JSON.stringify(d.data, null, 2));
      setCopiedExportId(id);
      setTimeout(() => setCopiedExportId(null), 2000);
    } else showError(d.message || '내보내기 실패');
  };

  // 일괄 발송 상태
  const [blastGroupId,  setBlastGroupId]  = useState<string | null>(null);
  const [blastMsg,      setBlastMsg]      = useState("");
  const [blastPreview,  setBlastPreview]  = useState<{ willSend: number; isOverLimit: boolean; overLimitMsg: string | null } | null>(null);
  const [blastConfirm,  setBlastConfirm]  = useState(false); // UX-004: 최종 확인 체크박스
  const [blasting,      setBlasting]      = useState(false);
  const [blastResult,   setBlastResult]   = useState<{ sentCount: number; blockedCount: number; failedCount: number } | null>(null);
  const [checkingBlast, setCheckingBlast] = useState(false);
  const [blastError,    setBlastError]    = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/csrf-token')
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setCsrfToken(d.token);
        } else {
          logger.warn('[GroupsPage] CSRF token', { message: d.message });
        }
      })
      .catch((err) => {
        logger.error('[GroupsPage] CSRF token fetch', { err });
      });
  }, []);

  const openBlast = (groupId: string) => {
    setBlastGroupId(groupId);
    setBlastMsg("");
    setBlastPreview(null);
    setBlastResult(null);
    setBlastError(null);
  };

  const checkBlast = async () => {
    if (!blastGroupId || !blastMsg.trim() || checkingBlast) return;
    setCheckingBlast(true);
    setBlastError(null);
    try {
      const res  = await fetch(`/api/groups/${blastGroupId}/blast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || '',
        },
        body: JSON.stringify({ message: blastMsg, dryRun: true }),
      });
      const data = await res.json() as { ok: boolean; error?: string; message?: string; willSend?: number; isOverLimit?: boolean; overLimitMsg?: string | null };
      if (data.ok) setBlastPreview({ willSend: data.willSend ?? 0, isOverLimit: data.isOverLimit ?? false, overLimitMsg: data.overLimitMsg ?? null });
      else {
        const msg = data.message ?? data.error ?? "대상 확인에 실패했습니다.";
        setBlastError(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = "네트워크 오류가 발생했습니다.";
      logger.error('[GroupsPage] checkBlast', { err });
      setBlastError(msg);
      showError(msg);
    } finally {
      setCheckingBlast(false);
    }
  };

  const sendBlast = async () => {
    // UX-004: 최종 확인 체크박스 검증
    if (!blastGroupId || !blastMsg.trim() || blasting || !blastConfirm) return;
    setBlasting(true);
    try {
      const res  = await fetch(`/api/groups/${blastGroupId}/blast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || '',
        },
        body: JSON.stringify({ message: blastMsg, dryRun: false }),
      });
      const data = await res.json() as { ok: boolean; error?: string; message?: string; sentCount?: number; blockedCount?: number; failedCount?: number };
      if (data.ok) {
        setBlastResult({ sentCount: data.sentCount ?? 0, blockedCount: data.blockedCount ?? 0, failedCount: data.failedCount ?? 0 });
        setBlastPreview(null);
        setBlastConfirm(false); // 발송 후 상태 초기화
      } else {
        const msg = data.message ?? data.error ?? "발송에 실패했습니다.";
        setBlastError(msg);
        showError(msg);
      }
    } catch (err) {
      const msg = "네트워크 오류가 발생했습니다.";
      logger.error('[GroupsPage] sendBlast', { err });
      setBlastError(msg);
      showError(msg);
    } finally {
      setBlasting(false); // 에러 시에도 반드시 해제
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/funnels").then((r) => r.json()),
    ]).then(([gResult, fResult]) => {
      if (gResult.status === 'fulfilled' && gResult.value.ok) {
        setGroups(gResult.value.groups);
      } else {
        logger.error('[GroupsPage init] groups fetch failed', { result: gResult });
      }

      if (fResult.status === 'fulfilled' && fResult.value.ok) {
        setFunnels(fResult.value.funnels);
      } else {
        logger.error('[GroupsPage init] funnels fetch failed', { result: fResult });
      }
    }).catch((err) => {
      logger.error('[GroupsPage init] Promise.allSettled', { err });
      setError('데이터를 불러올 수 없습니다.');
    }).finally(() => setLoading(false));
  }, []);

  const createGroup = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res  = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || '',
        },
        body:    JSON.stringify({
          name:        form.name,
          description: form.description || null,
          color:       form.color,
          funnelId:    form.funnelId || null,
        }),
      });
      const data = await res.json() as {
        ok: boolean;
        error?: string;
        message?: string;
        errors?: Record<string, string>;
        group?: Group;
      };
      if (data.ok && data.group) {
        setGroups((prev) => [...prev, data.group!]);
        setShowNew(false);
        setForm({ name: "", description: "", color: "#6B7280", funnelId: "" });
      } else {
        if (data.errors) {
          setFieldErrors(data.errors);
          showError("입력값을 확인해주세요.");
        } else {
          setFormError(data.message || data.error || "그룹 생성에 실패했습니다.");
          showError(data.message || data.error || "그룹 생성에 실패했습니다.");
        }
      }
    } catch (err) {
      const msg = "네트워크 오류가 발생했습니다.";
      logger.error('[GroupsPage] createGroup', { err });
      setFormError(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-navy-900">고객 그룹</h1>
          <p className="text-sm text-gray-500 mt-0.5">그룹 → 퍼널 연결로 자동 문자 발송</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            가져오기
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700"
          >
            <Plus className="w-4 h-4" /> 새 그룹
          </button>
        </div>
      </div>

      {/* 에러 상태 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-900">데이터를 불러올 수 없습니다</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                loadGroups();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              재시도
            </button>
          </div>
        </div>
      )}

      {/* 흐름 설명 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <p className="text-sm font-medium text-blue-800 mb-2">📌 그룹 + 퍼널 자동화 흐름</p>
        <div className="flex items-center gap-2 text-xs text-blue-700 flex-wrap">
          <span className="bg-blue-100 px-2 py-1 rounded">고객 그룹 배정</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="bg-blue-100 px-2 py-1 rounded">연결된 퍼널 자동 시작</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="bg-blue-100 px-2 py-1 rounded">자동 문자 발송</span>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          랜딩페이지 신청 시에도 그룹 자동 배정 → 퍼널 즉시 시작
        </p>
      </div>

      <RegionalSetup
        loading={setupLoading}
        setupMsg={setupMsg}
        onSetup={initRegionalGroups}
      />

      {/* 가져오기 모달 */}
      {showImport && (
        <ImportModal
          csrfToken={csrfToken}
          onClose={() => setShowImport(false)}
          onDone={async () => { await loadGroups(); }}
        />
      )}

      {/* 새 그룹 폼 */}
      {showNew && (
        <GroupForm
          form={form}
          setForm={setForm}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          formError={formError}
          setFormError={setFormError}
          saving={saving}
          funnels={funnels}
          onSubmit={createGroup}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* 그룹 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">그룹이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1">+ 새 그룹 버튼으로 만들어보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              copiedExportId={copiedExportId}
              onClone={cloneGroup}
              onExport={exportGroup}
              onBlast={openBlast}
            >
              {blastGroupId === group.id && (
                <BlastPanel
                  blastMsg={blastMsg}
                  onMsgChange={setBlastMsg}
                  blastPreview={blastPreview}
                  blastError={blastError}
                  blastConfirm={blastConfirm}
                  onConfirmChange={setBlastConfirm}
                  onCheckBlast={checkBlast}
                  checkingBlast={checkingBlast}
                  onSendBlast={sendBlast}
                  blasting={blasting}
                  blastResult={blastResult}
                  onClose={() => setBlastGroupId(null)}
                />
              )}
            </GroupCard>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
