'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/lib/api/use-toast';
import { X, Loader2, Copy } from 'lucide-react';

interface DuplicateContractModalProps {
  contractInstanceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newContractInstanceId: string) => void;
}

interface RecentContact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function DuplicateContractModal({
  contractInstanceId,
  isOpen,
  onClose,
  onSuccess,
}: DuplicateContractModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // 폼 상태
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [newSignerPhone, setNewSignerPhone] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  // 최근 연락처 목록
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);

  // 폼 에러
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 모달이 열릴 때 최근 Contact 조회
  useEffect(() => {
    if (!isOpen) return;

    const fetchRecentContacts = async () => {
      try {
        setIsLoadingContacts(true);
        const res = await fetch('/api/contract-instances/recent-contacts');
        if (!res.ok) throw new Error('Failed to fetch contacts');

        const data = await res.json();
        if (data.ok) {
          setRecentContacts(data.data || []);
        }
      } catch (err) {
        // 에러 발생 시 드롭다운 비활성화만 처리
        console.error('Failed to load recent contacts:', err);
      } finally {
        setIsLoadingContacts(false);
      }
    };

    fetchRecentContacts();
  }, [isOpen]);

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!newSignerName || newSignerName.trim().length < 2) {
      newErrors.newSignerName = '서명자명은 2글자 이상이어야 합니다';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newSignerEmail || !emailRegex.test(newSignerEmail)) {
      newErrors.newSignerEmail = '유효한 이메일 형식이 아닙니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 전화번호 자동 포맷
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // 숫자만 추출
    const cleaned = value.replace(/\D/g, '');

    // 포맷 적용
    if (cleaned.length === 10) {
      value = cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (cleaned.length === 11) {
      value = cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else {
      value = cleaned;
    }

    setNewSignerPhone(value);
  };

  // 기존 Contact 선택 시 필드 자동 채우기
  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = recentContacts.find((c) => c.id === contactId);
    if (contact) {
      setNewSignerName(contact.name);
      setNewSignerEmail(contact.email);
      setNewSignerPhone(contact.phone || '');
    }
  };

  // 복제 생성 요청
  const handleDuplicate = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch(`/api/contract-instances/${contractInstanceId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newSignerName,
          newSignerEmail,
          newSignerPhone: newSignerPhone || undefined,
          contactId: selectedContactId || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast({
          title: '복제 실패',
          description: errorData.error || '계약서 복제에 실패했습니다',
          variant: 'destructive',
        });
        return;
      }

      const data = await res.json();

      if (data.ok) {
        toast({
          title: '복제 완료',
          description: '새로운 계약 준비가 완료되었습니다. 즉시 서명요청을 보내세요.',
          variant: 'success',
        });

        // 폼 초기화
        setNewSignerName('');
        setNewSignerEmail('');
        setNewSignerPhone('');
        setSelectedContactId('');
        setErrors({});

        // 모달 닫기 및 콜백 실행
        onClose();
        if (onSuccess && data.newContractInstanceId) {
          onSuccess(data.newContractInstanceId);
        }
      }
    } catch (err) {
      toast({
        title: '오류',
        description: '오류 발생: ' + (err instanceof Error ? err.message : String(err)),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Copy className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">계약서 복제</h2>
              <p className="text-sm text-gray-600">이전 계약 내용을 유지하고 서명자만 변경합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1 hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* 본문 */}
        <div className="space-y-4 p-6">
          {/* 기존 고객 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기존 고객 선택 (선택)
            </label>
            <select
              value={selectedContactId}
              onChange={(e) => handleSelectContact(e.target.value)}
              disabled={isLoadingContacts || isLoading}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
            >
              <option value="">
                {isLoadingContacts ? '로드 중...' : '선택하거나 새로 입력하세요'}
              </option>
              {recentContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.email})
                </option>
              ))}
            </select>
            {isLoadingContacts && (
              <p className="mt-1 text-xs text-gray-500">최근 고객 목록을 불러오는 중입니다...</p>
            )}
          </div>

          {/* 서명자명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              서명자명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="홍길동"
              value={newSignerName}
              onChange={(e) => {
                setNewSignerName(e.target.value);
                if (errors.newSignerName) {
                  setErrors({ ...errors, newSignerName: '' });
                }
              }}
              disabled={isLoading}
              className={`w-full rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 ${
                errors.newSignerName ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {errors.newSignerName && (
              <p className="mt-1 text-xs text-red-600">{errors.newSignerName}</p>
            )}
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="hong@example.com"
              value={newSignerEmail}
              onChange={(e) => {
                setNewSignerEmail(e.target.value);
                if (errors.newSignerEmail) {
                  setErrors({ ...errors, newSignerEmail: '' });
                }
              }}
              disabled={isLoading}
              className={`w-full rounded-lg border px-4 py-2 text-sm focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 ${
                errors.newSignerEmail ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {errors.newSignerEmail && (
              <p className="mt-1 text-xs text-red-600">{errors.newSignerEmail}</p>
            )}
          </div>

          {/* 전화 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              전화 (선택)
            </label>
            <input
              type="tel"
              placeholder="010-1234-5678"
              value={newSignerPhone}
              onChange={handlePhoneChange}
              disabled={isLoading}
              className={`w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50`}
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex gap-3 border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleDuplicate}
            disabled={isLoading || !newSignerName || !newSignerEmail}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                복제 중...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                1클릭으로 완료됩니다
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
