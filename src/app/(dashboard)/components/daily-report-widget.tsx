/**
 * Daily Report Widget (TASK 6-2)
 *
 * Displays today's report on analytics home page
 * - Expandable cards for each section
 * - Link to full report history
 * - Real-time metrics display
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface DailyReportData {
  id: string;
  revenue: number;
  conversionRate: number;
  alerts: string;
  recommendations: string;
  channelMetrics: string;
  topPartners: string;
  smsOpenRate: number;
  emailOpenRate: number;
  day0Opened: number;
}

interface Alert {
  type: 'RED' | 'YELLOW';
  metric: string;
  message: string;
  priority: string;
}

interface Recommendation {
  title: string;
  description: string;
  impact: string;
  priority: string;
}

interface Partner {
  id: string;
  name: string;
  revenue: number;
  conversionCount: number;
}

export function DailyReportWidget() {
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayReport();
    // Refresh every 30 minutes
    const interval = setInterval(fetchTodayReport, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTodayReport = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().split('T')[0];

      const response = await fetch(`/api/analytics/daily-report?date=${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch report');

      const data = await response.json();
      setReport(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">Error loading daily report: {error}</p>
        <button
          onClick={fetchTodayReport}
          className="mt-2 text-red-600 hover:text-red-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600">No report generated yet for today</p>
      </div>
    );
  }

  const alerts: Alert[] = JSON.parse(report.alerts || '[]');
  const recommendations: Recommendation[] = JSON.parse(report.recommendations || '[]');
  const topPartners: Partner[] = JSON.parse(report.topPartners || '[]');
  const channelMetrics = JSON.parse(report.channelMetrics || '{}');

  const criticalAlerts = alerts.filter((a) => a.type === 'RED');
  const warnings = alerts.filter((a) => a.type === 'YELLOW');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Today's Performance</h2>
        <Link
          href="/analytics/reports"
          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          View all reports →
        </Link>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 font-medium">💰 Revenue</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            ${(report.revenue / 100).toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 mt-2">Today's total</div>
        </div>

        {/* Conversion Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 font-medium">📈 Conversion</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {report.conversionRate.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500 mt-2">Overall rate</div>
        </div>

        {/* SMS Open Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 font-medium">📱 SMS Open</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {report.smsOpenRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-2">Day 0 rate</div>
        </div>

        {/* Email Open Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600 font-medium">📧 Email Open</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {report.emailOpenRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-2">Today's rate</div>
        </div>
      </div>

      {/* Alerts Section */}
      {criticalAlerts.length > 0 && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-100 transition"
          onClick={() => setExpandedSection(expandedSection === 'alerts' ? null : 'alerts')}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-red-900">
              🚨 Critical Alerts ({criticalAlerts.length})
            </h3>
            <span className="text-red-600">{expandedSection === 'alerts' ? '−' : '+'}</span>
          </div>
          {expandedSection === 'alerts' && (
            <div className="mt-3 space-y-2">
              {criticalAlerts.map((alert, i) => (
                <div key={i} className="text-sm text-red-800">
                  <strong>{alert.metric}:</strong> {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 cursor-pointer hover:bg-yellow-100 transition"
          onClick={() => setExpandedSection(expandedSection === 'warnings' ? null : 'warnings')}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-yellow-900">
              ⚠️ Warnings ({warnings.length})
            </h3>
            <span className="text-yellow-600">{expandedSection === 'warnings' ? '−' : '+'}</span>
          </div>
          {expandedSection === 'warnings' && (
            <div className="mt-3 space-y-2">
              {warnings.map((alert, i) => (
                <div key={i} className="text-sm text-yellow-800">
                  <strong>{alert.metric}:</strong> {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Partners */}
      {topPartners.length > 0 && (
        <div
          className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition"
          onClick={() => setExpandedSection(expandedSection === 'partners' ? null : 'partners')}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              ⭐ Top Partners ({topPartners.length})
            </h3>
            <span className="text-gray-600">{expandedSection === 'partners' ? '−' : '+'}</span>
          </div>
          {expandedSection === 'partners' && (
            <div className="mt-3 space-y-2">
              {topPartners.slice(0, 3).map((partner, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {i + 1}. {partner.name}
                  </span>
                  <span className="text-green-600 font-medium">
                    ${partner.revenue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:bg-blue-100 transition"
          onClick={() => setExpandedSection(expandedSection === 'recommendations' ? null : 'recommendations')}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">
              💡 Recommendations ({recommendations.length})
            </h3>
            <span className="text-blue-600">{expandedSection === 'recommendations' ? '−' : '+'}</span>
          </div>
          {expandedSection === 'recommendations' && (
            <div className="mt-3 space-y-3">
              {recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="text-sm bg-white p-2 rounded">
                  <div className="font-medium text-blue-900">{rec.title}</div>
                  <div className="text-blue-700 text-xs mt-1">{rec.description}</div>
                  <div className="text-green-600 text-xs mt-1">Impact: {rec.impact}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Channel Performance */}
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpandedSection(expandedSection === 'channels' ? null : 'channels')}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">📊 Channel Performance</h3>
          <span className="text-gray-600">{expandedSection === 'channels' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'channels' && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {['sms', 'kakao', 'email'].map((channel) => {
              const metrics = channelMetrics[channel] || {};
              return (
                <div key={channel} className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-sm font-medium text-gray-700 capitalize">{channel}</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {metrics.openRate?.toFixed(1) || metrics.clickRate?.toFixed(1) || '—'}%
                  </div>
                  <div className="text-xs text-gray-500">
                    {metrics.sent || 0} sent
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={fetchTodayReport}
        className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
      >
        ↻ Refresh Report
      </button>
    </div>
  );
}
