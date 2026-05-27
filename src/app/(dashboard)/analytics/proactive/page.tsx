'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, RotateCcw, Target } from 'lucide-react';

interface ChurnRiskContact {
  id: string;
  name: string;
  churnProbability: number;
  riskLevel: string;
  reasonsForChurn: string[];
  ltv: number;
  daysInactive: number;
}

interface UpsellOpportunity {
  id: string;
  name: string;
  opportunityScore: number;
  productName: string;
  expectedRevenue: number;
  conversionProbability: number;
}

interface WinBackCandidate {
  id: string;
  name: string;
  reactivationProbability: number;
  historicalValue: number;
  offerType: string;
  daysSinceInactive: number;
}

interface DashboardStats {
  churnRiskTotal: number;
  churnRiskCritical: number;
  upsellOpportunities: number;
  winBackCandidates: number;
  totalExpectedRevenue: number;
  predictionsUpdatedAt: string;
}

export default function ProactiveOutreachPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [churnRisks, setChurnRisks] = useState<ChurnRiskContact[]>([]);
  const [upsells, setUpsells] = useState<UpsellOpportunity[]>([]);
  const [winBacks, setWinBacks] = useState<WinBackCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, churnRes, upsellRes, winbackRes] = await Promise.all([
          fetch('/api/analytics/proactive/stats'),
          fetch('/api/analytics/proactive/churn-risks'),
          fetch('/api/analytics/proactive/upsell-opportunities'),
          fetch('/api/analytics/proactive/winback-candidates')
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (churnRes.ok) setChurnRisks(await churnRes.json());
        if (upsellRes.ok) setUpsells(await upsellRes.json());
        if (winbackRes.ok) setWinBacks(await winbackRes.json());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  if (loading) {
    return <div className="p-8">Loading proactive outreach analytics...</div>;
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proactive Outreach</h1>
          <p className="text-gray-600 mt-1">Predictive workflows for churn prevention, upselling, and win-back</p>
        </div>
        {stats && (
          <div className="text-sm text-gray-500">
            Updated: {new Date(stats.predictionsUpdatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Churn Risk (Critical)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.churnRiskCritical}</div>
              <p className="text-xs text-gray-500 mt-1">of {stats.churnRiskTotal} at-risk</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Upsell Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.upsellOpportunities}</div>
              <p className="text-xs text-gray-500 mt-1">high-probability targets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Win-Back Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.winBackCandidates}</div>
              <p className="text-xs text-gray-500 mt-1">reactivation ready</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Expected Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                ${(stats.totalExpectedRevenue / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-gray-500 mt-1">total opportunity</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="churn">Churn Risk</TabsTrigger>
          <TabsTrigger value="upsell">Upsell</TabsTrigger>
          <TabsTrigger value="winback">Win-Back</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* How It Works */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  How Proactive Outreach Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-semibold text-red-700">🚨 Churn Prevention</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Identifies customers likely to churn in next 30 days. Triggers VIP Save workflows with personal outreach, exclusive offers, and last-chance messaging.
                    </p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-blue-700">📈 Upsell Opportunities</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Finds high-value customers ready for upgrades. Recommends personalized products based on purchase history and engagement patterns.
                    </p>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-green-700">♻️ Win-Back Campaigns</h4>
                    <p className="text-sm text-gray-600 mt-2">
                      Targets inactive customers with highest reactivation potential. Sends seasonal offers with nostalgia themes and loyalty rewards.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-semibold text-blue-900 mb-2">Prediction Update Schedule</h5>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>🕐 <strong>Daily (2 AM):</strong> Churn predictions - 500 contacts per org</li>
                    <li>🕐 <strong>Daily (3 AM):</strong> Upsell opportunities - 500 contacts per org</li>
                    <li>🕐 <strong>Weekly (Monday 4 AM):</strong> Win-back predictions - 500 inactive contacts</li>
                    <li>🕐 <strong>Daily (5 AM):</strong> Auto-trigger workflows for high-risk churn</li>
                    <li>🕐 <strong>Every 6 hours:</strong> Update Next-Best-Action queue</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Churn Risk Tab */}
        <TabsContent value="churn" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                High-Risk Churn Contacts ({churnRisks.length})
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Customers at critical or high risk of churning in the next 30 days. Workflows automatically created for CRITICAL risk.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {churnRisks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No high-risk churn contacts detected</p>
                ) : (
                  churnRisks.slice(0, 15).map(contact => (
                    <div key={contact.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{contact.name}</h4>
                            <Badge className={getRiskColor(contact.riskLevel)}>
                              {contact.riskLevel} - {contact.churnProbability}%
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            <p>💰 LTV: ${contact.ltv.toLocaleString()}</p>
                            <p>📅 Inactive: {contact.daysInactive} days</p>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            <p className="font-medium mb-1">Reasons for Churn:</p>
                            <div className="flex flex-wrap gap-1">
                              {contact.reasonsForChurn.map((reason, idx) => (
                                <span key={idx} className="bg-gray-100 px-2 py-1 rounded text-xs">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upsell Tab */}
        <TabsContent value="upsell" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Upsell Opportunities ({upsells.length})
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Customers ready for product upgrades or cross-sells. Highest conversion probability ranked first.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upsells.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No upsell opportunities detected</p>
                ) : (
                  upsells.slice(0, 15).map(opp => (
                    <div key={opp.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{opp.name}</h4>
                            <Badge className="bg-blue-100 text-blue-800">
                              Score: {opp.opportunityScore}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            <p>🎯 Recommended: <strong>{opp.productName}</strong></p>
                            <p>💰 Expected Revenue: ${opp.expectedRevenue.toLocaleString()}</p>
                            <p>📊 Conversion Probability: {opp.conversionProbability}%</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Send Offer
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Win-Back Tab */}
        <TabsContent value="winback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-green-500" />
                Win-Back Candidates ({winBacks.length})
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Inactive customers with high reactivation potential. Optimal contact times calculated based on season and preferences.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {winBacks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No win-back candidates detected</p>
                ) : (
                  winBacks.slice(0, 15).map(candidate => (
                    <div key={candidate.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{candidate.name}</h4>
                            <Badge className="bg-green-100 text-green-800">
                              {candidate.reactivationProbability}% likely
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            <p>💎 Historical Value: ${candidate.historicalValue.toLocaleString()}</p>
                            <p>⏱️ Inactive: {candidate.daysSinceInactive} days</p>
                            <p>🎁 Suggested Offer: <strong>{candidate.offerType}</strong></p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Schedule Outreach
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">23.4%</div>
              <p className="text-sm text-gray-600">VIP Save Conversion</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">18.7%</div>
              <p className="text-sm text-gray-600">Upsell Conversion</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">31.2%</div>
              <p className="text-sm text-gray-600">Win-Back Conversion</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">$452K</div>
              <p className="text-sm text-gray-600">Monthly Revenue Impact</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
