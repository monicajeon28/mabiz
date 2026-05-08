'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  FiSend,
  FiFileText,
  FiCopy,
  FiX,
  FiCheckCircle,
  FiExternalLink,
} from 'react-icons/fi';
import SignaturePad from 'signature_pad';
import { showError, showSuccess } from '@/components/ui/Toast';
import { getAffiliateTerm } from '@/lib/utils';

type AffiliateProfile = {
  id: number;
  userId: number;
  affiliateCode: string;
  type: 'BRANCH_MANAGER' | 'SALES_AGENT' | 'HQ';
  displayName: string | null;
  nickname: string | null;
  user: {
    mallUserId: string | null;
  } | null;
};

// 계약서 내용은 법적 문서이므로 동적으로 생성
const getContractSections = (affiliateTerm: string): Array<{ title: string; clauses: string[] }> => [
  {
    title: '제1조 (목적)',
    clauses: [
      `본 계약은 주식회사 크루즈닷(이하 "갑")과 계약 신청자(이하 "을")가 크루즈 상품 판매를 위한 ${affiliateTerm} 활동을 수행함에 있어 필요한 권리와 의무를 명확히 함을 목적으로 합니다.`,
    ],
  },
  {
    title: '제2조 (정의)',
    clauses: [
      `"${affiliateTerm} 활동"이라 함은 갑이 제공하는 상품, 서비스 및 프로모션을 을이 소개·판매·중개하는 일체의 영업 행위를 의미합니다.`,
      '"고객 DB"라 함은 갑이 직접 보유하거나 을을 통해 수집된 고객의 개인정보, 여행 이력, 상담 내역 및 판매 성과 데이터를 말합니다.',
    ],
  },
  {
    title: '제3조 (을의 역할과 의무)',
    clauses: [
      '을은 갑이 제공한 최신 상품 정보와 가격 정책을 정확히 전달하며, 허위·과장 광고를 하지 않습니다.',
      '을은 고객 상담, 예약, 결제 안내 등 판매 과정에서 필요한 절차를 성실히 수행하고, 고객 문의에 신속히 대응합니다.',
      '을은 갑이 지정한 교육 프로그램을 이수하고, 변경된 정책 및 지침을 즉시 반영합니다.',
    ],
  },
  {
    title: '제4조 (수수료 및 정산)',
    clauses: [
      '을의 활동으로 발생한 매출에 대해서는 갑이 사전에 고지한 커미션 정책에 따라 수수료가 산정됩니다.',
      '정산은 매월 말일 기준으로 집계하며, 갑은 익월 30일 이내에 을이 지정한 계좌로 지급합니다.',
      '고객의 취소·환불·미납 등이 발생할 경우, 해당 금액은 차기 정산분에서 공제하거나 환수할 수 있습니다.',
    ],
  },
  {
    title: '제5조 (고객 정보 보호 및 활용 제한)',
    clauses: [
      '을은 고객 DB를 계약 목적 외 용도로 이용하거나 제3자에게 제공·유출해서는 안 됩니다.',
      '계약 종료 시 을은 보유 중인 고객 DB를 즉시 반환하거나 복구 불가능한 방법으로 파기해야 하며, 이를 준수하지 않을 경우 손해배상 책임을 집니다.',
      '고객 동의 없이 타사 상품 홍보, 리크루팅, 스팸성 메시지 발송 등을 금지합니다.',
    ],
  },
  {
    title: '제6조 (교육, 자료 및 브랜드 사용)',
    clauses: [
      '갑은 을에게 필요한 교육 자료, 영업 가이드, 마케팅 콘텐츠를 제공할 수 있으며, 을은 해당 자료를 변형 없이 사용합니다.',
      '을은 갑의 상호, 로고, 브랜드 자산을 허가된 용도 내에서만 사용할 수 있으며, 별도 승인 없이 상업적 2차 제작물을 만들 수 없습니다.',
    ],
  },
  {
    title: '제7조 (계약 기간 및 해지)',
    clauses: [
      '본 계약의 유효기간은 서명일로부터 1년이며, 어느 일방의 서면 해지 통지가 없는 경우 동일 조건으로 자동 연장됩니다.',
      '갑 또는 을은 상대방이 계약을 위반하거나 신뢰를 훼손하는 행위를 한 경우 즉시 해지할 수 있습니다.',
      '계약이 해지되는 경우 을은 진행 중인 고객 상담과 판매 건에 대해 갑의 지침을 따르며, 미정산 수수료는 확정 후 지급·조정합니다.',
    ],
  },
  {
    title: '제8조 (손해배상 및 위약벌)',
    clauses: [
      '을이 고객 DB 무단 활용, 허위·과장 광고, 금품 요구 등의 행위를 하여 갑 또는 고객에게 피해가 발생한 경우, 을은 전액 배상하여야 합니다.',
      '을이 경업 금지 조항을 위반하거나 갑의 영업상 기밀을 유출한 경우, 갑은 발생한 손해와 별도로 위약벌(매출의 3배 이내)을 청구할 수 있습니다.',
    ],
  },
  {
    title: '제9조 (기타 및 준거법)',
    clauses: [
      '본 계약에 명시되지 않은 사항은 갑의 운영 정책과 관련 법령, 그리고 상관례에 따릅니다.',
      '본 계약과 관련하여 분쟁이 발생할 경우, 갑의 본사 소재지를 관할하는 법원을 1심 전속 관할 법원으로 합니다.',
    ],
  },
  {
    title: '부칙',
    clauses: [
      '본 계약은 전자 서명 제출일에 효력이 발생하며, 갑의 승인을 통해 최종 확정됩니다.',
      '갑은 필요 시 정책 변동 사항을 을에게 사전 통지하며, 통지일로부터 7일 이내에 이의 제기가 없을 경우 변경 사항에 동의한 것으로 간주합니다.',
    ],
  },
];

interface ContractTypeInfo {
  code: string;
  title: string;
  price?: string;
  icon: string;
  isCustom: boolean;
}

interface ContractInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfileId?: number; // 현재 사용자의 프로필 ID (대리점장인 경우)
  contractType?: string; // 계약서 타입 (동적 지원)
  onSuccess?: () => void;
  skipLinkGeneration?: boolean; // 링크 생성 단계 건너뛰고 바로 계약서 작성 폼 열기
}

// 기본 계약서 타입 정보 (API 로드 전 fallback)
const DEFAULT_CONTRACT_TYPE_INFO: Record<string, { title: string; icon: string }> = {
  SALES_AGENT: { title: '판매원', icon: '👤' },
  BRANCH_MANAGER: { title: '대리점장', icon: '🏢' },
  CRUISE_STAFF: { title: '크루즈스탭', icon: '🚢' },
  SUBSCRIPTION_AGENT: { title: '정액제', icon: '💳' },
};

export default function ContractInviteModal({
  isOpen,
  onClose,
  currentProfileId,
  contractType = 'SALES_AGENT',
  onSuccess,
  skipLinkGeneration = false,
}: ContractInviteModalProps) {
  const pathname = usePathname();
  const affiliateTerm = getAffiliateTerm(pathname || undefined);
  const [profiles, setProfiles] = useState<AffiliateProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<AffiliateProfile | null>(null);
  const [contractLink, setContractLink] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showContractFormModal, setShowContractFormModal] = useState(false);
  const [showInviteMessageModal, setShowInviteMessageModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', phone: '' });
  const [inviteMessage, setInviteMessage] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [showContractTextModal, setShowContractTextModal] = useState(false);
  const [contractReadConfirmed, setContractReadConfirmed] = useState(false);
  const [contractTypeInfo, setContractTypeInfo] = useState<ContractTypeInfo | null>(null);

  // 계약서 타입 정보 로드
  useEffect(() => {
    if (!isOpen || !contractType) return;

    const loadContractTypeInfo = async () => {
      try {
        const res = await fetch('/api/public/contract-types');
        const json = await res.json();
        if (res.ok && json.ok) {
          const found = json.contractTypes?.find((ct: ContractTypeInfo) => ct.code === contractType);
          if (found) {
            setContractTypeInfo(found);
          }
        }
      } catch (error) {
        console.error('[ContractInviteModal] load contract type info error', error);
      }
    };

    loadContractTypeInfo();
  }, [isOpen, contractType]);

  // 계약서 타입 레이블 가져오기
  const getContractTypeLabel = () => {
    if (contractTypeInfo) {
      return contractTypeInfo.title.replace(/계약서|계약/, '').trim() || contractTypeInfo.title;
    }
    return DEFAULT_CONTRACT_TYPE_INFO[contractType]?.title || contractType;
  };

  const getContractTypeIcon = () => {
    if (contractTypeInfo) {
      return contractTypeInfo.icon;
    }
    return DEFAULT_CONTRACT_TYPE_INFO[contractType]?.icon || '📄';
  };
  const [contractForm, setContractForm] = useState({
    name: '',
    phone: '',
    email: '',
    residentIdFront: '',
    residentIdBack: '',
    address: '',
    bankName: '',
    bankAccount: '',
    bankAccountHolder: '',
    signatureUrl: '',
    signatureOriginalName: '',
    signatureFileId: '',
    consentPrivacy: false,
    consentNonCompete: false,
    consentDbUse: false,
    consentPenalty: false,
  });
  const [submittingContract, setSubmittingContract] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState('');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [linkGenerated, setLinkGenerated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 현재 사용자 정보 자동 로드 (수동 계약서 저장용)
      const loadCurrentUserInfo = async () => {
        try {
          const res = await fetch('/api/affiliate/my-profile');
          const json = await res.json();
          if (res.ok && json?.ok && json?.profile) {
            const profile = json.profile;
            // 사용자 정보가 있고 이름/전화번호가 비어있으면 자동 채우기
            if ((!inviteForm.name || !inviteForm.phone) && (profile?.name || profile?.phone)) {
              const autoFilledForm = {
                name: profile?.name || '',
                phone: profile?.phone || '',
              };
              setInviteForm(autoFilledForm);

              // skipLinkGeneration이 true이고 이름/전화번호가 모두 있으면 바로 계약서 작성 폼 열기
              if (skipLinkGeneration && autoFilledForm.name && autoFilledForm.phone) {
                setTimeout(() => {
                  setContractForm({
                    name: autoFilledForm.name,
                    phone: autoFilledForm.phone,
                    email: profile?.email || '',
                    residentIdFront: '',
                    residentIdBack: '',
                    address: '',
                    bankName: '',
                    bankAccount: '',
                    bankAccountHolder: '',
                    signatureUrl: '',
                    signatureOriginalName: '',
                    signatureFileId: '',
                    consentPrivacy: false,
                    consentNonCompete: false,
                    consentDbUse: false,
                    consentPenalty: false,
                  });
                  setShowContractFormModal(true);
                }, 100);
              }
            }
          }
        } catch (error: any) {
          console.error('[ContractInviteModal] load current user info error', error);
          // 에러는 무시 (선택적 기능)
        }
      };

      // 판매원 프로필 목록 자동 로드
      loadCurrentUserInfo();
      loadProfiles();
    } else {
      setSelectedProfile(null);
      setContractLink(null);
      setShowContractFormModal(false);
      setShowInviteMessageModal(false);
      setInviteMessage('');
      setInviteForm({ name: '', phone: '' });
      setLinkGenerated(false);
      setProfiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const res = await fetch('/api/admin/affiliate/profiles?status=ACTIVE');
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '프로필을 불러오지 못했습니다.');
      }
      setProfiles(json.profiles ?? []);
    } catch (error: any) {
      console.error('[ContractInviteModal] load profiles error', error);
      showError(error.message || '프로필 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleGenerateLink = () => {
    if (!inviteForm.name.trim() || !inviteForm.phone.trim()) {
      showError('이름과 연락처를 모두 입력해주세요.');
      return;
    }

    // 계약서 작성 링크 생성 (판매원 선택 없이)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    let contractUrl = `${baseUrl}/affiliate/contract`;

    const params = new URLSearchParams();
    // 계약서 타입 추가
    params.append('type', contractType);

    // 현재 프로필 ID가 있으면 invitedBy 파라미터 추가
    if (currentProfileId) {
      params.append('invitedBy', String(currentProfileId));
    }

    // 개인정보를 URL 파라미터로 추가 (자동 채우기용)
    // 보안을 위해 base64 인코딩 또는 간단한 인코딩 사용
    if (inviteForm.name.trim()) {
      params.append('name', encodeURIComponent(inviteForm.name.trim()));
    }
    if (inviteForm.phone.trim()) {
      params.append('phone', encodeURIComponent(inviteForm.phone.trim()));
    }

    if (params.toString()) {
      contractUrl += `?${params.toString()}`;
    }

    setContractLink(contractUrl);
    setLinkGenerated(true);
  };

  const handleCopyContractLink = () => {
    if (contractLink) {
      navigator.clipboard.writeText(contractLink);
      showSuccess('계약서 링크가 클립보드에 복사되었습니다.');
    }
  };

  const handleOpenContractForm = () => {
    if (!inviteForm.name.trim() || !inviteForm.phone.trim()) {
      showError('이름과 연락처를 먼저 입력해주세요.');
      return;
    }
    setShowContractFormModal(true);
    setContractReadConfirmed(false);
    setContractForm({
      name: inviteForm.name,
      phone: inviteForm.phone,
      email: '',
      residentIdFront: '',
      residentIdBack: '',
      address: '',
      bankName: '',
      bankAccount: '',
      bankAccountHolder: '',
      signatureUrl: '',
      signatureOriginalName: '',
      signatureFileId: '',
      consentPrivacy: false,
      consentNonCompete: false,
      consentDbUse: false,
      consentPenalty: false,
    });
  };

  const handleOpenInviteMessageModal = () => {
    if (!inviteForm.name.trim() || !inviteForm.phone.trim()) {
      showError('이름과 연락처를 먼저 입력해주세요.');
      return;
    }
    if (!contractLink) {
      handleGenerateLink();
    }
    setShowInviteMessageModal(true);
    setInviteMessage('');
  };

  const buildInviteMessage = (name: string, phone: string, contractUrl: string) => {
    return [
      `[크루즈닷 ${affiliateTerm} 계약서 작성 안내]`,
      '',
      `${name}님, 안녕하세요.`,
      '',
      `크루즈닷 ${affiliateTerm} 계약서 작성을 안내드립니다.`,
      '아래 링크에서 계약서를 작성해주세요.',
      '',
      contractUrl,
      '',
      '※ 계약서 작성 시 필요 자료:',
      '- 신분증 사본 (앞면/뒷면)',
      '- 통장 사본',
      '- 계약서 전자 서명',
      '',
      '계약서 작성 완료 후 본사에서 검토하여 승인 절차를 진행합니다.',
      '',
      '문의사항이 있으시면 언제든지 연락주세요.',
      '',
      '감사합니다.',
      '크루즈닷 본사',
    ].join('\n');
  };

  const handleGenerateInviteMessage = async () => {
    if (!inviteForm.name.trim() || !inviteForm.phone.trim()) {
      showError('이름과 연락처를 모두 입력해주세요.');
      return;
    }

    if (!contractLink) {
      handleGenerateLink();
    }

    try {
      setGeneratingInvite(true);

      const message = buildInviteMessage(inviteForm.name, inviteForm.phone, contractLink!);
      setInviteMessage(message);

      try {
        await navigator.clipboard.writeText(message);
        showSuccess('초대 메시지가 생성되고 클립보드에 복사되었습니다.');
      } catch (clipboardError) {
        showSuccess('초대 메시지가 생성되었습니다. 아래 내용을 복사해 전송해주세요.');
      }
    } catch (error: any) {
      console.error('[ContractInviteModal] generate invite error', error);
      showError(error.message || '초대 메시지 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const dataUrlToFile = (dataUrl: string, defaultName: string) => {
    const parts = dataUrl.split(',');
    if (parts.length < 2) {
      throw new Error('잘못된 데이터 URL 형식입니다.');
    }
    const match = parts[0].match(/data:(.*?);base64/);
    const mimeType = match?.[1] || 'image/png';
    const binaryString = atob(parts[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new File([bytes], defaultName, { type: mimeType });
  };

  useEffect(() => {
    if (!showSignatureModal) {
      signaturePadRef.current?.off();
      signaturePadRef.current = null;
      return;
    }

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext('2d');
      if (context) {
        context.scale(ratio, ratio);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
      }
    };

    resizeCanvas();

    const pad = new SignaturePad(canvas, {
      backgroundColor: '#ffffff',
      penColor: '#2563eb',
      minWidth: 1.5,
      maxWidth: 3,
    });

    signaturePadRef.current = pad;

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      pad.off();
      signaturePadRef.current = null;
    };
  }, [showSignatureModal]);

  const uploadSignature = useCallback(async (file: File, options?: { previewDataUrl?: string }) => {
    setUploadingSignature(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      const response = await fetch('/api/affiliate/contracts/upload?type=signature', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || '파일 업로드에 실패했습니다.');
      }

      if (!json.url || !json.fileId) {
        throw new Error('업로드가 완료되었지만 파일 정보를 받지 못했습니다.');
      }

      const originalName = json.originalName || file.name;

      setContractForm((prev) => ({
        ...prev,
        signatureUrl: json.url,
        signatureOriginalName: originalName,
        signatureFileId: json.fileId,
      }));

      if (options?.previewDataUrl) {
        setSignaturePreview(options.previewDataUrl);
      }

      return true;
    } catch (error: any) {
      console.error('[ContractInviteModal] signature upload error', error);
      showError(error?.message || '파일 업로드 중 오류가 발생했습니다.');
      return false;
    } finally {
      setUploadingSignature(false);
    }
  }, []);

  const handleSignatureSave = useCallback(async () => {
    const pad = signaturePadRef.current;
    if (!pad) return;
    if (pad.isEmpty()) {
      showError('싸인을 먼저 입력해주세요.');
      return;
    }
    try {
      const dataUrl = pad.toDataURL('image/png');
      const fileName = `affiliate-signature-${Date.now()}.png`;
      const file = dataUrlToFile(dataUrl, fileName);
      const success = await uploadSignature(file, { previewDataUrl: dataUrl });
      if (success) {
        setShowSignatureModal(false);
        signaturePadRef.current?.clear();
      }
    } catch (error) {
      console.error('[ContractInviteModal] signature save error', error);
      showError('싸인 이미지를 처리하는 중 문제가 발생했습니다.');
    }
  }, [uploadSignature]);

  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingContract) return;

    if (uploadingSignature) {
      showError('싸인 업로드가 완료될 때까지 기다려주세요.');
      return;
    }

    if (!contractForm.name.trim() || !contractForm.phone.trim() || !contractForm.residentIdFront.trim() || !contractForm.residentIdBack.trim() || !contractForm.address.trim()) {
      showError('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (![contractForm.consentPrivacy, contractForm.consentNonCompete, contractForm.consentDbUse, contractForm.consentPenalty].every(Boolean)) {
      showError('모든 필수 동의 항목에 체크해주세요.');
      return;
    }

    if (!contractForm.signatureUrl.trim() || !contractForm.signatureFileId.trim()) {
      showError('계약서에 싸인을 그린 후 반드시 저장해주세요.');
      return;
    }

    if (!contractReadConfirmed) {
      showError('계약서 전문을 확인하고 "확인했습니다"에 체크해주세요.');
      return;
    }

    try {
      setSubmittingContract(true);
      const response = await fetch('/api/affiliate/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contractForm,
          contractType: contractType,
          invitedByProfileId: currentProfileId ?? undefined,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || '서버 오류가 발생했습니다.');
      }

      showSuccess('계약서가 접수되었습니다.');
      setShowContractFormModal(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('[ContractInviteModal] submit error', error);
      showError(error.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmittingContract(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-2xl font-bold text-gray-900">
              {getContractTypeIcon()} {getContractTypeLabel()} 계약서 링크 생성
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="text-xl text-gray-600" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* 계약서 타입별 미리보기 - 동적 처리 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiFileText className="text-blue-600" />
                계약서 미리보기
              </h3>
              <div className="space-y-2 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${contractType === 'BRANCH_MANAGER' ? 'bg-purple-100 text-purple-700' :
                      contractType === 'CRUISE_STAFF' ? 'bg-green-100 text-green-700' :
                        contractType === 'SUBSCRIPTION_AGENT' ? 'bg-orange-100 text-orange-700' :
                          contractTypeInfo?.isCustom ? 'bg-indigo-100 text-indigo-700' :
                            'bg-blue-100 text-blue-700'
                      }`}>
                      {getContractTypeIcon()} {getContractTypeLabel()}
                    </span>
                    <span className="text-gray-700">필요한 계약서:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-4">
                    <li>{contractTypeInfo?.title || getContractTypeLabel()} 계약서 (필수)</li>
                    {contractTypeInfo?.price && (
                      <li className="text-blue-600 font-medium">가격: {contractTypeInfo.price}</li>
                    )}
                  </ul>
                  {contractType === 'SUBSCRIPTION_AGENT' ? (
                    <p className="text-xs text-gray-500 mt-1">※ 판매원 아이디(gestX)로 생성됩니다</p>
                  ) : contractType === 'BRANCH_MANAGER' ? (
                    <p className="text-xs text-gray-500 mt-1">※ 대리점장 아이디(bossX)로 생성됩니다</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">※ 판매원 아이디(userX)로 생성됩니다</p>
                  )}
                  <a
                    href={`/affiliate/contract?type=${contractType}${currentProfileId ? `&invitedBy=${currentProfileId}` : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 text-blue-600 hover:text-blue-700 text-xs font-semibold"
                  >
                    <FiExternalLink /> 계약서 페이지 미리보기
                  </a>
                </div>
              </div>
            </div>

            {/* 이름, 연락처 입력 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {getContractTypeLabel()} 이름 *
                </label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 홍길동"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {getContractTypeLabel()} 연락처 *
                </label>
                <input
                  type="text"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <button
                onClick={handleGenerateLink}
                disabled={!inviteForm.name.trim() || !inviteForm.phone.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <FiFileText /> 계약서 링크 생성
              </button>
            </div>

            {/* 생성된 링크 및 액션 */}
            {linkGenerated && contractLink && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <FiFileText /> 계약서 링크
                </h3>
                <p className="break-all font-mono text-sm text-blue-700 bg-white p-3 rounded border border-blue-200">
                  {contractLink}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleOpenContractForm}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
                  >
                    <FiFileText /> 계약서 작성하기
                  </button>
                  <button
                    onClick={handleOpenInviteMessageModal}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-purple-700"
                  >
                    <FiSend /> 초대 메시지 생성
                  </button>
                  <button
                    onClick={handleCopyContractLink}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <FiCopy /> 링크 복사
                  </button>
                  <a
                    href={contractLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <FiExternalLink /> 새 탭에서 열기
                  </a>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  위 링크를 판매원에게 전달하여 계약서를 작성하도록 안내할 수 있습니다. 계약서 작성 완료 후 가입이 완료됩니다.
                </p>
              </div>
            )}

            {/* 기존 판매원 선택 (선택사항) */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">
                  기존 판매원 선택 (선택사항)
                </label>
                <button
                  onClick={loadProfiles}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  목록 불러오기
                </button>
              </div>
              {loadingProfiles ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : profiles.length > 0 ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        setSelectedProfile(profile);
                        setInviteForm((prev) => ({
                          ...prev,
                          name: profile.nickname || profile.displayName || prev.name,
                        }));
                        if (profile.user?.mallUserId) {
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          setContractLink(`${baseUrl}/partner/${profile.user.mallUserId}/contract`);
                          setLinkGenerated(true);
                        } else {
                          handleGenerateLink();
                        }
                      }}
                      className={`w-full text-left px-4 py-2 border-b border-gray-100 hover:bg-blue-50 transition-colors text-sm ${selectedProfile?.id === profile.id ? 'bg-blue-100 border-blue-300' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {profile.nickname || profile.displayName || '이름 없음'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {profile.affiliateCode} | {profile.type}
                          </p>
                        </div>
                        {selectedProfile?.id === profile.id && (
                          <FiCheckCircle className="text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 계약서 작성 폼 모달 */}
      {showContractFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">계약서 작성</h2>
              <button
                onClick={() => setShowContractFormModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmitContract} className="p-6 space-y-6">
              {/* 계약서 전문 확인 */}
              <section className="rounded-xl bg-gray-50 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">계약서 전문 확인</h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowContractTextModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <FiFileText /> 계약서 전문 보기
                  </button>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contractReadConfirmed}
                      onChange={(e) => setContractReadConfirmed(e.target.checked)}
                      className="mt-1 h-4 w-4"
                      required
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-semibold">계약서 전문을 확인했습니다.</span>
                      <br />
                      <span className="text-xs text-gray-500">계약서 전문을 읽고 모든 내용을 이해했으며 동의합니다.</span>
                    </span>
                  </label>
                </div>
              </section>

              {/* 기본 정보 */}
              <section className="rounded-xl bg-gray-50 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">기본 정보</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">성명 *</span>
                    <input
                      value={contractForm.name}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="예: 홍길동"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">연락처 *</span>
                    <input
                      value={contractForm.phone}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="010-0000-0000"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">이메일</span>
                    <input
                      value={contractForm.email}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="example@cruisedot.com"
                      type="email"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    <label className="col-span-2 flex flex-col gap-1 text-sm text-gray-700">
                      <span className="font-semibold">주민등록번호 앞 6자리 *</span>
                      <input
                        value={contractForm.residentIdFront}
                        onChange={(e) => setContractForm((prev) => ({ ...prev, residentIdFront: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                        placeholder="예: 900101"
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </label>
                    <label className="col-span-3 flex flex-col gap-1 text-sm text-gray-700">
                      <span className="font-semibold">주민등록번호 뒤 7자리 *</span>
                      <input
                        value={contractForm.residentIdBack}
                        onChange={(e) => setContractForm((prev) => ({ ...prev, residentIdBack: e.target.value.replace(/[^0-9]/g, '').slice(0, 7) }))}
                        placeholder="예: 1234567"
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        required
                      />
                    </label>
                  </div>
                  <label className="md:col-span-2 flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">주소 *</span>
                    <textarea
                      value={contractForm.address}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, address: e.target.value }))}
                      rows={2}
                      placeholder="도로명 주소를 입력해주세요"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                </div>
              </section>

              {/* 정산 계좌 정보 */}
              <section className="rounded-xl bg-gray-50 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">정산 계좌 정보</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">은행명</span>
                    <input
                      value={contractForm.bankName}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, bankName: e.target.value }))}
                      placeholder="예: 국민은행"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">계좌번호</span>
                    <input
                      value={contractForm.bankAccount}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, bankAccount: e.target.value }))}
                      placeholder="예: 123456-78-901234"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">예금주</span>
                    <input
                      value={contractForm.bankAccountHolder}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, bankAccountHolder: e.target.value }))}
                      placeholder="예: 홍길동"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>
              </section>

              {/* 계약서 싸인 */}
              <section className="rounded-xl bg-gray-50 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">계약서 싸인</h3>
                <div className="space-y-4 text-sm text-gray-700">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSignatureModal(true)}
                      disabled={uploadingSignature}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      {uploadingSignature ? '저장 중...' : '싸인 그리기'}
                    </button>
                    {contractForm.signatureUrl && contractForm.signatureFileId && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setContractForm((prev) => ({ ...prev, signatureUrl: '', signatureOriginalName: '', signatureFileId: '' }));
                            setSignaturePreview('');
                          }}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                        >
                          싸인 초기화
                        </button>
                        <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <FiCheckCircle /> {contractForm.signatureOriginalName || '싸인 저장됨'}
                        </span>
                      </>
                    )}
                  </div>

                  {signaturePreview && contractForm.signatureUrl && (
                    <div className="rounded-lg border-2 border-green-200 bg-green-50/30 p-4">
                      <p className="mb-2 text-xs font-semibold text-green-800">저장된 싸인 미리보기:</p>
                      <div className="rounded-lg bg-white p-3 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={signaturePreview} alt="서명 미리보기" className="h-32 w-auto" />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 필수 동의 */}
              <section className="rounded-xl bg-gray-50 p-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">필수 동의</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={contractForm.consentPrivacy}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, consentPrivacy: e.target.checked }))}
                      className="mt-1 h-4 w-4"
                      required
                    />
                    <span>
                      <span className="font-semibold">개인정보 및 고객 DB 사용 제한에 동의합니다.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={contractForm.consentNonCompete}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, consentNonCompete: e.target.checked }))}
                      className="mt-1 h-4 w-4"
                      required
                    />
                    <span>
                      <span className="font-semibold">경업 및 리크루팅 금지 조항에 동의합니다.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={contractForm.consentDbUse}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, consentDbUse: e.target.checked }))}
                      className="mt-1 h-4 w-4"
                      required
                    />
                    <span>
                      <span className="font-semibold">고객 DB 보안 및 반환 의무를 준수합니다.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={contractForm.consentPenalty}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, consentPenalty: e.target.checked }))}
                      className="mt-1 h-4 w-4"
                      required
                    />
                    <span>
                      <span className="font-semibold">위반 시 손해배상 및 위약벌 조항을 이해하고 동의합니다.</span>
                    </span>
                  </label>
                </div>
              </section>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowContractFormModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                  disabled={submittingContract}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submittingContract || uploadingSignature}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {submittingContract ? '접수 중...' : '계약서 접수하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 초대 메시지 생성 모달 */}
      {showInviteMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-900">계약서 작성 초대 메시지 생성</h2>
              <button
                onClick={() => {
                  setShowInviteMessageModal(false);
                  setInviteMessage('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 판매원 정보 */}
              {inviteForm.name && inviteForm.phone && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">판매원 정보</h3>
                  <p className="text-sm font-bold text-gray-900">
                    이름: {inviteForm.name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    연락처: {inviteForm.phone}
                  </p>
                </div>
              )}

              {/* 이름, 전화번호 입력 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    받는 사람 이름 *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 홍길동"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    받는 사람 연락처 *
                  </label>
                  <input
                    type="text"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  onClick={handleGenerateInviteMessage}
                  disabled={generatingInvite || !inviteForm.name.trim() || !inviteForm.phone.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <FiSend /> 초대 메시지 생성 및 복사
                </button>
              </div>

              {/* 생성된 메시지 표시 */}
              {inviteMessage && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">생성된 초대 메시지</h3>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteMessage);
                          showSuccess('메시지가 클립보드에 복사되었습니다.');
                        } catch (error) {
                          showError('클립보드 복사에 실패했습니다.');
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <FiCopy /> 다시 복사
                    </button>
                  </div>
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <textarea
                      value={inviteMessage}
                      readOnly
                      rows={15}
                      className="w-full resize-none rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-800">
                      💡 위 메시지를 카카오톡이나 문자로 전송하세요. 메시지에 포함된 링크를 클릭하면 계약서 작성 페이지로 이동합니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 계약서 전문 모달 */}
      {showContractTextModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 px-4"
          onClick={() => setShowContractTextModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">크루즈닷 {affiliateTerm} 계약서 전문</h3>
              <button
                type="button"
                onClick={() => setShowContractTextModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>
            <div className="h-[70vh] overflow-y-auto px-6 py-4 text-sm leading-relaxed text-slate-700 space-y-6">
              {getContractSections(affiliateTerm).map((section) => (
                <div key={section.title} className="space-y-2">
                  <h4 className="font-semibold text-slate-900">{section.title}</h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {section.clauses.map((clause, index) => (
                      <li key={index}>{clause}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                ※ 본 계약서는 전자 서명으로 체결되며, 갑(크루즈닷)의 최종 승인을 통해 효력이 발생합니다.
              </p>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowContractTextModal(false);
                  setContractReadConfirmed(true);
                }}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 싸인 입력 모달 */}
      {showSignatureModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 px-4"
          onClick={() => {
            setShowSignatureModal(false);
            signaturePadRef.current?.clear();
          }}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">싸인 입력</h3>
              <button
                type="button"
                onClick={() => {
                  setShowSignatureModal(false);
                  signaturePadRef.current?.clear();
                }}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="h-48 w-full overflow-hidden rounded-xl bg-white shadow-inner">
                  <canvas ref={signatureCanvasRef} className="h-full w-full cursor-crosshair rounded-xl" />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  터치 패드, 마우스, 스타일러스를 이용해 싸인을 입력해주세요.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => signaturePadRef.current?.clear()}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  다시 그리기
                </button>
                <button
                  type="button"
                  onClick={handleSignatureSave}
                  disabled={uploadingSignature}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {uploadingSignature ? '저장 중...' : '싸인 저장하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

