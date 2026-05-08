'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FiPlus, FiEdit, FiTrash2, FiUsers, FiX, FiUpload, FiDownload, FiArrowLeft, FiLoader, FiCode, FiCheck } from 'react-icons/fi';
import Link from 'next/link';
import { showSuccess, showError, showWarning } from '@/components/ui/Toast';

type CustomerGroup = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  parentGroupId?: number | null;
  productCode?: string | null;
  profileId?: number;
  createdAt: string;
  updatedAt?: string;
  funnelTalkIds?: number[] | null;
  funnelSmsIds?: number[] | null;
  funnelEmailIds?: number[] | null;
  reEntryHandling?: string | null;
  leadCount: number; // API returns leadCount instead of _count.members
  members?: Array<{
    id: number;
    user: {
      id: number;
      name: string | null;
      phone: string | null;
      email: string | null;
    };
  }>; // Optional: only available when explicitly loaded
  subGroups?: CustomerGroup[];
  scheduledMessages?: Array<{ id: number; title: string; isActive: boolean }>;
  affiliateProfile?: {
    id: number;
    displayName: string | null;
    type: string;
  } | null;
};

export default function PartnerCustomerGroupsPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.partnerId as string;

  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CustomerGroup | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<Array<{ id: number; name: string | null; phone: string | null }>>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isLoadingCustomerList, setIsLoadingCustomerList] = useState(false);

  // 고객 리스트 모달
  const [showCustomerListModal, setShowCustomerListModal] = useState(false);
  const [customerListGroup, setCustomerListGroup] = useState<CustomerGroup | null>(null);
  const [groupCustomers, setGroupCustomers] = useState<Array<{
    id: number;           // leadId
    leadId?: number;      // 명시적 leadId (API 응답에서 제공)
    customerName: string | null;
    phone: string | null;
    email?: string | null;
    groupInflowDate: string;
    daysSinceInflow: number;
    messageSentCount: number;
    status?: string;
    source?: string;
    notes?: string | null;
  }>>([]);
  const [customerListSearch, setCustomerListSearch] = useState('');
  const [customerListPage, setCustomerListPage] = useState(1);
  const [customerListTotal, setCustomerListTotal] = useState(0);
  const [releasingMemberId, setReleasingMemberId] = useState<number | null>(null);

  // 스크립트 모달
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptGroup, setScriptGroup] = useState<CustomerGroup | null>(null);
  const [groupScript, setGroupScript] = useState<string>('');
  const [isLoadingScript, setIsLoadingScript] = useState(false);

  // 새 고객 추가 관련 상태
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    customerName: '',
    customerPhone: '',
    status: 'NEW',
    notes: '',
    nextActionAt: '',
    createdAt: new Date().toISOString().split('T')[0],
  });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // 퍼널 설정 모달
  const [showFunnelModal, setShowFunnelModal] = useState(false);
  const [funnelSettingsGroup, setFunnelSettingsGroup] = useState<CustomerGroup | null>(null);

  // 퍼널 목록 (예약메시지 groupName 기반)
  const [funnelTalks, setFunnelTalks] = useState<Array<{ groupName: string; messages: Array<{ id: number; title: string }> }>>([]);
  const [funnelSms, setFunnelSms] = useState<Array<{ groupName: string; messages: Array<{ id: number; title: string }> }>>([]);
  const [funnelEmails, setFunnelEmails] = useState<Array<{ groupName: string; messages: Array<{ id: number; title: string }> }>>([]);

  // 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    parentGroupId: null as number | null,
    funnelTalkIds: [] as number[],
    funnelSmsIds: [] as number[],
    funnelEmailIds: [] as number[],
    reEntryHandling: 'time_change_info_change' as string,
  });

  // 그룹 목록 로드
  const loadGroups = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/partner/customer-groups', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setGroups(data.groups || []);
      } else {
        showError(data.error || '고객 그룹을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Failed to load customer groups:', error);
      showError('고객 그룹을 불러오는 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  // 고객 목록 로드 (AffiliateLead에서 User 정보 추출) - 고객 그룹 관리 전용 API 사용
  const loadAvailableCustomers = async () => {
    try {
      if (!selectedGroup) return;

      setIsLoadingCustomerList(true);
      // setAvailableCustomers([]); // 기존 목록 유지하며 로딩 (깜빡임 방지)

      // 이미 그룹에 속한 고객은 제외하고 나머지 고객만 표시
      // 성능을 위해 limit를 50으로 제한하고 검색 기능을 활용하도록 유도
      const searchParam = customerSearch ? `&search=${encodeURIComponent(customerSearch)}` : '';
      const response = await fetch(`/api/partner/customer-groups/customers?limit=50&groupId=${selectedGroup.id}${searchParam}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok && data.customers) {
        setAvailableCustomers(
          data.customers.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
          }))
        );
      } else {
        showError(data.error || '고객 목록을 불러오는 중 오류가 발생했습니다.');
        setAvailableCustomers([]);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
      showError('고객 목록을 불러오는 중 네트워크 오류가 발생했습니다.');
      setAvailableCustomers([]);
    } finally {
      setIsLoadingCustomerList(false);
    }
  };

  // 고객 검색어 변경 시 자동 검색 (debounce)
  useEffect(() => {
    if (!showAddMembersModal || !selectedGroup) return;

    const timer = setTimeout(() => {
      loadAvailableCustomers();
    }, 500);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // 그룹 생성/수정
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showWarning('그룹 이름을 입력해주세요.');
      return;
    }

    try {
      const url = editingGroup
        ? `/api/partner/customer-groups/${editingGroup.id}`
        : '/api/partner/customer-groups';
      const method = editingGroup ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.ok) {
        showSuccess(editingGroup ? '그룹이 수정되었습니다.' : '그룹이 생성되었습니다.');
        setShowModal(false);
        setEditingGroup(null);
        setFormData({
          name: '',
          description: '',
          color: '#3B82F6',
          parentGroupId: null,
          funnelTalkIds: [],
          funnelSmsIds: [],
          funnelEmailIds: [],
          reEntryHandling: 'time_change_info_change',
        });
        loadGroups();
      } else {
        showError(data.error || '그룹 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save group:', error);
      showError('그룹 저장 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 그룹 삭제
  const handleDelete = async (groupId: number) => {
    if (!confirm('정말 이 그룹을 삭제하시겠습니까?\n그룹에 속한 고객 정보는 삭제되지 않습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/customer-groups/${groupId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.ok) {
        showSuccess('그룹이 삭제되었습니다.');
        loadGroups();
      } else {
        showError(data.error || '그룹 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      showError('그룹 삭제 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 그룹 수정 모달 열기
  const handleEdit = (group: CustomerGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || '#3B82F6',
      parentGroupId: group.parentGroupId,
      funnelTalkIds: Array.isArray(group.funnelTalkIds) ? group.funnelTalkIds : [],
      funnelSmsIds: Array.isArray(group.funnelSmsIds) ? group.funnelSmsIds : [],
      funnelEmailIds: Array.isArray(group.funnelEmailIds) ? group.funnelEmailIds : [],
      reEntryHandling: group.reEntryHandling || 'time_change_info_change',
    });
    setShowModal(true);
  };

  // 퍼널 설정 모달 열기
  const handleFunnelSettings = async (group: CustomerGroup) => {
    setFunnelSettingsGroup(group);
    await loadFunnelLists();
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || '#3B82F6',
      parentGroupId: group.parentGroupId,
      funnelTalkIds: Array.isArray(group.funnelTalkIds) ? group.funnelTalkIds : [],
      funnelSmsIds: Array.isArray(group.funnelSmsIds) ? group.funnelSmsIds : [],
      funnelEmailIds: Array.isArray(group.funnelEmailIds) ? group.funnelEmailIds : [],
      reEntryHandling: group.reEntryHandling || 'time_change_info_change',
    });
    setShowFunnelModal(true);
  };

  // 예약 메시지 목록 로드 (groupName별로 그룹화)
  const loadFunnelLists = async () => {
    try {
      const response = await fetch('/api/partner/scheduled-messages', { credentials: 'include' });
      const data = await response.json();

      if (data.ok && data.messages) {
        const kakaoMessages = data.messages.filter((m: any) => m.sendMethod === 'kakao');
        const smsMessages = data.messages.filter((m: any) => m.sendMethod === 'sms' || m.sendMethod === 'cruise-guide');
        const emailMessages = data.messages.filter((m: any) => m.sendMethod === 'email');

        const groupByGroupName = (messages: any[]) => {
          const grouped = messages.reduce((acc: any, msg: any) => {
            const groupName = msg.groupName || '기타';
            if (!acc[groupName]) {
              acc[groupName] = [];
            }
            acc[groupName].push({ id: msg.id, title: msg.title });
            return acc;
          }, {});

          return Object.keys(grouped).map(groupName => ({
            groupName,
            messages: grouped[groupName],
          }));
        };

        setFunnelTalks(groupByGroupName(kakaoMessages));
        setFunnelSms(groupByGroupName(smsMessages));
        setFunnelEmails(groupByGroupName(emailMessages));
      }
    } catch (error) {
      console.error('Failed to load funnel lists:', error);
    }
  };

  // 고객 추가 모달 열기
  const handleAddMembers = async (group: CustomerGroup) => {
    setSelectedGroup(group);
    setSelectedCustomerIds([]);
    setCustomerSearch('');
    setShowNewCustomerForm(false);
    setNewCustomerForm({
      customerName: '',
      customerPhone: '',
      status: 'NEW',
      notes: '',
      nextActionAt: '',
      createdAt: new Date().toISOString().split('T')[0],
    });
    setShowAddMembersModal(true);
    await loadAvailableCustomers();
  };

  // 새 고객 생성 및 그룹에 추가 (판매원 고객 관리와 동일한 로직)
  const handleCreateAndAddCustomer = async () => {
    if (!selectedGroup) {
      showWarning('그룹이 선택되지 않았습니다.');
      return;
    }

    if (!newCustomerForm.customerName && !newCustomerForm.customerPhone) {
      showError('고객 이름 또는 연락처를 입력해주세요.');
      return;
    }

    setCreatingCustomer(true);
    try {
      const payload: Record<string, unknown> = {
        customerName: newCustomerForm.customerName,
        customerPhone: newCustomerForm.customerPhone,
        status: newCustomerForm.status || undefined,
        notes: newCustomerForm.notes || undefined,
      };

      if (newCustomerForm.createdAt) {
        // 유입날짜를 ISO 형식으로 변환
        const createdAtDate = new Date(newCustomerForm.createdAt);
        createdAtDate.setHours(0, 0, 0, 0);
        payload.createdAt = createdAtDate.toISOString();
      }

      if (newCustomerForm.nextActionAt) {
        // 다음 조치 예정일을 ISO 형식으로 변환 (날짜+시간)
        const nextActionDate = new Date(newCustomerForm.nextActionAt);
        payload.nextActionAt = nextActionDate.toISOString();
      }

      // 백업 컨텍스트 추가 (고객 그룹)
      payload.backupContext = 'group';

      const res = await fetch('/api/partner/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || '고객 추가에 실패했습니다.');
      }

      console.log('[Customer Groups] Created customer response:', json);

      // 생성된 고객의 leadId 확인 (API 응답에서)
      const createdCustomer = json.customer;
      const leadIdToAdd = createdCustomer?.leadId;

      if (leadIdToAdd) {
        console.log('[Customer Groups] Adding to group:', selectedGroup.id, 'leadId:', leadIdToAdd);
        // 그룹에 추가
        const addResponse = await fetch(`/api/partner/customer-groups/${selectedGroup.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ leadIds: [leadIdToAdd] }),
        });

        const addData = await addResponse.json();
        console.log('[Customer Groups] Add to group response:', addData);

        if (addResponse.ok && addData?.ok) {
          showSuccess('고객이 생성되고 그룹에 추가되었습니다.');
          setShowNewCustomerForm(false);
          setNewCustomerForm({
            customerName: '',
            customerPhone: '',
            status: 'NEW',
            notes: '',
            nextActionAt: '',
            createdAt: new Date().toISOString().split('T')[0],
          });
          // UI 갱신을 위해 목록 다시 불러오기
          await loadAvailableCustomers();
          loadGroups();
        } else {
          console.error('[Customer Groups] Failed to add to group:', addData);
          showWarning(`고객은 생성되었지만 그룹 추가에 실패했습니다: ${addData?.error || '알 수 없는 오류'}. 고객 목록에서 수동으로 추가해주세요.`);
          await loadAvailableCustomers();
        }
      } else {
        console.error('[Customer Groups] LeadId not found in response');
        showWarning('고객은 생성되었지만 Lead 정보를 찾을 수 없어 그룹에 추가하지 못했습니다. 고객 목록에서 수동으로 추가해주세요.');
        await loadAvailableCustomers();
      }
    } catch (error) {
      console.error('handleCreateAndAddCustomer error', error);
      showError(
        error instanceof Error ? error.message : '고객 추가에 실패했습니다.',
      );
    } finally {
      setCreatingCustomer(false);
    }
  };

  // 그룹에 고객 추가
  const handleAddMembersSubmit = async () => {
    if (!selectedGroup || selectedCustomerIds.length === 0) {
      showWarning('추가할 고객을 선택해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/partner/customer-groups/${selectedGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: selectedCustomerIds }),
      });

      const data = await response.json();

      if (data.ok) {
        if (data.skipped > 0) {
          showSuccess(`${data.added}명의 고객이 추가되었습니다. (${data.skipped}명은 이미 그룹에 포함되어 있습니다.)`);
        } else {
          showSuccess(`${data.added}명의 고객이 추가되었습니다.`);
        }
        setShowAddMembersModal(false);
        setSelectedGroup(null);
        setSelectedCustomerIds([]);
        loadGroups();
      } else {
        showError(data.error || '고객 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to add members:', error);
      showError('고객 추가 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 그룹에서 고객 제거
  const handleRemoveMember = async (groupId: number, userId: number) => {
    if (!confirm('이 고객을 그룹에서 제거하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/partner/customer-groups/${groupId}/members?userId=${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.ok) {
        showSuccess('고객이 그룹에서 제거되었습니다.');
        loadGroups();
      } else {
        showError(data.error || '고객 제거에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      showError('고객 제거 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 그룹별 고객 리스트 열기
  const handleViewCustomerList = async (group: CustomerGroup) => {
    setCustomerListGroup(group);
    setCustomerListSearch('');
    setCustomerListPage(1);
    setShowCustomerListModal(true);
    await loadGroupCustomers(group.id);
  };

  // 그룹별 고객 리스트 로드
  const loadGroupCustomers = async (groupId: number, pageNum: number = customerListPage) => {
    try {
      setIsLoadingCustomerList(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50',
      });
      if (customerListSearch) {
        params.set('search', customerListSearch);
      }

      const response = await fetch(`/api/partner/customer-groups/${groupId}/customers?${params}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.ok) {
        setGroupCustomers(data.customers || []);
        setCustomerListTotal(data.pagination?.total || 0);
        setCustomerListPage(data.pagination?.page || 1);
      } else {
        showError(data.error || '고객 리스트를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Failed to load group customers:', error);
      showError('고객 리스트를 불러오는 중 네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoadingCustomerList(false);
    }
  };

  // 고객 리스트 검색 (debounce)
  useEffect(() => {
    if (!showCustomerListModal || !customerListGroup) return;

    const timer = setTimeout(() => {
      setCustomerListPage(1);
      loadGroupCustomers(customerListGroup.id, 1);
    }, 500);

    return () => clearTimeout(timer);
  }, [customerListSearch]);

  // 그룹 해제 처리 (leadId 사용)
  const handleReleaseFromGroup = async (leadId: number, groupId: number) => {
    if (!confirm('이 고객을 그룹에서 해제하시겠습니까?')) {
      return;
    }

    setReleasingMemberId(leadId);
    try {
      const response = await fetch(`/api/partner/customer-groups/${groupId}/members?leadId=${leadId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      if (data.ok) {
        showSuccess('고객이 그룹에서 해제되었습니다.');
        // 고객 리스트 새로고침
        if (customerListGroup) {
          await loadGroupCustomers(customerListGroup.id);
        }
        // 그룹 목록도 새로고침
        await loadGroups();
      } else {
        showError(data.error || '그룹 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to release from group:', error);
      showError('그룹 해제 중 오류가 발생했습니다.');
    } finally {
      setReleasingMemberId(null);
    }
  };

  // 그룹별 스크립트 열기
  const handleViewScript = async (group: CustomerGroup) => {
    setScriptGroup(group);
    setShowScriptModal(true);
    setIsLoadingScript(true);
    setGroupScript('');

    try {
      const response = await fetch(`/api/partner/customer-groups/${group.id}/script`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (data.ok) {
        setGroupScript(data.script || '');
      } else {
        showError(data.error || '스크립트를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Failed to load script:', error);
      showError('스크립트를 불러오는 중 네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoadingScript(false);
    }
  };

  // 스크립트 복사
  const handleCopyScript = () => {
    navigator.clipboard.writeText(groupScript).then(() => {
      showSuccess('스크립트가 클립보드에 복사되었습니다.');
    }).catch(() => {
      showError('스크립트 복사에 실패했습니다.');
    });
  };

  // 엑셀 업로드
  const handleExcelUpload = async () => {
    if (!excelFile || !selectedGroup) {
      showWarning('파일을 선택해주세요.');
      return;
    }

    setIsUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('groupId', String(selectedGroup.id));

      const response = await fetch('/api/partner/customer-groups/excel-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (data.ok) {
        const summary = data.summary;
        if (summary.errors > 0) {
          showWarning(
            `업로드 완료!\n총 ${summary.total}건 중\n- 추가: ${summary.added}건\n- 건너뜀: ${summary.skipped}건\n- 오류: ${summary.errors}건\n\n오류가 발생한 항목은 확인해주세요.`,
            '엑셀 업로드 결과'
          );
        } else {
          showSuccess(
            `업로드 완료!\n총 ${summary.total}건 중\n- 추가: ${summary.added}건\n- 건너뜀: ${summary.skipped}건`,
            '엑셀 업로드 결과'
          );
        }
        setShowExcelUploadModal(false);
        setSelectedGroup(null);
        setExcelFile(null);
        loadGroups();
      } else {
        showError(data.error || '엑셀 파일 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to upload excel:', error);
      showError('엑셀 파일 업로드 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsUploadingExcel(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/partner/${partnerId}/dashboard`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="text-xl" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">고객 그룹 관리</h1>
            <p className="text-gray-600 mt-1">고객을 그룹으로 묶어 퍼널문자를 발송할 수 있습니다.</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null);
            setFormData({
              name: '',
              description: '',
              color: '#3B82F6',
              parentGroupId: null,
              funnelTalkIds: [],
              funnelSmsIds: [],
              funnelEmailIds: [],
              reEntryHandling: 'time_change_info_change',
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="text-lg" />
          그룹 생성
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <FiLoader className="inline-block animate-spin text-4xl text-blue-600 mb-4" />
          <p className="text-lg text-gray-600 font-medium">고객 그룹을 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FiUsers className="mx-auto text-4xl text-gray-400 mb-4" />
          <p className="text-gray-600">아직 생성된 그룹이 없습니다.</p>
          <button
            onClick={() => {
              setEditingGroup(null);
              setFormData({
                name: '',
                description: '',
                color: '#3B82F6',
                parentGroupId: null,
                funnelTalkIds: [],
                funnelSmsIds: [],
                funnelEmailIds: [],
                reEntryHandling: 'time_change_info_change',
              });
              setShowModal(true);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            첫 그룹 생성하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: group.color || '#3B82F6' }}
                  >
                    {group.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-500">
                      <FiUsers className="inline mr-1" />
                      {group.leadCount || 0}명
                      {group.scheduledMessages && group.scheduledMessages.length > 0 && (
                        <span className="ml-2 text-blue-600">
                          · {group.scheduledMessages.length}개의 퍼널문자
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(group)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="수정"
                  >
                    <FiEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-gray-600 mb-4">{group.description}</p>
              )}

              {/* 연결된 퍼널문자 표시 */}
              {group.scheduledMessages && group.scheduledMessages.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-2">연결된 퍼널문자</p>
                  <div className="space-y-1">
                    {group.scheduledMessages.map((msg) => (
                      <div key={msg.id} className="text-sm text-blue-600">
                        • {msg.title} {msg.isActive ? '✅' : '⏸️'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4">
                <button
                  onClick={() => handleViewCustomerList(group)}
                  className="w-full px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <FiUsers className="text-sm" />
                  고객 리스트
                </button>
                <button
                  onClick={() => handleAddMembers(group)}
                  className="w-full px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-semibold"
                >
                  고객 추가
                </button>
                <button
                  onClick={() => handleViewScript(group)}
                  className="w-full px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <FiCode className="text-sm" />
                  스크립트 보기
                </button>
                <button
                  onClick={() => handleFunnelSettings(group)}
                  className="w-full px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-semibold"
                >
                  퍼널 설정
                </button>
                <button
                  onClick={() => {
                    setSelectedGroup(group);
                    setExcelFile(null);
                    setShowExcelUploadModal(true);
                  }}
                  className="w-full px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <FiUpload className="text-sm" />
                  엑셀 일괄 등록
                </button>
              </div>

              {/* 멤버 목록은 "고객 리스트" 버튼을 통해 확인 가능 */}
              {group.members && group.members.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">그룹 멤버</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {group.members.slice(0, 5).map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span className="text-gray-700">
                          {member.user.name || '이름 없음'} ({member.user.phone || '전화번호 없음'})
                        </span>
                        <button
                          onClick={() => handleRemoveMember(group.id, member.user.id)}
                          className="text-red-500 hover:text-red-700"
                          title="제거"
                        >
                          <FiX />
                        </button>
                      </div>
                    ))}
                    {group.members.length > 5 && (
                      <p className="text-xs text-gray-500 text-center">
                        외 {group.members.length - 5}명
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 그룹 생성/수정 모달 - 관리자 페이지와 동일한 구조 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingGroup ? '그룹 수정' : '그룹 생성'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingGroup(null);
                  setFormData({
                    name: '',
                    description: '',
                    color: '#3B82F6',
                    parentGroupId: null,
                    funnelTalkIds: [],
                    funnelSmsIds: [],
                    funnelEmailIds: [],
                    reEntryHandling: 'time_change_info_change',
                  });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  그룹 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 동남아 고객, 일본 고객"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  그룹 설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="그룹에 대한 설명을 입력하세요"
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  그룹 색상
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-12 rounded-lg border border-gray-300 cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingGroup(null);
                    setFormData({
                      name: '',
                      description: '',
                      color: '#3B82F6',
                      parentGroupId: null,
                      funnelTalkIds: [],
                      funnelSmsIds: [],
                      funnelEmailIds: [],
                      reEntryHandling: 'time_change_info_change',
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingGroup ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 고객 추가 모달 - 관리자 페이지와 동일한 구조 */}
      {showAddMembersModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedGroup.name}에 고객 추가
              </h2>
              <button
                onClick={() => {
                  setShowAddMembersModal(false);
                  setSelectedGroup(null);
                  setSelectedCustomerIds([]);
                  setShowNewCustomerForm(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="p-6 border-b space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="고객 이름, 전화번호로 검색..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      loadAvailableCustomers();
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={loadAvailableCustomers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  검색
                </button>
              </div>

              {/* 고객 직접 추가 버튼 */}
              <button
                onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <FiPlus />
                {showNewCustomerForm ? '고객 추가 폼 닫기' : '고객 직접 추가'}
              </button>

              {/* 고객 직접 추가 폼 */}
              {showNewCustomerForm && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCustomerForm.customerName}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerName: e.target.value })}
                      placeholder="고객 이름"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCustomerForm.customerPhone}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customerPhone: e.target.value })}
                      placeholder="010-1234-5678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      비고
                    </label>
                    <input
                      type="text"
                      value={newCustomerForm.notes}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                      placeholder="비고 사항"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <button
                    onClick={handleCreateAndAddCustomer}
                    disabled={creatingCustomer || (!newCustomerForm.customerName && !newCustomerForm.customerPhone)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creatingCustomer ? (
                      <>
                        <FiLoader className="animate-spin" />
                        추가 중...
                      </>
                    ) : (
                      <>
                        <FiPlus />
                        고객 추가
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingCustomerList ? (
                <div className="text-center py-12">
                  <FiLoader className="inline-block animate-spin text-4xl text-blue-600 mb-4" />
                  <p className="text-gray-600">고객 목록을 불러오는 중...</p>
                </div>
              ) : !showNewCustomerForm && availableCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <FiUsers className="mx-auto text-4xl text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">추가할 수 있는 고객이 없습니다.</p>
                  <p className="text-sm text-gray-500">
                    {customerSearch ? (
                      <>검색 결과가 없습니다. 다른 검색어를 시도해보세요.</>
                    ) : (
                      <>
                        엑셀 일괄 등록을 사용하여 고객을 추가하거나,<br />
                        고객 관리 페이지에서 고객을 먼저 생성해주세요.
                      </>
                    )}
                  </p>
                </div>
              ) : !showNewCustomerForm ? (
                // 기존 고객 목록
                <div className="space-y-2">
                  {availableCustomers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>등록된 고객이 없습니다.</p>
                      <p className="text-sm mt-2">&quot;새 고객 추가&quot; 탭에서 고객을 추가해주세요.</p>
                    </div>
                  ) : (
                    availableCustomers.map((customer) => (
                      <label
                        key={customer.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(customer.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCustomerIds([...selectedCustomerIds, customer.id]);
                            } else {
                              setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== customer.id));
                            }
                          }}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {customer.name || '이름 없음'}
                          </p>
                          <p className="text-sm text-gray-500">{customer.phone || '전화번호 없음'}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowAddMembersModal(false);
                  setSelectedGroup(null);
                  setSelectedCustomerIds([]);
                  setShowNewCustomerForm(false);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              {!showNewCustomerForm ? (
                <button
                  onClick={handleAddMembersSubmit}
                  disabled={selectedCustomerIds.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selectedCustomerIds.length}명 추가
                </button>
              ) : (
                <button
                  onClick={handleCreateAndAddCustomer}
                  disabled={creatingCustomer || (!newCustomerForm.customerName && !newCustomerForm.customerPhone)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingCustomer ? '생성 중...' : '고객 생성 및 추가'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 일괄 등록 모달 - 관리자 페이지와 동일한 구조 */}
      {showExcelUploadModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedGroup.name} - 엑셀 일괄 등록
              </h2>
              <button
                onClick={() => {
                  setShowExcelUploadModal(false);
                  setSelectedGroup(null);
                  setExcelFile(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/partner/customer-groups/excel-upload', {
                        method: 'GET',
                        credentials: 'include',
                      });
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = '고객_일괄등록_양식.xlsx';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Failed to download template:', error);
                      alert('양식 파일 다운로드에 실패했습니다.');
                    }
                  }}
                  className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  <FiDownload className="text-lg" />
                  양식 파일 다운받기
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  파일 선택
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  엑셀 파일 형식만 지원됩니다 (.xlsx, .xls)
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">📋 사용 방법</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>위 양식파일을 다운로드 합니다.</li>
                  <li>양식파일의 항목에 맞게 고객 정보를 입력합니다.</li>
                  <li>저장 후 파일을 선택하여 업로드 합니다.</li>
                </ol>
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ 주의: 대용량일 경우 잠시 기다려주세요. (예: 3만건 - 약 1분)
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowExcelUploadModal(false);
                    setSelectedGroup(null);
                    setExcelFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleExcelUpload}
                  disabled={!excelFile || isUploadingExcel}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploadingExcel ? '업로드 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 퍼널 설정 모달 */}
      {showFunnelModal && funnelSettingsGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {funnelSettingsGroup.name} - 퍼널 설정
              </h2>
              <button
                onClick={() => {
                  setShowFunnelModal(false);
                  setFunnelSettingsGroup(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="space-y-6">
              {/* 퍼널톡 연결 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  퍼널톡 (카카오톡)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  연결할 예약메시지 그룹을 선택하세요 (Ctrl/Cmd + 클릭으로 여러 개 선택 가능)
                </p>
                {funnelTalks.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">등록된 카카오톡 예약메시지가 없습니다.</p>
                ) : (
                  <div>
                    <p className="text-xs text-purple-600 mb-1">
                      {funnelTalks.filter(group => group.messages.some(msg => formData.funnelTalkIds.includes(msg.id))).length}개 그룹 선택됨
                    </p>
                    <select
                      multiple
                      size={Math.min(funnelTalks.length, 10)}
                      value={funnelTalks
                        .filter(group => group.messages.some(msg => formData.funnelTalkIds.includes(msg.id)))
                        .map(group => group.groupName)}
                      onChange={(e) => {
                        const selectedGroupNames = Array.from(e.target.selectedOptions, option => option.value);
                        const allMessageIds: number[] = [];

                        funnelTalks.forEach(group => {
                          if (selectedGroupNames.includes(group.groupName)) {
                            allMessageIds.push(...group.messages.map(m => m.id));
                          }
                        });

                        setFormData({
                          ...formData,
                          funnelTalkIds: allMessageIds,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {funnelTalks.map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName} ({group.messages.length}개 메시지)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 퍼널문자 연결 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  퍼널문자 (SMS)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  연결할 예약메시지 그룹을 선택하세요 (Ctrl/Cmd + 클릭으로 여러 개 선택 가능)
                </p>
                {funnelSms.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">등록된 SMS 예약메시지가 없습니다.</p>
                ) : (
                  <div>
                    <p className="text-xs text-purple-600 mb-1">
                      {funnelSms.filter(group => group.messages.some(msg => formData.funnelSmsIds.includes(msg.id))).length}개 그룹 선택됨
                    </p>
                    <select
                      multiple
                      size={Math.min(funnelSms.length, 10)}
                      value={funnelSms
                        .filter(group => group.messages.some(msg => formData.funnelSmsIds.includes(msg.id)))
                        .map(group => group.groupName)}
                      onChange={(e) => {
                        const selectedGroupNames = Array.from(e.target.selectedOptions, option => option.value);
                        const allMessageIds: number[] = [];

                        funnelSms.forEach(group => {
                          if (selectedGroupNames.includes(group.groupName)) {
                            allMessageIds.push(...group.messages.map(m => m.id));
                          }
                        });

                        setFormData({
                          ...formData,
                          funnelSmsIds: allMessageIds,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {funnelSms.map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName} ({group.messages.length}개 메시지)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 퍼널메일 연결 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  퍼널메일 (Email)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  연결할 예약메시지 그룹을 선택하세요 (Ctrl/Cmd + 클릭으로 여러 개 선택 가능)
                </p>
                {funnelEmails.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">등록된 이메일 예약메시지가 없습니다.</p>
                ) : (
                  <div>
                    <p className="text-xs text-purple-600 mb-1">
                      {funnelEmails.filter(group => group.messages.some(msg => formData.funnelEmailIds.includes(msg.id))).length}개 그룹 선택됨
                    </p>
                    <select
                      multiple
                      size={Math.min(funnelEmails.length, 10)}
                      value={funnelEmails
                        .filter(group => group.messages.some(msg => formData.funnelEmailIds.includes(msg.id)))
                        .map(group => group.groupName)}
                      onChange={(e) => {
                        const selectedGroupNames = Array.from(e.target.selectedOptions, option => option.value);
                        const allMessageIds: number[] = [];

                        funnelEmails.forEach(group => {
                          if (selectedGroupNames.includes(group.groupName)) {
                            allMessageIds.push(...group.messages.map(m => m.id));
                          }
                        });

                        setFormData({
                          ...formData,
                          funnelEmailIds: allMessageIds,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      {funnelEmails.map((group) => (
                        <option key={group.groupName} value={group.groupName}>
                          {group.groupName} ({group.messages.length}개 메시지)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 재유입 처리 설정 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  재유입 처리 설정
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  고객이 해당그룹에 다시 들어올경우(해당그룹에 이미 존재할경우)
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reEntryHandling"
                      value="no_time_change_info_change"
                      checked={formData.reEntryHandling === 'no_time_change_info_change'}
                      onChange={(e) => setFormData({ ...formData, reEntryHandling: e.target.value })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">유입시간변경 X, 고객정보변경 O</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reEntryHandling"
                      value="no_time_change_no_info_change"
                      checked={formData.reEntryHandling === 'no_time_change_no_info_change'}
                      onChange={(e) => setFormData({ ...formData, reEntryHandling: e.target.value })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">유입시간변경 X, 고객정보변경 X</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reEntryHandling"
                      value="time_change_info_change"
                      checked={formData.reEntryHandling === 'time_change_info_change'}
                      onChange={(e) => setFormData({ ...formData, reEntryHandling: e.target.value })}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-gray-700">
                      유입시간변경 O, 고객정보변경 O (*0일차 퍼널 부터 다시 시작)
                    </span>
                  </label>
                </div>
              </div>

              {/* 저장 버튼 */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowFunnelModal(false);
                    setFunnelSettingsGroup(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/partner/customer-groups/${funnelSettingsGroup.id}/funnel-settings`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          funnelTalkIds: formData.funnelTalkIds,
                          funnelSmsIds: formData.funnelSmsIds,
                          funnelEmailIds: formData.funnelEmailIds,
                          reEntryHandling: formData.reEntryHandling,
                        }),
                      });

                      if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Error:', errorText);
                        showError(`퍼널 설정 저장에 실패했습니다. (${response.status})`);
                        return;
                      }

                      const data = await response.json();
                      if (data.ok) {
                        showSuccess('퍼널 설정이 저장되었습니다.');
                        setShowFunnelModal(false);
                        setFunnelSettingsGroup(null);
                        loadGroups();
                      } else {
                        showError(data.error || '퍼널 설정 저장에 실패했습니다.');
                      }
                    } catch (error) {
                      console.error('Failed to save funnel settings:', error);
                      showError('퍼널 설정 저장 중 네트워크 오류가 발생했습니다.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 고객 리스트 모달 */}
      {showCustomerListModal && customerListGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{customerListGroup.name} 고객 리스트</h2>
                <p className="text-sm text-gray-500 mt-1">총 {customerListTotal}명</p>
              </div>
              <button
                onClick={() => {
                  setShowCustomerListModal(false);
                  setCustomerListGroup(null);
                  setGroupCustomers([]);
                  setCustomerListSearch('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* 검색 바 */}
            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                placeholder="고객명, 전화번호, 이메일로 검색..."
                value={customerListSearch}
                onChange={(e) => setCustomerListSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 고객 리스트 */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingCustomerList ? (
                <div className="text-center py-12">
                  <FiLoader className="inline-block animate-spin text-3xl text-blue-600 mb-4" />
                  <p className="text-gray-600">고객 리스트를 불러오는 중...</p>
                </div>
              ) : groupCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <FiUsers className="mx-auto text-4xl text-gray-400 mb-4" />
                  <p className="text-gray-600">고객이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">고객명</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">전화번호</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">이메일</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">유입날짜</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">일차</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">문자 발송 횟수</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupCustomers.map((customer) => (
                        <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {customer.customerName || '이름 없음'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {customer.phone || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {customer.email || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {customer.groupInflowDate}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {customer.daysSinceInflow}일차
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {customer.messageSentCount || 0}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleReleaseFromGroup(customer.id, customerListGroup.id)}
                              disabled={releasingMemberId === customer.id}
                              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ml-auto"
                            >
                              {releasingMemberId === customer.id ? (
                                <>
                                  <FiLoader className="animate-spin" size={14} />
                                  해제 중...
                                </>
                              ) : (
                                <>
                                  <FiX size={14} />
                                  해제
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {!isLoadingCustomerList && customerListTotal > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {((customerListPage - 1) * 50) + 1} - {Math.min(customerListPage * 50, customerListTotal)} / {customerListTotal}명
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newPage = customerListPage - 1;
                      if (newPage >= 1) {
                        setCustomerListPage(newPage);
                        loadGroupCustomers(customerListGroup.id, newPage);
                      }
                    }}
                    disabled={customerListPage <= 1}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <button
                    onClick={() => {
                      const newPage = customerListPage + 1;
                      const totalPages = Math.ceil(customerListTotal / 50);
                      if (newPage <= totalPages) {
                        setCustomerListPage(newPage);
                        loadGroupCustomers(customerListGroup.id, newPage);
                      }
                    }}
                    disabled={customerListPage >= Math.ceil(customerListTotal / 50)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 스크립트 모달 */}
      {showScriptModal && scriptGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{scriptGroup.name} 스크립트</h2>
                <p className="text-sm text-gray-500 mt-1">이 스크립트를 HTML 페이지에 삽입하세요</p>
              </div>
              <button
                onClick={() => {
                  setShowScriptModal(false);
                  setScriptGroup(null);
                  setGroupScript('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* 스크립트 영역 */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingScript ? (
                <div className="text-center py-12">
                  <FiLoader className="inline-block animate-spin text-3xl text-blue-600 mb-4" />
                  <p className="text-gray-600">스크립트를 불러오는 중...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700">HTML 스크립트</label>
                      <button
                        onClick={handleCopyScript}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <FiDownload size={16} />
                        복사
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={groupScript}
                      className="w-full h-96 p-4 font-mono text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ fontFamily: 'Monaco, Menlo, "Courier New", monospace' }}
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">사용 방법</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                      <li>위 스크립트를 복사합니다.</li>
                      <li>HTML 페이지의 원하는 위치에 붙여넣습니다.</li>
                      <li>폼 제출 시 자동으로 &apos;{scriptGroup.name}&apos; 그룹에 고객이 추가됩니다.</li>
                      <li>그룹에 연결된 예약 메시지가 자동으로 활성화됩니다.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

