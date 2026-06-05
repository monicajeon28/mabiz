'use client';

/**
 * APIS 협업 편집 보드 (공용 컴포넌트) — Phase 1
 *
 * /products 와 /passport/apis 가 둘 다 이 단일 컴포넌트를 import 한다 (중복 금지, SSoT).
 *
 * 핵심 동작:
 *  1) GET  /api/admin/apis/board?productCode=        → 방=색깔카드 보드 로드
 *  2) PATCH /api/admin/apis/traveler/[id]            → 셀 수정(낙관적 잠금 version) / 방 이동
 *  3) POST  /api/admin/apis/traveler                 → 동행인 추가(PROSPECT 자동매칭)
 *
 * 모든 쓰기는 서버 라우트를 거쳐 writeTravelerWithAudit()로 감사로그 + version+1.
 * 409 충돌 시 '○○님이 방금 수정' 안내 + 보드 새로고침.
 *
 * 50대 직관 UI: 큰 글자 / 색 구분 / 큰 터치영역 / 저장됨·되돌리기 토스트.
 * 여권번호·생년월일은 카드에서 마스킹(슬라이드 패널에서만 전체 표시).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Undo2,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────
// 타입 (board route 응답과 1:1)
// ─────────────────────────────────────────────────────────────

interface BoardTraveler {
  id: number;
  reservationId: number;
  version: number;
  korName: string;
  engSurname: string;
  engGivenName: string;
  gender: string;
  birthDate: string;
  nationality: string;
  passportNo: string;
  issueDate: string;
  expiryDate: string;
  phone: string;
  companionGroupId: number | null;
  isCompanion: boolean;
  agentName: string;
  updatedAt: string;
  updatedByName: string;
  completeness: { filled: number; required: number };
  expiredPassport: boolean;
}

interface BoardRoom {
  roomNumber: number;
  colorHex: string;
  travelers: BoardTraveler[];
}

interface BoardProduct {
  code: string;
  name: string;
  departureDate: string;
  shipName: string | null;
}

interface BoardResponse {
  ok: boolean;
  product?: BoardProduct;
  rooms?: BoardRoom[];
  summary?: {
    totalTravelers: number;
    completed: number;
    pendingPassport: number;
    expiredCount: number;
  };
  error?: string;
}

interface ApisBoardProps {
  productCode: string;
  /** false면 읽기 전용(편집/이동/추가 버튼 숨김) */
  canManage: boolean;
}

// 핵심 6필드 (먼저 표시) + 더보기 필드
const CORE_FIELDS = [
  { key: 'engSurname', label: '영문 성', placeholder: 'HONG' },
  { key: 'engGivenName', label: '영문 이름', placeholder: 'GILDONG' },
  { key: 'gender', label: '성별', placeholder: 'M / F', isGender: true },
  { key: 'birthDate', label: '생년월일', placeholder: 'YYYY-MM-DD' },
  { key: 'passportNo', label: '여권번호', placeholder: 'M12345678' },
  { key: 'expiryDate', label: '여권 만료일', placeholder: 'YYYY-MM-DD' },
] as const;

const MORE_FIELDS = [
  { key: 'korName', label: '한글 이름', placeholder: '홍길동' },
  { key: 'nationality', label: '국적', placeholder: 'KOR' },
  { key: 'issueDate', label: '여권 발급일', placeholder: 'YYYY-MM-DD' },
  { key: 'phone', label: '연락처', placeholder: '010-0000-0000' },
] as const;

type EditableKey =
  | (typeof CORE_FIELDS)[number]['key']
  | (typeof MORE_FIELDS)[number]['key'];

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

/** 여권번호 마스킹: 앞 2 + 뒤 2만 노출 */
function maskPassport(v: string): string {
  const s = (v || '').trim();
  if (!s) return '—';
  if (s.length <= 4) return s[0] + '*'.repeat(Math.max(1, s.length - 1));
  return `${s.slice(0, 2)}${'*'.repeat(s.length - 4)}${s.slice(-2)}`;
}

/** 생년월일 마스킹: 연도만 노출 (1965-**-**) */
function maskBirth(v: string): string {
  const s = (v || '').trim();
  if (!s) return '—';
  const m = s.match(/^(\d{4})/);
  return m ? `${m[1]}-**-**` : '****';
}

/** 완성도 점 색: 6/6 초록 / 1~5 노랑 / 여권없음·0 빨강 */
function dotColor(t: BoardTraveler): { bg: string; label: string } {
  const { filled, required } = t.completeness;
  if (!t.passportNo?.trim()) return { bg: '#dc2626', label: '여권없음' };
  if (filled >= required) return { bg: '#16a34a', label: '완성' };
  return { bg: '#eab308', label: '일부' };
}

/** updatedAt → 'M/D HH:mm' */
function fmtUpdated(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function travelerDisplayName(t: BoardTraveler): string {
  if (t.korName?.trim()) return t.korName.trim();
  const eng = [t.engSurname, t.engGivenName].filter((s) => s?.trim()).join(' ').trim();
  return eng || '(이름없음)';
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function ApisBoard({ productCode, canManage }: ApisBoardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<BoardProduct | null>(null);
  const [rooms, setRooms] = useState<BoardRoom[]>([]);
  const [summary, setSummary] = useState<BoardResponse['summary'] | null>(null);

  // 슬라이드 편집 패널 대상 traveler id
  const [editingId, setEditingId] = useState<number | null>(null);
  // 동행인 추가 모달: 대상 방 정보
  const [addTarget, setAddTarget] = useState<{ reservationId: number; roomNumber: number } | null>(null);

  // 저장됨·되돌리기 토스트
  const [toast, setToast] = useState<{
    message: string;
    undo?: () => void;
    tone: 'ok' | 'warn';
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, tone: 'ok' | 'warn', undo?: () => void) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message, tone, undo });
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    },
    [],
  );

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/apis/board?productCode=${encodeURIComponent(productCode)}`,
        { cache: 'no-store' },
      );
      const data: BoardResponse = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || '보드를 불러오지 못했습니다.');
        setRooms([]);
        setProduct(null);
        setSummary(null);
        return;
      }
      setProduct(data.product ?? null);
      setRooms(data.rooms ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      logger.error('[ApisBoard] load failed', { err: String(err) });
      setError('네트워크 오류로 보드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [productCode]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // 방 이동 드롭다운 옵션 (현재 보드의 모든 방)
  const roomOptions = useMemo(
    () => rooms.map((r) => ({ roomNumber: r.roomNumber, colorHex: r.colorHex })),
    [rooms],
  );

  const editingTraveler = useMemo(() => {
    if (editingId == null) return null;
    for (const r of rooms) {
      const found = r.travelers.find((t) => t.id === editingId);
      if (found) return found;
    }
    return null;
  }, [editingId, rooms]);

  // ── 방 이동 ────────────────────────────────────────────────
  const moveRoom = useCallback(
    async (t: BoardTraveler, currentRoom: number, targetRoom: number) => {
      if (targetRoom === currentRoom) return;
      try {
        const res = await fetch(`/api/admin/apis/traveler/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'moveRoom',
            roomNumber: targetRoom,
            expectedVersion: t.version,
          }),
        });
        const data = await res.json();
        if (res.status === 409) {
          showToast(
            `${data?.latest?.updatedBy ? '다른 담당자' : '누군가'}님이 방금 수정했어요. 최신 정보를 불러옵니다.`,
            'warn',
          );
          await loadBoard();
          return;
        }
        if (!res.ok || !data.ok) {
          showToast(data.error || '방 이동에 실패했습니다.', 'warn');
          return;
        }
        showToast(`${travelerDisplayName(t)}님을 ${targetRoom}번방으로 옮겼어요.`, 'ok');
        await loadBoard();
      } catch (err) {
        logger.error('[ApisBoard] moveRoom failed', { err: String(err) });
        showToast('방 이동 중 오류가 발생했습니다.', 'warn');
      }
    },
    [loadBoard, showToast],
  );

  // ── 셀 저장 (슬라이드 패널 onBlur) ────────────────────────────
  const saveField = useCallback(
    async (
      t: BoardTraveler,
      key: EditableKey,
      nextValue: string,
      prevValue: string,
    ): Promise<boolean> => {
      const trimmed = nextValue.trim();
      if (trimmed === (prevValue || '').trim()) return true; // 변경 없음

      try {
        const res = await fetch(`/api/admin/apis/traveler/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            changes: { [key]: trimmed },
            expectedVersion: t.version,
          }),
        });
        const data = await res.json();
        if (res.status === 409) {
          showToast('다른 담당자님이 방금 수정했어요. 최신 정보를 불러옵니다.', 'warn');
          await loadBoard();
          return false;
        }
        if (!res.ok || !data.ok) {
          showToast(data.error || '저장에 실패했습니다.', 'warn');
          return false;
        }

        // 되돌리기: 이전 값으로 재저장 (서버가 올려준 새 version 사용)
        const newVersion: number =
          typeof data.traveler?.version === 'number' ? data.traveler.version : t.version + 1;
        showToast('저장됐어요.', 'ok', () => {
          void (async () => {
            try {
              await fetch(`/api/admin/apis/traveler/${t.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'update',
                  changes: { [key]: (prevValue || '').trim() },
                  expectedVersion: newVersion,
                }),
              });
            } catch (err) {
              logger.error('[ApisBoard] undo failed', { err: String(err) });
            } finally {
              await loadBoard();
            }
          })();
        });
        await loadBoard();
        return true;
      } catch (err) {
        logger.error('[ApisBoard] saveField failed', { err: String(err) });
        showToast('저장 중 오류가 발생했습니다.', 'warn');
        return false;
      }
    },
    [loadBoard, showToast],
  );

  // ─────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <span className="text-lg">보드를 불러오는 중…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
        <p className="text-lg font-semibold text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void loadBoard()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-base font-bold text-white hover:bg-red-700"
        >
          <RefreshCw className="h-5 w-5" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 헤더 + 요약 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{product?.name ?? productCode}</h2>
          <p className="mt-1 text-base text-gray-500">
            {product?.shipName ? `${product.shipName} · ` : ''}
            {product?.departureDate
              ? new Date(product.departureDate).toLocaleDateString('ko-KR')
              : ''}{' '}
            출발
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">
                탑승객 {summary.totalTravelers}명
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1.5 text-green-700">
                완성 {summary.completed}
              </span>
              {summary.pendingPassport > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-700">
                  여권없음 {summary.pendingPassport}
                </span>
              )}
              {summary.expiredCount > 0 && (
                <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-700">
                  만료임박 {summary.expiredCount}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadBoard()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base font-bold text-gray-700 hover:bg-gray-50"
            title="새로고침"
          >
            <RefreshCw className="h-5 w-5" /> 새로고침
          </button>
        </div>
      </div>

      {/* 방 색깔카드 세로 스택 (가로 스크롤 금지) */}
      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-lg text-gray-500">
          등록된 방이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.roomNumber}
              room={room}
              canManage={canManage}
              roomOptions={roomOptions}
              onEdit={(id) => setEditingId(id)}
              onMove={moveRoom}
              onAddCompanion={(reservationId) =>
                setAddTarget({ reservationId, roomNumber: room.roomNumber })
              }
            />
          ))}
        </div>
      )}

      {/* 슬라이드 편집 패널 */}
      {editingTraveler && (
        <EditPanel
          traveler={editingTraveler}
          canManage={canManage}
          onClose={() => setEditingId(null)}
          onSaveField={saveField}
        />
      )}

      {/* 동행인 추가 모달 */}
      {addTarget && canManage && (
        <AddCompanionModal
          reservationId={addTarget.reservationId}
          roomNumber={addTarget.roomNumber}
          onClose={() => setAddTarget(null)}
          onAdded={() => {
            setAddTarget(null);
            showToast('동행인을 추가했어요.', 'ok');
            void loadBoard();
          }}
          onError={(msg) => showToast(msg, 'warn')}
        />
      )}

      {/* 저장됨·되돌리기 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className={`flex items-center gap-3 rounded-2xl px-5 py-3.5 text-base font-bold text-white shadow-xl ${
              toast.tone === 'ok' ? 'bg-gray-900' : 'bg-orange-600'
            }`}
          >
            {toast.tone === 'ok' ? (
              <Check className="h-5 w-5 text-green-400" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25"
              >
                <Undo2 className="h-4 w-4" /> 되돌리기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 방 카드
// ─────────────────────────────────────────────────────────────

interface RoomCardProps {
  room: BoardRoom;
  canManage: boolean;
  roomOptions: { roomNumber: number; colorHex: string }[];
  onEdit: (travelerId: number) => void;
  onMove: (t: BoardTraveler, currentRoom: number, targetRoom: number) => void;
  onAddCompanion: (reservationId: number) => void;
}

function RoomCard({ room, canManage, roomOptions, onEdit, onMove, onAddCompanion }: RoomCardProps) {
  // 동행인 추가 시 연결할 reservationId: 방의 첫 번째 탑승객 기준 (없으면 추가 비활성)
  const primaryReservationId = room.travelers[0]?.reservationId ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* 8mm 색띠 */}
      <div style={{ height: '8mm', backgroundColor: room.colorHex }} aria-hidden />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900" style={{ fontSize: 18 }}>
            {room.roomNumber > 0 ? `${room.roomNumber}번방` : '미배정'}
            <span className="ml-2 text-base font-semibold text-gray-500">
              · {room.travelers.length}명
            </span>
          </h3>
        </div>

        <div className="flex flex-col divide-y divide-gray-100">
          {room.travelers.map((t) => (
            <TravelerBlock
              key={t.id}
              traveler={t}
              currentRoom={room.roomNumber}
              canManage={canManage}
              roomOptions={roomOptions}
              onEdit={onEdit}
              onMove={onMove}
            />
          ))}
        </div>

        {/* 동행인 추가 */}
        {canManage && primaryReservationId != null && (
          <button
            type="button"
            onClick={() => onAddCompanion(primaryReservationId)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-3 text-base font-bold text-gray-500 hover:border-gray-400 hover:text-gray-700"
          >
            <Plus className="h-5 w-5" /> 동행인 추가
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 탑승객 블록
// ─────────────────────────────────────────────────────────────

interface TravelerBlockProps {
  traveler: BoardTraveler;
  currentRoom: number;
  canManage: boolean;
  roomOptions: { roomNumber: number; colorHex: string }[];
  onEdit: (travelerId: number) => void;
  onMove: (t: BoardTraveler, currentRoom: number, targetRoom: number) => void;
}

function TravelerBlock({
  traveler,
  currentRoom,
  canManage,
  roomOptions,
  onEdit,
  onMove,
}: TravelerBlockProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveRef = useRef<HTMLDivElement | null>(null);
  const dot = dotColor(traveler);

  useEffect(() => {
    if (!moveOpen) return;
    function onDocClick(e: MouseEvent) {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) {
        setMoveOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [moveOpen]);

  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(traveler.id)}
            className="text-left text-base font-bold text-gray-900 underline-offset-2 hover:underline"
            style={{ fontSize: 16 }}
            title="클릭하여 편집"
          >
            {travelerDisplayName(traveler)}
          </button>
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: dot.bg }}
            title={dot.label}
            aria-label={dot.label}
          />
          <span className="text-sm font-semibold text-gray-600">
            {traveler.completeness.filled}/{traveler.completeness.required}
          </span>
          {traveler.isCompanion && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">
              동행인
            </span>
          )}
          {traveler.expiredPassport && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" /> 만료
            </span>
          )}
        </div>

        {/* 마스킹된 핵심 정보 */}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
          <span>여권 {maskPassport(traveler.passportNo)}</span>
          <span>생일 {maskBirth(traveler.birthDate)}</span>
          {traveler.gender && <span>{traveler.gender}</span>}
        </div>

        {/* 담당자 / 최근 수정 */}
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-400">
          {traveler.agentName && <span>담당 {traveler.agentName}</span>}
          {traveler.updatedByName && (
            <span>
              수정: {traveler.updatedByName} {fmtUpdated(traveler.updatedAt)}
            </span>
          )}
        </div>
      </div>

      {/* 방 이동 드롭다운 (메인 동작) */}
      {canManage && (
        <div className="relative shrink-0" ref={moveRef}>
          <button
            type="button"
            onClick={() => setMoveOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            방 이동
            <ChevronDown className="h-4 w-4" />
          </button>
          {moveOpen && (
            <div className="absolute right-0 z-20 mt-1 max-h-64 w-44 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {roomOptions.map((opt) => (
                <button
                  key={opt.roomNumber}
                  type="button"
                  disabled={opt.roomNumber === currentRoom}
                  onClick={() => {
                    setMoveOpen(false);
                    onMove(traveler, currentRoom, opt.roomNumber);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold ${
                    opt.roomNumber === currentRoom
                      ? 'cursor-default bg-gray-50 text-gray-400'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="inline-block h-4 w-4 shrink-0 rounded"
                    style={{ backgroundColor: opt.colorHex }}
                  />
                  {opt.roomNumber > 0 ? `${opt.roomNumber}번방` : '미배정'}
                  {opt.roomNumber === currentRoom && (
                    <span className="ml-auto text-xs">현재</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 슬라이드 편집 패널
// ─────────────────────────────────────────────────────────────

interface EditPanelProps {
  traveler: BoardTraveler;
  canManage: boolean;
  onClose: () => void;
  onSaveField: (
    t: BoardTraveler,
    key: EditableKey,
    nextValue: string,
    prevValue: string,
  ) => Promise<boolean>;
}

function EditPanel({ traveler, canManage, onClose, onSaveField }: EditPanelProps) {
  const [showMore, setShowMore] = useState(false);
  const [savingKey, setSavingKey] = useState<EditableKey | null>(null);

  // 로컬 편집값 (제어 컴포넌트) — 패널 열릴 때 traveler 기준 초기화
  const initial = useMemo(() => {
    const o: Record<string, string> = {};
    for (const f of [...CORE_FIELDS, ...MORE_FIELDS]) {
      o[f.key] = (traveler as unknown as Record<string, string>)[f.key] ?? '';
    }
    return o;
  }, [traveler]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  useEffect(() => setValues(initial), [initial]);

  const handleBlur = useCallback(
    async (key: EditableKey) => {
      if (!canManage) return;
      const next = values[key] ?? '';
      const prev = (traveler as unknown as Record<string, string>)[key] ?? '';
      if (next.trim() === (prev || '').trim()) return;
      setSavingKey(key);
      await onSaveField(traveler, key, next, prev);
      setSavingKey(null);
    },
    [values, traveler, canManage, onSaveField],
  );

  const renderField = (f: { key: string; label: string; placeholder: string; isGender?: boolean }) => {
    const key = f.key as EditableKey;
    return (
      <div key={f.key}>
        <label className="mb-1 block font-bold text-gray-700" style={{ fontSize: 16 }}>
          {f.label}
          {savingKey === key && (
            <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-gray-400" />
          )}
        </label>
        {f.isGender ? (
          <div className="flex gap-2">
            {['M', 'F'].map((g) => (
              <button
                key={g}
                type="button"
                disabled={!canManage}
                onClick={() => {
                  setValues((v) => ({ ...v, [key]: g }));
                  if (canManage && (values[key] ?? '') !== g) {
                    setSavingKey(key);
                    void onSaveField(
                      traveler,
                      key,
                      g,
                      (traveler as unknown as Record<string, string>)[key] ?? '',
                    ).finally(() => setSavingKey(null));
                  }
                }}
                className={`flex-1 rounded-xl border-2 text-lg font-bold ${
                  (values[key] ?? '') === g
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
                style={{ height: 48 }}
              >
                {g === 'M' ? '남 (M)' : '여 (F)'}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            value={values[key] ?? ''}
            disabled={!canManage}
            placeholder={f.placeholder}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            onBlur={() => void handleBlur(key)}
            className="w-full rounded-xl border-2 border-gray-200 px-3 text-lg focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
            style={{ height: 48 }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      {/* 패널 */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-bold text-gray-900">
              {travelerDisplayName(traveler)}
            </h3>
            <p className="text-sm text-gray-500">
              {canManage ? '칸을 벗어나면 자동 저장돼요.' : '읽기 전용'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {CORE_FIELDS.map(renderField)}

          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="flex items-center gap-1 text-base font-bold text-blue-600"
          >
            {showMore ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            {showMore ? '접기' : '더보기'}
          </button>

          {showMore && <div className="space-y-4">{MORE_FIELDS.map(renderField)}</div>}
        </div>

        {!canManage && (
          <div className="border-t border-gray-100 px-5 py-3 text-center text-sm text-gray-400">
            <Pencil className="mr-1 inline h-4 w-4" /> 편집 권한이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 동행인 추가 모달
// ─────────────────────────────────────────────────────────────

interface AddCompanionModalProps {
  reservationId: number;
  roomNumber: number;
  onClose: () => void;
  onAdded: () => void;
  onError: (msg: string) => void;
}

function AddCompanionModal({
  reservationId,
  roomNumber,
  onClose,
  onAdded,
  onError,
}: AddCompanionModalProps) {
  const [korName, setKorName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = useCallback(async () => {
    if (!korName.trim() && !phone.trim()) {
      onError('이름 또는 연락처를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/apis/traveler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          roomNumber,
          korName: korName.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onError(data.error || '동행인 추가에 실패했습니다.');
        return;
      }
      onAdded();
    } catch (err) {
      logger.error('[ApisBoard] addCompanion failed', { err: String(err) });
      onError('동행인 추가 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [korName, phone, reservationId, roomNumber, onAdded, onError]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <UserPlus className="h-6 w-6 text-blue-600" />
            {roomNumber > 0 ? `${roomNumber}번방` : ''} 동행인 추가
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block font-bold text-gray-700" style={{ fontSize: 16 }}>
              이름
            </label>
            <input
              type="text"
              value={korName}
              onChange={(e) => setKorName(e.target.value)}
              placeholder="홍길동"
              className="w-full rounded-xl border-2 border-gray-200 px-3 text-lg focus:border-blue-500 focus:outline-none"
              style={{ height: 48 }}
            />
          </div>
          <div>
            <label className="mb-1 block font-bold text-gray-700" style={{ fontSize: 16 }}>
              연락처
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-xl border-2 border-gray-200 px-3 text-lg focus:border-blue-500 focus:outline-none"
              style={{ height: 48 }}
            />
          </div>
          <p className="text-sm text-gray-400">
            기존 고객이면 자동으로 연결되고, 없으면 새 고객으로 등록돼요.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-base font-bold text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
