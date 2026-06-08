'use client';

/**
 * APIS 협업 편집 보드 (공용 컴포넌트) — Phase 2
 *
 * /products 와 /passport/apis 가 둘 다 이 단일 컴포넌트를 import 한다 (중복 금지, SSoT).
 *
 * 핵심 동작 (Phase 1, 절대 보존):
 *  1) GET  /api/admin/apis/board?productCode=        → 방=색깔카드 보드 로드
 *  2) PATCH /api/admin/apis/traveler/[id]            → 셀 수정(낙관적 잠금 version) / 방 이동
 *  3) POST  /api/admin/apis/traveler                 → 동행인 추가(PROSPECT 자동매칭)
 *
 * Phase 2 추가:
 *  4) GET  /api/admin/apis/audit?travelerId=         → 탑승객별 변경 이력 타임라인
 *  5) 1클릭 되돌리기(undo) — oldValue 로 PATCH(action:'update', 낙관락). undo 도 감사기록.
 *  6) 검증 색강조 — board 의 warnings/status 기반(빈칸·만료·형식·영문분리·중복).
 *  7) 상단 진척바 + 문제 행 점프 필터칩(만료/미완성).
 *  8) 엑셀 다운로드 전 경고(미완성/만료위험 건수 confirm) — 클라이언트 CSV 생성.
 *  9) 안전 단건삭제 — DELETE(전체 JSON 스냅샷 복구가능) + 5초 undo(되살리기).
 *
 * 모든 쓰기/삭제/undo 는 서버 라우트를 거쳐 감사로그 기록 + version+1.
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
  History,
  Trash2,
  Download,
  Filter,
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
  /** board route 가 산출한 검증 경고 코드들 (missing/expired/passport_format/eng_split/dup_passport) */
  warnings: string[];
  /** complete | partial | error (카드 점 색) */
  status: 'complete' | 'partial' | 'error';
}

type SaleConfirmStatus = 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED';

interface BoardRoom {
  // 그룹핑 단위 = 예약×방. 같은 roomNumber 라도 예약이 다르면 별도 카드(서버 board route 기준).
  reservationId: number;
  roomNumber: number;
  colorHex: string;
  travelers: BoardTraveler[];
  saleConfirmStatus: SaleConfirmStatus;
  affiliateSaleId: number | null;
}

interface BoardProduct {
  code: string;
  name: string;
  departureDate: string;
  shipName: string | null;
}

interface BoardSummary {
  totalTravelers: number;
  completed: number;
  pendingPassport: number;
  expiredCount: number;
  incompleteCount?: number;
  dupCount?: number;
}

interface BoardResponse {
  ok: boolean;
  product?: BoardProduct;
  rooms?: BoardRoom[];
  summary?: BoardSummary;
  error?: string;
}

// 감사 이력 1행 (audit route 응답과 1:1)
interface AuditRow {
  id: number;
  action: string;
  userName: string;
  oldValue: unknown;
  newValue: unknown;
  changedFields: string[];
  reason: string | null;
  createdAt: string;
  travelerId: number | null;
}

interface ApisBoardProps {
  productCode: string;
  /** false면 읽기 전용(편집/이동/추가/삭제/되돌리기 버튼 숨김) */
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

// 필드 키 → 한국어 라벨 (이력 타임라인·되돌리기 표시용)
const FIELD_LABELS: Record<string, string> = {
  engSurname: '영문 성',
  engGivenName: '영문 이름',
  gender: '성별',
  birthDate: '생년월일',
  passportNo: '여권번호',
  expiryDate: '여권 만료일',
  korName: '한글 이름',
  nationality: '국적',
  issueDate: '여권 발급일',
  phone: '연락처',
  roomNumber: '방 번호',
  isSingleCharge: '싱글차지',
};

// 경고 코드 → 한국어 + 색
const WARNING_META: Record<string, { label: string; tone: 'red' | 'yellow' }> = {
  missing: { label: '미완성', tone: 'yellow' },
  expired: { label: '여권 만료', tone: 'red' },
  passport_format: { label: '여권번호 형식 오류', tone: 'red' },
  eng_split: { label: '영문 성/이름 미분리', tone: 'yellow' },
  dup_passport: { label: '같은 방 여권 중복', tone: 'red' },
};

// 편집 가능 필드만 화이트리스트(undo 시 안전 적용)
const EDITABLE_KEYS = new Set<string>([
  ...CORE_FIELDS.map((f) => f.key),
  ...MORE_FIELDS.map((f) => f.key),
]);

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

/** 완성도 점 색: status(error 빨강 / partial 노랑 / complete 초록) 우선, 폴백은 completeness */
function dotColor(t: BoardTraveler): { bg: string; label: string } {
  if (t.status === 'error') {
    if (t.warnings?.includes('expired')) return { bg: '#dc2626', label: '여권 만료' };
    return { bg: '#dc2626', label: '확인 필요' };
  }
  if (t.status === 'partial') return { bg: '#eab308', label: '일부 입력' };
  if (t.status === 'complete') return { bg: '#16a34a', label: '완성' };
  // 폴백 (구버전 board 응답 호환 — status 미존재 시)
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

/**
 * 문자열을 'YYYY-MM-DD'(KST 달력 날짜)로 정규화해 UTC 자정 epoch(ms)로 환산한다.
 * 서버(board route)의 만료 판정과 UI 배지를 동일 기준으로 맞추기 위한 핵심 헬퍼([P1-3]).
 *
 * 왜 필요한가: `new Date('2026-06-30').getTime()` 은 UTC 자정으로 파싱되지만,
 * `new Date(isoWithTime)` 은 로컬 타임존이 섞여 들어가 같은 달력 날짜라도 시각 성분 때문에
 * D-N 이 ±1 흔들리고 서버 판정과 어긋난다. → 시각 성분을 버리고 'YYYY-MM-DD'(KST)만 비교한다.
 *  - 출발일(departureDate)은 서버가 ISO(시각 포함)로 내려줄 수 있어 KST 달력일로 환산한다.
 *  - 만료일(expiryDate)은 보통 'YYYY-MM-DD' 문자열이며 동일하게 달력일만 취한다.
 * 반환: UTC 자정 epoch(ms) / 파싱 불가 시 null.
 */
function toKstDateEpoch(value: string): number | null {
  const s = (value || '').trim();
  if (!s) return null;
  // 이미 'YYYY-MM-DD'(앞 10자) 형태면 시각 성분 없이 그대로 사용 (타임존 드리프트 0)
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }
  // 시각이 섞인 ISO 등은 KST(UTC+9) 달력일로 환산 후 날짜만 취한다 (서버 KST 기준과 일치)
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
}

/**
 * 출발일 기준 만료까지 남은 일수(달력 날짜 차, KST). 출발일에 이미 만료면 음수/0. null=계산불가.
 * 서버 board route 의 만료 판정(만료일 < 출발일)과 같은 달력 기준이라 UI 배지와 서버 판정이 일치한다([P1-3]).
 */
function daysToExpiry(expiryDate: string, departureDate: string): number | null {
  const exp = toKstDateEpoch(expiryDate);
  const dep = toKstDateEpoch(departureDate);
  if (exp == null || dep == null) return null;
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((exp - dep) / MS);
}

/** 만료 배지 텍스트: 출발일 이전 만료면 'D-N 만료위험' / 이미 지났으면 '만료' */
function expiryBadge(t: BoardTraveler, departureDate: string): string | null {
  if (!t.expiredPassport) return null;
  const d = daysToExpiry(t.expiryDate, departureDate);
  if (d == null) return '만료';
  if (d <= 0) return '만료';
  return `D-${d} 만료위험`;
}

/** CSV 한 셀 이스케이프 */
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** 이력 행 한 줄 한국어 요약 (예: "여권번호 수정 M1234 → M5678") */
function describeAudit(a: AuditRow): string {
  const actionLabel: Record<string, string> = {
    TRAVELER_UPDATE: '정보 수정',
    TRAVELER_MOVE_ROOM: '방 이동',
    TRAVELER_DELETE: '명단에서 삭제',
    TRAVELER_RESTORE: '삭제 되살리기',
    TRAVELER_UNDO: '삭제 되살리기', // 실제 undo 라우트가 저장하는 action
    TRAVELER_COMPANION_ADD: '동행인 추가',
    TRAVELER_SINGLE_CHARGE_RECHECK: '싱글차지 재판정',
    PASSPORT_SUBMIT: '고객 여권 제출',
    PASSPORT_SUBMIT_LATER: '고객 추후제출(이름만)',
  };
  const base = actionLabel[a.action] ?? a.action;

  // changedFields 가 1개면 '필드 수정 old → new' 형태로 상세 표시
  if (a.changedFields.length > 0 && a.oldValue && typeof a.oldValue === 'object') {
    const oldObj = a.oldValue as Record<string, unknown>;
    const newObj =
      a.newValue && typeof a.newValue === 'object' ? (a.newValue as Record<string, unknown>) : {};
    const parts = a.changedFields.slice(0, 3).map((f) => {
      const label = FIELD_LABELS[f] ?? f;
      const ov = oldObj[f];
      const nv = newObj[f];
      const ovs = ov == null || ov === '' ? '(비어있음)' : String(ov);
      const nvs = nv == null || nv === '' ? '(비어있음)' : String(nv);
      return `${label} ${ovs} → ${nvs}`;
    });
    return parts.join(', ');
  }
  return base;
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

export default function ApisBoard({ productCode, canManage }: ApisBoardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<BoardProduct | null>(null);
  const [rooms, setRooms] = useState<BoardRoom[]>([]);
  const [summary, setSummary] = useState<BoardSummary | null>(null);

  // 슬라이드 편집 패널 대상 traveler id
  const [editingId, setEditingId] = useState<number | null>(null);
  // 이력 패널 대상 traveler id (id 만 보관 — 실제 traveler 는 rooms 에서 최신값 재계산.
  // 객체 스냅샷을 그대로 들고 있으면 board 재로드 후 version 이 stale 이 되어
  // revertField 의 expectedVersion 이 구버전 → 첫 시도 항상 409 로 헛도는 버그가 생긴다.)
  const [historyId, setHistoryId] = useState<number | null>(null);
  // 동행인 추가 모달: 대상 방 정보
  const [addTarget, setAddTarget] = useState<{ reservationId: number; roomNumber: number } | null>(null);
  // 문제 행 점프 필터: null=전체 / 'expired' / 'incomplete'
  const [problemFilter, setProblemFilter] = useState<null | 'expired' | 'incomplete'>(null);

  // 판매확인 승인요청 중인 reservationId 집합
  const [saleConfirmLoading, setSaleConfirmLoading] = useState<Set<number>>(new Set());

  // 수동 탑승객 추가 모달
  const [addingManual, setAddingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    roomNumber: 1,
    korName: '',
    engSurname: '',
    engGivenName: '',
    gender: '',
    birthDate: '',
    nationality: '',
    passportNo: '',
    issueDate: '',
    expiryDate: '',
    phone: '',
  });

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

  const loadBoard = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/apis/board?productCode=${encodeURIComponent(productCode)}`,
        { cache: 'no-store', signal },
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
      if (err instanceof Error && err.name === 'AbortError') return;
      logger.error('[ApisBoard] load failed', { err: String(err) });
      setError('네트워크 오류로 보드를 불러오지 못했습니다.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [productCode]);

  const handleSaleConfirmRequest = useCallback(
    async (reservationId: number) => {
      setSaleConfirmLoading((prev) => new Set(prev).add(reservationId));
      try {
        const res = await fetch(
          `/api/admin/apis/reservation/${reservationId}/request-sale-confirm`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error ?? '요청에 실패했습니다.', 'warn');
          return;
        }
        showToast('판매확인 승인요청을 크루즈닷에 전송했습니다.', 'ok');
        void loadBoard();
      } catch {
        showToast('네트워크 오류가 발생했습니다.', 'warn');
      } finally {
        setSaleConfirmLoading((prev) => {
          const next = new Set(prev);
          next.delete(reservationId);
          return next;
        });
      }
    },
    [showToast, loadBoard]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void loadBoard(ctrl.signal);
    return () => ctrl.abort();
  }, [loadBoard]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // 방 이동 드롭다운 옵션 (현재 보드의 모든 방번호, 중복 제거)
  // 예약×방 단위로 카드가 분리되면서 서로 다른 예약이 같은 roomNumber 를 가질 수 있으므로
  // roomNumber 기준으로 중복을 제거해 드롭다운에 같은 방 버튼이 두 번 뜨지 않게 한다.
  const roomOptions = useMemo(() => {
    const seen = new Set<number>();
    const opts: { roomNumber: number; colorHex: string }[] = [];
    for (const r of rooms) {
      if (seen.has(r.roomNumber)) continue;
      seen.add(r.roomNumber);
      opts.push({ roomNumber: r.roomNumber, colorHex: r.colorHex });
    }
    return opts.sort((a, b) => a.roomNumber - b.roomNumber);
  }, [rooms]);

  const editingTraveler = useMemo(() => {
    if (editingId == null) return null;
    for (const r of rooms) {
      const found = r.travelers.find((t) => t.id === editingId);
      if (found) return found;
    }
    return null;
  }, [editingId, rooms]);

  // 이력 패널 대상 traveler — editingTraveler 와 동일하게 rooms 기준으로 최신값 재계산.
  // 이렇게 해야 이력을 연 뒤 같은 탑승객이 다른 곳에서 수정돼 board 가 재로드돼도
  // revertField 가 항상 최신 version 으로 호출된다(stale version 409 헛돎 방지).
  const historyTraveler = useMemo(() => {
    if (historyId == null) return null;
    for (const r of rooms) {
      const found = r.travelers.find((t) => t.id === historyId);
      if (found) return found;
    }
    return null;
  }, [historyId, rooms]);

  const departureDate = product?.departureDate ?? '';

  // ── 진척/문제 집계 (summary 우선, 없으면 rooms 로 폴백) ──────────
  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let expired = 0;
    let incomplete = 0;
    let pendingPassport = 0;
    for (const r of rooms) {
      for (const t of r.travelers) {
        total++;
        if (t.status === 'complete') completed++;
        if (t.expiredPassport) expired++;
        if (t.warnings?.includes('missing')) incomplete++;
        if (!t.passportNo?.trim()) pendingPassport++;
      }
    }
    return {
      total: summary?.totalTravelers ?? total,
      completed: summary?.completed ?? completed,
      expired: summary?.expiredCount ?? expired,
      incomplete: summary?.incompleteCount ?? incomplete,
      pendingPassport: summary?.pendingPassport ?? pendingPassport,
    };
  }, [rooms, summary]);

  const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // ── 필터 적용된 방 목록 (문제 행 점프) ──────────────────────────
  const filteredRooms = useMemo(() => {
    if (!problemFilter) return rooms;
    return rooms
      .map((r) => ({
        ...r,
        travelers: r.travelers.filter((t) =>
          problemFilter === 'expired'
            ? t.expiredPassport
            : t.warnings?.includes('missing'),
        ),
      }))
      .filter((r) => r.travelers.length > 0);
  }, [rooms, problemFilter]);

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

        // 되돌리기: 이전 값으로 재저장 (서버가 올려준 새 version 사용 — undo 도 감사기록됨)
        const newVersion: number =
          typeof data.traveler?.version === 'number' ? data.traveler.version : t.version + 1;
        const fieldLabel = FIELD_LABELS[key] ?? key;
        showToast(`${fieldLabel} 저장됐어요.`, 'ok', () => {
          void (async () => {
            try {
              const undoRes = await fetch(`/api/admin/apis/traveler/${t.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'update',
                  changes: { [key]: (prevValue || '').trim() },
                  expectedVersion: newVersion,
                }),
              });
              if (undoRes.status === 409) {
                showToast('그 사이 다른 담당자가 수정해 되돌릴 수 없어요. 최신 정보를 불러옵니다.', 'warn');
              }
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

  // ── 이력 → 특정 필드 1건 되돌리기 (oldValue 로 PATCH, 감사기록) ──
  // 409(다른 담당자가 그 사이 수정)일 때는 서버가 돌려준 latest.version 으로 1회 자동 재시도한다.
  // historyTraveler 가 rooms 기준 최신값이라도, 이력 패널을 띄운 짧은 사이에
  // 같은 탑승객이 수정될 수 있으므로 안전망으로 자동 재시도를 둔다(되돌리기 헛돎 방지).
  const revertField = useCallback(
    async (t: BoardTraveler, key: string, oldVal: unknown): Promise<void> => {
      if (!EDITABLE_KEYS.has(key)) {
        showToast('이 항목은 되돌릴 수 없어요.', 'warn');
        return;
      }
      const value = oldVal == null ? '' : String(oldVal).trim();
      const fieldLabel = FIELD_LABELS[key] ?? key;

      const attempt = async (expectedVersion: number) => {
        const res = await fetch(`/api/admin/apis/traveler/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            changes: { [key]: value },
            expectedVersion,
          }),
        });
        const data = await res.json();
        return { res, data };
      };

      try {
        let { res, data } = await attempt(t.version);

        // 409: 서버가 돌려준 최신 version 으로 1회 자동 재시도
        if (res.status === 409) {
          const latestVersion =
            data?.latest && typeof data.latest.version === 'number'
              ? (data.latest.version as number)
              : null;
          if (latestVersion != null && latestVersion !== t.version) {
            ({ res, data } = await attempt(latestVersion));
          }
        }

        if (res.status === 409) {
          showToast('다른 담당자가 방금 수정했어요. 최신 정보를 불러옵니다.', 'warn');
          await loadBoard();
          return;
        }
        if (!res.ok || !data.ok) {
          showToast(data.error || '되돌리기에 실패했습니다.', 'warn');
          return;
        }
        showToast(`${fieldLabel}을(를) 되돌렸어요.`, 'ok');
        await loadBoard();
      } catch (err) {
        logger.error('[ApisBoard] revertField failed', { err: String(err) });
        showToast('되돌리기 중 오류가 발생했습니다.', 'warn');
      }
    },
    [loadBoard, showToast],
  );

  // 삭제 무손실 되살리기: POST /undo {expectedAuditId} 로 서버가 DELETE 스냅샷(전체 JSON)을
  // 그대로 복원한다([P0]). 기존 '동행인 POST 재생성'(손실복원: 역할/그룹/고객연결/여권필드 유실)을
  // 완전히 대체한다. 구매자·동행인·미배정 모두 같은 경로로 원래 모습 그대로 복원된다.
  //   - expectedAuditId = 그 삭제건의 TRAVELER_DELETE 감사로그 id (DELETE 응답의 auditId).
  //     서버가 이 id 로 '정확히 그 삭제건만' 멱등 복원하고, 이미 복원/존재 시 409 로 차단한다.
  const undoDelete = useCallback(
    async (who: string, expectedAuditId: number, travelerId: number): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/apis/traveler/${travelerId}/undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedAuditId }),
        });
        const data = await res.json();
        if (res.status === 409) {
          // 이미 되살림 / 대상 id 가 이미 존재(중복 복원) → 보드만 최신화
          showToast(data.error || '이미 되살렸어요. 최신 정보를 불러옵니다.', 'warn');
          await loadBoard();
          return;
        }
        if (!res.ok || !data.ok) {
          showToast(data.error || '되살리기에 실패했습니다.', 'warn');
          await loadBoard();
          return;
        }
        showToast(`${who}님을 되살렸어요.`, 'ok');
        await loadBoard();
      } catch (err) {
        logger.error('[ApisBoard] undoDelete failed', { err: String(err) });
        showToast('되살리기 중 오류가 발생했습니다.', 'warn');
        await loadBoard();
      }
    },
    [loadBoard, showToast],
  );

  // ── 단건 삭제 (무손실 undo) ─────────────────────────────────
  //
  // [P0] 삭제 후 되살리기는 서버 /undo 라우트로 DELETE 스냅샷을 무손실 복원한다.
  // 따라서 구매자·동행인·미배정을 가리지 않고 모두 5초 되살리기를 제공한다(거짓 약속 없음).
  // 단, 서버가 auditId 를 돌려주지 않은 경우(계약 미충족)에만 되살리기 버튼을 숨겨
  // 깨진 undo 약속을 만들지 않는다.
  // [R1] DELETE 에 expectedVersion(t.version)을 함께 보내 lost-delete(그 사이 다른 사람이
  //      수정한 최신 행을 모르고 지움)를 서버 낙관락으로 차단한다. 409 → 최신 불러오기.
  const deleteTraveler = useCallback(
    async (t: BoardTraveler, currentRoom: number) => {
      const who = travelerDisplayName(t);
      const role = t.isCompanion ? '동행인' : '구매자';

      const confirmMsg =
        `${who}님(${role})을 이 명단에서 정말 빼나요?\n삭제해도 5초 안에 되살릴 수 있어요.`;
      if (!window.confirm(confirmMsg)) return;

      try {
        const res = await fetch(`/api/admin/apis/traveler/${t.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          // [R1] 낙관락: 화면이 본 version 을 함께 보내 그 사이 수정된 행을 모르고 지우는 것 차단
          body: JSON.stringify({ expectedVersion: t.version }),
        });
        const data = await res.json();
        if (res.status === 409) {
          showToast('다른 담당자가 방금 수정했어요. 최신 정보를 불러옵니다.', 'warn');
          await loadBoard();
          return;
        }
        if (!res.ok || !data.ok) {
          showToast(data.error || '삭제에 실패했습니다.', 'warn');
          return;
        }

        // 무손실 되살리기: 서버가 돌려준 auditId 를 expectedAuditId 로 /undo 호출.
        const auditId: number | null =
          typeof data.auditId === 'number' && Number.isInteger(data.auditId) ? data.auditId : null;
        if (auditId != null) {
          showToast(`${who}님을 명단에서 뺐어요.`, 'ok', () => {
            void undoDelete(who, auditId, t.id);
          });
        } else {
          // 계약 미충족(auditId 누락) → 거짓 undo 약속 금지: 되살리기 버튼 없이 안내
          showToast(`${who}님을 명단에서 뺐어요.`, 'warn');
        }
        await loadBoard();
      } catch (err) {
        logger.error('[ApisBoard] deleteTraveler failed', { err: String(err) });
        showToast('삭제 중 오류가 발생했습니다.', 'warn');
      }
    },
    [loadBoard, showToast, undoDelete],
  );

  // ── 엑셀(CSV) 다운로드 — 경고 confirm 후 클라이언트 생성 ────────
  const downloadCsv = useCallback(() => {
    const expired = stats.expired;
    const incomplete = stats.incomplete;
    if (expired > 0 || incomplete > 0) {
      const ok = window.confirm(
        `미완성 ${incomplete}건 · 만료위험 ${expired}건이 있어요.\n그래도 다운로드를 진행할까요?`,
      );
      if (!ok) return;
    }

    const header = [
      '방',
      '한글이름',
      '영문성',
      '영문이름',
      '성별',
      '생년월일',
      '국적',
      '여권번호',
      '발급일',
      '만료일',
      '연락처',
      '담당자',
      '상태',
    ];
    const lines: string[] = [header.map(csvCell).join(',')];
    for (const room of rooms) {
      for (const t of room.travelers) {
        const statusText =
          t.status === 'complete' ? '완성' : t.status === 'error' ? '확인필요' : '미완성';
        lines.push(
          [
            room.roomNumber > 0 ? `${room.roomNumber}번방` : '미배정',
            t.korName,
            t.engSurname,
            t.engGivenName,
            t.gender,
            t.birthDate,
            t.nationality,
            t.passportNo,
            t.issueDate,
            t.expiryDate,
            t.phone,
            t.agentName,
            statusText,
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
    const csv = '﻿' + lines.join('\r\n'); // BOM(엑셀 한글 깨짐 방지)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `APIS_${product?.code ?? productCode}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('명단을 내려받았어요.', 'ok');
  }, [rooms, stats, product, productCode, showToast]);

  // ── 수동 탑승객 추가 ──────────────────────────────────────────
  const addManualTraveler = useCallback(async () => {
    if (!productCode || !manualForm.roomNumber) return;
    try {
      const res = await fetch('/api/admin/apis/traveler/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode, ...manualForm }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error || '탑승객 추가에 실패했습니다.', 'warn');
        return;
      }
      setAddingManual(false);
      setManualForm({
        roomNumber: 1,
        korName: '',
        engSurname: '',
        engGivenName: '',
        gender: '',
        birthDate: '',
        nationality: '',
        passportNo: '',
        issueDate: '',
        expiryDate: '',
        phone: '',
      });
      showToast('탑승객을 추가했어요.', 'ok');
      await loadBoard();
    } catch (err) {
      logger.error('[ApisBoard] addManualTraveler failed', { err: String(err) });
      showToast('탑승객 추가 중 오류가 발생했습니다.', 'warn');
    }
  }, [productCode, manualForm, showToast, loadBoard]);

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
                탑승객 {stats.total}명
              </span>
              <span className="rounded-full bg-green-100 px-3 py-1.5 text-green-700">
                완성 {stats.completed}
              </span>
              {stats.pendingPassport > 0 && (
                <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-700">
                  여권없음 {stats.pendingPassport}
                </span>
              )}
              {stats.expired > 0 && (
                <span className="rounded-full bg-orange-100 px-3 py-1.5 text-orange-700">
                  만료위험 {stats.expired}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-base font-bold text-emerald-700 hover:bg-emerald-50"
            title="현재 명단 엑셀(CSV) 다운로드"
          >
            <Download className="h-5 w-5" /> 엑셀
          </button>
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

      {/* 진척바 + 문제 행 점프 칩 */}
      {stats.total > 0 && (
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-bold text-gray-800">
              {stats.total}명 중{' '}
              <span className="text-blue-700">{stats.completed}명</span> 여권 완료
              {stats.pendingPassport > 0 && (
                <span className="ml-2 text-red-600">· 미제출 {stats.pendingPassport}명</span>
              )}
            </p>
            <span className="text-lg font-bold text-blue-700">{progressPct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* 문제 점프 칩 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500">
              <Filter className="h-4 w-4" /> 빠른 보기
            </span>
            <button
              type="button"
              onClick={() => setProblemFilter(null)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                problemFilter === null
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 {stats.total}
            </button>
            <button
              type="button"
              onClick={() => setProblemFilter(problemFilter === 'expired' ? null : 'expired')}
              disabled={stats.expired === 0}
              className={`rounded-full px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${
                problemFilter === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              만료위험 {stats.expired}
            </button>
            <button
              type="button"
              onClick={() => setProblemFilter(problemFilter === 'incomplete' ? null : 'incomplete')}
              disabled={stats.incomplete === 0}
              className={`rounded-full px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${
                problemFilter === 'incomplete'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              }`}
            >
              미완성 {stats.incomplete}
            </button>
          </div>
        </div>
      )}

      {/* 방 색깔카드 세로 스택 (가로 스크롤 금지) */}
      {filteredRooms.length === 0 ? (
        <div className="space-y-4">
          {/* APIS 열 헤더 + 빈 상태 안내 */}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">방</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">한글이름</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">영문 성</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">영문 이름</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">성별</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">생년월일</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">여권번호</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">만료일</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">국적</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">연락처</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                    {problemFilter
                      ? '해당 조건의 탑승객이 없습니다.'
                      : '등록된 탑승객이 없습니다. 탑승객이 여권을 제출하면 자동으로 채워집니다.'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 수동 탑승객 추가 버튼 */}
          {canManage && !problemFilter && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAddingManual(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
              >
                <UserPlus className="w-4 h-4" />
                탑승객 수동 추가
              </button>
            </div>
          )}

          {/* 수동 추가 모달 */}
          {addingManual && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    탑승객 수동 추가
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAddingManual(false)}
                    className="text-gray-400 hover:text-gray-600 rounded-xl p-1"
                    aria-label="닫기"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">방번호</label>
                    <input
                      type="number"
                      min={1}
                      value={manualForm.roomNumber}
                      onChange={(e) => setManualForm((f) => ({ ...f, roomNumber: Number(e.target.value) }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">한글이름</label>
                    <input
                      type="text"
                      placeholder="홍길동"
                      value={manualForm.korName}
                      onChange={(e) => setManualForm((f) => ({ ...f, korName: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">영문 성</label>
                    <input
                      type="text"
                      placeholder="HONG"
                      value={manualForm.engSurname}
                      onChange={(e) => setManualForm((f) => ({ ...f, engSurname: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">영문 이름</label>
                    <input
                      type="text"
                      placeholder="GILDONG"
                      value={manualForm.engGivenName}
                      onChange={(e) => setManualForm((f) => ({ ...f, engGivenName: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">성별</label>
                    <div className="flex gap-2">
                      {['M', 'F'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setManualForm((f) => ({ ...f, gender: g }))}
                          className={`flex-1 rounded-xl border-2 py-2 text-base font-bold ${
                            manualForm.gender === g
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-white text-gray-600'
                          }`}
                        >
                          {g === 'M' ? '남 (M)' : '여 (F)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">생년월일</label>
                    <input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      value={manualForm.birthDate}
                      onChange={(e) => setManualForm((f) => ({ ...f, birthDate: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">여권번호</label>
                    <input
                      type="text"
                      placeholder="M12345678"
                      value={manualForm.passportNo}
                      onChange={(e) => setManualForm((f) => ({ ...f, passportNo: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">만료일</label>
                    <input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      value={manualForm.expiryDate}
                      onChange={(e) => setManualForm((f) => ({ ...f, expiryDate: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">국적</label>
                    <input
                      type="text"
                      placeholder="KOR"
                      value={manualForm.nationality}
                      onChange={(e) => setManualForm((f) => ({ ...f, nationality: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">연락처</label>
                    <input
                      type="tel"
                      placeholder="010-0000-0000"
                      value={manualForm.phone}
                      onChange={(e) => setManualForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-5 justify-end">
                  <button
                    type="button"
                    onClick={() => setAddingManual(false)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void addManualTraveler()}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredRooms.map((room) => (
            <RoomCard
              key={`${room.reservationId}-${room.roomNumber}`}
              room={room}
              canManage={canManage}
              roomOptions={roomOptions}
              departureDate={departureDate}
              onEdit={(id) => setEditingId(id)}
              onMove={moveRoom}
              onHistory={(t) => setHistoryId(t.id)}
              onDelete={deleteTraveler}
              onAddCompanion={(reservationId) =>
                setAddTarget({ reservationId, roomNumber: room.roomNumber })
              }
              onSaleConfirm={handleSaleConfirmRequest}
              saleConfirmLoading={saleConfirmLoading.has(room.reservationId)}
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

      {/* 이력 패널 — historyTraveler 는 rooms 기준 최신값(stale version 방지) */}
      {historyTraveler && (
        <HistoryPanel
          traveler={historyTraveler}
          canManage={canManage}
          onClose={() => setHistoryId(null)}
          onRevert={revertField}
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
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
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

// 판매확인 상태 배지
const SALE_CONFIRM_CONFIG: Record<SaleConfirmStatus, { label: string; cls: string }> = {
  PENDING:   { label: '미요청',   cls: 'bg-gray-100 text-gray-500' },
  REQUESTED: { label: '승인대기', cls: 'bg-orange-100 text-orange-700' },
  APPROVED:  { label: '승인완료', cls: 'bg-green-100 text-green-700' },
  REJECTED:  { label: '반려',     cls: 'bg-red-100 text-red-600' },
};

interface RoomCardProps {
  room: BoardRoom;
  canManage: boolean;
  roomOptions: { roomNumber: number; colorHex: string }[];
  departureDate: string;
  onEdit: (travelerId: number) => void;
  onMove: (t: BoardTraveler, currentRoom: number, targetRoom: number) => void;
  onHistory: (t: BoardTraveler) => void;
  onDelete: (t: BoardTraveler, currentRoom: number) => void;
  onAddCompanion: (reservationId: number) => void;
  onSaleConfirm: (reservationId: number) => void;
  saleConfirmLoading: boolean;
}

function RoomCard({
  room,
  canManage,
  roomOptions,
  departureDate,
  onEdit,
  onMove,
  onHistory,
  onDelete,
  onAddCompanion,
  onSaleConfirm,
  saleConfirmLoading,
}: RoomCardProps) {
  // 동행인 추가 시 연결할 reservationId: 방의 첫 번째 탑승객 기준 (없으면 추가 비활성)
  const primaryReservationId = room.travelers[0]?.reservationId ?? null;
  const confirmCfg = SALE_CONFIRM_CONFIG[room.saleConfirmStatus] ?? SALE_CONFIRM_CONFIG.PENDING;
  const canRequest = room.affiliateSaleId != null
    && room.saleConfirmStatus !== 'REQUESTED'
    && room.saleConfirmStatus !== 'APPROVED';

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
          {/* 판매확인 승인요청 영역 */}
          {canManage && room.affiliateSaleId != null && (
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${confirmCfg.cls}`}>
                {confirmCfg.label}
              </span>
              {canRequest && (
                <button
                  type="button"
                  disabled={saleConfirmLoading}
                  onClick={() => onSaleConfirm(room.reservationId)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saleConfirmLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  판매확인 승인요청
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col divide-y divide-gray-100">
          {room.travelers.map((t) => (
            <TravelerBlock
              key={t.id}
              traveler={t}
              currentRoom={room.roomNumber}
              canManage={canManage}
              roomOptions={roomOptions}
              departureDate={departureDate}
              onEdit={onEdit}
              onMove={onMove}
              onHistory={onHistory}
              onDelete={onDelete}
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
  departureDate: string;
  onEdit: (travelerId: number) => void;
  onMove: (t: BoardTraveler, currentRoom: number, targetRoom: number) => void;
  onHistory: (t: BoardTraveler) => void;
  onDelete: (t: BoardTraveler, currentRoom: number) => void;
}

function TravelerBlock({
  traveler,
  currentRoom,
  canManage,
  roomOptions,
  departureDate,
  onEdit,
  onMove,
  onHistory,
  onDelete,
}: TravelerBlockProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const moveRef = useRef<HTMLDivElement | null>(null);
  const dot = dotColor(traveler);
  const expBadge = expiryBadge(traveler, departureDate);

  // 검증 경고 → 표시용 (만료는 별도 배지로 표시하므로 제외, 미완성은 빈칸 노랑 배지)
  const warns = traveler.warnings ?? [];
  const hasMissing = warns.includes('missing');
  const otherWarns = warns.filter(
    (w) => w !== 'expired' && w !== 'missing' && WARNING_META[w],
  );

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

  // 행 배경: error 연빨강 / partial 연노랑 / complete 흰색
  const rowBg =
    traveler.status === 'error'
      ? 'bg-red-50/60'
      : traveler.status === 'partial'
        ? 'bg-yellow-50/50'
        : '';

  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg px-2 py-3 ${rowBg}`}>
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
          {/* 만료 배지 (빨강, D-N) */}
          {expBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" /> {expBadge}
            </span>
          )}
          {/* 미완성(빈칸) 노랑 배지 */}
          {hasMissing && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
              빈칸 있음
            </span>
          )}
          {/* 기타 경고 (형식/영문분리/중복) 아이콘 + 툴팁 */}
          {otherWarns.map((w) => {
            const meta = WARNING_META[w];
            return (
              <span
                key={w}
                title={meta.label}
                aria-label={meta.label}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                  meta.tone === 'red'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                <AlertTriangle className="h-3 w-3" /> {meta.label}
              </span>
            );
          })}
        </div>

        {/* 마스킹된 핵심 정보 */}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
          <span>여권 {maskPassport(traveler.passportNo)}</span>
          <span>생일 {maskBirth(traveler.birthDate)}</span>
          {traveler.gender && <span>{traveler.gender}</span>}
        </div>

        {/* 담당자 / 최근 수정 / 이력 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
          {traveler.agentName && <span>담당 {traveler.agentName}</span>}
          {traveler.updatedByName && (
            <span>
              수정: {traveler.updatedByName} {fmtUpdated(traveler.updatedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onHistory(traveler)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-blue-600 hover:bg-blue-50"
            title="변경 이력 보기"
          >
            <History className="h-3.5 w-3.5" /> 이력
          </button>
        </div>
      </div>

      {/* 우측 동작: 방 이동 + 삭제 */}
      {canManage && (
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="relative" ref={moveRef}>
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
          {/* 단건 삭제 (휴지통) */}
          <button
            type="button"
            onClick={() => onDelete(traveler, currentRoom)}
            className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white p-2 text-red-500 hover:bg-red-50"
            title="이 사람 명단에서 빼기"
            aria-label="명단에서 빼기"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 이력 패널 (변경 이력 타임라인 + 1클릭 되돌리기)
// ─────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  traveler: BoardTraveler;
  canManage: boolean;
  onClose: () => void;
  onRevert: (t: BoardTraveler, key: string, oldVal: unknown) => Promise<void>;
}

function HistoryPanel({ traveler, canManage, onClose, onRevert }: HistoryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/apis/audit?travelerId=${traveler.id}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || '이력을 불러오지 못했습니다.');
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      logger.error('[ApisBoard] history load failed', { err: String(e) });
      setErr('네트워크 오류로 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [traveler.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 truncate text-xl font-bold text-gray-900">
              <History className="h-6 w-6 text-blue-600" />
              {travelerDisplayName(traveler)} 변경 이력
            </h3>
            <p className="text-sm text-gray-500">누가 언제 무엇을 바꿨는지 보여줘요.</p>
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

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 이력을 불러오는 중…
            </div>
          ) : err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-base font-semibold text-red-700">
              {err}
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4" /> 다시 시도
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-base text-gray-400">
              아직 변경 이력이 없어요.
            </div>
          ) : (
            <ol className="relative space-y-4 border-l-2 border-gray-100 pl-5">
              {rows.map((a) => {
                // 되돌리기 가능: update 액션 + 단일 편집필드 + 화이트리스트
                const single =
                  a.action === 'TRAVELER_UPDATE' &&
                  a.changedFields.length === 1 &&
                  EDITABLE_KEYS.has(a.changedFields[0]) &&
                  a.oldValue != null &&
                  typeof a.oldValue === 'object';
                const revertKey = single ? a.changedFields[0] : null;
                const revertVal =
                  single && a.oldValue && typeof a.oldValue === 'object'
                    ? (a.oldValue as Record<string, unknown>)[a.changedFields[0]]
                    : undefined;
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-400">
                          {fmtUpdated(a.createdAt)} · {a.userName || '알 수 없음'}
                        </p>
                        <p className="mt-0.5 break-words text-sm font-semibold text-gray-800">
                          {describeAudit(a)}
                        </p>
                      </div>
                      {canManage && revertKey && (
                        <button
                          type="button"
                          disabled={reverting === `${a.id}`}
                          onClick={async () => {
                            setReverting(`${a.id}`);
                            await onRevert(traveler, revertKey, revertVal);
                            setReverting(null);
                            onClose();
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="이 변경 전 값으로 되돌리기"
                        >
                          {reverting === `${a.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Undo2 className="h-3.5 w-3.5" />
                          )}
                          되돌리기
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
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
