"use client";

import { useState, useEffect } from "react";
import { Building2, User, Phone, Mail, Award, Share2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { useSession } from "@/hooks/useSession";

interface AffiliateInfo {
  manager: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    org: string;
    trustScore: number;
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

interface DbRecipient {
  id: string;
  displayName: string | null;
  loginId?: string;
  orgName: string;
  role?: string;
}

interface ContactAffiliateCardProps {
  contactId: string;
}

export default function ContactAffiliateCard({
  contactId,
}: ContactAffiliateCardProps) {
  const { role } = useSession();
  const canShareDb = role !== 'FREE_SALES';

  const [affiliateInfo, setAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // DB 공유 상태
  const [showDbShare, setShowDbShare] = useState(false);
  const [dbRecipients, setDbRecipients] = useState<DbRecipient[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [sendingDb, setSendingDb] = useState(false);
  const [dbResult, setDbResult] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchAffiliateInfo = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/contacts/${contactId}/affiliate-info`, { signal: controller.signal });
        if (!res.ok) {
          setError("제휴 정보를 불러올 수 없습니다.");
          return;
        }
        const result = await res.json();
        if (result.ok) {
          setAffiliateInfo(result.data);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        logger.error("[ContactAffiliateCard] 제휴 정보 조회 실패", { err, contactId });
        setError("제휴 정보 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchAffiliateInfo();
    return () => controller.abort();
  }, [contactId]);

  const loadDbRecipients = async () => {
    setLoadingRecipients(true);
    try {
      const res = await fetch("/api/contacts/share-targets");
      const data = await res.json();
      if (data.ok) {
        setDbRecipients(data.targets ?? []);
      }
    } catch (err) {
      logger.error("[ContactAffiliateCard] DB 수신자 조회 실패", { err });
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleDbShare = async () => {
    if (!selectedRecipient || sendingDb) return;
    setSendingDb(true);
    try {
      // CSRF 토큰 조회
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();
        csrfToken = csrfData.token ?? "";
      } catch {
        // CSRF 토큰 없이 진행 (서버가 허용하는 경우)
      }
      const res = await fetch(`/api/contacts/${contactId}/send-db`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ targetUserId: selectedRecipient }),
      });
      const data = await res.json();
      if (data.ok) {
        setDbResult("✅ DB 공유 완료");
        setShowDbShare(false);
        setSelectedRecipient("");
      } else {
        setDbResult(`❌ ${data.message ?? "공유 실패"}`);
      }
    } catch (err) {
      logger.error("[ContactAffiliateCard] DB 공유 실패", { err });
      setDbResult("❌ 네트워크 오류");
    } finally {
      setSendingDb(false);
    }
  };

  const filteredRecipients = dbRecipients.filter((r) => {
    const q = dbSearch.toLowerCase();
    return (r.displayName ?? r.loginId ?? "").toLowerCase().includes(q) || r.orgName.toLowerCase().includes(q);
  });

  const DbShareSection = () => (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Share2 className="w-4 h-4 text-blue-500" />
          DB 공유
        </p>
        <button
          onClick={() => {
            setShowDbShare(!showDbShare);
            if (!showDbShare && dbRecipients.length === 0) loadDbRecipients();
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {showDbShare ? "닫기" : "공유하기"}
        </button>
      </div>
      {dbResult && <p className="text-sm font-medium mb-2">{dbResult}</p>}
      {showDbShare && (
        <div className="space-y-2">
          <input
            type="text"
            value={dbSearch}
            onChange={(e) => setDbSearch(e.target.value)}
            placeholder="담당자 이름 또는 조직 검색..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          {loadingRecipients ? (
            <p className="text-xs text-gray-400 text-center py-2">불러오는 중...</p>
          ) : filteredRecipients.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">담당자가 없습니다.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-1">
              {filteredRecipients.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRecipient(r.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedRecipient === r.id
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="font-medium">{r.displayName ?? r.loginId ?? r.id}</span>
                  <span className={`text-xs ml-1.5 ${selectedRecipient === r.id ? "text-blue-100" : "text-gray-400"}`}>
                    {r.orgName}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleDbShare}
            disabled={!selectedRecipient || sendingDb}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {sendingDb ? "공유 중..." : "DB 공유"}
          </button>
        </div>
      )}
    </div>
  );

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

  if (error || (!affiliateInfo?.manager && !affiliateInfo?.agent)) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            제휴 담당자
          </h2>
        </div>
        <p className="text-sm text-gray-400 mt-3">
          {error ?? "배정된 제휴 담당자가 없습니다."}
        </p>
        {canShareDb && <DbShareSection />}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          제휴 담당자
        </h2>
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

      <DbShareSection />
    </div>
  );
}
