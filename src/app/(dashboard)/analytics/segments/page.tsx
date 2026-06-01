'use client';

/**
 * Segment Analytics Dashboard
 *
 * Features:
 * - Segment cards (top): Name, size, churn risk, recommended action
 * - Segment comparison table: Sortable, filterable
 * - Detailed view (drill-down): Demographics, behavior, churn drivers
 * - Trend view: Segment growth over time
 */

import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/lib/api/use-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Users, Target, Zap } from 'lucide-react';

interface Segment {
  id: string;
  name: string;
  size: number;
  churnRisk: number;
  avgLtv: number;
  avgEngagement: number;
  predictedConversion: number;
  profile: any;
}

interface SegmentMetrics {
  segments: Segment[];
  totalContacts: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const ACTION_COLORS: Record<string, string> = {
  'Upsell': '#3b82f6',
  'Reactivate': '#ef4444',
  'Support': '#f59e0b',
  'VIP': '#8b5cf6',
  'Growth': '#10b981',
  'Close': '#ec4899',
};

export default function SegmentAnalyticsDashboard() {
  const session = useSession();
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [sortBy, setSortBy] = useState<'size' | 'churn' | 'ltv' | 'engagement'>('size');

  useEffect(() => {
    if (session?.organizationId) fetchSegments(session.organizationId);
  }, [session?.organizationId]);

  const fetchSegments = async (orgId: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/segments', {
        headers: { 'x-organization-id': orgId },
      });

      if (!response.ok) throw new Error('Failed to fetch segments');

      const data = await response.json();
      setSegments(data.segments || []);

      if (data.segments?.length > 0) {
        setSelectedSegment(data.segments[0]);
      }
    } catch (error) {
      console.error('Error fetching segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReclustering = async () => {
    if (!session?.organizationId) return;
    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': session.organizationId,
        },
        body: JSON.stringify({ action: 'refresh' }),
      });

      if (!response.ok) throw new Error('Re-clustering failed');

      await fetchSegments(session.organizationId);
      toast({ title: '세그먼트 재분류 완료', description: '고객 세그먼트가 업데이트되었습니다.' });
    } catch (error) {
      console.error('Error:', error);
      toast({ title: '재분류 실패', description: '잠시 후 다시 시도해주세요.', variant: 'destructive' });
    }
  };

  const sortedSegments = [...segments].sort((a, b) => {
    switch (sortBy) {
      case 'size':
        return b.size - a.size;
      case 'churn':
        return b.churnRisk - a.churnRisk;
      case 'ltv':
        return b.avgLtv - a.avgLtv;
      case 'engagement':
        return b.avgEngagement - a.avgEngagement;
      default:
        return 0;
    }
  });

  const segmentDistribution = segments.map((seg) => ({
    name: seg.name.substring(0, 15),
    value: seg.size,
    color: COLORS[segments.indexOf(seg) % COLORS.length],
  }));

  const churnRiskData = segments.map((seg) => ({
    name: seg.name.substring(0, 10),
    risk: seg.churnRisk,
    actionRequired: seg.churnRisk > 60 ? 1 : 0,
  }));

  const engagementTrendData = segments.map((seg) => ({
    name: seg.name.substring(0, 10),
    engagement: seg.avgEngagement,
    ltv: seg.avgLtv / 1000, // Scale for chart
    conversion: seg.predictedConversion * 10, // Scale for chart
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading segments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Segment Analytics</h1>
          <p className="text-gray-600 mt-1">
            {segments.length} segments, {segments.reduce((s, seg) => s + seg.size, 0)} total contacts
          </p>
        </div>
        <Button
          onClick={handleReclustering}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={loading}
        >
          <Zap className="w-4 h-4 mr-2" />
          Re-cluster Contacts
        </Button>
      </div>

      {/* Segment Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedSegments.slice(0, 4).map((segment) => (
          <Card
            key={segment.id}
            className={`cursor-pointer transition ${
              selectedSegment?.id === segment.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedSegment(segment)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{segment.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Size</span>
                  <span className="font-bold">{segment.size} contacts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Churn Risk</span>
                  <span
                    className={`font-bold ${
                      segment.churnRisk > 60
                        ? 'text-red-600'
                        : segment.churnRisk > 30
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    }`}
                  >
                    {segment.churnRisk}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Avg LTV</span>
                  <span className="font-bold">${Math.round(segment.avgLtv)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Engagement</span>
                  <span className="font-bold">{Math.round(segment.avgEngagement)}%</span>
                </div>
                <div className="pt-2 mt-2 border-t">
                  <span className="text-sm font-semibold text-blue-600">
                    {segment.profile?.recommendedAction || 'Support'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <Users className="w-5 h-5 mr-2" /> Segment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={segmentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {segmentDistribution.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Churn Risk Assessment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" /> Churn Risk by Segment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnRiskData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="risk" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Segment Comparison */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold">Segment Comparison</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('size')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Size
              </button>
              <button
                onClick={() => setSortBy('churn')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'churn' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Churn
              </button>
              <button
                onClick={() => setSortBy('ltv')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'ltv' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                LTV
              </button>
              <button
                onClick={() => setSortBy('engagement')}
                className={`px-3 py-1 rounded text-sm ${
                  sortBy === 'engagement' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Engagement
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="text-left py-3 px-4">Segment</th>
                  <th className="text-center py-3 px-4">Size</th>
                  <th className="text-center py-3 px-4">Churn Risk</th>
                  <th className="text-center py-3 px-4">Avg LTV</th>
                  <th className="text-center py-3 px-4">Engagement</th>
                  <th className="text-center py-3 px-4">Est. Conv. Rate</th>
                  <th className="text-center py-3 px-4">Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedSegments.map((segment) => (
                  <tr
                    key={segment.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedSegment(segment)}
                  >
                    <td className="py-3 px-4 font-semibold">{segment.name}</td>
                    <td className="py-3 px-4 text-center">{segment.size}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-sm font-bold ${
                          segment.churnRisk > 60
                            ? 'bg-red-100 text-red-700'
                            : segment.churnRisk > 30
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {segment.churnRisk}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold">
                      ${Math.round(segment.avgLtv)}
                    </td>
                    <td className="py-3 px-4 text-center">{Math.round(segment.avgEngagement)}%</td>
                    <td className="py-3 px-4 text-center">
                      {segment.predictedConversion.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className="px-2 py-1 rounded text-sm font-bold text-white"
                        style={{
                          backgroundColor:
                            ACTION_COLORS[segment.profile?.recommendedAction || 'Support'],
                        }}
                      >
                        {segment.profile?.recommendedAction || 'Support'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Segment View */}
      {selectedSegment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{selectedSegment.name} - Detailed View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Demographics */}
              <div>
                <h3 className="font-semibold text-base mb-3">Demographics</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Age</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.demographicProfile?.avgAge || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Male %</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.demographicProfile?.malePercent || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Married %</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.demographicProfile?.mariedPercent || 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Children</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.demographicProfile?.avgChildrenCount || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Behavioral */}
              <div>
                <h3 className="font-semibold text-base mb-3">Behavioral Traits</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Recency</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.behavioralProfile?.avgRecency || 0} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Purchase Frequency</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.behavioralProfile?.avgFrequency || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Monetary Value</span>
                    <span className="font-semibold">
                      ${selectedSegment.profile?.behavioralProfile?.avgMonetaryValue || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Engagement Rate</span>
                    <span className="font-semibold">
                      {selectedSegment.profile?.behavioralProfile?.avgEngagementRate || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  // Navigate to campaign recommendation
                  window.location.href = `/analytics/segments/${selectedSegment.id}/recommendation`;
                }}
              >
                <Target className="w-4 h-4 mr-2" />
                View Campaign Recommendation
              </Button>
              <Button variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Contacts ({selectedSegment.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" /> Engagement vs LTV vs Conversion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={engagementTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="engagement"
                stroke="#10b981"
                name="Engagement %"
              />
              <Line type="monotone" dataKey="ltv" stroke="#3b82f6" name="LTV ($1000s)" />
              <Line type="monotone" dataKey="conversion" stroke="#f59e0b" name="Conv. Rate x10" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
