'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FiCheckCircle, FiFileText, FiUser, FiArrowLeft, FiSend, FiRefreshCw, FiEye, FiEyeOff, FiClock, FiXCircle, FiTrash2, FiSearch, FiX, FiExternalLink, FiLock } from 'react-icons/fi';
import Link from 'next/link';
import dayjs from 'dayjs';
import { showError, showSuccess } from '@/components/ui/Toast';
import ContractInviteModal from '@/components/admin/ContractInviteModal';
import { getAffiliateTerm } from '@/lib/utils';

type AffiliateContract = {
  id: number;
  userId: number | null;
  name: string;
  phone: string;
  email?: string | null;
  address: string;
  bankName?: string | null;
  bankAccount?: string | null;
  bankAccountHolder?: string | null;
  status: string;
  submittedAt: string;
  reviewedAt?: string | null;
  consentPrivacy: boolean;
  consentNonCompete: boolean;
  consentDbUse: boolean;
  consentPenalty: boolean;
  metadata?: {
    signature?: {
      url?: string;
      originalName?: string;
      fileId?: string;
    };
    [key: string]: any;
  } | null;
  mentor?: {
    id: number;
    displayName: string | null;
    affiliateCode: string;
    branchLabel: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    type: string;
  } | null;
};

export default function MyContractClient({ partnerId }: { partnerId: string }) {
  const pathname = usePathname();
  const affiliateTerm = getAffiliateTerm(pathname || undefined);
  const [contract, setContract] = useState<AffiliateContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isBranchManager, setIsBranchManager] = useState(false);
  const [managedContracts, setManagedContracts] = useState<Array<{
    id: number;
    name: string;
    phone: string;
    email: string | null;
    status: string;
    submittedAt: string | null;
    completedAt: string | null;
  }>>([]);
  const [loadingManagedContracts, setLoadingManagedContracts] = useState(false);
  const [sendingPdfContractId, setSendingPdfContractId] = useState<number | null>(null);
  const [completingContractId, setCompletingContractId] = useState<number | null>(null);
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'submitted' | 'completed' | 'rejected'>('all');
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [showContractDetail, setShowContractDetail] = useState(false);
  const [loadingContractDetail, setLoadingContractDetail] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<number | null>(null);
  const [showSendContractModal, setShowSendContractModal] = useState(false);
  const [contractType, setContractType] = useState<'SALES_AGENT' | 'BRANCH_MANAGER' | 'CRUISE_STAFF' | 'PRIMARKETER'>('SALES_AGENT');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentProfileId, setCurrentProfileId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const loadContract = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/affiliate/my-contract');
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || '계약 정보를 불러올 수 없습니다.');
        }

        setContract(json.contract);
      } catch (error: any) {
        console.error('[MyContract] load error', error);
        showError(error.message || '계약 정보를 불러오는 중 문제가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    const checkBranchManager = async () => {
      try {
        const res = await fetch('/api/affiliate/my-profile');
        const json = await res.json();

        if (res.ok && json?.ok) {
          const profile = json.profile;
          setUserProfile(profile);
          setCurrentProfileId(profile?.id);

          if (profile?.type === 'BRANCH_MANAGER') {
            setIsBranchManager(true);
            setContractType('BRANCH_MANAGER');
            loadManagedContracts();
          } else if (profile?.type === 'SALES_AGENT') {
            setContractType('SALES_AGENT');
          }
        }
      } catch (error: any) {
        console.error('[MyContract] check branch manager error', error);
      }
    };

    loadContract();
    checkBranchManager();
  }, []);

  const loadManagedContracts = async () => {
    try {
      setLoadingManagedContracts(true);
      const res = await fetch('/api/partner/contracts');
      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '계약서 목록을 불러올 수 없습니다.');
      }

      setManagedContracts(json.contracts || []);
    } catch (error: any) {
      console.error('[MyContract] load managed contracts error', error);
      showError(error.message || '계약서 목록을 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoadingManagedContracts(false);
    }
  };

  const handleCompleteContract = async (contractId: number) => {
    if (!confirm('이 계약서를 완료하여 PDF를 이메일로 전송하시겠습니까?')) return;

    try {
      setCompletingContractId(contractId);
      const res = await fetch(`/api/partner/contracts/${contractId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!text) {
        throw new Error('Empty response');
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (parseError) {
        console.error('[MyContract] JSON parse error:', parseError, 'Response text:', text);
        throw new Error('Invalid JSON response from server');
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || '계약서 완료 처리에 실패했습니다.');
      }

      // 이메일 전송 성공 여부에 따라 메시지 표시
      if (json.emailSent) {
        showSuccess(json.message || '계약서가 완료되었고 이메일로 전송되었습니다.');
      } else {
        showSuccess(json.message || '계약서가 완료되었으나 이메일 전송에 실패했습니다.');
      }
      loadManagedContracts(); // 목록 새로고침

      // 완료 페이지로 리다이렉트 (새 창에서 열기) - 이메일 전송 실패해도 redirectUrl이 있으면 이동
      if (json.redirectUrl) {
        window.open(json.redirectUrl, '_blank');
      }
    } catch (error: any) {
      console.error('[MyContract] Complete contract error:', error);
      showError(error.message || '계약서 완료 처리 중 오류가 발생했습니다.');
    } finally {
      setCompletingContractId(null);
    }
  };

  const handleSendPdf = async (contractId: number) => {
    if (!confirm('계약서 PDF를 계약자 이메일 주소로 전송하시겠습니까? (본사 이메일은 참조로 추가됩니다)')) return;
    try {
      setSendingPdfContractId(contractId);

      // 타임아웃 설정 (60초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await fetch(`/api/partner/contracts/${contractId}/send-pdf`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          let errorJson;
          try {
            if (!errorText) {
              throw new Error('Empty response');
            }
            errorJson = JSON.parse(errorText);
          } catch (parseError) {
            console.error('[MyContract] JSON parse error:', parseError, 'Response text:', errorText);
            errorJson = { message: errorText || '서버 오류가 발생했습니다.' };
          }
          throw new Error(errorJson.message || errorJson.error || `서버 오류 (${res.status})`);
        }

        const text = await res.text();
        if (!text) {
          throw new Error('Empty response');
        }

        let json;
        try {
          json = JSON.parse(text);
        } catch (parseError) {
          console.error('[MyContract] JSON parse error:', parseError, 'Response text:', text);
          throw new Error('Invalid JSON response from server');
        }

        if (!json.ok) {
          throw new Error(json.message || json.error || 'PDF 전송에 실패했습니다.');
        }

        showSuccess(json.message || 'PDF가 성공적으로 전송되었습니다.');
        loadManagedContracts();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('PDF 전송 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        }
        throw fetchError;
      }
    } catch (error: any) {
      console.error('[MyContract] Send PDF error:', error);
      showError(error.message || 'PDF 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingPdfContractId(null);
    }
  };

  const handleReject = async (contractId: number) => {
    const reason = prompt('거부 사유를 입력하세요:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/partner/contracts/${contractId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '계약 거부에 실패했습니다.');
      }
      showSuccess('계약이 거부되었습니다.');
      loadManagedContracts();
    } catch (error: any) {
      console.error('[MyContract] reject error', error);
      showError(error.message || '계약 거부 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (contractId: number) => {
    if (!confirm('정말로 이 계약서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    try {
      setDeletingContractId(contractId);
      const res = await fetch(`/api/partner/contracts/${contractId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '삭제에 실패했습니다.');
      }
      showSuccess('계약서가 삭제되었습니다.');
      loadManagedContracts();
    } catch (error: any) {
      console.error('[MyContract] delete error', error);
      showError(error.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingContractId(null);
    }
  };

  const handleViewDetail = async (contractId: number) => {
    try {
      setLoadingContractDetail(true);
      const res = await fetch(`/api/partner/contracts/${contractId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '계약서 정보를 불러오지 못했습니다.');
      }
      setSelectedContract(json.contract);
      setShowContractDetail(true);
    } catch (error: any) {
      console.error('[MyContract] view detail error', error);
      showError(error.message || '계약서 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingContractDetail(false);
    }
  };

  const handleVoiceUpload = async (contractId: number, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/partner/contracts/${contractId}/upload-voice`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || '녹음 파일 업로드에 실패했습니다.');
      }

      showSuccess('녹음 파일이 업로드되었습니다.');

      // 관리 목록 새로고침
      loadManagedContracts();

      // 나의 계약에 업로드한 경우 페이지 새로고침
      if (contract && contractId === contract.id) {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('[MyContract] voice upload error', error);
      showError(error.message || '업로드 중 오류가 발생했습니다.');
    }
  };

  // 서명 URL 추출 - 여러 형식 지원
  const getSignatureUrl = () => {
    if (!contract?.metadata) return null;
    const metadata = contract.metadata as any;
    // 새로운 형식: metadata.signatures.main.url
    if (metadata?.signatures?.main?.url) {
      return metadata.signatures.main.url;
    }
    // 구 형식: metadata.signature.url
    if (metadata?.signature?.url) {
      return metadata.signature.url;
    }
    // 다른 형식들도 확인
    if (metadata?.signatures?.education?.url) {
      return metadata.signatures.education.url;
    }
    if (metadata?.signatures?.b2b?.url) {
      return metadata.signatures.b2b.url;
    }
    return null;
  };
  const signatureUrl = getSignatureUrl();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-sm text-slate-600">계약 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 계약서가 없어도 대리점장은 관리 기능을 사용할 수 있어야 함
  const showMyContractSection = !!contract;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      <div className="mx-auto w-full max-w-4xl px-4 pt-12">
        <header className="mb-8 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 shadow-xl shadow-slate-900/20">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
          >
            <FiArrowLeft /> 대시보드로 돌아가기
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <FiCheckCircle className="text-3xl" />
            <h1 className="text-3xl font-extrabold">
              {isBranchManager ? '계약서 관리' : `나의 ${affiliateTerm} 계약서`}
            </h1>
          </div>
          <p className="text-slate-300">
            {isBranchManager
              ? '판매원 계약서 관리 및 나의 계약 정보를 확인할 수 있습니다.'
              : '승인된 계약 정보와 서명을 확인할 수 있습니다.'}
          </p>
        </header>

        <div className="space-y-6">
          {/* 나의 계약서 정보 (있는 경우에만 표시) */}
          {showMyContractSection ? (
            <>
              {/* 기본 정보 */}
              <section className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <FiUser className="text-slate-600" />
                  계약자 정보
                </h2>
                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div>
                    <p className="font-semibold text-slate-500">성명</p>
                    <p className="text-slate-900">{contract.name}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">연락처</p>
                    <p className="text-slate-900">{contract.phone}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">이메일</p>
                    <p className="text-slate-900">{contract.email || '-'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">주소</p>
                    <p className="text-slate-900">{contract.address || '정보 없음'}</p>
                  </div>
                </div>
              </section>

              {/* 정산 계좌 정보 */}
              <section className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-lg font-bold text-slate-900 mb-4">정산 계좌 정보</h2>
                <div className="grid gap-4 md:grid-cols-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-500">은행명</p>
                    <p className="text-slate-900">{contract.bankName || '-'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">계좌번호</p>
                    <p className="text-slate-900">{contract.bankAccount || '-'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">예금주</p>
                    <p className="text-slate-900">{contract.bankAccountHolder || '-'}</p>
                  </div>
                </div>
              </section>

              {/* 계약서 서명 */}
              <section className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-lg font-bold text-slate-900 mb-4">계약서 서명</h2>
                {signatureUrl ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-6">
                      <div className="flex items-center justify-center">
                        <img
                          src={signatureUrl}
                          alt="나의 서명"
                          className="max-h-40 w-auto"
                        />
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowSignatureModal(true)}
                        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-blue-700"
                      >
                        서명 크게 보기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">
                    서명 정보가 없습니다.
                  </div>
                )}
              </section>

              {/* 필수 동의 확인 */}
              <section className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-lg font-bold text-slate-900 mb-4">필수 동의 항목</h2>
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentPrivacy ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <FiCheckCircle className="text-lg" />
                    <span>개인정보 처리 동의</span>
                  </div>
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentNonCompete ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <FiCheckCircle className="text-lg" />
                    <span>경업금지 조항 동의</span>
                  </div>
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentDbUse ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <FiCheckCircle className="text-lg" />
                    <span>DB 활용 동의</span>
                  </div>
                  <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${contract.consentPenalty ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <FiCheckCircle className="text-lg" />
                    <span>위약금 조항 동의</span>
                  </div>
                </div>
              </section>

              {/* 담당 멘토 정보 */}
              {contract.mentor && (
                <section className="rounded-3xl bg-white p-6 shadow-lg">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FiUser className="text-purple-600" />
                    담당 멘토
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-500">이름</p>
                      <p className="text-slate-900">{contract.mentor.displayName || '-'}</p>
                    </div>
                    {contract.mentor.branchLabel && (
                      <div>
                        <p className="font-semibold text-slate-500">지점명</p>
                        <p className="text-slate-900">{contract.mentor.branchLabel}</p>
                      </div>
                    )}
                    {contract.mentor.contactPhone && (
                      <div>
                        <p className="font-semibold text-slate-500">연락처</p>
                        <p className="text-slate-900">{contract.mentor.contactPhone}</p>
                      </div>
                    )}
                    {contract.mentor.contactEmail && (
                      <div>
                        <p className="font-semibold text-slate-500">이메일</p>
                        <p className="text-slate-900">{contract.mentor.contactEmail}</p>
                      </div>
                    )}
                    {contract.mentor.affiliateCode && (
                      <div>
                        <p className="font-semibold text-slate-500">{affiliateTerm} 코드</p>
                        <p className="text-slate-900">{contract.mentor.affiliateCode}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 계정 정보 (아이디/비밀번호) */}
              {(contract as any).accountInfo && (
                <section className="rounded-3xl bg-white p-6 shadow-lg">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FiLock className="text-green-600" />
                    계정 정보
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-500">아이디</p>
                      <p className="text-slate-900 font-mono">{(contract as any).accountInfo.mallUserId || '미생성'}</p>
                    </div>
                    {(contract as any).accountInfo.password && (
                      <div>
                        <p className="font-semibold text-slate-500">비밀번호</p>
                        <p className="text-slate-900 font-mono">{(contract as any).accountInfo.password}</p>
                      </div>
                    )}
                    {(contract as any).accountInfo.mallNickname && (
                      <div>
                        <p className="font-semibold text-slate-500">닉네임</p>
                        <p className="text-slate-900">{(contract as any).accountInfo.mallNickname}</p>
                      </div>
                    )}
                    {(contract as any).accountInfo.passwordGeneratedAt && (
                      <div>
                        <p className="font-semibold text-slate-500">생성일시</p>
                        <p className="text-slate-900">
                          {new Date((contract as any).accountInfo.passwordGeneratedAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 계약 상태 */}
              <section className="rounded-3xl bg-white p-6 shadow-lg">
                <h2 className="text-lg font-bold text-slate-900 mb-4">계약 상태</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 border border-green-200">
                    <span className="font-semibold text-green-800">계약 상태</span>
                    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-bold text-white ${contract.status === 'approved' || contract.status === 'completed'
                      ? 'bg-green-600'
                      : contract.status === 'terminated'
                        ? 'bg-red-600'
                        : 'bg-yellow-600'
                      }`}>
                      <FiCheckCircle />
                      {contract.status === 'approved' || contract.status === 'completed' ? '승인 완료' :
                        contract.status === 'terminated' ? '계약 해지' : '승인 대기 중'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="font-semibold text-slate-700">계약 접수일</span>
                    <span className="text-slate-600">{dayjs(contract.submittedAt).format('YYYY년 MM월 DD일')}</span>
                  </div>
                  {contract.reviewedAt && (
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="font-semibold text-slate-700">승인일</span>
                      <span className="text-slate-600">{dayjs(contract.reviewedAt).format('YYYY년 MM월 DD일')}</span>
                    </div>
                  )}
                  {(() => {
                    const metadata = contract.metadata as any;
                    const renewalDate = metadata?.renewalDate ? new Date(metadata.renewalDate) : null;
                    const renewalRequestStatus = metadata?.renewalRequestStatus || null;
                    const approvedDate = contract.reviewedAt ? new Date(contract.reviewedAt) : (contract.submittedAt ? new Date(contract.submittedAt) : null);

                    // 재계약 갱신일 계산 (승인일 또는 접수일로부터 1년)
                    let calculatedRenewalDate = renewalDate;
                    if (!calculatedRenewalDate && approvedDate) {
                      calculatedRenewalDate = new Date(approvedDate);
                      calculatedRenewalDate.setFullYear(calculatedRenewalDate.getFullYear() + 1);
                    }

                    // D-day 계산
                    const calculateDaysRemaining = (targetDate: Date | null) => {
                      if (!targetDate) return null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const target = new Date(targetDate);
                      target.setHours(0, 0, 0, 0);
                      const diffTime = target.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return diffDays;
                    };

                    const daysRemaining = calculatedRenewalDate ? calculateDaysRemaining(calculatedRenewalDate) : null;

                    return (
                      <>
                        {calculatedRenewalDate && (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                            <span className="font-semibold text-slate-700">재계약 갱신일</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600">{dayjs(calculatedRenewalDate).format('YYYY년 MM월 DD일')}</span>
                              {daysRemaining !== null && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${daysRemaining < 0
                                  ? 'bg-red-100 text-red-700'
                                  : daysRemaining <= 30
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-blue-100 text-blue-700'
                                  }`}>
                                  {daysRemaining < 0 ? `D+${Math.abs(daysRemaining)}` : `D-${daysRemaining}`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {renewalRequestStatus === 'PENDING' && (
                          <div className="flex items-center justify-between rounded-xl bg-yellow-50 px-4 py-3 border border-yellow-200">
                            <span className="font-semibold text-yellow-800">재계약 요청 상태</span>
                            <span className="text-yellow-700">재계약 신청 대기 중</span>
                          </div>
                        )}
                        {renewalRequestStatus === 'APPROVED' && (
                          <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3 border border-green-200">
                            <span className="font-semibold text-green-800">재계약 요청 상태</span>
                            <span className="text-green-700">재계약 승인 완료</span>
                          </div>
                        )}
                        {renewalRequestStatus === 'REJECTED' && (
                          <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 border border-red-200">
                            <span className="font-semibold text-red-800">재계약 요청 상태</span>
                            <span className="text-red-700">재계약 불가 - 계약 해지</span>
                          </div>
                        )}
                        {calculatedRenewalDate && daysRemaining !== null && daysRemaining <= 60 && daysRemaining > 0 && !renewalRequestStatus && (
                          <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 border border-blue-200">
                            <span className="font-semibold text-blue-800">재계약 갱신</span>
                            <button
                              onClick={async () => {
                                if (!confirm('재계약 갱신을 요청하시겠습니까?')) return;
                                try {
                                  const res = await fetch(`/api/partner/contracts/${contract.id}/renewal-request`, {
                                    method: 'POST',
                                    credentials: 'include',
                                  });
                                  const json = await res.json();
                                  if (!res.ok || !json.ok) {
                                    throw new Error(json.message || '재계약 요청에 실패했습니다.');
                                  }
                                  showSuccess('재계약 갱신 요청이 완료되었습니다.');
                                  // 페이지 새로고침
                                  window.location.reload();
                                } catch (error: any) {
                                  console.error('[MyContract] renewal request error', error);
                                  showError(error.message || '재계약 요청 중 오류가 발생했습니다.');
                                }
                              }}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              재계약 갱신 요청
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </section>

              {/* 계약서 PDF */}
              {(contract as any).pdfUrl && (
                <section className="rounded-3xl bg-blue-50 border border-blue-200 p-6 shadow-lg">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FiFileText className="text-blue-600" />
                    계약서 PDF
                  </h2>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      {contract.status === 'approved' || contract.status === 'completed'
                        ? '승인된 계약서 PDF를 확인하실 수 있습니다.'
                        : '계약서 PDF를 확인하실 수 있습니다.'}
                    </p>
                    <div className="flex gap-3">
                      <a
                        href={(contract as any).pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                      >
                        <FiExternalLink className="w-4 h-4" />
                        PDF 보기
                      </a>
                      <a
                        href={(contract as any).pdfUrl}
                        download
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <FiFileText className="w-4 h-4" />
                        PDF 다운로드
                      </a>
                    </div>
                  </div>
                </section>
              )}

              {/* 녹음 파일 관리 (나의 계약에 연결된 녹음) */}
              {contract && (
                <section className="rounded-3xl bg-white p-6 shadow-lg">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FiSend className="text-purple-600" />
                    녹음 파일 보관
                  </h2>
                  <div className="space-y-4">
                    {/* 업로드 버튼 */}
                    <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors">
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleVoiceUpload(contract.id, file);
                        }}
                      />
                      <FiSend className="w-4 h-4" />
                      녹음 파일 업로드
                    </label>

                    {/* 저장된 녹음 파일 목록 */}
                    {(contract as any).metadata?.voiceRecordings?.length > 0 ? (
                      <div className="mt-4">
                        {/* 판매원/대리점장 자신의 계약: 음성녹음보관 표시만 */}
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200">
                          <FiLock className="w-5 h-5 text-green-600" />
                          <p className="text-sm font-semibold text-green-700">
                            음성녹음보관 ({(contract as any).metadata.voiceRecordings.length}개 파일)
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">저장된 녹음 파일이 없습니다.</p>
                    )}
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="rounded-3xl bg-white p-8 shadow-lg text-center">
              <FiFileText className="mx-auto text-6xl text-slate-300 mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">나의 계약 정보 없음</h2>
              <p className="text-slate-600 mb-6">
                승인된 {affiliateTerm} 계약이 없습니다.
              </p>
            </section>
          )}

          {/* 계약서 관리 (대리점장만) */}
          {isBranchManager && (
            <section className="rounded-3xl bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 md:text-xl flex items-center gap-2">
                  <FiFileText className="text-indigo-600" />
                  계약서 관리
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setContractType('SALES_AGENT');
                      setShowSendContractModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md"
                  >
                    <FiSend className="text-base" />
                    판매원 계약서 보내기
                  </button>
                  <button
                    onClick={loadManagedContracts}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    <FiRefreshCw className="text-base" />
                    새로고침
                  </button>
                </div>
              </div>

              {/* 검색 및 필터 */}
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1 max-w-md">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="이름, 전화번호, 이메일 검색..."
                      value={contractSearch}
                      onChange={(e) => setContractSearch(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <select
                    value={contractStatusFilter}
                    onChange={(e) => setContractStatusFilter(e.target.value as 'all' | 'submitted' | 'completed' | 'rejected')}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="all">전체</option>
                    <option value="submitted">제출됨</option>
                    <option value="completed">완료됨</option>
                    <option value="rejected">거부됨</option>
                  </select>
                </div>
              </div>

              {/* 계약 목록 테이블 */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">신청자 정보</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">계약 만료</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">녹음 보관</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingManagedContracts ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent"></div>
                          <p className="mt-2 text-xs text-gray-500">불러오는 중...</p>
                        </td>
                      </tr>
                    ) : managedContracts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">
                          관리 중인 계약서가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      managedContracts
                        .filter(c => {
                          if (contractStatusFilter !== 'all' && c.status !== contractStatusFilter) return false;
                          if (contractSearch) {
                            const search = contractSearch.toLowerCase();
                            return (
                              c.name.toLowerCase().includes(search) ||
                              c.phone.includes(search) ||
                              (c.email && c.email.toLowerCase().includes(search))
                            );
                          }
                          return true;
                        })
                        .map((contract) => {
                          // 만료일 계산 (승인일로부터 1년)
                          const approvedAt = (contract as any).completedAt || contract.submittedAt;
                          let daysRemaining = null;
                          if (approvedAt) {
                            const endDate = new Date(approvedAt);
                            endDate.setFullYear(endDate.getFullYear() + 1);
                            const today = new Date();
                            const diffTime = endDate.getTime() - today.getTime();
                            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          }

                          return (
                            <tr key={contract.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{contract.name}</div>
                                <div className="text-sm text-gray-500">{contract.phone}</div>
                                <div className="text-xs text-gray-400">{contract.email || '-'}</div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${contract.status === 'completed' || contract.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : contract.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                  {contract.status === 'completed' || contract.status === 'approved' ? '완료' :
                                    contract.status === 'rejected' ? '거부됨' : '대기중'}
                                </span>
                                <div className="text-xs text-gray-500">
                                  {contract.submittedAt ? dayjs(contract.submittedAt).format('YYYY-MM-DD') : '-'}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {daysRemaining !== null ? (
                                  <span className={`text-xs font-bold ${daysRemaining < 0 ? 'text-red-600' : daysRemaining < 30 ? 'text-yellow-600' : 'text-green-600'
                                    }`}>
                                    {daysRemaining < 0 ? '만료됨' : `D-${daysRemaining}`}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                                    <input
                                      type="file"
                                      accept="audio/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleVoiceUpload(contract.id, file);
                                      }}
                                    />
                                    <FiSend className="w-3 h-3" /> 녹음 업로드
                                  </label>
                                  {(contract as any).metadata?.voiceRecordings?.length > 0 && (
                                    <div className="mt-1 space-y-1">
                                      {(contract as any).metadata.voiceRecordings.map((rec: any, idx: number) => (
                                        <a
                                          key={rec.id || idx}
                                          href={rec.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                          title={`${rec.uploadedBy} - ${new Date(rec.uploadedAt).toLocaleString('ko-KR')}`}
                                        >
                                          <FiFileText className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate max-w-[100px]">{rec.name}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleViewDetail(contract.id)}
                                    className="text-gray-400 hover:text-indigo-600"
                                    title="상세보기"
                                  >
                                    <FiFileText className="w-4 h-4" />
                                  </button>
                                  {contract.status === 'submitted' && (
                                    <>
                                      <button
                                        onClick={() => handleCompleteContract(contract.id)}
                                        disabled={!!completingContractId}
                                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                        title="승인 및 완료"
                                      >
                                        {completingContractId === contract.id ? (
                                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                        ) : (
                                          <FiCheckCircle className="w-4 h-4" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleReject(contract.id)}
                                        className="text-red-600 hover:text-red-900"
                                        title="거부"
                                      >
                                        <FiXCircle className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                  {(contract.status === 'completed' || contract.status === 'approved') && (
                                    <button
                                      onClick={() => handleSendPdf(contract.id)}
                                      disabled={!!sendingPdfContractId}
                                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                      title="PDF 이메일 전송"
                                    >
                                      {sendingPdfContractId === contract.id ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                      ) : (
                                        <FiSend className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {/* 대리점장은 판매원 계약서 삭제 불가 - 확인만 가능 */}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 계약서 보내기 모달 */}
          {
            isBranchManager && (
              <ContractInviteModal
                isOpen={showSendContractModal}
                onClose={() => setShowSendContractModal(false)}
                contractType={contractType}
                onSuccess={() => {
                  setShowSendContractModal(false);
                  loadManagedContracts();
                }}
              />
            )
          }

          {/* 계약서 상세보기 모달 */}
          {
            isBranchManager && showContractDetail && selectedContract && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-900">계약서 상세 정보</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selectedContract && handleSendPdf(selectedContract.id)}
                        disabled={!selectedContract || sendingPdfContractId === selectedContract.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <FiSend className="text-sm" />
                        {sendingPdfContractId === selectedContract?.id ? '전송 중...' : 'PDF로 보내기'}
                      </button>
                      <button
                        onClick={() => {
                          setShowContractDetail(false);
                          setSelectedContract(null);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <FiX className="text-xl text-gray-600" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* 기본 정보 */}
                    <section className="rounded-xl bg-gray-50 p-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">기본 정보</h3>
                      <div className="grid gap-4 md:grid-cols-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">성명:</span>
                          <span className="ml-2 text-gray-900">{selectedContract.name}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">연락처:</span>
                          <span className="ml-2 text-gray-900">{selectedContract.phone}</span>
                        </div>
                        {selectedContract.email && (
                          <div>
                            <span className="font-semibold text-gray-700">이메일:</span>
                            <span className="ml-2 text-gray-900">{selectedContract.email}</span>
                          </div>
                        )}
                        {selectedContract.residentId && (
                          <div>
                            <span className="font-semibold text-gray-700">주민등록번호:</span>
                            <span className="ml-2 text-gray-900">{selectedContract.residentId}</span>
                          </div>
                        )}
                        {selectedContract.address && (
                          <div className="md:col-span-2">
                            <span className="font-semibold text-gray-700">주소:</span>
                            <span className="ml-2 text-gray-900">{selectedContract.address}</span>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* 정산 계좌 정보 */}
                    {(selectedContract.bankName || selectedContract.bankAccount) && (
                      <section className="rounded-xl bg-gray-50 p-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">정산 계좌 정보</h3>
                        <div className="grid gap-4 md:grid-cols-2 text-sm">
                          {selectedContract.bankName && (
                            <div>
                              <span className="font-semibold text-gray-700">은행명:</span>
                              <span className="ml-2 text-gray-900">{selectedContract.bankName}</span>
                            </div>
                          )}
                          {selectedContract.bankAccount && (
                            <div>
                              <span className="font-semibold text-gray-700">계좌번호:</span>
                              <span className="ml-2 text-gray-900">{selectedContract.bankAccount}</span>
                            </div>
                          )}
                          {selectedContract.bankAccountHolder && (
                            <div>
                              <span className="font-semibold text-gray-700">예금주:</span>
                              <span className="ml-2 text-gray-900">{selectedContract.bankAccountHolder}</span>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* 계약서 상태 */}
                    <section className="rounded-xl bg-gray-50 p-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">계약서 상태</h3>
                      <div className="grid gap-4 md:grid-cols-2 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">상태:</span>
                          <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${selectedContract.status === 'completed' ? 'bg-purple-50 text-purple-700' :
                            selectedContract.status === 'submitted' ? 'bg-blue-50 text-blue-700' :
                              selectedContract.status === 'rejected' ? 'bg-red-50 text-red-700' :
                                'bg-gray-50 text-gray-700'
                            }`}>
                            {selectedContract.status === 'completed' ? <FiCheckCircle className="text-base" /> :
                              selectedContract.status === 'submitted' ? <FiClock className="text-base" /> :
                                selectedContract.status === 'rejected' ? <FiXCircle className="text-base" /> :
                                  <FiFileText className="text-base" />}
                            {selectedContract.status === 'completed' ? '완료됨' :
                              selectedContract.status === 'submitted' ? '제출됨' :
                                selectedContract.status === 'rejected' ? '거부됨' :
                                  selectedContract.status}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">제출일:</span>
                          <span className="ml-2 text-gray-900">
                            {selectedContract.submittedAt
                              ? dayjs(selectedContract.submittedAt).format('YYYY년 MM월 DD일 HH:mm')
                              : selectedContract.createdAt
                                ? dayjs(selectedContract.createdAt).format('YYYY년 MM월 DD일 HH:mm')
                                : '-'}
                          </span>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowContractDetail(false);
                        setSelectedContract(null);
                      }}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    >
                      닫기
                    </button>
                    {/* 대리점장은 판매원 계약서 삭제 불가 - 확인만 가능 */}
                  </div>
                </div>
              </div>
            )
          }
        </div >
      </div >

      {/* 서명 확대 모달 */}
      {
        showSignatureModal && signatureUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
            onClick={() => setShowSignatureModal(false)}
          >
            <div
              className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">나의 서명</h3>
                  <p className="text-xs text-slate-500">{contract.name}</p>
                </div>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
              <div className="px-6 py-8">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 flex items-center justify-center">
                  <img
                    src={signatureUrl}
                    alt="나의 서명"
                    className="max-w-full max-h-[60vh] object-contain"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                <a
                  href={signatureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  새 창에서 열기
                </a>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
