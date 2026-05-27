'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface VariantResult {
  variant: string;
  visitors: number;
  completions: number;
  completionRate: number;
  avgCompletionTimeMs: number;
  confidence: number;
  isWinner: boolean;
}

interface TestMetadata {
  totalSubmissions: number;
  estimatedTotalVisitors: number;
  testStatus: string;
  minSampleRequired: number;
  minConfidenceRequired: number;
}

export default function ABTestResultsPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [days, setDays] = useState(14);

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/admin/loop5/ab-test-results?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [days]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchResults, 60000); // 1분 새로고침
    return () => clearInterval(interval);
  }, [autoRefresh, days]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>데이터 로딩 중...</p>
      </div>
    );
  }

  if (!results) {
    return <div className="error-container">데이터를 불러올 수 없습니다.</div>;
  }

  const { testPeriod, variants, metadata } = results as {
    testPeriod: { startDate: string; endDate: string; days: number };
    variants: VariantResult[];
    metadata: TestMetadata;
  };

  const statusColors: Record<string, string> = {
    WARMING_UP: '#FFA500',
    ONGOING: '#3182CE',
    COMPLETE: '#22863A',
  };

  const exportToCSV = () => {
    const csv = [
      ['변형', '방문자', '완성', '완성율(%)', '평균시간(초)', '신뢰도(%)', '승자'],
      ...variants.map(v => [
        v.variant,
        v.visitors,
        v.completions,
        (v.completionRate * 100).toFixed(1),
        (v.avgCompletionTimeMs / 1000).toFixed(1),
        v.confidence,
        v.isWinner ? '✅' : '',
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `loop5-ab-test-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="ab-test-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Loop 5-C A/B 테스트 결과</h1>
        <p className="subtitle">CTA/폼 최적화 성과 분석</p>
      </div>

      {/* Controls */}
      <div className="dashboard-controls">
        <div className="control-group">
          <label htmlFor="days-select">테스트 기간:</label>
          <select
            id="days-select"
            value={days}
            onChange={e => setDays(parseInt(e.target.value, 10))}
          >
            <option value={7}>최근 7일</option>
            <option value={14}>최근 14일</option>
            <option value={30}>최근 30일</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="auto-refresh">
            <input
              id="auto-refresh"
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            자동 새로고침 (1분)
          </label>
        </div>

        <button className="btn-refresh" onClick={fetchResults}>
          새로고침
        </button>

        <button className="btn-export" onClick={exportToCSV}>
          CSV 내보내기
        </button>
      </div>

      {/* Test Period Info */}
      <div className="test-info">
        <div className="info-box">
          <span className="label">테스트 기간:</span>
          <span className="value">
            {format(new Date(testPeriod.startDate), 'MMM dd', { locale: ko })} ~{' '}
            {format(new Date(testPeriod.endDate), 'MMM dd', { locale: ko })}
          </span>
        </div>

        <div className="info-box">
          <span className="label">총 제출:</span>
          <span className="value">{metadata.totalSubmissions.toLocaleString()}</span>
        </div>

        <div className="info-box">
          <span className="label">예상 방문:</span>
          <span className="value">{metadata.estimatedTotalVisitors.toLocaleString()}</span>
        </div>

        <div className="info-box">
          <span className="label">상태:</span>
          <span
            className="status-badge"
            style={{ backgroundColor: statusColors[metadata.testStatus] || '#9CA3AF' }}
          >
            {metadata.testStatus === 'WARMING_UP' && '🔥 워밍업'}
            {metadata.testStatus === 'ONGOING' && '⏳ 진행중'}
            {metadata.testStatus === 'COMPLETE' && '✅ 완료'}
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div className="results-section">
        <h2>변형별 성과</h2>

        <div className="table-responsive">
          <table className="results-table">
            <thead>
              <tr>
                <th>변형</th>
                <th>방문자</th>
                <th>완성</th>
                <th>완성율</th>
                <th>평균시간</th>
                <th>신뢰도</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(variant => (
                <tr key={variant.variant} className={variant.isWinner ? 'winner' : ''}>
                  <td className="variant-name">
                    <strong>{variant.variant.toUpperCase()}</strong>
                    {variant.variant === 'a' && <span className="tag">Control</span>}
                    {variant.variant === 'b' && <span className="tag">Action</span>}
                    {variant.variant === 'c' && <span className="tag">Urgent</span>}
                  </td>
                  <td>{variant.visitors.toLocaleString()}</td>
                  <td>{variant.completions.toLocaleString()}</td>
                  <td>
                    <strong>{(variant.completionRate * 100).toFixed(1)}%</strong>
                  </td>
                  <td>{(variant.avgCompletionTimeMs / 1000).toFixed(1)}초</td>
                  <td>
                    {variant.confidence > 0 ? (
                      <span className="confidence-high">{variant.confidence}%</span>
                    ) : (
                      <span className="confidence-low">계산중</span>
                    )}
                  </td>
                  <td>
                    {variant.isWinner && <span className="badge winner-badge">✅ 승자</span>}
                    {!variant.isWinner && variant.confidence >= 95 && (
                      <span className="badge loser-badge">❌ 패자</span>
                    )}
                    {variant.confidence < 95 && (
                      <span className="badge progress-badge">⏳ 진행중</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Insights */}
      <div className="insights-section">
        <h2>주요 인사이트</h2>

        <div className="insights-grid">
          {/* Best Performer */}
          {variants.length > 0 && (
            <div className="insight-card">
              <h3>최고 성과</h3>
              {(() => {
                const best = variants.reduce((prev, current) =>
                  current.completionRate > prev.completionRate ? current : prev
                );
                return (
                  <>
                    <p className="insight-value">
                      Variant <strong>{best.variant.toUpperCase()}</strong>
                    </p>
                    <p className="insight-detail">{(best.completionRate * 100).toFixed(1)}% 완성율</p>
                  </>
                );
              })()}
            </div>
          )}

          {/* Confidence Status */}
          <div className="insight-card">
            <h3>통계 신뢰도</h3>
            {(() => {
              const hasWinner = variants.some(v => v.isWinner);
              if (hasWinner) {
                return <p className="insight-detail">✅ 승자 결정됨 (p &lt; 0.05)</p>;
              }
              const maxConfidence = Math.max(...variants.map(v => v.confidence));
              return (
                <p className="insight-detail">
                  ⏳ {maxConfidence}% 신뢰도 (95% 목표)
                </p>
              );
            })()}
          </div>

          {/* Sample Size */}
          <div className="insight-card">
            <h3>표본 크기</h3>
            {(() => {
              const maxCompletions = Math.max(...variants.map(v => v.completions));
              const minRequired = metadata.minSampleRequired;
              if (maxCompletions >= minRequired) {
                return <p className="insight-detail">✅ 충분함 ({maxCompletions}명)</p>;
              }
              return (
                <p className="insight-detail">
                  ⏳ {minRequired - maxCompletions}명 부족
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      {variants.some(v => v.isWinner) && (
        <div className="recommendation-box">
          <h2>추천사항</h2>
          <p>
            Variant <strong>{variants.find(v => v.isWinner)?.variant.toUpperCase()}</strong>가
            통계적으로 유의미한 성과를 보였습니다. 이 변형을 기본값으로 배포할 것을 권장합니다.
          </p>
        </div>
      )}

      <style jsx>{`
        .ab-test-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .dashboard-header {
          margin-bottom: 32px;
        }

        .dashboard-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1a202c;
          margin: 0 0 8px 0;
        }

        .subtitle {
          font-size: 14px;
          color: #718096;
        }

        .dashboard-controls {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .control-group label {
          font-size: 14px;
          color: #2d3748;
        }

        .control-group select {
          padding: 6px 10px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 14px;
        }

        .control-group input[type='checkbox'] {
          width: 16px;
          height: 16px;
        }

        .btn-refresh,
        .btn-export {
          padding: 8px 16px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-refresh {
          background: #edf2f7;
          color: #2d3748;
        }

        .btn-refresh:hover {
          background: #e2e8f0;
        }

        .btn-export {
          background: #3182ce;
          color: white;
          border-color: #3182ce;
        }

        .btn-export:hover {
          background: #2c5282;
        }

        .test-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .info-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f7fafc;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .info-box .label {
          font-size: 12px;
          color: #718096;
          font-weight: 600;
        }

        .info-box .value {
          font-size: 16px;
          font-weight: 600;
          color: #1a202c;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .results-section {
          margin-bottom: 32px;
        }

        .results-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
          margin: 0 0 16px 0;
        }

        .table-responsive {
          overflow-x: auto;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .results-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }

        .results-table thead {
          background: #f7fafc;
          border-bottom: 2px solid #e2e8f0;
        }

        .results-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #718096;
          text-transform: uppercase;
        }

        .results-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
          color: #2d3748;
        }

        .results-table tr.winner {
          background: #f0fdf4;
          border-left: 4px solid #22863a;
        }

        .variant-name {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tag {
          display: inline-block;
          padding: 2px 8px;
          background: #e2e8f0;
          border-radius: 4px;
          font-size: 11px;
          color: #4a5568;
          font-weight: 500;
        }

        .confidence-high {
          color: #22863a;
          font-weight: 600;
        }

        .confidence-low {
          color: #a0aec0;
        }

        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .winner-badge {
          background: #dcfce7;
          color: #22863a;
        }

        .loser-badge {
          background: #fee2e2;
          color: #dc2626;
        }

        .progress-badge {
          background: #fef3c7;
          color: #92400e;
        }

        .insights-section {
          margin-bottom: 32px;
        }

        .insights-section h2 {
          font-size: 18px;
          font-weight: 600;
          color: #1a202c;
          margin: 0 0 16px 0;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .insight-card {
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .insight-card h3 {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.9;
          margin: 0 0 8px 0;
        }

        .insight-value {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
        }

        .insight-detail {
          font-size: 14px;
          opacity: 0.95;
          margin: 4px 0 0 0;
        }

        .recommendation-box {
          padding: 16px;
          background: #dcfce7;
          border-left: 4px solid #22863a;
          border-radius: 4px;
          margin-top: 32px;
        }

        .recommendation-box h2 {
          font-size: 14px;
          font-weight: 600;
          color: #22863a;
          margin: 0 0 8px 0;
        }

        .recommendation-box p {
          font-size: 14px;
          color: #166534;
          margin: 0;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #718096;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-top-color: #3182ce;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .dashboard-controls {
            flex-direction: column;
          }

          .control-group {
            width: 100%;
          }

          .btn-refresh,
          .btn-export {
            flex: 1;
          }

          .insights-grid {
            grid-template-columns: 1fr;
          }

          .results-table {
            font-size: 12px;
          }

          .results-table th,
          .results-table td {
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  );
}
