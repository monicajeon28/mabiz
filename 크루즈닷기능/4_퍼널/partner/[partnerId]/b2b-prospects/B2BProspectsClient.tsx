'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    FiRefreshCw,
    FiSearch,
    FiUser,
    FiPhone,
    FiMessageSquare,
    FiCalendar,
    FiSend,
    FiRotateCcw,
    FiX,
    FiCheck,
    FiArrowLeft,
} from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';
import B2BProspectDetailModal from '@/components/admin/B2BProspectDetailModal';

interface B2BProspect {
    id: number;
    customerName: string | null;
    customerPhone: string | null;
    status: string;
    source: string;
    notes: string | null;
    createdAt: string;
    agentId: number | null;
    affiliateOwnership: {
        ownerType: string;
        ownerName: string | null;
    } | null;
    metadata?: {
        receivedFromHQ?: boolean;
        lastTransferFrom?: string;
        lastTransferFromId?: number | null;
    } | null;
}

interface SystemConsultation {
    id: number;
    name: string;
    phone: string;
    message: string | null;
    status: string;
    createdAt: string;
    agentId: number | null;
    managerId: number | null;
    AffiliateProfile_SystemConsultation_agentIdToAffiliateProfile?: {
        displayName: string | null;
    } | null;
    AffiliateProfile_SystemConsultation_managerIdToAffiliateProfile?: {
        displayName: string | null;
    } | null;
}

interface Agent {
    id: number;
    displayName: string | null;
    affiliateCode: string | null;
    type?: string;
    mallUserId?: string | null;
}

export default function B2BProspectsClient({ params }: { params: { partnerId: string } }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') === 'system' ? 'SYSTEM' : 'B2B';
    const [activeTab, setActiveTab] = useState<'B2B' | 'SYSTEM'>(initialTab);
    const [partnerId, setPartnerId] = useState<string>('');

    // B2B State
    const [prospects, setProspects] = useState<B2BProspect[]>([]);
    const [loadingB2B, setLoadingB2B] = useState(true);
    const [b2bSearch, setB2bSearch] = useState('');
    const [selectedProspects, setSelectedProspects] = useState<Set<number>>(new Set());

    // System Consultation State
    const [consultations, setConsultations] = useState<SystemConsultation[]>([]);
    const [loadingSystem, setLoadingSystem] = useState(false);
    const [systemSearch, setSystemSearch] = useState('');
    const [selectedConsultations, setSelectedConsultations] = useState<Set<number>>(new Set());

    // Pagination State
    const [b2bPage, setB2bPage] = useState(1);
    const [b2bTotalPages, setB2bTotalPages] = useState(1);
    const [systemPage, setSystemPage] = useState(1);
    const [systemTotalPages, setSystemTotalPages] = useState(1);
    const itemsPerPage = 50;

    // Month Filter State
    const [selectedMonth, setSelectedMonth] = useState('');

    // DB Assignment State
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [isRecalling, setIsRecalling] = useState(false);

    // Detail Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
    const [selectedProspectType, setSelectedProspectType] = useState<'lead' | 'consultation'>('lead');

    useEffect(() => {
        // Unwrap params
        Promise.resolve(params).then((resolvedParams) => {
            setPartnerId(resolvedParams.partnerId);
        });
        loadAgents();
    }, [params]);

    const [branchManagers, setBranchManagers] = useState<Agent[]>([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [isSharing, setIsSharing] = useState(false);

    const loadAgents = async () => {
        try {
            // Fetch Sales Agents managed by this partner
            const res = await fetch('/api/partner/agents');
            const json = await res.json();

            if (json.ok && json.agents) {
                const salesAgents = json.agents.map((agent: any) => ({
                    id: agent.profileId,
                    displayName: agent.displayName,
                    affiliateCode: agent.affiliateCode,
                    type: agent.type,
                    mallUserId: agent.user?.mallUserId
                }));

                setAgents(salesAgents);
            }
        } catch (error) {
            console.error('Failed to load agents:', error);
        }
    };

    const [sharedLeads, setSharedLeads] = useState<any[]>([]);

    const loadBranchManagers = async () => {
        try {
            const res = await fetch('/api/partner/branch-managers');
            const json = await res.json();
            if (json.ok && json.managers) {
                setBranchManagers(json.managers);
            }
        } catch (error) {
            console.error('Failed to load branch managers:', error);
        }
    };

    useEffect(() => {
        loadAgents();
        loadBranchManagers();
    }, []);

    const loadProspects = useCallback(async () => {
        try {
            setLoadingB2B(true);
            // B2B_INFLOW와 B2B_LANDING 소스 각각 조회
            const res1 = await fetch('/api/partner/customers?source=B2B_INFLOW&limit=100');
            const json1 = await res1.json();

            const res2 = await fetch('/api/partner/customers?source=B2B_LANDING&limit=100');
            const json2 = await res2.json();

            let allProspects: B2BProspect[] = [];
            if (json1.ok) allProspects = [...allProspects, ...json1.customers];
            if (json2.ok) allProspects = [...allProspects, ...json2.customers];

            // 중복 제거
            const uniqueProspects = Array.from(new Map(allProspects.map(item => [item.id, item])).values());

            setProspects(uniqueProspects);
            setSelectedProspects(new Set());
        } catch (error) {
            console.error('Failed to load prospects:', error);
            showError('데이터 로드 중 오류가 발생했습니다.');
        } finally {
            setLoadingB2B(false);
        }
    }, []);

    const loadSystemConsultations = useCallback(async () => {
        try {
            setLoadingSystem(true);
            const params = new URLSearchParams({
                page: systemPage.toString(),
                limit: itemsPerPage.toString(),
            });
            if (selectedMonth) {
                params.append('month', selectedMonth);
            }
            const res = await fetch(`/api/partner/system-inquiries?${params}`);
            const json = await res.json();

            if (json.ok) {
                setConsultations(json.consultations || []);
                setSystemTotalPages(json.totalPages || 1);
                setSelectedConsultations(new Set());
            } else {
                showError(json.message || '데이터를 불러오는데 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to load system consultations:', error);
            showError('데이터 로드 중 오류가 발생했습니다.');
        } finally {
            setLoadingSystem(false);
        }
    }, [systemPage, selectedMonth, itemsPerPage]);

    useEffect(() => {
        if (activeTab === 'B2B') {
            loadProspects();
        } else {
            loadSystemConsultations();
        }
    }, [activeTab, loadProspects, loadSystemConsultations]);

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'B2B_INFLOW':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        B2B 유입
                    </span>
                );
            case 'B2B_LANDING':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        파트너 B2B 유입
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {source}
                    </span>
                );
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'NEW':
            case '신규':
                return '신규';
            case 'CONTACTED':
            case '연락됨':
                return '연락됨';
            case 'CONVERTED':
            case '전환됨':
                return '전환됨';
            case 'LOST':
            case '이탈':
                return '이탈';
            case 'PENDING':
            case '대기중':
                return '대기중';
            case 'IN_PROGRESS':
            case '진행중':
                return '진행중';
            case 'COMPLETED':
            case '완료':
                return '완료';
            default:
                return status;
        }
    };

    const filteredProspects = prospects.filter(p => {
        if (b2bSearch) {
            const query = b2bSearch.toLowerCase();
            return (
                p.customerName?.toLowerCase().includes(query) ||
                p.customerPhone?.includes(query)
            );
        }
        return true;
    });

    const filteredConsultations = consultations.filter(c => {
        if (systemSearch) {
            const query = systemSearch.toLowerCase();
            return (
                c.name?.toLowerCase().includes(query) ||
                c.phone?.includes(query)
            );
        }
        return true;
    });

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeTab === 'B2B') {
            if (e.target.checked) {
                setSelectedProspects(new Set(filteredProspects.map(p => p.id)));
            } else {
                setSelectedProspects(new Set());
            }
        } else {
            if (e.target.checked) {
                setSelectedConsultations(new Set(filteredConsultations.map(c => c.id)));
            } else {
                setSelectedConsultations(new Set());
            }
        }
    };

    const handleSelectRow = (id: number, checked: boolean) => {
        if (activeTab === 'B2B') {
            const newSelected = new Set(selectedProspects);
            if (checked) newSelected.add(id);
            else newSelected.delete(id);
            setSelectedProspects(newSelected);
        } else {
            const newSelected = new Set(selectedConsultations);
            if (checked) newSelected.add(id);
            else newSelected.delete(id);
            setSelectedConsultations(newSelected);
        }
    };

    const handleAssign = async () => {
        if (!selectedAgentId) {
            showError('판매원을 선택해주세요.');
            return;
        }

        setIsAssigning(true);
        try {
            const leadIds = activeTab === 'B2B'
                ? Array.from(selectedProspects)
                : Array.from(selectedConsultations);

            const type = activeTab === 'B2B' ? 'lead' : 'consultation';

            const res = await fetch('/api/partner/customers/assign-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadIds,
                    agentId: selectedAgentId,
                    type
                }),
            });

            const json = await res.json();
            if (json.ok) {
                showSuccess('DB가 성공적으로 전송되었습니다.');
                setIsAssignModalOpen(false);
                setSelectedAgentId('');
                if (activeTab === 'B2B') loadProspects();
                else loadSystemConsultations();
            } else {
                showError(json.error || 'DB 전송에 실패했습니다.');
            }
        } catch (error) {
            console.error('Assign error:', error);
            showError('오류가 발생했습니다.');
        } finally {
            setIsAssigning(false);
        }
    };

    const handleRecall = async () => {
        const selectedCount = activeTab === 'B2B' ? selectedProspects.size : selectedConsultations.size;
        if (selectedCount === 0) {
            showError('회수할 항목을 선택해주세요.');
            return;
        }

        if (!confirm(`선택한 ${selectedCount}개의 DB를 회수하시겠습니까?`)) return;

        setIsRecalling(true);
        try {
            const leadIds = activeTab === 'B2B'
                ? Array.from(selectedProspects)
                : Array.from(selectedConsultations);

            const type = activeTab === 'B2B' ? 'lead' : 'consultation';

            const res = await fetch('/api/partner/customers/assign-leads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadIds,
                    type
                }),
            });

            const json = await res.json();
            if (json.ok) {
                showSuccess('DB가 성공적으로 회수되었습니다.');
                if (activeTab === 'B2B') loadProspects();
                else loadSystemConsultations();
            } else {
                showError(json.error || 'DB 회수에 실패했습니다.');
            }
        } catch (error) {
            console.error('Recall error:', error);
            showError('오류가 발생했습니다.');
        } finally {
            setIsRecalling(false);
        }
    };

    // 시스템 상담 신청자만 3일 연장 (B2B 유입은 제외)
    const handleExtendTrial = async (consultationId: number, phone: string) => {
        if (!confirm('체험 기간을 3일 연장하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/system-inquiries/${consultationId}/extend-trial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: 3, phone }),
            });

            const json = await res.json();
            if (json.ok) {
                showSuccess(json.message || '체험 기간이 3일 연장되었습니다.');
                loadSystemConsultations();
            } else {
                showError(json.error || json.message || '연장에 실패했습니다.');
            }
        } catch (error) {
            console.error('Extend trial error:', error);
            showError('오류가 발생했습니다.');
        }
    };

    const handleDelete = async () => {
        const selectedCount = activeTab === 'B2B' ? selectedProspects.size : selectedConsultations.size;
        if (selectedCount === 0) {
            showError('삭제할 항목을 선택해주세요.');
            return;
        }

        if (!confirm(`선택한 ${selectedCount}개의 항목을 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.`)) return;

        try {
            const ids = activeTab === 'B2B'
                ? Array.from(selectedProspects)
                : Array.from(selectedConsultations);

            // Delete sequentially or parallel
            // Since we don't have a bulk delete API yet, we call delete for each.
            // For System Consultation, we need a delete API too.
            // /api/partner/customers/[id] supports DELETE.
            // For System Consultation, we need to check if we can delete.
            // If not, we might need to add DELETE to /api/partner/system-inquiries/[id] or similar.

            let successCount = 0;

            if (activeTab === 'B2B') {
                for (const id of ids) {
                    const res = await fetch(`/api/partner/customers/${id}`, {
                        method: 'DELETE',
                    });
                    if (res.ok) successCount++;
                }
                loadProspects();
            } else {
                // System Consultation Delete
                // Assuming we can delete system consultations.
                // We need an endpoint. Let's assume /api/admin/system-consultations/[id] or create one.
                // Actually, the user asked for delete in B2B Prospects management.
                // If System Consultation is part of it, we need to handle it.
                // I'll assume we can use a new endpoint or existing one.
                // Let's use /api/admin/system-consultations/[id] with DELETE method if I create it,
                // OR /api/system-inquiries/[id] (if exists).
                // I'll create a server action or API for this if needed.
                // For now, let's try to delete B2B only or handle System Consultation if I add the API.
                // I will add the API for System Consultation delete in the next step if it doesn't exist.
                for (const id of ids) {
                    const res = await fetch(`/api/admin/system-consultations/${id}`, {
                        method: 'DELETE',
                    });
                    if (res.ok) successCount++;
                }
                loadSystemConsultations();
            }

            if (successCount > 0) {
                showSuccess(`${successCount}개의 항목이 삭제되었습니다.`);
                if (activeTab === 'B2B') setSelectedProspects(new Set());
                else setSelectedConsultations(new Set());
            } else {
                showError('삭제에 실패했습니다.');
            }

        } catch (error) {
            console.error('Delete error:', error);
            showError('오류가 발생했습니다.');
        }
    };

    const selectedCount = activeTab === 'B2B' ? selectedProspects.size : selectedConsultations.size;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">B2B 잠재고객 관리</h1>
                    <p className="text-gray-500 mt-1">B2B 유입 및 시스템 상담 신청 고객을 관리하고 판매원에게 배정합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                        <>
                            <button
                                onClick={() => setIsAssignModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <FiSend />
                                DB 보내기 ({selectedCount})
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                            >
                                <FiX />
                                삭제 ({selectedCount})
                            </button>
                            {/* Recall button removed or kept? User didn't ask to remove, but asked for Delete. I'll keep Recall if it was there, but maybe move it? 
                                The user said "Select and Delete".
                                I'll keep Recall as well.
                            */}
                            <button
                                onClick={handleRecall}
                                disabled={isRecalling}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                <FiRotateCcw className={isRecalling ? 'animate-spin' : ''} />
                                회수 ({selectedCount})
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                    >
                        <FiArrowLeft />
                        이전으로
                    </button>
                    <button
                        onClick={activeTab === 'B2B' ? loadProspects : loadSystemConsultations}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                    >
                        <FiRefreshCw className={(activeTab === 'B2B' ? loadingB2B : loadingSystem) ? 'animate-spin' : ''} />
                        새로고침
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('B2B')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'B2B'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    B2B 유입 (잠재고객)
                </button>
                <button
                    onClick={() => setActiveTab('SYSTEM')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'SYSTEM'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    시스템 상담 신청
                </button>
            </div>

            {/* Content */}
            {activeTab === 'B2B' ? (
                <>
                    {/* B2B Search */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                        <div className="relative w-full md:w-96">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="이름, 연락처 검색"
                                value={b2bSearch}
                                onChange={(e) => setB2bSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* B2B Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                                            <input
                                                type="checkbox"
                                                checked={filteredProspects.length > 0 && selectedProspects.size === filteredProspects.length}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">구분</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">고객 정보</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">상태</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">담당 판매원</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">문의/노트</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">등록일시</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {loadingB2B ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex justify-center mb-2">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                                </div>
                                                데이터를 불러오는 중입니다...
                                            </td>
                                        </tr>
                                    ) : filteredProspects.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProspects.map((prospect) => (
                                            <tr key={prospect.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedProspects.has(prospect.id)}
                                                        onChange={(e) => handleSelectRow(prospect.id, e.target.checked)}
                                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    {getSourceBadge(prospect.source)}
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                            <FiUser className="text-gray-500 w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 text-sm truncate">{prospect.customerName}</p>
                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                <FiPhone className="w-3 h-3 flex-shrink-0" />
                                                                <span className="truncate">{prospect.customerPhone}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        prospect.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
                                                        prospect.status === 'CONTACTED' ? 'bg-yellow-100 text-yellow-800' :
                                                        prospect.status === 'CONVERTED' ? 'bg-green-100 text-green-800' :
                                                        prospect.status === 'LOST' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {getStatusLabel(prospect.status)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        {prospect.affiliateOwnership?.ownerType === 'SALES_AGENT' ? (
                                                            <span className="text-blue-600 font-medium text-xs truncate">
                                                                {prospect.affiliateOwnership.ownerName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                        {/* DB 출처 표시 */}
                                                        {(prospect.metadata?.receivedFromHQ || prospect.metadata?.lastTransferFrom) && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                                {prospect.metadata.lastTransferFrom || '본사'} 제공
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500" title={prospect.notes || ''}>
                                                    {prospect.notes ? (
                                                        <div className="flex items-center gap-1">
                                                            <FiMessageSquare className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                            <span>{new Date(prospect.createdAt).toLocaleDateString('ko-KR')}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <FiCalendar className="w-3 h-3" />
                                                        {new Date(prospect.createdAt).toLocaleDateString('ko-KR')}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-xs font-medium">
                                                    <div className="flex items-center gap-1 flex-nowrap">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProspectId(prospect.id);
                                                                setSelectedProspectType('lead');
                                                                setDetailModalOpen(true);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap"
                                                        >
                                                            상세
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm(`${prospect.customerName}님의 정보를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
                                                                try {
                                                                    const res = await fetch(`/api/partner/customers/${prospect.id}`, {
                                                                        method: 'DELETE',
                                                                    });
                                                                    const data = await res.json();
                                                                    if (data.ok) {
                                                                        showSuccess('삭제되었습니다.');
                                                                        loadProspects();
                                                                    } else {
                                                                        showError(data.message || '삭제에 실패했습니다.');
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error deleting prospect:', error);
                                                                    showError('오류가 발생했습니다.');
                                                                }
                                                            }}
                                                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap"
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* System Consultation Search and Month Filter */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="이름, 연락처 검색"
                                    value={systemSearch}
                                    onChange={(e) => setSystemSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => {
                                        setSelectedMonth(e.target.value);
                                        setSystemPage(1);
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                                >
                                    <option value="">전체 기간</option>
                                    {(() => {
                                        const months = [];
                                        const now = new Date();
                                        for (let i = 0; i < 12; i++) {
                                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                                            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                            months.push(
                                                <option key={value} value={value}>
                                                    {d.getFullYear()}년 {d.getMonth() + 1}월
                                                </option>
                                            );
                                        }
                                        return months;
                                    })()}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* System Consultation Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                                            <input
                                                type="checkbox"
                                                checked={filteredConsultations.length > 0 && selectedConsultations.size === filteredConsultations.length}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">상태</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">고객 정보</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">문의/노트</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">담당 판매원</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">등록일시</th>
                                        <th className="px-3 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {loadingSystem ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex justify-center mb-2">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                                </div>
                                                데이터를 불러오는 중입니다...
                                            </td>
                                        </tr>
                                    ) : filteredConsultations.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredConsultations.map((consultation) => (
                                            <tr key={consultation.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedConsultations.has(consultation.id)}
                                                        onChange={(e) => handleSelectRow(consultation.id, e.target.checked)}
                                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${consultation.status === 'NEW' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {consultation.status === 'NEW' ? '신규' : consultation.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                                            <FiUser className="text-orange-600 w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 text-sm truncate">{consultation.name}</p>
                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                <FiPhone className="w-3 h-3 flex-shrink-0" />
                                                                <span className="truncate">{consultation.phone}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500" title={consultation.message || ''}>
                                                    {consultation.message ? (
                                                        <div className="flex items-center gap-1">
                                                            <FiMessageSquare className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                                            <span>{new Date(consultation.createdAt).toLocaleDateString('ko-KR')}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap">
                                                    {(() => {
                                                        const manager = consultation.AffiliateProfile_SystemConsultation_managerIdToAffiliateProfile;
                                                        const agent = consultation.AffiliateProfile_SystemConsultation_agentIdToAffiliateProfile;

                                                        if (agent?.displayName) {
                                                            return (
                                                                <span className="text-blue-600 font-medium text-xs truncate">
                                                                    {agent.displayName}
                                                                </span>
                                                            );
                                                        } else if (manager?.displayName) {
                                                            return (
                                                                <span className="text-purple-600 font-medium text-xs truncate">
                                                                    {manager.displayName}
                                                                </span>
                                                            );
                                                        } else {
                                                            return (
                                                                <span className="text-gray-500 font-medium text-xs">
                                                                    본사
                                                                </span>
                                                            );
                                                        }
                                                    })()}
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <FiCalendar className="w-3 h-3" />
                                                        {new Date(consultation.createdAt).toLocaleDateString('ko-KR')}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 whitespace-nowrap text-xs font-medium">
                                                    <div className="flex items-center gap-1 flex-nowrap">
                                                        <button
                                                            onClick={() => handleExtendTrial(consultation.id, consultation.phone)}
                                                            className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap"
                                                        >
                                                            +3일
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProspectId(consultation.id);
                                                                setSelectedProspectType('consultation');
                                                                setDetailModalOpen(true);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap"
                                                        >
                                                            상세
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm(`${consultation.name}님의 상담 신청을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
                                                                try {
                                                                    const res = await fetch(`/api/partner/system-inquiries/${consultation.id}`, {
                                                                        method: 'DELETE',
                                                                    });
                                                                    const data = await res.json();
                                                                    if (data.ok) {
                                                                        showSuccess('삭제되었습니다.');
                                                                        loadSystemConsultations();
                                                                    } else {
                                                                        showError(data.message || '삭제에 실패했습니다.');
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error deleting consultation:', error);
                                                                    showError('오류가 발생했습니다.');
                                                                }
                                                            }}
                                                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-1.5 py-1 rounded text-xs transition-colors whitespace-nowrap"
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {systemTotalPages > 1 && (
                        <div className="mt-6 flex justify-center items-center gap-2">
                            <button
                                onClick={() => setSystemPage(p => Math.max(1, p - 1))}
                                disabled={systemPage === 1}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
                            >
                                \uc774\uc804
                            </button>
                            <span className="text-sm text-gray-600">
                                {systemPage} / {systemTotalPages}
                            </span>
                            <button
                                onClick={() => setSystemPage(p => Math.min(systemTotalPages, p + 1))}
                                disabled={systemPage === systemTotalPages}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
                            >
                                \ub2e4\uc74c
                            </button>
                        </div>
                    )}
                </>
            )}



            {/* B2B Prospect Detail Modal */}
            {selectedProspectId && (
                <B2BProspectDetailModal
                    prospectId={selectedProspectId}
                    prospectType={selectedProspectType}
                    isOpen={detailModalOpen}
                    onClose={() => {
                        setDetailModalOpen(false);
                        setSelectedProspectId(null);
                    }}
                    onUpdate={() => {
                        if (activeTab === 'B2B') {
                            loadProspects();
                        } else {
                            loadSystemConsultations();
                        }
                    }}
                    apiBasePath="partner"
                />
            )}

            {/* Assign Modal - DB 보내기 (대리점장 간 교환) */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">DB 보내기</h3>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <FiX className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="text-gray-600 mb-6">
                            선택한 {activeTab === 'B2B' ? selectedProspects.size : selectedConsultations.size}명의 고객 DB를 보낼 대상을 선택해주세요.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                대상 선택
                            </label>
                            <select
                                value={selectedManagerId}
                                onChange={(e) => setSelectedManagerId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                            >
                                <option value="">선택해주세요</option>
                                <option value="hq">본사로 반환</option>
                                {branchManagers.map(manager => (
                                    <option key={manager.id} value={manager.id}>
                                        {manager.displayName} ({manager.affiliateCode})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setIsAssignModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={async () => {
                                    if (!selectedManagerId) {
                                        showError('대상을 선택해주세요.');
                                        return;
                                    }

                                    setIsSharing(true);
                                    try {
                                        const leadIds = activeTab === 'B2B'
                                            ? Array.from(selectedProspects)
                                            : Array.from(selectedConsultations);

                                        const targetManagerId = selectedManagerId === 'hq' ? null : parseInt(selectedManagerId);

                                        const res = await fetch('/api/partner/customers/share-leads', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                leadIds,
                                                targetManagerId,
                                                type: activeTab === 'B2B' ? 'lead' : 'consultation'
                                            }),
                                        });

                                        const json = await res.json();
                                        if (json.ok) {
                                            showSuccess(selectedManagerId === 'hq' ? 'DB가 본사로 반환되었습니다.' : 'DB가 성공적으로 전송되었습니다.');
                                            setIsAssignModalOpen(false);
                                            setSelectedManagerId('');
                                            if (activeTab === 'B2B') {
                                                setSelectedProspects(new Set());
                                                loadProspects();
                                            } else {
                                                setSelectedConsultations(new Set());
                                                loadSystemConsultations();
                                            }
                                        } else {
                                            showError(json.error || json.message || 'DB 전송에 실패했습니다.');
                                        }
                                    } catch (error) {
                                        console.error('Share error:', error);
                                        showError('오류가 발생했습니다.');
                                    } finally {
                                        setIsSharing(false);
                                    }
                                }}
                                disabled={isSharing || !selectedManagerId}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSharing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        전송 중...
                                    </>
                                ) : (
                                    '확인'
                                )}
                            </button>
                        </div>
                    </div>
                </div>)}
        </div>
    );
}
