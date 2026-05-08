// components/admin/ManualContractFormModal.tsx
// 수동 계약서 입력/수정 모달

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiX,
  FiSave,
  FiSend,
  FiFileText,
  FiCopy,
  FiCheckCircle,
  FiCalendar,
  FiLink,
} from 'react-icons/fi';
import SignaturePad from 'signature_pad';
import { showError, showSuccess } from '@/components/ui/Toast';
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';

type ContractType = 'SALES_AGENT' | 'BRANCH_MANAGER' | 'CRUISE_STAFF' | 'PRIMARKETER' | 'SUBSCRIPTION_AGENT';

interface ManualContractFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId?: number; // 수정 모드인 경우
  contractType?: ContractType;
  onSuccess?: () => void;
}

interface ContractFormData {
  name: string;
  phone: string;
  email: string;
  residentIdFront: string;
  residentIdBack: string;
  address: string;
  bankName: string;
  bankAccount: string;
  bankAccountHolder: string;
  idCardPath: string;
  idCardOriginalName: string;
  bankbookPath: string;
  bankbookOriginalName: string;
  signatureUrl: string;
  signatureOriginalName: string;
  signatureFileId: string;
  signatureLink: string; // 싸인 링크
  signatureLinkExpiresAt: string; // 싸인 링크 만료일
  contractStartDate: string; // 계약 시작일
  contractEndDate: string; // 계약 종료일
  consentPrivacy: boolean;
  consentNonCompete: boolean;
  consentDbUse: boolean;
  consentPenalty: boolean;
  notes: string;
}

export default function ManualContractFormModal({
  isOpen,
  onClose,
  contractId,
  contractType = 'SALES_AGENT',
  onSuccess,
}: ManualContractFormModalProps) {
  const [formData, setFormData] = useState<ContractFormData>({
    name: '',
    phone: '',
    email: '',
    residentIdFront: '',
    residentIdBack: '',
    address: '',
    bankName: '',
    bankAccount: '',
    bankAccountHolder: '',
    idCardPath: '',
    idCardOriginalName: '',
    bankbookPath: '',
    bankbookOriginalName: '',
    signatureUrl: '',
    signatureOriginalName: '',
    signatureFileId: '',
    signatureLink: '',
    signatureLinkExpiresAt: '',
    contractStartDate: '',
    contractEndDate: '',
    consentPrivacy: false,
    consentNonCompete: false,
    consentDbUse: false,
    consentPenalty: false,
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSignatureLinkModal, setShowSignatureLinkModal] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState('');
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [generatedSignatureLink, setGeneratedSignatureLink] = useState('');

  // 수정 모드: 기존 계약서 데이터 로드
  useEffect(() => {
    if (isOpen && contractId) {
      loadContractData();
    } else if (isOpen) {
      // 새 계약서: 폼 초기화
      resetForm();
    }
  }, [isOpen, contractId]);

  const loadContractData = async () => {
    try {
      const res = await fetch(`/api/admin/affiliate/contracts/${contractId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json?.ok && json?.contract) {
        const contract = json.contract;
        setFormData({
          name: contract.name || '',
          phone: contract.phone || '',
          email: contract.email || '',
          residentIdFront: contract.residentId ? contract.residentId.substring(0, 6) : '',
          residentIdBack: contract.residentId ? contract.residentId.substring(6) : '',
          address: contract.address || '',
          bankName: contract.bankName || '',
          bankAccount: contract.bankAccount || '',
          bankAccountHolder: contract.bankAccountHolder || '',
          idCardPath: contract.idCardPath || '',
          idCardOriginalName: contract.idCardOriginalName || '',
          bankbookPath: contract.bankbookPath || '',
          bankbookOriginalName: contract.bankbookOriginalName || '',
          signatureUrl: contract.signatureUrl || '',
          signatureOriginalName: contract.signatureOriginalName || '',
          signatureFileId: contract.signatureFileId || '',
          signatureLink: contract.signatureLink || '',
          signatureLinkExpiresAt: contract.signatureLinkExpiresAt 
            ? new Date(contract.signatureLinkExpiresAt).toISOString().split('T')[0]
            : '',
          contractStartDate: contract.contractStartDate
            ? new Date(contract.contractStartDate).toISOString().split('T')[0]
            : '',
          contractEndDate: contract.contractEndDate
            ? new Date(contract.contractEndDate).toISOString().split('T')[0]
            : '',
          consentPrivacy: contract.consentPrivacy || false,
          consentNonCompete: contract.consentNonCompete || false,
          consentDbUse: contract.consentDbUse || false,
          consentPenalty: contract.consentPenalty || false,
          notes: contract.notes || '',
        });
        if (contract.signatureUrl) {
          setSignaturePreview(contract.signatureUrl);
        }
      }
    } catch (error: any) {
      logger.error('[ManualContractForm] Load error:', error);
      showError('계약서 데이터를 불러오는데 실패했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      residentIdFront: '',
      residentIdBack: '',
      address: '',
      bankName: '',
      bankAccount: '',
      bankAccountHolder: '',
      idCardPath: '',
      idCardOriginalName: '',
      bankbookPath: '',
      bankbookOriginalName: '',
      signatureUrl: '',
      signatureOriginalName: '',
      signatureFileId: '',
      signatureLink: '',
      signatureLinkExpiresAt: '',
      contractStartDate: '',
      contractEndDate: '',
      consentPrivacy: false,
      consentNonCompete: false,
      consentDbUse: false,
      consentPenalty: false,
      notes: '',
    });
    setSignaturePreview('');
    setGeneratedSignatureLink('');
  };

  // 싸인 링크 생성
  const handleGenerateSignatureLink = async () => {
    try {
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const signatureLink = `${baseUrl}/affiliate/contract/sign?token=${token}`;

      setFormData(prev => ({
        ...prev,
        signatureLink,
        signatureLinkExpiresAt: expiresAt.toISOString().split('T')[0],
      }));
      setGeneratedSignatureLink(signatureLink);

      // 서버에 링크 저장 (임시)
      const res = await fetch('/api/admin/affiliate/contracts/signature-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          expiresAt: expiresAt.toISOString(),
          contractId: contractId || null,
          name: formData.name,
          phone: formData.phone,
        }),
      });

      if (res.ok) {
        showSuccess('싸인 링크가 생성되었습니다.');
      }
    } catch (error: any) {
      logger.error('[ManualContractForm] Generate link error:', error);
      showError('싸인 링크 생성 중 오류가 발생했습니다.');
    }
  };

  const handleCopySignatureLink = () => {
    if (formData.signatureLink || generatedSignatureLink) {
      navigator.clipboard.writeText(formData.signatureLink || generatedSignatureLink);
      showSuccess('싸인 링크가 클립보드에 복사되었습니다.');
    }
  };

  // 싸인 업로드
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

      setFormData((prev) => ({
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
      logger.error('[ManualContractForm] Signature upload error:', error);
      showError(error?.message || '파일 업로드 중 오류가 발생했습니다.');
      return false;
    } finally {
      setUploadingSignature(false);
    }
  }, []);

  // 싸인 캔버스 초기화
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
      logger.error('[ManualContractForm] Signature save error:', error);
      showError('싸인 이미지를 처리하는 중 문제가 발생했습니다.');
    }
  }, [uploadSignature]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 필수 항목 검증
    if (!formData.name.trim() || !formData.phone.trim() || !formData.residentIdFront.trim() || !formData.residentIdBack.trim() || !formData.address.trim()) {
      showError('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (![formData.consentPrivacy, formData.consentNonCompete, formData.consentDbUse, formData.consentPenalty].every(Boolean)) {
      showError('모든 필수 동의 항목에 체크해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);

      const residentId = formData.residentIdFront + formData.residentIdBack;

      const payload: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        residentId,
        address: formData.address.trim(),
        bankName: formData.bankName.trim() || null,
        bankAccount: formData.bankAccount.trim() || null,
        bankAccountHolder: formData.bankAccountHolder.trim() || null,
        idCardPath: formData.idCardPath || null,
        idCardOriginalName: formData.idCardOriginalName || null,
        bankbookPath: formData.bankbookPath || null,
        bankbookOriginalName: formData.bankbookOriginalName || null,
        signatureUrl: formData.signatureUrl || null,
        signatureOriginalName: formData.signatureOriginalName || null,
        signatureFileId: formData.signatureFileId || null,
        signatureLink: formData.signatureLink || null,
        signatureLinkExpiresAt: formData.signatureLinkExpiresAt 
          ? new Date(formData.signatureLinkExpiresAt).toISOString()
          : null,
        contractStartDate: formData.contractStartDate 
          ? new Date(formData.contractStartDate).toISOString()
          : null,
        contractEndDate: formData.contractEndDate
          ? new Date(formData.contractEndDate).toISOString()
          : null,
        consentPrivacy: formData.consentPrivacy,
        consentNonCompete: formData.consentNonCompete,
        consentDbUse: formData.consentDbUse,
        consentPenalty: formData.consentPenalty,
        notes: formData.notes.trim() || null,
        contractType,
        status: 'submitted',
      };

      const url = contractId
        ? `/api/admin/affiliate/contracts/${contractId}`
        : '/api/admin/affiliate/contracts/manual';
      const method = contractId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.message || '계약서 저장에 실패했습니다.');
      }

      showSuccess(contractId ? '계약서가 수정되었습니다.' : '계약서가 저장되었습니다.');
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      logger.error('[ManualContractForm] Submit error:', error);
      showError(error.message || '계약서 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl z-10">
            <h2 className="text-2xl font-bold text-gray-900">
              {contractId ? '계약서 수정' : '수동 계약서 입력'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="text-xl text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* 기본 정보 */}
            <section className="rounded-xl bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">기본 정보</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">성명 *</span>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 홍길동"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">연락처 *</span>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">이메일</span>
                  <input
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="example@cruisedot.com"
                    type="email"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <div className="grid grid-cols-5 gap-2">
                  <label className="col-span-2 flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">주민등록번호 앞 6자리 *</span>
                    <input
                      value={formData.residentIdFront}
                      onChange={(e) => setFormData(prev => ({ ...prev, residentIdFront: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                      placeholder="예: 900101"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                  <label className="col-span-3 flex flex-col gap-1 text-sm text-gray-700">
                    <span className="font-semibold">주민등록번호 뒤 7자리 *</span>
                    <input
                      value={formData.residentIdBack}
                      onChange={(e) => setFormData(prev => ({ ...prev, residentIdBack: e.target.value.replace(/[^0-9]/g, '').slice(0, 7) }))}
                      placeholder="예: 1234567"
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      required
                    />
                  </label>
                </div>
                <label className="md:col-span-2 flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">주소 *</span>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    rows={2}
                    placeholder="도로명 주소를 입력해주세요"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>
              </div>
            </section>

            {/* 계약 기간 */}
            <section className="rounded-xl bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FiCalendar /> 계약 기간 (수동 입력)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">계약 시작일</span>
                  <input
                    type="date"
                    value={formData.contractStartDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractStartDate: e.target.value }))}
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">계약 종료일</span>
                  <input
                    type="date"
                    value={formData.contractEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractEndDate: e.target.value }))}
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                계약 시작일과 종료일을 입력하면 해당 기간 동안 계약서가 활성화됩니다.
              </p>
            </section>

            {/* 정산 계좌 정보 */}
            <section className="rounded-xl bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">정산 계좌 정보</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">은행명</span>
                  <input
                    value={formData.bankName}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="예: 국민은행"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">계좌번호</span>
                  <input
                    value={formData.bankAccount}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
                    placeholder="예: 123456-78-901234"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  <span className="font-semibold">예금주</span>
                  <input
                    value={formData.bankAccountHolder}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankAccountHolder: e.target.value }))}
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
                    싸인 그리기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignatureLinkModal(true);
                    }}
                    className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
                  >
                    <FiLink className="inline mr-1" /> 싸인 링크 생성
                  </button>
                  {formData.signatureUrl && formData.signatureFileId && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, signatureUrl: '', signatureOriginalName: '', signatureFileId: '' }));
                          setSignaturePreview('');
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                      >
                        싸인 초기화
                      </button>
                      <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        <FiCheckCircle /> {formData.signatureOriginalName || '싸인 저장됨'}
                      </span>
                    </>
                  )}
                  {formData.signatureLink && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <FiLink /> 싸인 링크 생성됨
                    </span>
                  )}
                </div>

                {/* 싸인 링크 표시 */}
                {formData.signatureLink && (
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-blue-800">싸인 링크:</p>
                      <button
                        type="button"
                        onClick={handleCopySignatureLink}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <FiCopy /> 복사
                      </button>
                    </div>
                    <p className="text-xs font-mono text-blue-700 break-all">{formData.signatureLink}</p>
                    {formData.signatureLinkExpiresAt && (
                      <p className="text-xs text-blue-600 mt-1">
                        만료일: {new Date(formData.signatureLinkExpiresAt).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                  </div>
                )}

                {signaturePreview && formData.signatureUrl && (
                  <div className="rounded-lg border-2 border-green-200 bg-green-50/30 p-4">
                    <p className="mb-2 text-xs font-semibold text-green-800">저장된 싸인 미리보기:</p>
                    <div className="rounded-lg bg-white p-3 shadow-sm">
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
                    checked={formData.consentPrivacy}
                    onChange={(e) => setFormData(prev => ({ ...prev, consentPrivacy: e.target.checked }))}
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
                    checked={formData.consentNonCompete}
                    onChange={(e) => setFormData(prev => ({ ...prev, consentNonCompete: e.target.checked }))}
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
                    checked={formData.consentDbUse}
                    onChange={(e) => setFormData(prev => ({ ...prev, consentDbUse: e.target.checked }))}
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
                    checked={formData.consentPenalty}
                    onChange={(e) => setFormData(prev => ({ ...prev, consentPenalty: e.target.checked }))}
                    className="mt-1 h-4 w-4"
                    required
                  />
                  <span>
                    <span className="font-semibold">위반 시 손해배상 및 위약벌 조항을 이해하고 동의합니다.</span>
                  </span>
                </label>
              </div>
            </section>

            {/* 메모 */}
            <section className="rounded-xl bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">관리자 메모</h3>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="계약서 관련 메모를 입력하세요"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </section>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting || uploadingSignature}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
              >
                <FiSave />
                {isSubmitting ? '저장 중...' : contractId ? '수정하기' : '저장하기'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 싸인 그리기 모달 */}
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

      {/* 싸인 링크 생성 모달 */}
      {showSignatureLinkModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 px-4"
          onClick={() => setShowSignatureLinkModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">싸인 링크 생성</h3>
              <button
                type="button"
                onClick={() => setShowSignatureLinkModal(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-700">
                생성된 링크를 계약 당사자에게 전달하면, 해당 링크를 통해 싸인을 받을 수 있습니다.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateSignatureLink}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-purple-700"
                >
                  <FiLink className="inline mr-2" /> 싸인 링크 생성하기
                </button>
                {(formData.signatureLink || generatedSignatureLink) && (
                  <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-blue-800">생성된 링크:</p>
                      <button
                        type="button"
                        onClick={handleCopySignatureLink}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <FiCopy /> 복사
                      </button>
                    </div>
                    <p className="text-xs font-mono text-blue-700 break-all">
                      {formData.signatureLink || generatedSignatureLink}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      ⚠️ 이 링크는 7일 후 만료됩니다. 계약 당사자에게 전달하세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


