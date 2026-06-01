/**
 * Report History Page (TASK 6-2)
 *
 * Display table of daily reports with:
 * - Date | Revenue | Conversion | Alert Count | Top Partner
 * - Filters: Last 7/30/90 days
 * - Click row → expand details (all report sections)
 * - Export to CSV/PDF
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReportRow {
  id: string;
  reportDate: string;
  revenue: number;
  conversionRate: number;
  alertCount: number;
  topPartner: string;
  topPartnerRevenue: number;
  status: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'7' | '30' | '90'>('30');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<any>(null);

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const days = parseInt(filter);
      const response = await fetch(`/api/analytics/reports?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch reports');

      const data = await response.json();
      setReports(data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const expandRow = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    try {
      const response = await fetch(`/api/analytics/reports/${id}`);
      if (!response.ok) throw new Error('Failed to fetch details');

      const data = await response.json();
      setExpandedData(data);
      setExpandedId(id);
    } catch (err) {
      console.error('Error expanding row:', err);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Revenue', 'Conversion Rate', 'Alerts', 'Top Partner'];
    const rows = reports.map((r) => [
      r.reportDate,
      `$${(r.revenue / 100).toFixed(0)}`,
      `${r.conversionRate.toFixed(2)}%`,
      r.alertCount,
      r.topPartner,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Reports</h1>
          <p className="text-gray-600 mt-1">Performance metrics and insights</p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          ⬇️ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['7', '30', '90'] as const).map((days) => (
          <button
            key={days}
            onClick={() => setFilter(days)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Last {days} days
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-600">No reports found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Conversion
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Alerts
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Top Partner
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((report) => (
                <React.Fragment key={report.id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => expandRow(report.id)}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {new Date(report.reportDate).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-green-600 font-medium">
                      ${(report.revenue / 100).toFixed(0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-600 font-medium">
                      {report.conversionRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          report.alertCount > 0
                            ? report.alertCount > 2
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {report.alertCount} {report.alertCount === 1 ? 'alert' : 'alerts'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {report.topPartner || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-gray-600">
                        {expandedId === report.id ? '−' : '+'}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expandedId === report.id && expandedData && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-6">
                        <div className="space-y-6">
                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded border-l-4 border-blue-500">
                              <div className="text-sm text-gray-600 font-medium">
                                Revenue
                              </div>
                              <div className="text-2xl font-bold text-gray-900 mt-1">
                                ${(expandedData.revenue / 100).toFixed(0)}
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded border-l-4 border-green-500">
                              <div className="text-sm text-gray-600 font-medium">
                                Conversion Rate
                              </div>
                              <div className="text-2xl font-bold text-gray-900 mt-1">
                                {expandedData.conversionRate.toFixed(2)}%
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded border-l-4 border-purple-500">
                              <div className="text-sm text-gray-600 font-medium">
                                SMS Open Rate
                              </div>
                              <div className="text-2xl font-bold text-gray-900 mt-1">
                                {expandedData.smsOpenRate.toFixed(1)}%
                              </div>
                            </div>
                            <div className="bg-white p-4 rounded border-l-4 border-orange-500">
                              <div className="text-sm text-gray-600 font-medium">
                                Email Open Rate
                              </div>
                              <div className="text-2xl font-bold text-gray-900 mt-1">
                                {expandedData.emailOpenRate.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* Alerts */}
                          {expandedData.alerts && expandedData.alerts.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3">
                                Alerts ({expandedData.alerts.length})
                              </h4>
                              <div className="space-y-2">
                                {expandedData.alerts.map((alert: any, i: number) => (
                                  <div
                                    key={i}
                                    className={`p-3 rounded text-sm ${
                                      alert.type === 'RED'
                                        ? 'bg-red-50 text-red-800'
                                        : 'bg-yellow-50 text-yellow-800'
                                    }`}
                                  >
                                    <strong>{alert.metric}:</strong> {alert.message}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Recommendations */}
                          {expandedData.recommendations &&
                            expandedData.recommendations.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-3">
                                  Recommendations ({expandedData.recommendations.length})
                                </h4>
                                <div className="space-y-2">
                                  {expandedData.recommendations.map(
                                    (rec: any, i: number) => (
                                      <div key={i} className="bg-blue-50 p-3 rounded">
                                        <div className="font-medium text-blue-900">
                                          {rec.title}
                                        </div>
                                        <div className="text-sm text-blue-800 mt-1">
                                          {rec.description}
                                        </div>
                                        <div className="text-sm text-green-600 mt-1">
                                          Impact: {rec.impact}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Top Partners */}
                          {expandedData.topPartners &&
                            expandedData.topPartners.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-3">
                                  Top Partners
                                </h4>
                                <div className="space-y-2">
                                  {expandedData.topPartners.map(
                                    (partner: any, i: number) => (
                                      <div
                                        key={i}
                                        className="flex justify-between items-center bg-white p-3 rounded"
                                      >
                                        <span className="text-gray-900 font-medium">
                                          {partner.name}
                                        </span>
                                        <span className="text-green-600 font-medium">
                                          ${partner.revenue.toFixed(0)}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
