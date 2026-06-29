/**
 * 크루즈닷 구매계약서 PDF 생성 (전체본)
 * - GmarketSans 한글 폰트 (깨짐 방지, public/fonts 등록)
 * - ContractTab FullContractPreview 와 동일한 섹션 구성:
 *   계약구분 / 계약정보표 / 탑승자명단 / 포함·불포함 / 약관교부·서명 /
 *   특약사항 / 크루즈 특별약관 / 국외여행 표준약관 / 일반 취소규정 /
 *   개인정보 3동의(수집·제3자·마케팅) / 여행업자정보 / 발행일·직인
 * - 7개 서명점(privacy_collect·privacy_3rd·privacy_mkt·terms_handover·
 *   special_terms_ack·main·vendor_seal) 이미지를 각 위치에 출력.
 *
 * ── export ──
 *   renderPurchaseContractPdf(generatedData, docId?)  ← 신규(권장). generatedData(JSON) 그대로 입력.
 *   generatePurchaseContractPdf(params)               ← 기존 호환(이메일 첨부 호출부). 둘 다 동일 렌더러 사용.
 */
import path from 'path';
import {
  Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer';
import React from 'react';
import { COMPANY_INFO, CANCELLATION_POLICY, CRUISE_CANCELLATION_POLICY } from '@/lib/company-info';
import { CERT_SEAL_DATA_URI } from '@/app/(dashboard)/documents-approval/_components/cert-assets';

// ─── 폰트 등록 ───────────────────────────────────────────────────────────────

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

Font.register({
  family: 'GmarketSans',
  fonts: [
    { src: path.join(FONT_DIR, 'GmarketSansTTFLight.ttf'),  fontWeight: 300 },
    { src: path.join(FONT_DIR, 'GmarketSansTTFMedium.ttf'), fontWeight: 400 },
    { src: path.join(FONT_DIR, 'GmarketSansTTFBold.ttf'),   fontWeight: 700 },
  ],
});
// 긴 약관 텍스트 줄바꿈 안정화 (한글 단어 단위 줄바꿈)
Font.registerHyphenationCallback((w) => [w]);

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const ORANGE = '#c2410c';
const NAVY   = '#1a3a6b';
const GREEN  = '#2f9e44';

const S = StyleSheet.create({
  page: {
    fontFamily: 'GmarketSans', fontSize: 9, color: '#1a1a1a',
    paddingTop: 58, paddingBottom: 46, paddingHorizontal: 40, lineHeight: 1.6,
  },

  // 고정 머리글/꼬리글
  runHeader: {
    position: 'absolute', top: 22, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 4,
  },
  runHeaderText: { fontSize: 8, color: '#999', fontWeight: 400 },
  runFooter: {
    position: 'absolute', bottom: 22, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: '#eee', paddingTop: 4,
  },
  footerText: { fontSize: 7.5, color: '#aaa', fontWeight: 300 },
  footerPage: { fontSize: 7.5, color: '#aaa', fontWeight: 400 },

  // 표지 헤더
  title:    { fontSize: 18, fontWeight: 700, color: '#1a1a1a', textAlign: 'center', marginBottom: 3 },
  subtitle: { fontSize: 9, fontWeight: 300, color: '#666', textAlign: 'center' },
  headerRule: { borderBottomWidth: 2, borderColor: '#fed7aa', marginTop: 8, marginBottom: 4 },

  // 섹션 제목
  sectionTitle: { fontSize: 10.5, fontWeight: 700, color: ORANGE, marginBottom: 6, marginTop: 14 },

  // 계약 구분 바
  kindBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f7fa',
    borderRadius: 4, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 6,
  },
  kindLabel: { fontSize: 9, fontWeight: 700, color: '#555', marginRight: 12 },

  // 정보 표 (label/value)
  infoTable: { borderTopWidth: 1, borderColor: '#eee' },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', minHeight: 22 },
  infoLabel: {
    width: 92, backgroundColor: '#f7f8fa', paddingVertical: 5, paddingHorizontal: 8,
    fontSize: 8.5, fontWeight: 700, color: '#555',
  },
  infoValue: { flex: 1, paddingVertical: 5, paddingHorizontal: 8, justifyContent: 'center' },
  infoValueText: { fontSize: 8.5, color: '#222' },

  // 체크박스 그룹
  checkGroup: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  checkItem:  { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 2 },
  boxChecked: { width: 8, height: 8, backgroundColor: GREEN, borderRadius: 1, marginRight: 3 },
  boxEmpty:   { width: 8, height: 8, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 1, marginRight: 3 },
  checkLabel: { fontSize: 8.5, color: '#222' },
  inlineNote: { fontSize: 8, color: '#666', marginLeft: 4 },

  // 동행자 표
  compHead: { flexDirection: 'row', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  compHeadCell: { fontSize: 8, fontWeight: 700, color: ORANGE, paddingVertical: 4, paddingHorizontal: 6 },
  compRow: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  compCell: { fontSize: 8, color: '#333', paddingVertical: 4, paddingHorizontal: 6 },

  // 포함/불포함 2열
  twoCol: { flexDirection: 'row' },
  incCol: { flex: 1, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', borderRadius: 4, padding: 8, marginRight: 6 },
  excCol: { flex: 1, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', borderRadius: 4, padding: 8 },
  incTitle: { fontSize: 8.5, fontWeight: 700, color: '#15803d', marginBottom: 4 },
  excTitle: { fontSize: 8.5, fontWeight: 700, color: '#b91c1c', marginBottom: 4 },
  itemStruck: { fontSize: 8.5, color: '#bbb', textDecoration: 'line-through' },

  // 박스 (공통)
  noteBox:    { backgroundColor: '#f7f8fa', borderRadius: 4, padding: 10, marginBottom: 4 },
  specialBox: { borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb', borderRadius: 4, padding: 10 },
  redBox:     { borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', borderRadius: 4, padding: 10 },
  blueBox:    { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 4, padding: 10 },
  vendorBox:  { borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed', borderRadius: 4, padding: 10 },

  // 약관 조항
  clauseSubTitle: { fontSize: 9, fontWeight: 700, color: '#b91c1c', marginTop: 5, marginBottom: 2 },
  clause:      { fontSize: 8, color: '#444', marginBottom: 2.5 },
  clauseTitle: { fontWeight: 700, color: '#333' },
  warnLine:    { fontSize: 8, fontWeight: 700, color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: 3, padding: 5, marginBottom: 4 },

  // 취소료 표 (label/value 2열)
  feeHead: { flexDirection: 'row', backgroundColor: '#fecaca' },
  feeHeadCellL: { flex: 1, fontSize: 8, fontWeight: 700, color: '#991b1b', paddingVertical: 3, paddingHorizontal: 6 },
  feeHeadCellR: { width: 110, fontSize: 8, fontWeight: 700, color: '#991b1b', paddingVertical: 3, paddingHorizontal: 6, textAlign: 'right' },
  feeRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#fde0e0' },
  feeCellL: { flex: 1, fontSize: 8, color: '#444', paddingVertical: 3, paddingHorizontal: 6 },
  feeCellR: { width: 110, fontSize: 8, fontWeight: 700, color: '#b91c1c', paddingVertical: 3, paddingHorizontal: 6, textAlign: 'right' },

  // 일반 취소료 표 (회색)
  gHead: { flexDirection: 'row', backgroundColor: '#f1f5f9' },
  gHeadCellL: { flex: 1, fontSize: 8, fontWeight: 700, color: '#475569', paddingVertical: 3, paddingHorizontal: 6 },
  gHeadCellR: { width: 110, fontSize: 8, fontWeight: 700, color: '#475569', paddingVertical: 3, paddingHorizontal: 6, textAlign: 'right' },
  gRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  gCellL: { flex: 1, fontSize: 8, color: '#555', paddingVertical: 3, paddingHorizontal: 6 },
  gCellR: { width: 110, fontSize: 8, color: '#555', paddingVertical: 3, paddingHorizontal: 6, textAlign: 'right' },

  // 개인정보 동의 소제목/본문
  privTitle: { fontSize: 8.5, fontWeight: 700, color: '#1d4ed8', marginTop: 6, marginBottom: 2 },
  privText:  { fontSize: 8, color: '#444', marginBottom: 1.5 },
  privBold:  { fontWeight: 700, color: '#333' },

  // 서명 영역
  ackText: { fontSize: 8.5, color: '#444', lineHeight: 1.7 },
  ackSignRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', marginTop: 6 },
  ackSignLabel: { fontSize: 8, color: '#666', marginRight: 8, alignSelf: 'center' },

  sigPairRow: { flexDirection: 'row', marginTop: 8 },
  sigPartyBox: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
    borderRadius: 4, padding: 10, marginRight: 8, alignItems: 'center',
  },
  sigPartyBoxVendor: {
    flex: 1, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed',
    borderRadius: 4, padding: 10, alignItems: 'center',
  },
  partyRole: { fontSize: 8.5, color: '#666', marginBottom: 2 },
  partyCompany: { fontSize: 9.5, fontWeight: 700, color: ORANGE },
  partyCeo: { fontSize: 8.5, color: '#666' },

  sig: { alignItems: 'center', marginTop: 4 },
  sigImg:    { width: 110, height: 44, objectFit: 'contain' },
  sigImgBig: { width: 150, height: 60, objectFit: 'contain' },
  sigLine:    { width: 100, height: 28, borderBottomWidth: 1, borderColor: '#cbd5e1' },
  sigLineBig: { width: 140, height: 40, borderBottomWidth: 1, borderColor: '#cbd5e1' },
  sigName:    { fontSize: 9, fontWeight: 700, color: NAVY, marginTop: 3 },
  sigCaption: { fontSize: 7.5, color: '#888', marginTop: 1 },

  // 여행업자 정보
  vendorGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  vendorItem: { width: '50%', fontSize: 8, color: '#555', marginBottom: 2 },
  vendorItemFull: { width: '100%', fontSize: 8, color: '#555', marginBottom: 2 },

  // 발행일/직인
  issueWrap: { borderTopWidth: 1, borderColor: '#eee', marginTop: 14, paddingTop: 10, alignItems: 'center' },
  issueDate: { fontSize: 9.5, color: '#444', marginBottom: 6 },
  sealImg: { width: 70, height: 70, objectFit: 'contain' },

  emptyHint: {
    borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'dashed', backgroundColor: '#f9fafb',
    borderRadius: 4, padding: 14, textAlign: 'center', fontSize: 8.5, color: '#9ca3af', marginTop: 8,
  },
});

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface Companion {
  name:      string;
  birthDate: string;
  relation:  string;
  phone:     string;
  pnr?:      string | null;
}

/** 기존 이메일 첨부 호출부(sign/route.ts)가 쓰는 입력 형태 — 호환 유지 */
export interface PurchaseContractPdfParams {
  docId:              string;
  buyerName:          string;
  buyerTel:           string;
  productName:        string;
  amount:             number;
  departureDate:      string | null;
  nights:             number | null;
  paymentMethod:      string;
  paidAt:             string | null;
  cancellationPolicy: string[];
  specialTerms:       string | null;
  companions:         Companion[];
  signatureImage:     string;   // 대표(main) 서명 base64 data URL
  signedAt:           string;   // 한국어 날짜 문자열(이미 포맷됨)
  signedByName:       string;
  companyName:        string;
}

interface SigData { image: string | null; name: string | null; signedAt: string | null; agreed: boolean | null }

interface ContractModel {
  docId:           string | null;
  companyName:     string;
  buyerName:       string | null;
  buyerTel:        string | null;
  productName:     string | null;
  amount:          number | null;
  departureDate:   string | null;
  nights:          number | null;
  contractType:    string | null;
  travelGuarantee: string[];
  hasInsurance:    boolean | null;
  insuranceCompany:string | null;
  minPax:          number | null;
  maxPax:          number | null;
  pricePerPerson:  number | null;
  transportTypes:  string[];
  shipName:        string | null;
  accommodationTypes: string[];
  hotelGrade:      string | null;
  mealDisplay:     string | null;
  breakfast:       number | null;
  lunch:           number | null;
  dinner:          number | null;
  hasGuide:        string | null;
  localGuide:      string | null;
  localTransport:  string[];
  localAgency:     string | null;
  includedItems:   string[];
  excludedItems:   string[];
  companions:      Companion[];
  refundPolicyRows:{ label: string; value: string }[];
  specialTerms:    string | null;
  marketingConsent:boolean | null;
  signatures:      Record<string, SigData>;
  agentName:       string | null;
  agentPhone:      string | null;
  signedAtText:    string | null;
  issuedDateText:  string;
}

// ─── 정적 약관 텍스트 (FullContractPreview 미러) ──────────────────────────────

const CO = COMPANY_INFO.name;

const CRUISE_NOTES_2: string[] = [
  '1) 총 경비는 할인가격이 아닌 정상가격 기준으로 계산합니다.',
  '2) 크루즈 예약 후 발생되는 모든 예약 변경은 비용이 부과됩니다.',
  '3) 연휴·연말·휴가기간에는 특별 취소료 규정이 적용됩니다. (예약 시 별도 고지)',
  '4) 질병·부상·사망·천재지변 등으로 인한 취소에도 상기 규정이 적용됩니다.',
  '5) 기상악화 및 선사 사정으로 기항지 투어 진행 불가 시 선사 책정 금액 외 추가 보상은 없습니다.',
];

const CRUISE_NOTES_3: string[] = [
  '1) 여권 유효기간은 여행 출발일 기준 6개월 이상 남아있어야 합니다.',
  '2) 예약 후 3일 이내 계약금 결제 必 — 미결제 시 예약 자동취소.',
  '3) 잔금은 출발 전 지정일까지 완납하여야 하며, 미납 시 자동취소됩니다. (위약금 발생)',
  '4) 18세 이하 어린이는 보호자 동반 필수 / 6개월 미만 유아는 탑승 제한될 수 있음.',
  '5) 임신 6개월 이상 임산부는 탑승 불가 / 미만은 의사 소견서(영문) + 동의서 제출 필요.',
  '6) 여행자 본인 과실로 인한 안전사고는 여행자 본인이 책임집니다.',
  '7) 선내 면세점·현지 관광 중 구매한 쇼핑 물품은 단순 변심·훼손 시 교환·환불 불가.',
];

const STANDARD_TERMS: [string, string][] = [
  ['제1조 (목적)', `이 약관은 ${CO}(이하 '당사')와 여행자가 체결한 국외여행계약의 세부 이행 및 준수사항을 정함을 목적으로 합니다.`],
  ['제2조 (당사와 여행자 의무)', '① 당사는 여행자에게 안전하고 만족스러운 여행서비스를 제공하기 위하여 맡은 바 임무를 충실히 수행합니다. ② 여행자는 안전하고 즐거운 여행을 위하여 여행자 간 화합 도모 및 당사의 여행 질서 유지에 적극 협조합니다.'],
  ['제3조 (용어의 정의)', '① 기획여행: 당사가 미리 여행일정·요금을 정하여 여행자를 모집하여 실시하는 여행. ② 희망여행: 여행자가 희망하는 조건에 따라 당사가 계획을 수립하여 실시하는 여행.'],
  ['제4조 (계약 구성)', '여행계약은 여행계약서·여행약관·여행일정표(또는 여행설명서)를 계약내용으로 합니다.'],
  ['제5조 (특약)', '당사와 여행자는 관계법규에 위반되지 않는 범위에서 서면으로 특약을 맺을 수 있습니다. 크루즈 특별약관은 본 약관에 우선하여 적용합니다.'],
  ['제6조 (계약서 및 약관 교부)', '당사는 여행자와 여행계약 체결 시 계약서·여행약관·여행일정표를 각 1부씩 여행자에게 교부합니다.'],
  ['제8조 (당사의 책임)', '당사는 여행 출발 시부터 도착 시까지 당사 또는 그 사용인이 여행자에게 고의 또는 과실로 손해를 가한 경우 배상책임을 집니다.'],
  ['제9조 (최저행사인원 미충족)', '당사는 최저행사인원 미충족으로 계약 해제 시 여행출발 7일 전까지 여행자에게 통지합니다. 기일 내 미통지 해제 시 출발 1일 전까지 통지: 여행요금의 30%, 당일 통지: 50% 배상합니다.'],
  ['제11조 (여행요금)', '여행요금에는 운임·숙박·식사·안내자경비·각종 세금·관광기금·공항항만세·관광지 입장료 등이 포함됩니다. 계약금(여행요금의 10% 이하)은 계약 체결 시 지급합니다.'],
  ['제12조 (여행요금 변경)', '이용 운송·숙박기관 요금이 계약 시보다 5% 이상 증감하거나 환율이 2% 이상 증감하면 요금 증감을 청구할 수 있습니다. 요금 증액 시 출발 15일 전에 통지합니다.'],
  ['제13조 (여행조건 변경 및 정산)', '여행조건 변경 및 요금 증감으로 생긴 차액은 여행 출발 전 변경분은 출발 이전에, 여행 중 변경분은 여행 종료 후 10일 이내에 정산·환급합니다.'],
  ['제14조 (손해배상)', '① 당사는 현지 여행사 등의 고의·과실로 여행자에게 손해를 가한 경우 배상합니다. ② 당사 귀책으로 사증·재입국 허가 등 미취득 시 수수료 전액 및 그 100% 상당액을 배상합니다. ③ 교통기관 연발착으로 인한 손해는 당사 고의·과실 없음 입증 시 제외됩니다.'],
  ['제15조 (여행 출발 전 계약 해제)', '당사 또는 여행자는 출발 전 계약 해제 가능. 발생 손해는 소비자분쟁해결기준(공정거래위원회 고시)에 따라 배상합니다. 천재지변·여행자 사망·질병 등 불가항력 사유는 위약금 없이 해제 가능합니다.'],
  ['제16조 (여행 출발 후 계약 해지)', '부득이한 사유로 계약 해지 시, 당사는 여행자 귀국에 필요한 사항을 협조하며, 당사 귀책이 아닌 비용은 여행자가 부담합니다.'],
  ['제17조 (여행의 시작과 종료)', '여행의 시작은 탑승수속(선박의 경우 승선수속) 완료 시점, 종료는 여행자가 입국장 보세구역을 벗어나는 시점으로 합니다.'],
  ['제18조 (설명의무)', '당사는 계약서에 정해진 중요한 내용 및 변경사항을 여행자가 이해할 수 있도록 설명합니다.'],
  ['제19조 (보험 가입)', '당사는 여행자에게 손해가 발생한 경우 보험금을 지급하기 위한 보험 또는 공제에 가입하거나 영업보증금을 예치합니다.'],
  ['제20조 (기타)', '이 계약에 명시되지 않은 사항은 당사 또는 여행자가 합의하여 결정하되, 미합의 시 관계법령 및 일반관례에 따릅니다.'],
];

const ALL_INCLUDE_ITEMS = [
  '선박/항공기 운임', '숙박/식사료', '안내자경비', '항만세·관광기금',
  '제세금', '여행알선수수료', '관광지 입장료', '유류할증료', '여행보험료',
  '항공기 추가 운임',
];
const ALL_EXCLUDE_ITEMS = [
  '선상팁', '쇼핑비', '선택관광',
  '일본 관광 입국세', '여권·비자 개인 부담', '여권발급비', '비자발급비',
];

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function won(n: number): string { return `${Number(n).toLocaleString('ko-KR')}원`; }

function sanitizeImg(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  if (/^data:image\/(png|jpe?g|webp);base64,/.test(s)) return s;
  if (/^https:\/\//.test(s)) return s;
  return null;
}

function fmtSignedAt(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
  }
  return s; // 이미 포맷된 문자열(기존 params 경로)
}

function todayKoText(): string {
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function getSig(gd: Record<string, unknown>, pointId: string): SigData {
  const sigs = (gd.signatures && typeof gd.signatures === 'object' && !Array.isArray(gd.signatures))
    ? gd.signatures as Record<string, unknown> : {};
  const s = sigs[pointId];
  if (s && typeof s === 'object' && !Array.isArray(s)) {
    const o = s as Record<string, unknown>;
    return {
      image:    typeof o.image === 'string' ? o.image : null,
      name:     typeof o.signedByName === 'string' ? o.signedByName : null,
      signedAt: typeof o.signedAt === 'string' ? o.signedAt : null,
      agreed:   typeof o.agreed === 'boolean' ? o.agreed : null,
    };
  }
  return { image: null, name: null, signedAt: null, agreed: null };
}

// ─── generatedData → 모델 정규화 ─────────────────────────────────────────────

function buildModel(gd: Record<string, unknown>, docId: string | null): ContractModel {
  // contractDetails 가 중첩 저장된 경우와 top-level 저장(현재 route.ts) 둘 다 지원
  const cd = (gd.contractDetails && typeof gd.contractDetails === 'object' && !Array.isArray(gd.contractDetails))
    ? gd.contractDetails as Record<string, unknown> : {};
  const pick = (k: string): unknown => (cd[k] !== undefined ? cd[k] : gd[k]);
  const pStr = (k: string): string | null => { const v = pick(k); return typeof v === 'string' && v.trim() ? v : null; };
  const pNum = (k: string): number | null => { const v = pick(k); return typeof v === 'number' ? v : null; };
  const pBool = (k: string): boolean | null => { const v = pick(k); return typeof v === 'boolean' ? v : null; };
  const pArr = (k: string): string[] => { const v = pick(k); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; };

  const gStr = (k: string): string | null => { const v = gd[k]; return typeof v === 'string' && v.trim() ? v : null; };
  const gNum = (k: string): number | null => { const v = gd[k]; return typeof v === 'number' ? v : null; };
  const gArr = (k: string): string[] => { const v = gd[k]; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; };

  // 환불(취소료) 규정: refundPolicy({label,value}[]) > refundPolicyLines > 크루즈 기본
  const rp = gd.refundPolicy;
  const rpl = gd.refundPolicyLines;
  let refundPolicyRows: { label: string; value: string }[] = CRUISE_CANCELLATION_POLICY.slice();
  const coerceRows = (arr: unknown): { label: string; value: string }[] | null => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const rows = arr
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({ label: String(r.label ?? ''), value: String(r.value ?? '') }))
      .filter((r) => r.label || r.value);
    return rows.length > 0 ? rows : null;
  };
  refundPolicyRows = coerceRows(rp) ?? coerceRows(rpl) ?? refundPolicyRows;

  // 동행자
  const rawComp = gd.companions;
  const companions: Companion[] = Array.isArray(rawComp)
    ? rawComp
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          name: String(c.name ?? ''),
          birthDate: String(c.birthDate ?? ''),
          relation: String(c.relation ?? ''),
          phone: String(c.phone ?? ''),
          pnr: typeof c.pnr === 'string' ? c.pnr : null,
        }))
    : [];

  // 7개 서명점
  const signatures: Record<string, SigData> = {
    privacy_collect:   getSig(gd, 'privacy_collect'),
    privacy_3rd:       getSig(gd, 'privacy_3rd'),
    privacy_mkt:       getSig(gd, 'privacy_mkt'),
    terms_handover:    getSig(gd, 'terms_handover'),
    special_terms_ack: getSig(gd, 'special_terms_ack'),
    main:              getSig(gd, 'main'),
    vendor_seal:       getSig(gd, 'vendor_seal'),
  };
  // 하위호환: main 이미지 없으면 단일 signatureImage 사용
  if (!signatures.main.image && typeof gd.signatureImage === 'string') {
    signatures.main = { ...signatures.main, image: gd.signatureImage, name: gStr('signedByName') ?? signatures.main.name };
  }

  return {
    docId,
    companyName:      gStr('companyName') ?? CO,
    buyerName:        gStr('buyerName'),
    buyerTel:         gStr('buyerTel'),
    productName:      gStr('productName'),
    amount:           gNum('amount'),
    departureDate:    gStr('departureDate'),
    nights:           gNum('nights'),
    contractType:     pStr('contractType'),
    travelGuarantee:  pArr('travelGuarantee'),
    hasInsurance:     pBool('hasInsurance'),
    insuranceCompany: pStr('insuranceCompany'),
    minPax:           pNum('minPax'),
    maxPax:           pNum('maxPax'),
    pricePerPerson:   pNum('pricePerPerson'),
    transportTypes:   pArr('transportTypes'),
    shipName:         pStr('shipName'),
    accommodationTypes: pArr('accommodationTypes'),
    hotelGrade:       pStr('hotelGrade'),
    mealDisplay:      pStr('mealDisplay'),
    breakfast:        pNum('breakfast'),
    lunch:            pNum('lunch'),
    dinner:           pNum('dinner'),
    hasGuide:         gStr('hasGuide'),
    localGuide:       pStr('localGuide'),
    localTransport:   pArr('localTransport'),
    localAgency:      pStr('localAgency'),
    includedItems:    gArr('includedItems'),
    excludedItems:    gArr('excludedItems'),
    companions,
    refundPolicyRows,
    specialTerms:     gStr('specialTerms'),
    marketingConsent: typeof gd.marketingConsent === 'boolean' ? gd.marketingConsent : null,
    signatures,
    agentName:        gStr('agentName'),
    agentPhone:       gStr('agentPhone'),
    signedAtText:     fmtSignedAt(gStr('signedAt')),
    issuedDateText:   todayKoText(),
  };
}

// ─── 작은 컴포넌트 ────────────────────────────────────────────────────────────

function CheckRow({ items }: { items: { label: string; checked: boolean }[] }) {
  return (
    <View style={S.checkGroup}>
      {items.map((it, i) => (
        <View key={i} style={S.checkItem}>
          <View style={it.checked ? S.boxChecked : S.boxEmpty} />
          <Text style={S.checkLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={S.infoRow} wrap={false}>
      <Text style={S.infoLabel}>{label}</Text>
      <View style={S.infoValue}>{children}</View>
    </View>
  );
}

function Sig({ image, name, caption, big }: { image: string | null; name?: string | null; caption?: string; big?: boolean }) {
  const safe = sanitizeImg(image);
  return (
    <View style={S.sig} wrap={false}>
      {safe
        ? <Image src={safe} style={big ? S.sigImgBig : S.sigImg} />
        : <View style={big ? S.sigLineBig : S.sigLine} />}
      {name ? <Text style={S.sigName}>{name}</Text> : null}
      <Text style={S.sigCaption}>{caption ?? '(인 / 서명)'}</Text>
    </View>
  );
}

// ─── 메인 문서 ────────────────────────────────────────────────────────────────

function ContractDoc({ m }: { m: ContractModel }) {
  const hasData = !!(m.buyerName || m.productName);
  const buyerFill = m.buyerName ?? '___________';
  const agentFill = m.agentName ?? '___________';
  const vendorSealImg = sanitizeImg(m.signatures.vendor_seal.image) ?? CERT_SEAL_DATA_URI;

  const checkedInc = m.includedItems;
  const checkedExc = m.excludedItems;

  const docNo = m.docId ? m.docId.slice(-8) : null;

  // 행사인원 / 여행요금 텍스트
  const paxText = (m.minPax != null || m.maxPax != null)
    ? `최저 ${m.minPax ?? '___'} 명 / 최대 ${m.maxPax ?? '___'} 명`
    : '최저 ___ 명 / 최대 ___ 명';
  const fareText = (() => {
    const pp = m.pricePerPerson, total = m.amount;
    if (pp != null && total != null) return `1인당 ${won(pp)} / 총액 ${won(total)}`;
    if (total != null) return `1인당 ___ 원 / 총액 ${won(total)}`;
    if (pp != null) return `1인당 ${won(pp)} / 총액 ___ 원`;
    return '1인당 ___ 원 / 총액 ___ 원';
  })();
  const mealCountText = m.mealDisplay === '개별'
    ? `조식 ${m.breakfast ?? '_'}회, 중식 ${m.lunch ?? '_'}회, 석식 ${m.dinner ?? '_'}회`
    : '조식 _회, 중식 _회, 석식 _회';

  return (
    <Document title={`구매계약서_${m.buyerName ?? '고객'}`} author={m.companyName}>
      <Page size="A4" style={S.page}>
        {/* 고정 머리글 */}
        <View style={S.runHeader} fixed>
          <Text style={S.runHeaderText}>{m.companyName} 여행계약서</Text>
          <Text style={S.runHeaderText}>{m.buyerName ?? ''}</Text>
        </View>
        {/* 고정 꼬리글 + 페이지번호 */}
        <View style={S.runFooter} fixed>
          <Text style={S.footerText}>
            {m.companyName}{docNo ? ` | 문서번호 ${docNo}` : ''} · 전자서명법에 따른 전자계약서
          </Text>
          <Text style={S.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

        {/* ── 표지 헤더 ── */}
        <View wrap={false}>
          <Text style={S.title}>{m.companyName} 여행계약서</Text>
          <Text style={S.subtitle}>
            {m.companyName} | 대표 {COMPANY_INFO.ceo} | 여행업 등록 {COMPANY_INFO.travelAgencyNo}
            {docNo ? ` | 문서번호 ${docNo}` : ''}
          </Text>
          <View style={S.headerRule} />
        </View>

        {/* ── 계약 구분 ── */}
        <View style={S.kindBar} wrap={false}>
          <Text style={S.kindLabel}>계약 구분</Text>
          <CheckRow items={[
            { label: '기획여행', checked: m.contractType === '기획여행' },
            { label: '희망여행', checked: m.contractType === '희망여행' },
          ]} />
        </View>

        {/* ── 계약 정보 ── */}
        <Text style={S.sectionTitle}>1. 계약 정보</Text>
        <View style={S.infoTable}>
          <InfoRow label="상품명">
            <Text style={S.infoValueText}>{m.productName ?? '여행일정표 참조'}</Text>
          </InfoRow>
          <InfoRow label="여행기간">
            <Text style={S.infoValueText}>
              {m.departureDate ? `${m.departureDate} 출발${m.nights ? ` / ${m.nights}박` : ''}` : '여행일정표 참조'}
            </Text>
          </InfoRow>
          <InfoRow label="여행보증">
            <CheckRow items={(['공제', '예치금', '영업보증보험'] as const).map((g) => ({ label: g, checked: m.travelGuarantee.includes(g) }))} />
          </InfoRow>
          <InfoRow label="여행자보험">
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <CheckRow items={[
                { label: '가입', checked: m.hasInsurance === true },
                { label: '미가입', checked: m.hasInsurance === false },
              ]} />
              {m.hasInsurance && m.insuranceCompany
                ? <Text style={S.inlineNote}>/ 보험회사: {m.insuranceCompany}</Text> : null}
            </View>
          </InfoRow>
          <InfoRow label="행사인원"><Text style={S.infoValueText}>{paxText}</Text></InfoRow>
          <InfoRow label="여행요금"><Text style={S.infoValueText}>{fareText}</Text></InfoRow>
          <InfoRow label="교통수단">
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <CheckRow items={(['항공기', '선박', '기차'] as const).map((t) => ({ label: t, checked: m.transportTypes.includes(t) }))} />
              {m.transportTypes.includes('선박') && m.shipName
                ? <Text style={S.inlineNote}>선박명: {m.shipName}</Text> : null}
            </View>
          </InfoRow>
          <InfoRow label="숙박">
            <CheckRow items={[
              { label: '일정표 표시', checked: m.accommodationTypes.includes('일정표표시') },
              { label: m.accommodationTypes.includes('관광호텔') && m.hotelGrade ? `관광호텔 (${m.hotelGrade} 등급)` : '관광호텔', checked: m.accommodationTypes.includes('관광호텔') },
              { label: '기타', checked: m.accommodationTypes.includes('기타') },
            ]} />
          </InfoRow>
          <InfoRow label="식사">
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <CheckRow items={[
                { label: '일정표 표시', checked: m.mealDisplay === '일정표표시' },
                { label: '개별 입력', checked: m.mealDisplay === '개별' },
              ]} />
              <Text style={S.inlineNote}>/ {mealCountText}</Text>
            </View>
          </InfoRow>
          <InfoRow label="여행 인솔자">
            <CheckRow items={[
              { label: '있음', checked: m.hasGuide === 'Y' },
              { label: '없음', checked: m.hasGuide === 'N' },
            ]} />
          </InfoRow>
          <InfoRow label="현지 안내원">
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <CheckRow items={[
                { label: '있음', checked: m.localGuide === '있음' },
                { label: '없음', checked: m.localGuide === '없음' },
              ]} />
              <Text style={S.inlineNote}>*여행일정표 참조</Text>
            </View>
          </InfoRow>
          <InfoRow label="현지 교통">
            <CheckRow items={(['버스', '승용차', '기타', '없음'] as const).map((t) => ({ label: t, checked: m.localTransport.includes(t) }))} />
          </InfoRow>
          <InfoRow label="현지 여행사">
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <CheckRow items={[
                { label: '있음', checked: m.localAgency === '있음' },
                { label: '없음', checked: m.localAgency === '없음' },
              ]} />
              <Text style={S.inlineNote}>*여행일정표 참조</Text>
            </View>
          </InfoRow>
        </View>

        {/* ── 탑승자 명단 ── */}
        {m.companions.length > 0 && (
          <>
            <Text style={S.sectionTitle}>2. 탑승자 명단 ({m.companions.length}명)</Text>
            <View wrap={false}>
              <View style={S.compHead}>
                <Text style={[S.compHeadCell, { flex: 1.4 }]}>이름</Text>
                <Text style={[S.compHeadCell, { flex: 1 }]}>관계</Text>
                <Text style={[S.compHeadCell, { flex: 1.4 }]}>생년월일</Text>
                <Text style={[S.compHeadCell, { flex: 1.6 }]}>연락처</Text>
                <Text style={[S.compHeadCell, { flex: 1.2 }]}>PNR</Text>
              </View>
              {m.companions.map((c, i) => (
                <View key={i} style={[S.compRow, i % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                  <Text style={[S.compCell, { flex: 1.4, fontWeight: 700 }]}>{c.name || '-'}</Text>
                  <Text style={[S.compCell, { flex: 1 }]}>{c.relation || '-'}</Text>
                  <Text style={[S.compCell, { flex: 1.4 }]}>{c.birthDate || '-'}</Text>
                  <Text style={[S.compCell, { flex: 1.6 }]}>{c.phone || '-'}</Text>
                  <Text style={[S.compCell, { flex: 1.2 }]}>{c.pnr || '-'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── 포함/불포함 ── */}
        <Text style={S.sectionTitle}>3. 여행요금 포함 / 불포함 내역</Text>
        <View style={S.twoCol} wrap={false}>
          <View style={S.incCol}>
            <Text style={S.incTitle}>포함 항목</Text>
            {ALL_INCLUDE_ITEMS.map((item) => {
              const on = checkedInc.includes(item);
              return (
                <View key={item} style={S.checkItem}>
                  <View style={on ? S.boxChecked : S.boxEmpty} />
                  <Text style={checkedInc.length > 0 && !on ? S.itemStruck : S.checkLabel}>{item}</Text>
                </View>
              );
            })}
          </View>
          <View style={S.excCol}>
            <Text style={S.excTitle}>불포함 항목</Text>
            {ALL_EXCLUDE_ITEMS.map((item) => {
              const on = checkedExc.includes(item);
              return (
                <View key={item} style={S.checkItem}>
                  <View style={on ? S.boxChecked : S.boxEmpty} />
                  <Text style={checkedExc.length > 0 && !on ? S.itemStruck : S.checkLabel}>{item}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── 약관 교부 및 서명 ── */}
        <Text style={S.sectionTitle}>4. 약관 교부 및 서명</Text>
        <View style={S.noteBox} wrap={false}>
          <Text style={S.ackText}>
            여행자( {buyerFill} )은 담당자( {agentFill} )으로부터 크루즈여행계약서, 국외여행표준약관,
            크루즈여행특별약관 및 여행일정표를 교부받았으며, 주요사항에 대한 충분한 설명을 들었습니다.
          </Text>
          <View style={S.ackSignRow}>
            <Text style={S.ackSignLabel}>약관 교부 확인 (여행자)</Text>
            <Sig image={m.signatures.terms_handover.image} name={m.buyerName} caption="(서명)" />
          </View>
        </View>
        <View style={S.sigPairRow}>
          <View style={S.sigPartyBox} wrap={false}>
            <Text style={S.partyRole}>여행자</Text>
            <Sig image={m.signatures.main.image} name={m.buyerName ?? '___________'} big />
          </View>
          <View style={S.sigPartyBoxVendor} wrap={false}>
            <Text style={S.partyRole}>여행업자</Text>
            <Text style={S.partyCompany}>{m.companyName}</Text>
            <Text style={S.partyCeo}>대표 {COMPANY_INFO.ceo}</Text>
            <Sig image={vendorSealImg} caption="(직인)" big />
          </View>
        </View>

        {/* ── 특약사항 ── */}
        {m.specialTerms && (
          <>
            <Text style={S.sectionTitle}>5. 특약사항</Text>
            <View style={S.specialBox} wrap={false}>
              <Text style={[S.clause, { color: '#92400e' }]}>{m.specialTerms}</Text>
            </View>
          </>
        )}

        {/* ── 크루즈 여행 특별약관 ── */}
        <Text style={S.sectionTitle}>{m.specialTerms ? '6' : '5'}. 크루즈 여행 특별약관</Text>
        <View style={S.redBox}>
          <View wrap={false}>
            <Text style={S.clauseSubTitle}>제1조 (목적)</Text>
            <Text style={S.clause}>본 특약은 국외여행표준약관을 보완하고 크루즈 여행 고유의 여행조건, 취소규정, 유의사항 등을 여행자에게 사전 고지함에 그 목적이 있습니다.</Text>
          </View>

          <View wrap={false}>
            <Text style={S.clauseSubTitle}>제2조 (크루즈 취소료 규정) — 환불 고지</Text>
            <Text style={S.warnLine}>
              본 상품은 항공사·선사 비용 사전 지급으로 인해 일반여행 취소료 규정이 아닌 크루즈 특별 취소료를 우선 적용합니다.
            </Text>
            <View style={S.feeHead}>
              <Text style={S.feeHeadCellL}>해지 시기</Text>
              <Text style={S.feeHeadCellR}>취소료</Text>
            </View>
            {m.refundPolicyRows.map((p, i) => (
              <View key={i} style={S.feeRow}>
                <Text style={S.feeCellL}>{p.label}</Text>
                <Text style={S.feeCellR}>{p.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 4 }}>
            {CRUISE_NOTES_2.map((t, i) => (
              <Text key={i} style={S.clause} wrap={false}>{t}</Text>
            ))}
          </View>

          <View wrap={false}>
            <Text style={S.clauseSubTitle}>제3조 (유의사항)</Text>
          </View>
          {CRUISE_NOTES_3.map((t, i) => (
            <Text key={i} style={S.clause} wrap={false}>{t}</Text>
          ))}

          <View style={[S.noteBox, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecaca', marginTop: 6 }]} wrap={false}>
            <Text style={S.clause}>
              <Text style={S.clauseTitle}>약관 교부 확인: </Text>
              여행자( {buyerFill} )은 담당자( {agentFill} )으로부터 크루즈여행특별약관을 교부받았으며,
              취소료 규정·유의사항 및 본 약관이 국외여행표준약관에 우선함을 충분히 설명 들었습니다.
            </Text>
            <View style={S.ackSignRow}>
              <Text style={S.ackSignLabel}>여행자</Text>
              <Sig image={m.signatures.special_terms_ack.image} name={m.buyerName} caption="(서명)" />
            </View>
          </View>
        </View>

        {/* ── 국외여행 표준약관 ── */}
        <Text style={S.sectionTitle}>{m.specialTerms ? '7' : '6'}. 국외여행 표준약관</Text>
        <Text style={[S.clause, { color: '#888', marginBottom: 4 }]}>{m.companyName}은 공정거래위원회 표준약관을 준수합니다.</Text>
        {STANDARD_TERMS.map(([title, body], i) => (
          <Text key={i} style={S.clause} wrap={false}>
            <Text style={S.clauseTitle}>{title} </Text>{body}
          </Text>
        ))}
        <Text style={[S.clause, { color: '#888', marginTop: 2 }]} wrap={false}>
          ※ 본 계약 관련 분쟁 시 관광불편신고처리위원회(1588-8692) 또는 소재지 도청 문화관광과에 중재 신청 가능합니다.
        </Text>

        {/* ── 일반 취소·환불 규정 (참고) ── */}
        <Text style={S.sectionTitle}>{m.specialTerms ? '8' : '7'}. 일반여행 취소·환불 규정 (참고)</Text>
        <Text style={[S.clause, { color: '#b91c1c', marginBottom: 3 }]}>※ 크루즈 여행은 위 특별약관 제2조 취소료 규정이 우선 적용됩니다.</Text>
        <View wrap={false}>
          <View style={S.gHead}>
            <Text style={S.gHeadCellL}>취소 시점</Text>
            <Text style={S.gHeadCellR}>위약금</Text>
          </View>
          {CANCELLATION_POLICY.map((p, i) => (
            <View key={i} style={S.gRow}>
              <Text style={S.gCellL}>{p.label}</Text>
              <Text style={S.gCellR}>{p.value}</Text>
            </View>
          ))}
        </View>

        {/* ── 개인정보처리 동의 ── */}
        <Text style={S.sectionTitle}>{m.specialTerms ? '9' : '8'}. 개인정보처리 동의사항</Text>
        <View style={S.blueBox}>
          {/* 1. 수집·이용 (필수) */}
          <View wrap={false}>
            <Text style={S.privTitle}>1. 개인정보 수집·이용 동의 (필수)</Text>
            <Text style={S.privText}><Text style={S.privBold}>수집·이용 목적: </Text>크루즈여행계약 체결·심사·관리, 서비스 제공, 고객관리, 대금결제, 민원처리</Text>
            <Text style={S.privText}><Text style={S.privBold}>수집 항목: </Text>성명, 생년월일, 주소(자택/직장), 연락처(휴대폰/자택/직장), 이메일</Text>
            <Text style={S.privText}><Text style={S.privBold}>보유 기간: </Text>목적 달성 시까지 / 계약·청약철회 기록 5년 / 대금결제 기록 5년 / 분쟁처리 기록 3년</Text>
            <View style={S.ackSignRow}>
              <Text style={S.ackSignLabel}>계약자 (필수 동의)</Text>
              <Sig image={m.signatures.privacy_collect.image} name={m.buyerName} caption="(서명)" />
            </View>
          </View>

          {/* 2. 제3자 제공 (필수) */}
          <View wrap={false}>
            <Text style={S.privTitle}>2. 제3자 제공 동의 (필수)</Text>
            <Text style={S.privText}><Text style={S.privBold}>제공 대상: </Text>각 항공사·선사·랜드사, {m.companyName}</Text>
            <Text style={S.privText}><Text style={S.privBold}>제공 항목: </Text>성명, 생년월일, 주소, 연락처</Text>
            <Text style={S.privText}><Text style={S.privBold}>제공 목적: </Text>크루즈 여행 서비스 제공</Text>
            <Text style={S.privText}><Text style={S.privBold}>보유 기간: </Text>크루즈 여행 서비스 종료 시 삭제</Text>
            <View style={S.ackSignRow}>
              <Text style={S.ackSignLabel}>계약자 (필수 동의)</Text>
              <Sig image={m.signatures.privacy_3rd.image} name={m.buyerName} caption="(서명)" />
            </View>
          </View>

          {/* 3. 마케팅 활용 (선택) */}
          <View wrap={false}>
            <Text style={S.privTitle}>3. 마케팅 활용 동의 (선택)</Text>
            <Text style={S.privText}><Text style={S.privBold}>활용 목적: </Text>{m.companyName}이 제공하는 서비스 홍보 및 소개</Text>
            <Text style={S.privText}><Text style={S.privBold}>방법: </Text>우편·전화·이메일·방문·문자</Text>
            <Text style={S.privText}><Text style={S.privBold}>보유 기간: </Text>계약 종료 후 5년</Text>
            <Text style={S.privText}>※ 상기 동의를 거부할 수 있으며, 미동의 시에도 계약 체결에는 영향이 없습니다.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Text style={[S.ackSignLabel, { marginRight: 8 }]}>마케팅 활용</Text>
              <CheckRow items={[
                { label: '동의', checked: m.marketingConsent === true },
                { label: '미동의', checked: m.marketingConsent === false },
              ]} />
            </View>
            <View style={S.ackSignRow}>
              <Text style={S.ackSignLabel}>계약자 (선택)</Text>
              <Sig image={m.signatures.privacy_mkt.image} name={m.buyerName} caption="(선택 서명)" />
            </View>
          </View>
        </View>

        {/* ── 여행업자 정보 ── */}
        <Text style={S.sectionTitle}>{m.specialTerms ? '10' : '9'}. 여행업자 정보</Text>
        <View style={S.vendorBox} wrap={false}>
          <View style={S.vendorGrid}>
            <Text style={S.vendorItem}>상호: {m.companyName}</Text>
            <Text style={S.vendorItem}>대표: {COMPANY_INFO.ceo}</Text>
            <Text style={S.vendorItem}>대표전화: {COMPANY_INFO.hqPhone}</Text>
            <Text style={S.vendorItem}>
              담당자: {m.agentName ? `${m.agentName}${m.agentPhone ? ` ${m.agentPhone}` : ''}` : `본사 ${COMPANY_INFO.hqPhone}`}
            </Text>
            <Text style={S.vendorItem}>사업자등록: {COMPANY_INFO.bizRegNo}</Text>
            <Text style={S.vendorItem}>통신판매업: {COMPANY_INFO.telecomSalesNo}</Text>
            <Text style={S.vendorItemFull}>여행업 등록: {COMPANY_INFO.travelAgencyNo}</Text>
            <Text style={S.vendorItemFull}>주소: {COMPANY_INFO.address}</Text>
            <Text style={S.vendorItemFull}>계좌: {COMPANY_INFO.bankName} {COMPANY_INFO.bankAccount} (예금주 {COMPANY_INFO.bankHolder})</Text>
          </View>
        </View>

        {!hasData && (
          <Text style={S.emptyHint}>
            계약 정보가 비어 있습니다. 발급 시 구매자·상품 정보가 자동 반영됩니다.
          </Text>
        )}

        {/* ── 발행일 / 직인 ── */}
        <View style={S.issueWrap} wrap={false}>
          <Text style={S.issueDate}>
            {m.signedAtText ? `${m.signedAtText} 전자서명 완료` : `${m.issuedDateText} 발행`}
          </Text>
          <Image src={vendorSealImg} style={S.sealImg} />
          <Text style={S.sigCaption}>{m.companyName} 직인</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── 내보내기 ─────────────────────────────────────────────────────────────────

async function renderModel(model: ContractModel): Promise<Buffer> {
  const buf = await renderToBuffer(<ContractDoc m={model} />);
  return Buffer.from(buf);
}

/**
 * 신규(권장): generatedData(JSON) 를 그대로 받아 전체본 계약서 PDF Buffer 반환.
 * @param generatedData SalesDocument.generatedData (구매계약서)
 * @param docId         (선택) 문서번호 푸터/머리글 표기용
 */
export async function renderPurchaseContractPdf(
  generatedData: Record<string, unknown>,
  docId?: string,
): Promise<Buffer> {
  const model = buildModel(generatedData ?? {}, docId ?? null);
  return renderModel(model);
}

/**
 * 기존 호환: sign/route.ts 이메일 첨부 호출부가 쓰는 시그니처 유지.
 * 내부적으로 동일한 전체본 렌더러를 사용한다(축약본 아님).
 */
export async function generatePurchaseContractPdf(params: PurchaseContractPdfParams): Promise<Buffer> {
  // params → generatedData 형태로 매핑하여 동일 모델 빌더 재사용
  const gd: Record<string, unknown> = {
    buyerName:      params.buyerName,
    buyerTel:       params.buyerTel,
    productName:    params.productName,
    amount:         params.amount,
    departureDate:  params.departureDate,
    nights:         params.nights,
    paymentMethod:  params.paymentMethod,
    paidAt:         params.paidAt,
    specialTerms:   params.specialTerms,
    companions:     params.companions,
    companyName:    params.companyName,
    signatureImage: params.signatureImage,
    signedByName:   params.signedByName,
    signedAt:       params.signedAt, // 이미 한국어 포맷 — fmtSignedAt 가 그대로 통과
    signatures: {
      main: { role: 'TRAVELER', image: params.signatureImage, signedByName: params.signedByName },
    },
  };
  const model = buildModel(gd, params.docId);
  return renderModel(model);
}
