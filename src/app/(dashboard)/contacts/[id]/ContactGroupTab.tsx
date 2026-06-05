"use client";

import { memo } from "react";
import FunnelEnrollSection from "./FunnelEnrollSection";

interface Funnel {
  id: string;
  name: string;
  funnelType?: string;
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
  // 그룹 관련 props (하위 호환성 유지 - 현재 UI에서 미사용)
  allGroups?: { id: string; name: string; funnelId?: string | null }[];
  selectedGroup?: string;
  setSelectedGroup?: (id: string) => void;
  assigning?: boolean;
  assignMsg?: string;
  assignGroup?: () => Promise<void>;
  // 퍼널 직접 등록
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
  // 이관 이력 (하위 호환성 유지)
  transferLogs?: {
    id: string; createdAt: string; transferType: string; newContactId: string | null;
    transferredBy: string; fromOrg: { name: string } | null; toOrg: { name: string } | null;
    toUserName: string | null; toUserOrgName: string | null; canRecall: boolean;
  }[];
  loadingTransfer?: boolean;
}

function ContactGroupTabComponent({
  contact, funnels,
  selectedFunnelId, setSelectedFunnelId,
  enrollStartDate, setEnrollStartDate,
  enrollSendNow, setEnrollSendNow,
  enrolling, enrollError,
  handleFunnelEnroll,
}: ContactGroupTabProps) {
  return (
    <div className="space-y-4">
      <FunnelEnrollSection
        funnels={funnels}
        enrolledSequences={contact.vipSequences ?? []}
        selectedFunnelId={selectedFunnelId}
        setSelectedFunnelId={setSelectedFunnelId}
        enrollStartDate={enrollStartDate}
        setEnrollStartDate={setEnrollStartDate}
        enrollSendNow={enrollSendNow}
        setEnrollSendNow={setEnrollSendNow}
        enrolling={enrolling}
        enrollError={enrollError}
        onEnroll={handleFunnelEnroll}
      />
    </div>
  );
}

export default memo(ContactGroupTabComponent);
