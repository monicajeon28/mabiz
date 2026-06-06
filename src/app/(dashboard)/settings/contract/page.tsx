'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, FileText, CheckCircle, Clock, AlertTriangle, Calendar } from 'lucide-react';

type ContractInfo = {
  status: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractSignedAt: string | null;
  signatureImageUrl: string | null;
  name: string;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  submitted:  { label: '검토 중',   color: 'bg-yellow-100 text-yellow-700' },
  APPROVED:   { label: '승인 완료', color: 'bg-green-100 text-green-700'   },
  REJECTED:   { label: '반려됨',    color: 'bg-red-100 text-red-700'        },
  PROCESSING: { label: '처리 중',   color: 'bg-blue-100 text-blue-700'      },
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function Header() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link href="/settings" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">계약 정보</h1>
        <p className="text-sm text-gray-500">계약 상태 및 서명 내역</p>
      </div>
    </div>
  );
}

export default function ContractPage() {
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/my-contract')
      .then(r => r.json())
      .then(d => { setContract(d.contract ?? null); })
      .catch(() => { setContract(null); })
      .finally(() => { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 md:p-6">
        <Header />
        <div className="bg-white rounded-xl border border-gray-200 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0 border-gray-100">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="max-w-lg mx-auto p-4 md:p-6">
        <Header />
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">계약 정보가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">GMcruise 계정 연동 후 이용 가능합니다.</p>
        </div>
      </div>
    );
  }

  const days = daysLeft(contract.contractEndDate);
  const statusCfg = STATUS_MAP[contract.status] ?? { label: contract.status, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <Header />
      <div className="space-y-4">
        {/* 만료 임박 경고 */}
        {days !== null && days <= 30 && (
          <div className={`rounded-xl border p-4 flex gap-3 ${days <= 7 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${days <= 7 ? 'text-red-500' : 'text-amber-500'}`} />
            <div className="text-sm">
              <p className={`font-semibold ${days <= 7 ? 'text-red-800' : 'text-amber-800'}`}>
                계약 만료 {days <= 0 ? '기간이 지났습니다' : `D-${days}`}
              </p>
              <p className={`mt-0.5 ${days <= 7 ? 'text-red-700' : 'text-amber-700'}`}>
                담당자에게 재계약 문의가 필요합니다.
              </p>
            </div>
          </div>
        )}

        {/* 계약 정보 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="flex items-center gap-3 p-4">
            <span className="text-sm text-gray-500 w-24 shrink-0">계약자</span>
            <span className="text-sm font-semibold text-gray-900">{contract.name}</span>
          </div>

          <div className="flex items-center gap-3 p-4">
            <span className="text-sm text-gray-500 w-24 shrink-0">계약 상태</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          <div className="flex items-center gap-3 p-4">
            <span className="text-sm text-gray-500 w-24 shrink-0">서명일</span>
            <span className="text-sm text-gray-900 flex items-center gap-1.5">
              {contract.contractSignedAt ? (
                <><CheckCircle className="w-4 h-4 text-green-500" />{fmt(contract.contractSignedAt)}</>
              ) : (
                <><Clock className="w-4 h-4 text-gray-400" />미서명</>
              )}
            </span>
          </div>

          {contract.contractStartDate && (
            <div className="flex items-center gap-3 p-4">
              <span className="text-sm text-gray-500 w-24 shrink-0">계약 시작</span>
              <span className="text-sm text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />{fmt(contract.contractStartDate)}
              </span>
            </div>
          )}

          {contract.contractEndDate && (
            <div className="flex items-center gap-3 p-4">
              <span className="text-sm text-gray-500 w-24 shrink-0">계약 종료</span>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${
                days !== null && days <= 7 ? 'text-red-600' : days !== null && days <= 30 ? 'text-amber-600' : 'text-gray-900'
              }`}>
                <Calendar className="w-4 h-4" />{fmt(contract.contractEndDate)}
                {days !== null && days > 0 && (
                  <span className={`text-xs ml-1 px-1.5 py-0.5 rounded-full ${days <= 7 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    D-{days}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* 서명 이미지 */}
        {contract.signatureImageUrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">서명</p>
            <div className="bg-gray-50 rounded-lg p-3 flex justify-center">
              <Image
                src={contract.signatureImageUrl}
                alt="서명 이미지"
                width={300}
                height={128}
                className="max-h-32 object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
