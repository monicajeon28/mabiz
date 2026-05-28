"use client";

import { useState, useEffect } from "react";
import { Building2, User, Phone, Mail, Award, Send, Loader } from "lucide-react";
import { logger } from "@/lib/logger";

interface AffiliateInfo {
  manager: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    org: string;
    trustScore: number; // L9: 신뢰도
    expertise: string;
  } | null;
  agent: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    org: string;
    trustScore: number;
    expertise: string;
  } | null;
  assignedAt: string;
}

interface ContactAffiliateCardProps {
  contactId: string;
  onStartSequence: (contactId: string) => Promise<void>;
  sequenceLoading?: boolean;
}

export default function ContactAffiliateCard({
  contactId,
  onStartSequence,
  sequenceLoading = false,
}: ContactAffiliateCardProps) {
  const [affiliateInfo, setAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAffiliateInfo = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/contacts/${contactId}/affiliate-info`);
        if (!res.ok) {
          setError("제휴 정보를 불러올 수 없습니다.");
          return;
        }
        const result = await res.json();
        if (result.ok) {
          setAffiliateInfo(result.data);
        }
      } catch (err) {
        logger.error("[ContactAffiliateCard] 제휴 정보 조회 실패", { err, contactId });
        setError("제휴 정보 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchAffiliateInfo();
  }, [contactId]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // 조용히 실패 (필수 기능 아님)
  }

  if (!affiliateInfo?.manager && !affiliateInfo?.agent) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          제휴 담당자
        </h2>
        {/* L10 클로징: 즉시 시퀀스 시작 버튼 */}
        <button
          onClick={() => onStartSequence(contactId)}
          disabled={sequenceLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sequenceLoading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Day 0-3 시작
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 본사 (Manager) */}
        {affiliateInfo.manager && (
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">본사</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600 mb-1">담당자명</p>
                <p className="font-semibold text-gray-900">{affiliateInfo.manager.name}</p>
              </div>

              <div>
                <p className="text-gray-600 mb-1">조직</p>
                <p className="text-gray-900">{affiliateInfo.manager.org}</p>
              </div>

              <div>
                <p className="text-gray-600 mb-1">경력</p>
                <p className="text-gray-900">{affiliateInfo.manager.expertise}</p>
              </div>

              {/* L9 의료신뢰: 신뢰도 배지 */}
              <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
                <div className="flex-1">
                  <p className="text-gray-600 text-xs mb-1">신뢰도</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${affiliateInfo.manager.trustScore}%` }}
                      />
                    </div>
                    <span className="font-bold text-blue-600 text-sm">
                      {affiliateInfo.manager.trustScore}
                    </span>
                  </div>
                </div>
              </div>

              {affiliateInfo.manager.phone && (
                <div className="flex items-center gap-2 text-blue-600 mt-3 pt-3 border-t border-blue-200">
                  <a
                    href={`tel:${affiliateInfo.manager.phone}`}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 flex-1"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-medium">{affiliateInfo.manager.phone}</span>
                  </a>
                </div>
              )}

              {affiliateInfo.manager.email && (
                <a
                  href={`mailto:${affiliateInfo.manager.email}`}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium break-all">{affiliateInfo.manager.email}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* 판매원 (Agent) */}
        {affiliateInfo.agent && (
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">판매원</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600 mb-1">담당자명</p>
                <p className="font-semibold text-gray-900">{affiliateInfo.agent.name}</p>
              </div>

              <div>
                <p className="text-gray-600 mb-1">조직</p>
                <p className="text-gray-900">{affiliateInfo.agent.org}</p>
              </div>

              <div>
                <p className="text-gray-600 mb-1">전문분야</p>
                <p className="text-gray-900">{affiliateInfo.agent.expertise}</p>
              </div>

              {/* L9 의료신뢰: 신뢰도 배지 */}
              <div className="flex items-center gap-2 pt-2 border-t border-green-200">
                <div className="flex-1">
                  <p className="text-gray-600 text-xs mb-1">신뢰도</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-green-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600"
                        style={{ width: `${affiliateInfo.agent.trustScore}%` }}
                      />
                    </div>
                    <span className="font-bold text-green-600 text-sm">
                      {affiliateInfo.agent.trustScore}
                    </span>
                  </div>
                </div>
              </div>

              {affiliateInfo.agent.phone && (
                <div className="flex items-center gap-2 text-green-600 mt-3 pt-3 border-t border-green-200">
                  <a
                    href={`tel:${affiliateInfo.agent.phone}`}
                    className="flex items-center gap-2 text-green-600 hover:text-green-700 flex-1"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-medium">{affiliateInfo.agent.phone}</span>
                  </a>
                </div>
              )}

              {affiliateInfo.agent.email && (
                <a
                  href={`mailto:${affiliateInfo.agent.email}`}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700"
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium break-all">{affiliateInfo.agent.email}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
