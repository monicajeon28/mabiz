export interface CallLog {
  id: string;
  content: string | null;
  result: string | null;
  duration: number | null;
  convictionScore: number | null;
  nextAction: string | null;
  scheduledAt: string | null;
  createdAt: string;
  _sharedFrom?: string;
  _authorName?: string | null;
}

export interface Memo {
  id: string;
  content: string;
  createdAt: string;
  _authorName?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  type: string;
  cruiseInterest: string | null;
  budgetRange: string | null;
  adminMemo: string | null;
  assignedUserId: string | null;
  lastContactedAt: string | null;
  purchasedAt: string | null;
  departureDate: string | null;
  productName: string | null;
  bookingRef: string | null;
  tags: string[];
  leadScore: number;
  sourceOrgId: string | null;
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  segmentOverride?: string | null;
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[];
  memos: Memo[];
  sharedCallLogs: (CallLog & { _sharedFrom: string })[];
  vipSequences: { id: string; funnelId: string; status: string; startDate: string }[];
  // 결제 상태
  lastPaymentStatus?: string | null;
  lastPaymentAt?: string | null;
  lastRefundedAt?: string | null;
  paymentStatusNote?: string | null;
  // 엑셀 가져오기
  inflowDate?: string | null;
  surveyData?: Record<string, string | null> | null;
}
