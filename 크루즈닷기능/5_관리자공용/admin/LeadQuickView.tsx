'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Lead {
  id: number;
  customerName: string;
  customerPhone: string;
  source?: string;
  status: string;
  createdAt: string;
  agentName?: string;
  managerName?: string;
  productName?: string;
}

interface LeadQuickViewProps {
  leads?: Lead[];
  apiEndpoint?: string;
  limit?: number;
  title?: string;
  showAgent?: boolean;
  showManager?: boolean;
  showProduct?: boolean;
  onLeadClick?: (lead: Lead) => void;
  className?: string;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  PURCHASED: 'bg-green-100 text-green-800',
  REFUNDED: 'bg-red-100 text-red-800',
  TEST_GUIDE: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  NEW: '신규',
  CONTACTED: '연락완료',
  IN_PROGRESS: '진행중',
  PURCHASED: '구매완료',
  REFUNDED: '환불',
  TEST_GUIDE: '체험중',
};

export default function LeadQuickView({
  leads: initialLeads,
  apiEndpoint = '/api/admin/affiliate/leads',
  limit = 5,
  title = '최근 문의',
  showAgent = false,
  showManager = false,
  showProduct = false,
  onLeadClick,
  className = '',
}: LeadQuickViewProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads || []);
  const [loading, setLoading] = useState(!initialLeads);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLeads) return;

    async function fetchLeads() {
      try {
        setLoading(true);
        const res = await fetch(`${apiEndpoint}?limit=${limit}`);
        const data = await res.json();
        if (data.ok && data.leads) {
          setLeads(data.leads);
        } else if (data.leads) {
          setLeads(data.leads);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [apiEndpoint, limit, initialLeads]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-red-500 text-sm">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-gray-500 text-sm">문의 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onLeadClick?.(lead)}
            className={`p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${
              onLeadClick ? 'cursor-pointer' : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {lead.customerName || '이름 없음'}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      statusColors[lead.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {statusLabels[lead.status] || lead.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {lead.customerPhone?.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') || '-'}
                </p>
                {showProduct && lead.productName && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {lead.productName}
                  </p>
                )}
                {(showAgent || showManager) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {showManager && lead.managerName && `대리점장: ${lead.managerName}`}
                    {showManager && showAgent && lead.managerName && lead.agentName && ' / '}
                    {showAgent && lead.agentName && `판매원: ${lead.agentName}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400">
                  {format(new Date(lead.createdAt), 'MM.dd HH:mm', { locale: ko })}
                </span>
                {lead.source && (
                  <p className="text-xs text-blue-500 mt-1">{lead.source}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
