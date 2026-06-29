'use client';

import React from 'react';
import {
  DocumentLetterhead,
  DocumentSeal,
  COMPANY,
  formatMoney,
  todayKo,
  type CurrentAgent,
} from './shared';
import {
  CANCELLATION_POLICY,
  CRUISE_CANCELLATION_POLICY,
  COMPANY_INFO,
} from '@/lib/company-info';

/* ─────────────────────────────────────────────────────────────────────────────
   포함/불포함 전체 항목 목록 (체크박스 렌더링용)
   — 계약서 본문(ContractBody)과 작성 모달(ContractTab) 양쪽에서 재사용하므로 export
───────────────────────────────────────────────────────────────────────────── */
export const ALL_INCLUDE_ITEMS = [
  '선박/항공기 운임', '숙박/식사료', '안내자경비', '항만세·관광기금',
  '제세금', '여행알선수수료', '관광지 입장료', '유류할증료', '여행보험료',
  '항공기 추가 운임',
];
export const ALL_EXCLUDE_ITEMS = [
  '선상팁', '쇼핑비', '선택관광',
  '일본 관광 입국세', '여권·비자 개인 부담', '여권발급비', '비자발급비',
];

/* ─────────────────────────────────────────────────────────────────────────────
   타입 (공유 데이터 계약 — generatedData 형태)
───────────────────────────────────────────────────────────────────────────── */
export type RefundLine = { label: string; value: string };

export type ContractBodyCompanion = {
  id?: string;
  name: string;
  birthDate?: string;
  relation?: string;
  phone?: string;
  pnr?: string;
};

/** ③-2 계약 추가 정보 — generatedData 에 nested(contractDetails) 또는 flat 둘 다 허용 */
export type ContractDetailsShape = {
  contractType?: '기획여행' | '희망여행';
  travelGuarantee?: ('공제' | '예치금' | '영업보증보험')[];
  hasInsurance?: boolean;
  insuranceCompany?: string;
  minPax?: number | null;
  maxPax?: number | null;
  pricePerPerson?: number | null;
  transportTypes?: ('항공기' | '선박' | '기차')[];
  shipName?: string;
  accommodationTypes?: ('일정표표시' | '관광호텔' | '기타')[];
  hotelGrade?: string;
  mealDisplay?: '일정표표시' | '개별';
  breakfast?: number | null;
  lunch?: number | null;
  dinner?: number | null;
  localGuide?: '있음' | '없음';
  localTransport?: ('버스' | '승용차' | '기타' | '없음')[];
  localAgency?: '있음' | '없음';
};

export type ContractBodyData = ContractDetailsShape & {
  buyerName?: string | null;
  buyerTel?: string | null;
  productName?: string | null;
  amount?: number | null;
  departureDate?: string | null;
  nights?: number | null;
  includedItems?: string[];
  excludedItems?: string[];
  hasGuide?: 'Y' | 'N' | '';
  refundPolicy?: RefundLine[];
  refundPolicyLines?: RefundLine[];
  refundPolicyText?: string;
  specialTerms?: string | null;
  companions?: ContractBodyCompanion[];
  /** nested 형태(SPEC GET 화이트리스트). 없으면 flat(top-level)에서 읽음 */
  contractDetails?: ContractDetailsShape;
};

/* ── 서명점 (pointId 고정 — 공유 데이터 계약) ── */
export type SignaturePointId =
  | 'privacy_collect'
  | 'privacy_3rd'
  | 'privacy_mkt'
  | 'terms_handover'
  | 'special_terms_ack'
  | 'main'
  | 'vendor_seal';

export type SignatureRecord = {
  role: 'TRAVELER' | 'VENDOR';
  image: string | null;
  signedByName?: string;
  signedAt?: string;
  agreed?: boolean;
};

export type SignatureMap = Partial<Record<SignaturePointId, SignatureRecord>>;

export type ContractBodyProps = {
  /** generatedData 형태 (nested contractDetails 또는 flat 둘 다 지원) */
  data: ContractBodyData;
  /** 담당자 이름 — CRM 미리보기는 로그인 displayName, 서명페이지는 스냅샷(agentName) */
  agentName: string | null;
  /** 담당자 연락처(선택) — 없으면 본사 대표번호 폴백 */
  agentPhone?: string | null;
  /** 서명점별 서명 이미지/상태 */
  signatures?: SignatureMap;
  /** preview = CRM 읽기전용 미리보기 / sign = 공개 서명페이지(서명점 클릭 가능) */
  mode: 'preview' | 'sign';
  /** sign 모드에서 서명점 클릭 시 호출 (해당 pointId 서명으로 이동) */
  onRequestSign?: (pointId: SignaturePointId) => void;
  /** 현재 서명 중인 서명점 — 해당 조문을 강조 표시 */
  activeSignPointId?: SignaturePointId | null;
};

/* ── nested(contractDetails) 우선, 없으면 flat(top-level)에서 ③-2 필드 병합 ── */
function getDetails(data: ContractBodyData): ContractDetailsShape {
  const n = data.contractDetails ?? {};
  return {
    contractType: n.contractType ?? data.contractType,
    travelGuarantee: n.travelGuarantee ?? data.travelGuarantee,
    hasInsurance: n.hasInsurance ?? data.hasInsurance,
    insuranceCompany: n.insuranceCompany ?? data.insuranceCompany,
    minPax: n.minPax ?? data.minPax,
    maxPax: n.maxPax ?? data.maxPax,
    pricePerPerson: n.pricePerPerson ?? data.pricePerPerson,
    transportTypes: n.transportTypes ?? data.transportTypes,
    shipName: n.shipName ?? data.shipName,
    accommodationTypes: n.accommodationTypes ?? data.accommodationTypes,
    hotelGrade: n.hotelGrade ?? data.hotelGrade,
    mealDisplay: n.mealDisplay ?? data.mealDisplay,
    breakfast: n.breakfast ?? data.breakfast,
    lunch: n.lunch ?? data.lunch,
    dinner: n.dinner ?? data.dinner,
    localGuide: n.localGuide ?? data.localGuide,
    localTransport: n.localTransport ?? data.localTransport,
    localAgency: n.localAgency ?? data.localAgency,
  };
}

function CheckBox({ checked }: { checked: boolean }) {
  return checked
    ? <span className="inline-flex h-3 w-3 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-white text-[8px] font-bold">✓</span>
    : <span className="inline-block h-3 w-3 rounded border border-gray-300 bg-white" />;
}

/* ─────────────────────────────────────────────────────────────────────────────
   서명 슬롯 — 서명점 자리에 서명 이미지(있으면) / 직인(vendor) / 빈 서명란을 렌더
   - id: sign-point-{pointId} (서명페이지가 scrollIntoView 로 이동)
   - sign 모드 + onRequestSign 이면 클릭 가능(해당 서명점으로 이동)
───────────────────────────────────────────────────────────────────────────── */
function SignatureSlot({
  pointId,
  role,
  label,
  signatures,
  mode,
  onRequestSign,
  activeSignPointId,
  size = 'inline',
}: {
  pointId: SignaturePointId;
  role: 'traveler' | 'vendor';
  label: string;
  signatures?: SignatureMap;
  mode: 'preview' | 'sign';
  onRequestSign?: (pointId: SignaturePointId) => void;
  activeSignPointId?: SignaturePointId | null;
  size?: 'inline' | 'box';
}) {
  const rec = signatures?.[pointId];
  const isVendor = role === 'vendor';
  // vendor_seal 은 손님 입력 없이 회사 직인 자동 표시
  const img = rec?.image ?? (isVendor ? COMPANY.seal : null);
  const isActive = activeSignPointId === pointId;
  const interactive = mode === 'sign' && !isVendor && !!onRequestSign;

  const imgH = size === 'box' ? 'h-16' : 'h-10';
  const sealSize = size === 'box' ? 'h-16 w-16' : 'h-12 w-12';

  let inner: React.ReactNode;
  if (img && isVendor) {
    inner = (
      <span
        role="img"
        aria-label="직인"
        className={`${sealSize} bg-contain bg-center bg-no-repeat opacity-95`}
        style={{ backgroundImage: `url(${img})`, display: 'inline-block' }}
      />
    );
  } else if (img) {
    inner = <img src={img} alt="서명" className={`${imgH} object-contain`} />;
  } else if (interactive) {
    inner = (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#1a2e4a] px-3 py-1.5 text-[13px] font-bold text-white">
        ✍ 여기 서명
      </span>
    );
  } else {
    inner = <span className="text-gray-400">( 인 / 서명 )</span>;
  }

  const wrapCls = `inline-flex flex-col items-center justify-center gap-0.5 align-middle ${
    isActive ? 'rounded-md bg-amber-50 px-1.5 py-0.5 ring-2 ring-amber-400' : ''
  }`;

  const content = (
    <>
      {inner}
      {rec?.signedByName && <span className="text-[10px] text-gray-500">{rec.signedByName}</span>}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        id={`sign-point-${pointId}`}
        onClick={() => onRequestSign?.(pointId)}
        aria-label={`${label} 서명하기`}
        className={`${wrapCls} cursor-pointer`}
      >
        {content}
      </button>
    );
  }
  return (
    <span id={`sign-point-${pointId}`} className={wrapCls}>
      {content}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   크루즈닷 여행계약서 본문 (CRM 미리보기 + 공개 서명페이지 공용)
───────────────────────────────────────────────────────────────────────────── */
export default function ContractBody({
  data,
  agentName,
  agentPhone,
  signatures,
  mode,
  onRequestSign,
  activeSignPointId,
}: ContractBodyProps) {
  // R3: useCurrentAgent 의존 제거 — 담당자 이름/연락처를 prop 으로 통일
  const agent: CurrentAgent = { displayName: agentName, phone: agentPhone ?? null };

  const cd = getDetails(data);
  const hasData = !!(data.buyerName || data.productName);

  const checkedIncludes = data.includedItems ?? [];
  const checkedExcludes = data.excludedItems ?? [];
  const guideRow = data.hasGuide === 'Y' ? '■ 있음  □ 없음' : data.hasGuide === 'N' ? '□ 있음  ■ 없음' : '□ 있음  □ 없음';

  // 상품별 환불 규정 우선, 없으면 크루즈 기본
  const cancellationRows = data.refundPolicy ?? data.refundPolicyLines ?? CRUISE_CANCELLATION_POLICY;

  const contractType = cd.contractType;
  const travelGuarantee = cd.travelGuarantee ?? [];
  const transportTypes = cd.transportTypes ?? [];
  const accommodationTypes = cd.accommodationTypes ?? [];
  const localTransport = cd.localTransport ?? [];

  // 여행보증 표시
  const guaranteeCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      {(['공제', '예치금', '영업보증보험'] as const).map((g) => (
        <span key={g} className="inline-flex items-center gap-1">
          <CheckBox checked={travelGuarantee.includes(g)} />{g}
        </span>
      ))}
    </span>
  );

  // 여행자보험 표시
  const insuranceCell = (() => {
    if (cd.hasInsurance === undefined) {
      return <span className="text-xs">□ 가입  □ 미가입 / 보험회사: ___</span>;
    }
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1"><CheckBox checked={cd.hasInsurance === true} />가입</span>
        <span className="inline-flex items-center gap-1"><CheckBox checked={cd.hasInsurance === false} />미가입</span>
        {cd.hasInsurance && cd.insuranceCompany && (
          <span className="text-gray-600">/ 보험회사: {cd.insuranceCompany}</span>
        )}
      </span>
    );
  })();

  // 행사인원 표시
  const paxCell = (cd.minPax != null || cd.maxPax != null)
    ? `최저 ${cd.minPax ?? '___'} 명 / 최대 ${cd.maxPax ?? '___'} 명`
    : '최저 ___ 명 / 최대 ___ 명';

  // 여행요금 표시
  const fareCell = (() => {
    const pp = cd.pricePerPerson;
    const total = data.amount;
    if (pp != null && total != null) {
      return `1인당 ${formatMoney(pp)} / 총액 ${formatMoney(total)}`;
    }
    if (total != null) {
      return `1인당 ___ 원 / 총액 ${formatMoney(total)}`;
    }
    if (pp != null) {
      return `1인당 ${formatMoney(pp)} / 총액 ___ 원`;
    }
    return '1인당 ___ 원  /  총액 ___ 원';
  })();

  // 교통수단 표시
  const transportCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      {(['항공기', '선박', '기차'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1">
          <CheckBox checked={transportTypes.includes(t)} />{t}
        </span>
      ))}
      {transportTypes.includes('선박') && cd.shipName && (
        <span className="text-gray-600">선박명: {cd.shipName}</span>
      )}
    </span>
  );

  // 숙박 표시
  const accommodationCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center gap-1">
        <CheckBox checked={accommodationTypes.includes('일정표표시')} />일정표 표시
      </span>
      <span className="inline-flex items-center gap-1">
        <CheckBox checked={accommodationTypes.includes('관광호텔')} />관광호텔
        {accommodationTypes.includes('관광호텔') && cd.hotelGrade && ` (${cd.hotelGrade} 등급)`}
      </span>
      <span className="inline-flex items-center gap-1">
        <CheckBox checked={accommodationTypes.includes('기타')} />기타
      </span>
    </span>
  );

  // 식사 표시
  const mealCell = (() => {
    if (cd.mealDisplay === '개별') {
      return (
        <span className="text-xs">
          □ 일정표 표시 ■ 개별 입력 /
          조식 {cd.breakfast ?? '_'}회, 중식 {cd.lunch ?? '_'}회, 석식 {cd.dinner ?? '_'}회
        </span>
      );
    }
    if (cd.mealDisplay === '일정표표시') {
      return <span className="text-xs">■ 일정표 표시 / 조식 _회, 중식 _회, 석식 _회</span>;
    }
    return <span className="text-xs">□ 일정표 표시  /  조식 _회, 중식 _회, 석식 _회</span>;
  })();

  // 현지 안내원 표시
  const localGuideCell = (() => {
    if (cd.localGuide === '있음') return '■ 있음  □ 없음  *여행일정표 참조';
    if (cd.localGuide === '없음') return '□ 있음  ■ 없음  *여행일정표 참조';
    return '□ 있음  □ 없음  *여행일정표 참조';
  })();

  // 현지 교통 표시
  const localTransportCell = (
    <span className="flex flex-wrap gap-2 text-xs">
      {(['버스', '승용차', '기타', '없음'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1">
          <CheckBox checked={localTransport.includes(t)} />{t}
        </span>
      ))}
    </span>
  );

  // 현지 여행사 표시
  const localAgencyCell = (() => {
    if (cd.localAgency === '있음') return '■ 있음  □ 없음  *여행일정표 참조';
    if (cd.localAgency === '없음') return '□ 있음  ■ 없음  *여행일정표 참조';
    return '□ 있음  □ 없음  *여행일정표 참조';
  })();

  return (
    <div className="rounded-xl border border-gray-200 bg-white text-[12px] leading-relaxed text-gray-800 shadow-sm">
      <div className="p-5 space-y-4">
        {/* 헤더 */}
        <DocumentLetterhead title="크루즈닷 여행계약서" accentClass="border-orange-100" />

        {/* 계약 유형 */}
        <div className="flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-2 text-xs">
          <span className="font-medium text-gray-600">계약 구분:</span>
          <span className="flex items-center gap-1.5">
            <CheckBox checked={contractType === '기획여행'} />
            기획여행
          </span>
          <span className="flex items-center gap-1.5">
            <CheckBox checked={contractType === '희망여행'} />
            희망여행
          </span>
        </div>

        {/* 계약 기본 정보 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">계약 정보</p>
          <table className="w-full border-collapse text-xs">
            <tbody>
              {([
                ['상품명', data.productName || <span className="italic text-gray-300">여행일정표 참조</span>],
                ['여행기간', data.departureDate ? `${data.departureDate} ~ (출발일 기준)` : <span className="italic text-gray-300">여행일정표 참조</span>],
                ['여행보증', guaranteeCell],
                ['여행자보험', insuranceCell],
                ['행사인원', paxCell],
                ['여행요금', fareCell],
                ['교통수단', transportCell],
                ['숙박', accommodationCell],
                ['식사', mealCell],
                ['여행 인솔자', guideRow],
                ['현지 안내원', localGuideCell],
                ['현지 교통', localTransportCell],
                ['현지 여행사', localAgencyCell],
              ] as [string, React.ReactNode][]).map(([label, value], i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="w-28 bg-gray-50 px-3 py-2 font-medium text-gray-600 align-top">{label}</td>
                  <td className="px-3 py-2 text-gray-700">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 탑승자 명단 (동행인 있을 때만) */}
        {data.companions && data.companions.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">탑승자 명단</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-orange-50">
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">이름</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">관계</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">생년월일</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">연락처</th>
                  <th className="border border-orange-100 px-3 py-1.5 text-left font-semibold text-orange-700">PNR</th>
                </tr>
              </thead>
              <tbody>
                {data.companions.map((c, i) => (
                  <tr key={c.id ?? i} className="border-b border-gray-100">
                    <td className="border border-gray-100 px-3 py-1.5 font-medium text-gray-800">{c.name}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-600">{c.relation}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-600">{c.birthDate || '-'}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-600">{c.phone || '-'}</td>
                    <td className="border border-gray-100 px-3 py-1.5 text-gray-500">{c.pnr || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 여행요금 포함/불포함 내역 */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">여행요금 포함/불포함 내역</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="mb-1.5 text-[11px] font-semibold text-emerald-700">▸ 포함 항목</p>
              <div className="space-y-1">
                {ALL_INCLUDE_ITEMS.map((item) => (
                  <span key={item} className="flex items-center gap-1.5 text-[11px]">
                    <CheckBox checked={checkedIncludes.includes(item)} />
                    <span className={checkedIncludes.length > 0 && !checkedIncludes.includes(item) ? 'text-gray-300 line-through' : ''}>{item}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="mb-1.5 text-[11px] font-semibold text-red-700">▸ 불포함 항목</p>
              <div className="space-y-1">
                {ALL_EXCLUDE_ITEMS.map((item) => (
                  <span key={item} className="flex items-center gap-1.5 text-[11px]">
                    <CheckBox checked={checkedExcludes.includes(item)} />
                    <span className={checkedExcludes.length > 0 && !checkedExcludes.includes(item) ? 'text-gray-300 line-through' : ''}>{item}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 약관 교부 및 서명 */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-orange-700">약관 교부 및 서명</p>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600 leading-5">
            여행자( <span className="font-semibold text-gray-800">{data.buyerName || '      '}</span> )은 담당자( <span className="font-semibold text-gray-800">{agentName || '      '}</span> )으로부터 크루즈여행계약서, 국외여행표준약관,
            크루즈여행특별약관 및 여행일정표를 교부받았으며, 주요사항에 대한 충분한 설명을 들었습니다.
            <span className="mt-2 flex items-center justify-end gap-1.5">
              여행자:
              <SignatureSlot
                pointId="terms_handover" role="traveler" label="여행약관 교부 확인"
                signatures={signatures} mode={mode} onRequestSign={onRequestSign} activeSignPointId={activeSignPointId}
              />
            </span>
          </div>
          <div className="mt-3 flex justify-between gap-4">
            <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-[11px]">
              <p className="text-gray-500">여행자</p>
              <p className="mt-3 font-medium text-gray-700">{data.buyerName || '___________'}</p>
              <div className="mt-2 flex justify-center">
                <SignatureSlot
                  pointId="main" role="traveler" label="계약 전체 대표 서명" size="box"
                  signatures={signatures} mode={mode} onRequestSign={onRequestSign} activeSignPointId={activeSignPointId}
                />
              </div>
            </div>
            <div className="flex-1 rounded-lg border border-orange-100 bg-orange-50 px-3 py-4 text-center text-[11px]">
              <p className="text-gray-500">여행업자</p>
              <p className="mt-1 font-bold text-orange-700">{COMPANY.name}</p>
              <p className="text-gray-500">대표 {COMPANY_INFO.ceo}</p>
              <div className="mt-1 flex justify-center">
                <SignatureSlot
                  pointId="vendor_seal" role="vendor" label="여행업자" size="box"
                  signatures={signatures} mode={mode} activeSignPointId={activeSignPointId}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 특약사항 (있을 때만) */}
        {data.specialTerms && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-yellow-700">특약사항</p>
            <p className="whitespace-pre-wrap text-[11px] text-gray-700">{data.specialTerms}</p>
          </div>
        )}

        {/* ── 크루즈 여행 특별약관 ────────────────────────────────── */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-red-700">크루즈 여행 특별약관</p>
          <p className="mb-1 text-[11px] font-semibold text-red-600">제1조 (목적)</p>
          <p className="mb-2 text-[10px] text-gray-600">본 특약은 국외여행표준약관을 보완하고 크루즈 여행 고유의 여행조건, 취소규정, 유의사항 등을 여행자에게 사전 고지함에 그 목적이 있습니다.</p>

          {/* 환불고지 — 상품별 or 기본 크루즈 취소료 */}
          <p className="mb-1 text-[11px] font-semibold text-red-600">제2조 (크루즈 취소료 규정) — 환불 고지</p>
          <div className="mb-1 rounded-lg bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">
            ⚠ 본 상품은 항공사·선사 비용 사전 지급으로 인해 <strong>일반여행 취소료 규정이 아닌 크루즈 특별 취소료를 우선 적용</strong>합니다.
          </div>
          <table className="mb-2 w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-red-200">
                <th className="border border-red-200 px-2 py-1 text-left font-semibold text-red-800">해지 시기</th>
                <th className="border border-red-200 px-2 py-1 text-right font-semibold text-red-800">취소료</th>
              </tr>
            </thead>
            <tbody>
              {cancellationRows.map((p) => (
                <tr key={p.label} className="border-b border-red-100">
                  <td className="border border-red-100 px-2 py-1 text-gray-700">{p.label}</td>
                  <td className="border border-red-100 px-2 py-1 text-right font-bold text-red-700">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-0.5 text-[10px] text-gray-600">
            <p>1) 총 경비는 할인가격이 아닌 <strong>정상가격</strong> 기준으로 계산합니다.</p>
            <p>2) 크루즈 예약 후 발생되는 모든 예약 변경은 비용이 부과됩니다.</p>
            <p>3) 연휴·연말·휴가기간에는 특별 취소료 규정이 적용됩니다. (예약 시 별도 고지)</p>
            <p>4) 질병·부상·사망·천재지변 등으로 인한 취소에도 상기 규정이 적용됩니다.</p>
            <p>5) 기상악화 및 선사 사정으로 기항지 투어 진행 불가 시 선사 책정 금액 외 추가 보상은 없습니다.</p>
          </div>

          <p className="mb-0.5 mt-2 text-[11px] font-semibold text-red-600">제3조 (유의사항)</p>
          <div className="space-y-0.5 text-[10px] text-gray-600">
            <p>1) 여권 유효기간은 여행 출발일 기준 <strong>6개월 이상</strong> 남아있어야 합니다.</p>
            <p>2) 예약 후 3일 이내 계약금 결제 必 — 미결제 시 예약 자동취소.</p>
            <p>3) 잔금은 출발 전 지정일까지 완납하여야 하며, 미납 시 자동취소됩니다. (위약금 발생)</p>
            <p>4) 18세 이하 어린이는 보호자 동반 필수 / 6개월 미만 유아는 탑승 제한될 수 있음.</p>
            <p>5) 임신 6개월 이상 임산부는 탑승 불가 / 미만은 의사 소견서(영문) + 동의서 제출 필요.</p>
            <p>6) 여행자 본인 과실로 인한 안전사고는 여행자 본인이 책임집니다.</p>
            <p>7) 선내 면세점·현지 관광 중 구매한 쇼핑 물품은 단순 변심·훼손 시 교환·환불 불가.</p>
          </div>

          <div className="mt-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-[10px]">
            <strong>약관 교부 확인:</strong> 여행자( <span className="font-semibold text-gray-800">{data.buyerName || '      '}</span> )은 담당자( <span className="font-semibold text-gray-800">{agentName || '      '}</span> )으로부터 크루즈여행특별약관을 교부받았으며, 취소료 규정·유의사항 및 본 약관이 국외여행표준약관에 우선함을 충분히 설명 들었습니다.
            <span className="mt-1.5 flex items-center justify-end gap-1.5 text-gray-500">
              여행자:
              <SignatureSlot
                pointId="special_terms_ack" role="traveler" label="크루즈 특별약관 교부 확인"
                signatures={signatures} mode={mode} onRequestSign={onRequestSign} activeSignPointId={activeSignPointId}
              />
            </span>
          </div>
        </div>

        {/* ── 국외여행표준약관 ─────────────────────────────────────── */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-700">국외여행표준약관</p>
          <p className="mb-1 text-[10px] text-gray-500">{COMPANY.name}은 공정거래위원회 표준약관을 준수합니다.</p>
          <div className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[10px] text-gray-600">
            <p><span className="font-semibold text-gray-700">제1조 (목적)</span> 이 약관은 {COMPANY.name}(이하 &apos;당사&apos;)와 여행자가 체결한 국외여행계약의 세부 이행 및 준수사항을 정함을 목적으로 합니다.</p>
            <p><span className="font-semibold text-gray-700">제2조 (당사와 여행자 의무)</span> ① 당사는 여행자에게 안전하고 만족스러운 여행서비스를 제공하기 위하여 맡은 바 임무를 충실히 수행합니다. ② 여행자는 안전하고 즐거운 여행을 위하여 여행자 간 화합 도모 및 당사의 여행 질서 유지에 적극 협조합니다.</p>
            <p><span className="font-semibold text-gray-700">제3조 (용어의 정의)</span> ① 기획여행: 당사가 미리 여행일정·요금을 정하여 여행자를 모집하여 실시하는 여행. ② 희망여행: 여행자가 희망하는 조건에 따라 당사가 계획을 수립하여 실시하는 여행.</p>
            <p><span className="font-semibold text-gray-700">제4조 (계약 구성)</span> 여행계약은 여행계약서·여행약관·여행일정표(또는 여행설명서)를 계약내용으로 합니다.</p>
            <p><span className="font-semibold text-gray-700">제5조 (특약)</span> 당사와 여행자는 관계법규에 위반되지 않는 범위에서 서면으로 특약을 맺을 수 있습니다. 크루즈 특별약관은 본 약관에 우선하여 적용합니다.</p>
            <p><span className="font-semibold text-gray-700">제6조 (계약서 및 약관 교부)</span> 당사는 여행자와 여행계약 체결 시 계약서·여행약관·여행일정표를 각 1부씩 여행자에게 교부합니다.</p>
            <p><span className="font-semibold text-gray-700">제8조 (당사의 책임)</span> 당사는 여행 출발 시부터 도착 시까지 당사 또는 그 사용인이 여행자에게 고의 또는 과실로 손해를 가한 경우 배상책임을 집니다.</p>
            <p><span className="font-semibold text-gray-700">제9조 (최저행사인원 미충족)</span> 당사는 최저행사인원 미충족으로 계약 해제 시 여행출발 7일 전까지 여행자에게 통지합니다. 기일 내 미통지 해제 시 출발 1일 전까지 통지: 여행요금의 30%, 당일 통지: 50% 배상합니다.</p>
            <p><span className="font-semibold text-gray-700">제11조 (여행요금)</span> 여행요금에는 운임·숙박·식사·안내자경비·각종 세금·관광기금·공항항만세·관광지 입장료 등이 포함됩니다. 계약금(여행요금의 10% 이하)은 계약 체결 시 지급합니다.</p>
            <p><span className="font-semibold text-gray-700">제12조 (여행요금 변경)</span> 이용 운송·숙박기관 요금이 계약 시보다 5% 이상 증감하거나 환율이 2% 이상 증감하면 요금 증감을 청구할 수 있습니다. 요금 증액 시 출발 15일 전에 통지합니다.</p>
            <p><span className="font-semibold text-gray-700">제13조 (여행조건 변경 및 정산)</span> 여행조건 변경 및 요금 증감으로 생긴 차액은 여행 출발 전 변경분은 출발 이전에, 여행 중 변경분은 여행 종료 후 10일 이내에 정산·환급합니다.</p>
            <p><span className="font-semibold text-gray-700">제14조 (손해배상)</span> ① 당사는 현지 여행사 등의 고의·과실로 여행자에게 손해를 가한 경우 배상합니다. ② 당사 귀책으로 사증·재입국 허가 등 미취득 시 수수료 전액 및 그 100% 상당액을 배상합니다. ③ 교통기관 연발착으로 인한 손해는 당사 고의·과실 없음 입증 시 제외됩니다.</p>
            <p><span className="font-semibold text-gray-700">제15조 (여행 출발 전 계약 해제)</span> 당사 또는 여행자는 출발 전 계약 해제 가능. 발생 손해는 소비자분쟁해결기준(공정거래위원회 고시)에 따라 배상합니다. 천재지변·여행자 사망·질병 등 불가항력 사유는 위약금 없이 해제 가능합니다.</p>
            <p><span className="font-semibold text-gray-700">제16조 (여행 출발 후 계약 해지)</span> 부득이한 사유로 계약 해지 시, 당사는 여행자 귀국에 필요한 사항을 협조하며, 당사 귀책이 아닌 비용은 여행자가 부담합니다.</p>
            <p><span className="font-semibold text-gray-700">제17조 (여행의 시작과 종료)</span> 여행의 시작은 탑승수속(선박의 경우 승선수속) 완료 시점, 종료는 여행자가 입국장 보세구역을 벗어나는 시점으로 합니다.</p>
            <p><span className="font-semibold text-gray-700">제18조 (설명의무)</span> 당사는 계약서에 정해진 중요한 내용 및 변경사항을 여행자가 이해할 수 있도록 설명합니다.</p>
            <p><span className="font-semibold text-gray-700">제19조 (보험 가입)</span> 당사는 여행자에게 손해가 발생한 경우 보험금을 지급하기 위한 보험 또는 공제에 가입하거나 영업보증금을 예치합니다.</p>
            <p><span className="font-semibold text-gray-700">제20조 (기타)</span> 이 계약에 명시되지 않은 사항은 당사 또는 여행자가 합의하여 결정하되, 미합의 시 관계법령 및 일반관례에 따릅니다.</p>
            <p className="mt-1 text-gray-400">※ 본 계약 관련 분쟁 시 관광불편신고처리위원회(☎1588-8692) 또는 소재지 도청 문화관광과에 중재 신청 가능합니다.</p>
          </div>
        </div>

        {/* ── 일반 취소료 규정 (참고용) ──────────────────────────── */}
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-orange-700">일반여행 취소·환불 규정 (참고)</p>
          <p className="mb-1 text-[10px] text-red-500">※ 크루즈 여행은 위 특별약관 제2조 취소료 규정이 우선 적용됩니다.</p>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">취소 시점</th>
                <th className="border border-gray-200 px-2 py-1 text-right font-semibold text-gray-600">위약금</th>
              </tr>
            </thead>
            <tbody>
              {CANCELLATION_POLICY.map((p) => (
                <tr key={p.label} className="border-b border-gray-100">
                  <td className="border border-gray-200 px-2 py-1 text-gray-500">{p.label}</td>
                  <td className="border border-gray-200 px-2 py-1 text-right text-gray-600">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 개인정보처리 동의 ─────────────────────────────────── */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">개인정보처리 동의사항</p>

          <p className="mb-0.5 text-[10px] font-semibold text-blue-600">1. 개인정보 수집·이용 동의 (필수)</p>
          <div className="mb-2 space-y-0.5 text-[10px] text-gray-600">
            <p><strong>수집·이용 목적:</strong> 크루즈여행계약 체결·심사·관리, 서비스 제공, 고객관리, 대금결제, 민원처리</p>
            <p><strong>수집 항목:</strong> 성명, 생년월일, 주소(자택/직장), 연락처(휴대폰/자택/직장), 이메일</p>
            <p><strong>보유 기간:</strong> 목적 달성 시까지 / 계약·청약철회 기록 5년 / 대금결제 기록 5년 / 분쟁처리 기록 3년</p>
            <span className="flex items-center justify-end gap-1.5 text-gray-500">
              계약자:
              <SignatureSlot
                pointId="privacy_collect" role="traveler" label="개인정보 수집·이용 동의(필수)"
                signatures={signatures} mode={mode} onRequestSign={onRequestSign} activeSignPointId={activeSignPointId}
              />
            </span>
          </div>

          <p className="mb-0.5 text-[10px] font-semibold text-blue-600">2. 제3자 제공 동의 (필수)</p>
          <div className="mb-2 space-y-0.5 text-[10px] text-gray-600">
            <p><strong>제공 대상:</strong> 각 항공사·선사·랜드사, {COMPANY.name}</p>
            <p><strong>제공 항목:</strong> 성명, 생년월일, 주소, 연락처</p>
            <p><strong>제공 목적:</strong> 크루즈 여행 서비스 제공</p>
            <p><strong>보유 기간:</strong> 크루즈 여행 서비스 종료 시 삭제</p>
            <span className="flex items-center justify-end gap-1.5 text-gray-500">
              계약자:
              <SignatureSlot
                pointId="privacy_3rd" role="traveler" label="개인정보 제3자 제공 동의(필수)"
                signatures={signatures} mode={mode} onRequestSign={onRequestSign} activeSignPointId={activeSignPointId}
              />
            </span>
          </div>

          <p className="mb-0.5 text-[10px] font-semibold text-blue-600">3. 마케팅 활용 동의 (선택)</p>
          <div className="space-y-0.5 text-[10px] text-gray-600">
            <p><strong>활용 목적:</strong> {COMPANY.name}이 제공하는 서비스 홍보 및 소개</p>
            <p><strong>방법:</strong> 우편·전화·이메일·방문·문자</p>
            <p><strong>보유 기간:</strong> 계약 종료 후 5년</p>
            <p>※ 상기 동의를 거부할 수 있으나, 미동의 시 정상 서비스 제공이 어려울 수 있습니다.</p>
            <span className="flex items-center justify-end gap-1.5 text-gray-500">
              계약자:
              <SignatureSlot
                pointId="privacy_mkt" role="traveler" label="마케팅 활용 동의(선택)"
                signatures={signatures} mode={mode} onRequestSign={onRequestSign} activeSignPointId={activeSignPointId}
              />
            </span>
          </div>
        </div>

        {/* ── 여행업자 정보 ─────────────────────────────────────── */}
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 text-[11px]">
          <p className="mb-1 font-bold text-orange-700">여행업자 정보</p>
          <div className="grid grid-cols-2 gap-1 text-gray-600">
            <span>상호: {COMPANY.name}</span>
            <span>대표: {COMPANY_INFO.ceo}</span>
            <span>전화: {COMPANY_INFO.hqPhone}</span>
            {/* 담당자 전화: 담당자 본인 번호, 없으면(관리자 등) 본사 대표번호 폴백 */}
            <span>
              담당자: {agent.phone && agent.phone.trim()
                ? `${agent.displayName ?? ''} ${agent.phone}`.trim()
                : `본사 ${COMPANY.hqPhone}`}
            </span>
            <span className="col-span-2">계좌: {COMPANY_INFO.bankName} {COMPANY_INFO.bankAccount} ({COMPANY_INFO.bankHolder})</span>
          </div>
        </div>

        {!hasData && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
            목록에서 행을 클릭하거나 &apos;계약서 보내기&apos;에서 구매자를 선택하면 정보가 자동 반영됩니다.
          </div>
        )}

        {/* 발행일 / 직인 */}
        <div className="border-t border-gray-100 pt-3">
          <p className="text-center text-[11px] text-gray-500">{todayKo()} 발행</p>
        </div>
        <DocumentSeal agent={agent} />
      </div>
    </div>
  );
}
