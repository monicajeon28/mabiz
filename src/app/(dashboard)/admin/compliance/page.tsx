/**
 * 🔐 보안 & 컴플라이언스 대시보드
 * /admin/compliance
 *
 * 탭:
 * 1. Audit Logs - 모든 감시 로그 조회 및 필터
 * 2. PII Access - PII 접근 통계 및 이상 탐지
 * 3. Compliance Status - GDPR/CCPA/한국 규정 준수 현황
 * 4. Data Requests - 데이터 접근/삭제 요청 관리
 *
 * 2026-05-27 Compliance Monitor Agent
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  status: string;
  ipAddress?: string;
  createdAt: string;
  purpose?: string;
}

interface ComplianceStatus {
  gdpr: { passed: number; total: number };
  ccpa: { passed: number; total: number };
  korean: { passed: number; total: number };
  overallScore: number;
  issues: string[];
}

interface DataDeletionRequest {
  id: string;
  contactId: string;
  status: string;
  requestedAt: string;
  scheduledDeleteAt: string;
  reason: string;
}

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState('audit-logs');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [compliance, setCompliance] = useState<ComplianceStatus | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<DataDeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState<{
    summary?: { piiAccessCountToday?: number; anomalyCount?: number };
    topPiiAccessors?: { userId: string; count: number }[];
    recentAnomalies?: { id: number; anomalyType: string; severity: string; createdAt: string }[];
  }>({});

  // 필터
  const [actionFilter, setActionFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('7days');

  useEffect(() => {
    fetchData();
  }, [actionFilter, dateRangeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [auditRes, complianceRes, deletionRes] = await Promise.all([
        fetch(
          `/api/admin/compliance/audit-logs?action=${actionFilter}&range=${dateRangeFilter}`
        ),
        fetch('/api/admin/compliance/monitoring'),
        fetch('/api/admin/compliance/deletion-requests'),
      ]);

      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }

      if (complianceRes.ok) {
        const data = await complianceRes.json();
        setCompliance(data);
        setMonitoring(data);
      }

      if (deletionRes.ok) {
        const data = await deletionRes.json();
        setDeletionRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'DENIED':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getDeletionStatus = (status: string) => {
    switch (status) {
      case 'PENDING_DELETION':
        return <Badge variant="outline" className="bg-yellow-50">유예중</Badge>;
      case 'SCHEDULED_FOR_DELETE':
        return <Badge variant="outline" className="bg-orange-50">삭제예정</Badge>;
      case 'HARD_DELETED':
        return <Badge variant="outline" className="bg-gray-50">삭제됨</Badge>;
      case 'RESTORED':
        return <Badge variant="outline" className="bg-blue-50">복구됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">보안 & 컴플라이언스</h1>
        <p className="text-gray-600 mt-1">
          감시 로그, PII 접근 제어, 규정 준수 현황 모니터링
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="audit-logs">감시 로그</TabsTrigger>
          <TabsTrigger value="pii-access">PII 접근</TabsTrigger>
          <TabsTrigger value="compliance-status">규정 준수</TabsTrigger>
          <TabsTrigger value="data-requests">데이터 요청</TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="audit-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>감시 로그</CardTitle>
              <CardDescription>
                모든 시스템 액션 기록 (7년 보관)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">모든 액션</SelectItem>
                    <SelectItem value="READ">조회</SelectItem>
                    <SelectItem value="WRITE">수정</SelectItem>
                    <SelectItem value="DELETE">삭제</SelectItem>
                    <SelectItem value="EXPORT">수출</SelectItem>
                    <SelectItem value="LOGIN">로그인</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24hours">24시간</SelectItem>
                    <SelectItem value="7days">7일</SelectItem>
                    <SelectItem value="30days">30일</SelectItem>
                    <SelectItem value="90days">90일</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={fetchData}>새로고침</Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  로딩 중...
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>사용자</TableHead>
                        <TableHead>액션</TableHead>
                        <TableHead>리소스</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>시간</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            로그 데이터 없음
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-sm">
                              {log.userId?.slice(-8) || '시스템'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="text-sm">{log.resourceType}</div>
                                {log.resourceId && (
                                  <div className="text-xs text-gray-500">
                                    {log.resourceId.slice(-8)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusIcon(log.status)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.ipAddress || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {format(
                                new Date(log.createdAt),
                                'yyyy-MM-dd HH:mm:ss',
                                { locale: ko }
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PII Access Tab */}
        <TabsContent value="pii-access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PII 접근 제어</CardTitle>
              <CardDescription>
                개인정보 접근 패턴 및 이상 탐지
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      오늘 PII 접근
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {monitoring.summary?.piiAccessCountToday ?? '—'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">실시간 집계</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      이상 탐지
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {monitoring.recentAnomalies?.length ?? 0}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">최근 30일</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      PII 상위 접근자
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {monitoring.topPiiAccessors?.length ?? 0}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Top 5 사용자</p>
                  </CardContent>
                </Card>
              </div>

              {/* 이상 탐지 목록 */}
              {(monitoring.recentAnomalies?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  {monitoring.recentAnomalies!.map((a) => (
                    <div key={a.id} className={`border rounded-lg p-3 flex items-center gap-3 ${
                      a.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                      a.severity === 'HIGH' ? 'bg-orange-50 border-orange-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                        a.severity === 'CRITICAL' ? 'text-red-600' :
                        a.severity === 'HIGH' ? 'text-orange-600' : 'text-blue-600'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{a.anomalyType}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(a.createdAt).toLocaleString('ko-KR')} · {a.severity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Status Tab */}
        <TabsContent value="compliance-status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>규정 준수 현황</CardTitle>
              <CardDescription>
                GDPR, CCPA, 한국 데이터보호법 준수 점수
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {compliance ? (
                <>
                  {/* 종합 점수 */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">종합 규정 준수 점수</p>
                        <p className="text-4xl font-bold text-indigo-600 mt-2">
                          {compliance.overallScore}%
                        </p>
                      </div>
                      <div className="w-24 h-24 rounded-full flex items-center justify-center bg-white border-4 border-indigo-600">
                        <span className="text-2xl font-bold text-indigo-600">
                          {compliance.overallScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 규정별 상세 */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* GDPR */}
                    <Card className="border-blue-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          🇪🇺 GDPR
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Math.round((compliance.gdpr.passed / compliance.gdpr.total) * 100)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {compliance.gdpr.passed}/{compliance.gdpr.total} 항목 준수
                        </p>
                      </CardContent>
                    </Card>

                    {/* CCPA */}
                    <Card className="border-yellow-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          🇺🇸 CCPA
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Math.round((compliance.ccpa.passed / compliance.ccpa.total) * 100)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {compliance.ccpa.passed}/{compliance.ccpa.total} 항목 준수
                        </p>
                      </CardContent>
                    </Card>

                    {/* Korean */}
                    <Card className="border-red-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          🇰🇷 한국 개보법
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Math.round((compliance.korean.passed / compliance.korean.total) * 100)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {compliance.korean.passed}/{compliance.korean.total} 항목 준수
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 문제점 */}
                  {compliance.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">⚠️ 해결 필요 사항</h4>
                      {compliance.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900"
                        >
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  로딩 중...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Requests Tab */}
        <TabsContent value="data-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>데이터 요청 관리</CardTitle>
              <CardDescription>
                삭제 요청 및 데이터 접근 요청 (GDPR Article 15, 17)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  로딩 중...
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Contact ID</TableHead>
                        <TableHead>요청 사유</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>요청일</TableHead>
                        <TableHead>삭제 예정일</TableHead>
                        <TableHead>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletionRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            진행 중인 요청 없음
                          </TableCell>
                        </TableRow>
                      ) : (
                        deletionRequests.map(req => (
                          <TableRow key={req.id}>
                            <TableCell className="font-mono text-sm">
                              {req.contactId.slice(-8)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {req.reason.length > 40
                                ? `${req.reason.slice(0, 40)}...`
                                : req.reason}
                            </TableCell>
                            <TableCell>
                              {getDeletionStatus(req.status)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(
                                new Date(req.requestedAt),
                                'yyyy-MM-dd',
                                { locale: ko }
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(
                                new Date(req.scheduledDeleteAt),
                                'yyyy-MM-dd',
                                { locale: ko }
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                상세보기
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
