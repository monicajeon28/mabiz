"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertCircle,
  TrendingUp,
  Target,
  Clock,
  MessageSquare,
  Phone,
  CreditCard,
  Users,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

function Badge({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: 'outline' | 'secondary' | 'default' }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const variantClass =
    variant === 'outline' ? 'border border-gray-300 text-gray-700' :
    variant === 'secondary' ? 'bg-gray-100 text-gray-700' :
    'bg-gray-900 text-white';
  return <span className={`${base} ${variantClass} ${className || ''}`}>{children}</span>;
}

interface Customer360Data {
  data: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    sourceType: string;
    type: "contact" | "gold_member" | "platform_user" | "mixed";
    primaryLens?: {
      lensType: string;
      label: string;
      confidenceScore: number;
      readinessScore: number;
    };
    allLenses: Array<{
      lensType: string;
      label: string;
      confidenceScore: number;
      readinessScore: number;
      status: string;
      identifiedAt: string;
    }>;
    riskScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    riskFlags: string[];
    contact?: {
      type: string;
      status: string;
      channel: string;
      tags: string[];
      leadScore: number;
      reEngageCount: number;
      purchasedAt: string | null;
      lastPaymentStatus: string | null;
      cruiseCount: number;
      memoCount: number;
      lastMemoAt: string | null;
      callCount: number;
      lastCallAt: string | null;
    };
    journey: Array<{
      id: string;
      type: "call" | "sms" | "email" | "memo" | "payment" | "lens_update";
      timestamp: string;
      details: Record<string, any>;
      channel?: string;
    }>;
    groupMemberships: Array<{
      groupId: string;
      groupName: string;
      color: string | null;
      joinedAt: string;
    }>;
    lastInteractionAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  meta: {
    contactId: string;
    duration_ms: number;
    lensCount: number;
    journeyEventCount: number;
    maskLevel: string;
  };
}

interface Customer360ViewProps {
  contactId: string;
}

export default function Customer360View({ contactId }: Customer360ViewProps) {
  const [data, setData] = useState<Customer360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maskLevel, setMaskLevel] = useState<"ADMIN" | "MANAGER" | "AGENT" | "PUBLIC">("AGENT");

  useEffect(() => {
    fetchCustomer360();
  }, [contactId, maskLevel]);

  async function fetchCustomer360() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/customers/${contactId}/360?maskLevel=${maskLevel}&detailed=true`
      );

      if (!response.ok) {
        throw new Error(`Failed to load customer data: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[Customer360] Error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin mr-2" />
        <span>360° 고객 뷰 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-red-900">뷰 로딩 오류</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!data?.data) {
    return <Card className="p-6">고객 데이터가 없습니다.</Card>;
  }

  const customer = data.data;
  const meta = data.meta;

  return (
    <div className="space-y-6">
      {/* Header with Mask Control */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{customer.name}</h2>
          <p className="text-sm text-gray-600 mt-1">
            유입경로: {customer.sourceType} • 조직: {meta.contactId.substring(0, 8)}...
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={maskLevel}
            onChange={(e) =>
              setMaskLevel(e.target.value as "ADMIN" | "MANAGER" | "AGENT" | "PUBLIC")
            }
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="ADMIN">관리자 (전체 공개)</option>
            <option value="MANAGER">매니저 (일부 공개)</option>
            <option value="AGENT">에이전트 (마스킹)</option>
            <option value="PUBLIC">공개 (최대 마스킹)</option>
          </select>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            로드 시간: {meta.duration_ms}ms
          </span>
        </div>
      </div>

      {/* Contact Info Summary */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">고객 기본 정보</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">전화번호</div>
            <div className="font-mono font-semibold">{customer.phone}</div>
          </div>
          <div>
            <div className="text-gray-600">이메일</div>
            <div className="font-mono font-semibold">{customer.email || "없음"}</div>
          </div>
          <div>
            <div className="text-gray-600">유형</div>
            <div className="font-semibold capitalize">{customer.type}</div>
          </div>
          <div>
            <div className="text-gray-600">상태</div>
            <div className="font-semibold">{customer.contact?.status || "알 수 없음"}</div>
          </div>
        </div>
      </Card>

      {/* Psychology Lenses */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">심리학 렌즈 (L0-L10)</h3>
          <span className="text-xs text-gray-600">{meta.lensCount}개 감지됨</span>
        </div>

        {customer.primaryLens && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-blue-900">{customer.primaryLens.label}</div>
                <div className="text-sm text-blue-700 mt-1">
                  확신도: {customer.primaryLens.confidenceScore}% | 준비도: {customer.primaryLens.readinessScore}%
                </div>
              </div>
              <Badge className="bg-blue-600">{customer.primaryLens.lensType}</Badge>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {customer.allLenses.map((lens) => (
            <div
              key={`${lens.lensType}_${lens.identifiedAt}`}
              className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="text-sm font-medium">{lens.label}</div>
                <div className="text-xs text-gray-600">
                  확신도: {lens.confidenceScore}% • 준비도: {lens.readinessScore}%
                </div>
              </div>
              <Badge variant="outline">{lens.lensType}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Assessment */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">위험도 평가</h3>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">위험도 점수</span>
            <span className="text-lg font-bold">{customer.riskScore}/100</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                customer.riskLevel === "CRITICAL"
                  ? "bg-red-600"
                  : customer.riskLevel === "HIGH"
                    ? "bg-orange-500"
                    : customer.riskLevel === "MEDIUM"
                      ? "bg-yellow-500"
                      : "bg-green-600"
              }`}
              style={{ width: `${customer.riskScore}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Badge
            className={
              customer.riskLevel === "CRITICAL"
                ? "bg-red-600"
                : customer.riskLevel === "HIGH"
                  ? "bg-orange-500"
                  : customer.riskLevel === "MEDIUM"
                    ? "bg-yellow-600"
                    : "bg-green-600"
            }
          >
            {customer.riskLevel}
          </Badge>
        </div>

        {customer.riskFlags.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">위험 신호:</div>
            <div className="flex flex-wrap gap-2">
              {customer.riskFlags.map((flag) => (
                <Badge key={flag} variant="secondary" className="text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Engagement Metrics */}
      {customer.contact && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">참여 지표</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">리드 점수</div>
              <div className="text-2xl font-bold">{customer.contact.leadScore}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">콜 횟수</div>
              <div className="text-2xl font-bold">{customer.contact.callCount}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">메모 수</div>
              <div className="text-2xl font-bold">{customer.contact.memoCount}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">크루즈 횟수</div>
              <div className="text-2xl font-bold">{customer.contact.cruiseCount}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Group Memberships */}
      {customer.groupMemberships.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users size={18} />
            Groups ({customer.groupMemberships.length})
          </h3>
          <div className="space-y-2">
            {customer.groupMemberships.map((group) => (
              <div key={group.groupId} className="flex items-center gap-2 p-2 border rounded">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: group.color || "#999" }}
                />
                <span className="flex-1 text-sm">{group.groupName}</span>
                <span className="text-xs text-gray-500">
                  {new Date(group.joinedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Journey Timeline */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={18} />
          활동 이력 ({meta.journeyEventCount}건)
        </h3>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {customer.journey.slice(0, 50).map((event) => (
            <div key={event.id} className="flex gap-4 pb-3 border-b last:border-b-0">
              <div className="flex-shrink-0">
                {event.type === "call" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Phone size={16} className="text-blue-600" />
                  </div>
                )}
                {event.type === "memo" && (
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <MessageSquare size={16} className="text-green-600" />
                  </div>
                )}
                {event.type === "payment" && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <CreditCard size={16} className="text-purple-600" />
                  </div>
                )}
                {event.type === "sms" && (
                  <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                    <MessageSquare size={16} className="text-yellow-600" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium capitalize">
                  {event.type === "call" ? "콜" : event.type === "memo" ? "메모" : event.type === "payment" ? "결제" : event.type === "sms" ? "문자" : event.type === "email" ? "이메일" : event.type === "lens_update" ? "렌즈 업데이트" : event.type}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(event.timestamp).toLocaleString()}
                </div>
                {Object.keys(event.details).length > 0 && (
                  <div className="text-xs text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                    {Object.entries(event.details).map(([key, value]) => (
                      <div key={key}>
                        {key}: {typeof value === "string" ? value : JSON.stringify(value).substring(0, 50)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
