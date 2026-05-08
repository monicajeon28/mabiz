'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Pause, Play, Trash2 } from 'lucide-react';

interface MessageControlPanelProps {
  organizationId: string;
}

interface MessageStatus {
  id: number;
  status: string;
  scheduledAt?: Date;
}

export function MessageControlPanel({ organizationId }: MessageControlPanelProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch messages
  const { data: messages } = useQuery({
    queryKey: ['pendingMessages', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/messages/logs?organizationId=${organizationId}&limit=100`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/admin/messages/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationId,
          messageIds: ids,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pause messages');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionSuccess(`${selectedIds.length} message(s) paused`);
      setSelectedIds([]);
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Failed to pause messages');
      setTimeout(() => setActionError(null), 5000);
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/admin/messages/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          organizationId,
          messageIds: ids,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resume messages');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionSuccess(`${selectedIds.length} message(s) resumed`);
      setSelectedIds([]);
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Failed to resume messages');
      setTimeout(() => setActionError(null), 5000);
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch('/api/admin/messages/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          messageIds: ids,
          reason: cancelReason,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel messages');
      }
      return response.json();
    },
    onSuccess: () => {
      setActionSuccess(`${selectedIds.length} message(s) cancelled`);
      setSelectedIds([]);
      setCancelReason('');
      setShowCancelDialog(false);
      setTimeout(() => setActionSuccess(null), 3000);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Failed to cancel messages');
      setTimeout(() => setActionError(null), 5000);
    },
  });

  const messageList = messages?.data?.logs || [];
  const isLoading = pauseMutation.isPending || resumeMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => pauseMutation.mutate(selectedIds)}
          disabled={selectedIds.length === 0 || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-300"
        >
          <Pause className="w-4 h-4" />
          Pause ({selectedIds.length})
        </button>
        <button
          onClick={() => resumeMutation.mutate(selectedIds)}
          disabled={selectedIds.length === 0 || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
        >
          <Play className="w-4 h-4" />
          Resume ({selectedIds.length})
        </button>
        <button
          onClick={() => {
            if (cancelReason.length >= 10) {
              cancelMutation.mutate(selectedIds);
            } else {
              setShowCancelDialog(true);
            }
          }}
          disabled={selectedIds.length === 0 || isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
        >
          <Trash2 className="w-4 h-4" />
          Cancel ({selectedIds.length})
        </button>
      </div>

      {/* Alerts */}
      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700">
          <AlertCircle className="w-5 h-5" />
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-green-700">
          <CheckCircle className="w-5 h-5" />
          {actionSuccess}
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Cancel Messages</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for cancelling {selectedIds.length} message(s):
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason (min 10 characters)..."
              className="w-full p-2 border rounded mb-4 min-h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={500}
            />
            <div className="text-sm text-gray-500 mb-4">
              {cancelReason.length}/500
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => cancelMutation.mutate(selectedIds)}
                disabled={cancelReason.length < 10 || isLoading}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 text-left w-8">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(messageList.map((m: any) => m.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  checked={selectedIds.length > 0 && selectedIds.length === messageList.length}
                />
              </th>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {messageList.map((message: any) => (
              <tr key={message.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(message.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds([...selectedIds, message.id]);
                      } else {
                        setSelectedIds(selectedIds.filter((id) => id !== message.id));
                      }
                    }}
                  />
                </td>
                <td className="p-3">{message.id}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      message.status === 'sent'
                        ? 'bg-green-100 text-green-700'
                        : message.status === 'paused'
                          ? 'bg-amber-100 text-amber-700'
                          : message.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {message.status}
                  </span>
                </td>
                <td className="p-3">{message.scheduledAt ? new Date(message.scheduledAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
