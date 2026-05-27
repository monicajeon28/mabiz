"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Badge,
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
        <span>Loading 360° customer view...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-red-900">Error loading view</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!data?.data) {
    return <Card className="p-6">No customer data available</Card>;
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
            Source: {customer.sourceType} • Org: {meta.contactId.substring(0, 8)}...
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
            <option value="ADMIN">Admin (Full Access)</option>
            <option value="MANAGER">Manager (Partial)</option>
            <option value="AGENT">Agent (Masked)</option>
            <option value="PUBLIC">Public (Max Masked)</option>
          </select>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            Loaded in {meta.duration_ms}ms
          </span>
        </div>
      </div>

      {/* Contact Info Summary */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Contact Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Phone</div>
            <div className="font-mono font-semibold">{customer.phone}</div>
          </div>
          <div>
            <div className="text-gray-600">Email</div>
            <div className="font-mono font-semibold">{customer.email || "N/A"}</div>
          </div>
          <div>
            <div className="text-gray-600">Type</div>
            <div className="font-semibold capitalize">{customer.type}</div>
          </div>
          <div>
            <div className="text-gray-600">Status</div>
            <div className="font-semibold">{customer.contact?.status || "Unknown"}</div>
          </div>
        </div>
      </Card>

      {/* Psychology Lenses */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Psychology Lenses (L0-L10)</h3>
          <span className="text-xs text-gray-600">{meta.lensCount} detected</span>
        </div>

        {customer.primaryLens && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-blue-900">{customer.primaryLens.label}</div>
                <div className="text-sm text-blue-700 mt-1">
                  Confidence: {customer.primaryLens.confidenceScore}% | Readiness: {customer.primaryLens.readinessScore}%
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
                  Confidence: {lens.confidenceScore}% • Readiness: {lens.readinessScore}%
                </div>
              </div>
              <Badge variant="outline">{lens.lensType}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Risk Assessment */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Risk Assessment</h3>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Risk Score</span>
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
            <div className="text-sm font-medium text-gray-700">Risk Flags:</div>
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
          <h3 className="font-semibold mb-4">Engagement Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Lead Score</div>
              <div className="text-2xl font-bold">{customer.contact.leadScore}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Calls</div>
              <div className="text-2xl font-bold">{customer.contact.callCount}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Memos</div>
              <div className="text-2xl font-bold">{customer.contact.memoCount}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Cruise Count</div>
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
          Journey ({meta.journeyEventCount} events)
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
                <div className="text-sm font-medium capitalize">{event.type}</div>
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
