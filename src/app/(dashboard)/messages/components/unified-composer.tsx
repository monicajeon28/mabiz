"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  Mail,
  MessageCircle,
  Send,
  AlertCircle,
  Eye,
  Copy,
  CheckCircle2,
  Lightbulb,
  Clock,
  Edit2,
} from "lucide-react";
import { convertMessageForChannel } from "@/lib/services/multi-channel-campaign";
import type { MessageChannel } from "@/lib/types/multi-channel";
import { logger } from "@/lib/logger";

interface UnifiedComposerProps {
  groups: Array<{ id: string; name: string; _count: { members: number } }>;
  templates: Array<{
    id: string;
    title: string;
    content: string;
    category: string | null;
  }>;
  onSubmit?: (data: {
    channels: MessageChannel[];
    message: string;
    groupIds: string[];
    scheduleAt?: Date | null;
    templateId?: string;
  }) => Promise<void>;
}

// 채널별 색상/아이콘
const CHANNEL_CONFIG: Record<
  MessageChannel,
  {
    label: string;
    icon: React.ReactNode;
    bgColor: string;
    color: string;
    limit: number;
    cost: number;
  }
> = {
  SMS: {
    label: "SMS",
    icon: <MessageSquare className="w-4 h-4" />,
    bgColor: "bg-blue-50",
    color: "text-blue-600",
    limit: 90,
    cost: 50,
  },
  KAKAO: {
    label: "카카오",
    icon: <MessageCircle className="w-4 h-4" />,
    bgColor: "bg-yellow-50",
    color: "text-yellow-600",
    limit: 1000,
    cost: 30,
  },
  EMAIL: {
    label: "이메일",
    icon: <Mail className="w-4 h-4" />,
    bgColor: "bg-purple-50",
    color: "text-purple-600",
    limit: 2000,
    cost: 0,
  },
};

export function UnifiedComposer({
  groups,
  templates,
  onSubmit,
}: UnifiedComposerProps) {
  const [channels, setChannels] = useState<MessageChannel[]>(["SMS"]);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [useSchedule, setUseSchedule] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<MessageChannel>("SMS");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 템플릿 선택 시 메시지 자동 채우기
  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        setMessage(template.content);
        setShowTemplates(false);
      }
    }
  }, [selectedTemplate, templates]);

  // 총 수신자 수 계산
  const totalRecipients = useMemo(() => {
    return selectedGroups.reduce((sum, groupId) => {
      const group = groups.find((g) => g.id === groupId);
      return sum + (group?._count.members || 0);
    }, 0);
  }, [selectedGroups, groups]);

  // 채널별 변환된 메시지 및 제안
  const channelMessages = useMemo(() => {
    return channels.reduce(
      (acc, channel) => {
        const result = convertMessageForChannel(message, channel, true);
        acc[channel] = result;
        return acc;
      },
      {} as Record<MessageChannel, { message: string; suggestions?: string[] }>
    );
  }, [message, channels]);

  // 예상 비용 계산
  const estimatedCost = useMemo(() => {
    return channels.reduce((sum, channel) => {
      const cost = CHANNEL_CONFIG[channel].cost;
      return sum + totalRecipients * cost;
    }, 0);
  }, [channels, totalRecipients]);

  // 채널 토글
  const handleChannelToggle = (channel: MessageChannel) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  // 모든 채널 선택
  const handleSelectAllChannels = () => {
    setChannels(["SMS", "KAKAO", "EMAIL"]);
  };

  // 그룹 토글
  const handleGroupToggle = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((g) => g !== groupId)
        : [...prev, groupId]
    );
  };

  // 발송 처리
  const handleSubmit = async () => {
    if (!message.trim()) {
      alert("메시지를 입력하세요.");
      return;
    }

    if (channels.length === 0) {
      alert("최소 1개 이상의 채널을 선택하세요.");
      return;
    }

    if (selectedGroups.length === 0) {
      alert("최소 1개 이상의 그룹을 선택하세요.");
      return;
    }

    if (onSubmit) {
      try {
        setSubmitting(true);
        await onSubmit({
          channels,
          message,
          groupIds: selectedGroups,
          scheduleAt: useSchedule ? scheduleAt : null,
          templateId: selectedTemplate || undefined,
        });
      } catch (error) {
        logger.error("UnifiedComposer 발송 실패", {
          error: error instanceof Error ? error.message : String(error)
        });
        alert("발송 중 오류가 발생했습니다.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ━━━ 채널 선택 ━━━ */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          채널 선택
        </h3>

        <div className="flex flex-wrap gap-3 mb-4">
          {(Object.keys(CHANNEL_CONFIG) as MessageChannel[]).map((channel) => {
            const config = CHANNEL_CONFIG[channel];
            const isSelected = channels.includes(channel);

            return (
              <button
                key={channel}
                onClick={() => handleChannelToggle(channel)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  isSelected
                    ? `${config.bgColor} border-blue-400`
                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={isSelected ? config.color : "text-gray-600"}>
                  {config.icon}
                </span>
                <span
                  className={`text-sm font-medium ${
                    isSelected ? config.color : "text-gray-600"
                  }`}
                >
                  {config.label}
                </span>
                <span className="ml-1 text-sm text-gray-500">
                  ₩{config.cost}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSelectAllChannels}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          모든 채널 선택
        </button>
      </div>

      {/* ━━━ 메시지 작성 ━━━ */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Edit2 className="w-4 h-4" />
          메시지 작성
        </h3>

        {/* 제목 (이메일용) */}
        {channels.includes("EMAIL") && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일 제목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="이메일 제목을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 메시지 본문 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            메시지 본문
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="메시지를 입력하세요..."
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* 글자 수 표시 (채널별) */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {channels.map((channel) => {
            const config = CHANNEL_CONFIG[channel];
            const converted = channelMessages[channel];
            const charCount = converted?.message.length || 0;
            const exceeded = charCount > config.limit;

            return (
              <div
                key={channel}
                className={`p-3 rounded-lg border text-sm ${
                  exceeded
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="font-medium">{config.label}</div>
                <div
                  className={`mt-1 ${
                    exceeded ? "text-red-600 font-semibold" : "text-gray-600"
                  }`}
                >
                  {charCount} / {config.limit}자
                </div>
              </div>
            );
          })}
        </div>

        {/* 제안사항 */}
        {showSuggestions && message.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 text-sm">
            <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              {channels.flatMap(
                (channel) => channelMessages[channel].suggestions || []
              )}
            </div>
          </div>
        )}
      </div>

      {/* ━━━ 미리보기 ━━━ */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            채널별 미리보기
          </h3>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showPreview ? "접기" : "펼치기"}
          </button>
        </div>

        {showPreview && channels.length > 0 && (
          <div className="space-y-4">
            {channels.map((channel) => {
              const config = CHANNEL_CONFIG[channel];
              const converted = channelMessages[channel];

              return (
                <div
                  key={channel}
                  className={`p-4 rounded-lg border-2 ${config.bgColor} border-gray-200`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={config.color}>{config.icon}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {config.label} 미리보기
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded border text-sm text-gray-700 whitespace-pre-wrap">
                    {converted?.message || message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ━━━ 그룹 선택 ━━━ */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          수신 그룹 선택
        </h3>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedGroups.includes(group.id)}
                onChange={() => handleGroupToggle(group.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-900">{group.name}</span>
              <span className="text-sm text-gray-500">
                ({group._count.members}명)
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* ━━━ 스케줄링 ━━━ */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={useSchedule}
            onChange={(e) => setUseSchedule(e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            발송 예약
          </label>
        </div>

        {useSchedule && (
          <input
            type="datetime-local"
            value={scheduleAt ? scheduleAt.toISOString().slice(0, 16) : ""}
            onChange={(e) =>
              setScheduleAt(
                e.target.value ? new Date(e.target.value) : null
              )
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        )}
      </div>

      {/* ━━━ 요약 및 발송 ━━━ */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-5">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">채널</div>
            <div className="text-lg font-bold text-gray-900">
              {channels.length}개
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">수신자</div>
            <div className="text-lg font-bold text-gray-900">
              {totalRecipients}명
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">예상 비용</div>
            <div className="text-lg font-bold text-gray-900">
              ₩{estimatedCost.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600">평균 비용/명</div>
            <div className="text-lg font-bold text-gray-900">
              ₩{totalRecipients > 0 ? (estimatedCost / totalRecipients).toFixed(0) : 0}
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !message.trim() ||
            channels.length === 0 ||
            selectedGroups.length === 0
          }
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <div className="animate-spin">⏳</div>
              발송 중...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              지금 발송 {useSchedule && "(예약)"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
