'use client';

import { useState } from 'react';
import useSWR from 'swr';

interface Campaign {
  id: string;
  name: string;
  messageType: 'SMS' | 'KAKAO' | 'EMAIL';
  templateDay: 0 | 1 | 2 | 3;
  psychologyLens: string;
  totalContacts: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  conversionCount: number;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED';
  createdAt: string;
}

export default function CampaignsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data } = useSWR('/api/campaigns', (url) =>
    fetch(url).then((r) => r.json())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaign Management</h1>
            <p className="text-gray-600 mt-2">Create and manage SMS/Kakao/Email campaigns</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Create Campaign
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {data?.campaigns && data.campaigns.length > 0 ? (
            <div className="space-y-4">
              {data.campaigns.map((campaign: Campaign) => (
                <div key={campaign.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{campaign.name}</h3>
                      <div className="text-sm text-gray-600">
                        {campaign.messageType} · Day {campaign.templateDay} · {campaign.psychologyLens}
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-100">
                      {campaign.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t">
                    <div><div className="text-2xl font-bold">{campaign.totalContacts}</div><div className="text-xs text-gray-600">Contacts</div></div>
                    <div><div className="text-2xl font-bold">{campaign.sentCount}</div><div className="text-xs text-gray-600">Sent</div></div>
                    <div><div className="text-2xl font-bold">{((campaign.openCount / campaign.sentCount) * 100).toFixed(1)}%</div><div className="text-xs text-gray-600">Open Rate</div></div>
                    <div><div className="text-2xl font-bold">{((campaign.clickCount / campaign.sentCount) * 100).toFixed(1)}%</div><div className="text-xs text-gray-600">Click Rate</div></div>
                    <div><div className="text-2xl font-bold">{((campaign.conversionCount / campaign.sentCount) * 100).toFixed(1)}%</div><div className="text-xs text-gray-600">Conversion</div></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-600">No campaigns yet. Create one to get started.</div>
          )}
        </div>
      </div>
    </div>
  );
}
