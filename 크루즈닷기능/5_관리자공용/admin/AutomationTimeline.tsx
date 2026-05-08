'use client';

import { useQuery } from '@tanstack/react-query';
import { AutomationLogEntry } from '@/lib/schemas/automation-log-schema';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AutomationTimelineProps {
  organizationId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ACTION_COLORS: Record<string, string> = {
  import: 'bg-blue-50 border-blue-200',
  group_assigned: 'bg-purple-50 border-purple-200',
  funnel_started: 'bg-green-50 border-green-200',
  message_queued: 'bg-yellow-50 border-yellow-200',
  message_sent: 'bg-green-50 border-green-200',
  message_failed: 'bg-red-50 border-red-200',
  messages_paused: 'bg-amber-50 border-amber-200',
  messages_resumed: 'bg-green-50 border-green-200',
  messages_cancelled: 'bg-red-50 border-red-200',
  config_updated: 'bg-gray-50 border-gray-200',
  user_unsubscribed: 'bg-orange-50 border-orange-200',
  delivery_failed: 'bg-red-50 border-red-200',
  compliance_action: 'bg-indigo-50 border-indigo-200',
};

const ACTION_ICONS: Record<string, string> = {
  import: '📤',
  group_assigned: '👥',
  funnel_started: '🚀',
  message_queued: '⏳',
  message_sent: '✅',
  message_failed: '❌',
  messages_paused: '⏸️',
  messages_resumed: '▶️',
  messages_cancelled: '🛑',
  config_updated: '⚙️',
  user_unsubscribed: '🚪',
  delivery_failed: '📧',
  compliance_action: '🔐',
};

export function AutomationTimeline({
  organizationId,
  autoRefresh = true,
  refreshInterval = 5000,
}: AutomationTimelineProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['automationLogs', organizationId, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        organizationId,
        ...(filter && { action: filter }),
      });
      const response = await fetch(`/api/admin/automation-logs?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin text-2xl">⏳</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-600">Failed to load automation logs</p>
      </div>
    );
  }

  const logs = data?.data?.logs || [];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
            filter === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        {['import', 'group_assigned', 'funnel_started', 'message_sent', 'messages_paused', 'messages_cancelled'].map((action) => (
          <button
            key={action}
            onClick={() => setFilter(action)}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
              filter === action
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {action.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No automation logs found</p>
        ) : (
          logs.map((log: AutomationLogEntry) => (
            <div
              key={log.id}
              className={`border rounded-lg p-4 ${ACTION_COLORS[log.action] || 'bg-gray-50 border-gray-200'}`}
            >
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl">{ACTION_ICONS[log.action]}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {log.action.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                    {log.createdByUser && (
                      <div className="text-xs text-gray-500 mt-1">
                        By: {log.createdByUser.name || log.createdByUser.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-4">
                  {expandedId === log.id ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </div>

              {expandedId === log.id && log.actionDetails && (
                <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                  <pre className="text-xs bg-white rounded p-2 overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(log.actionDetails, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination info */}
      {data?.data?.pagination && (
        <div className="text-center text-sm text-gray-500 mt-4">
          Showing {logs.length} of {data.data.pagination.total} logs
        </div>
      )}
    </div>
  );
}
