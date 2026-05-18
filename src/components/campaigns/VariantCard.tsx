'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Trash2 } from 'lucide-react';

interface VariantCardProps {
  variant: 'A' | 'B';
  data?: {
    id: string;
    smsBody?: string;
    emailSubject?: string;
    emailBody?: string;
    trafficSplit: number;
  };
  onSave: (content: any) => void;
  onUpdate: (content: any) => void;
  onDelete: () => void;
  isLoading: boolean;
  isDraftOnly: boolean;
}

export function VariantCard({
  variant,
  data,
  onSave,
  onUpdate,
  onDelete,
  isLoading,
  isDraftOnly,
}: VariantCardProps) {
  const [smsBody, setSmsBody] = useState(data?.smsBody || '');
  const [emailSubject, setEmailSubject] = useState(data?.emailSubject || '');
  const [emailBody, setEmailBody] = useState(data?.emailBody || '');
  const [trafficSplit, setTrafficSplit] = useState(data?.trafficSplit || 0.5);
  const [isEditing, setIsEditing] = useState(!data);

  const charCount = smsBody.length;
  const charLimit = 90;
  const progress = (charCount / charLimit) * 100;

  const handleSave = () => {
    const content = {
      smsBody: smsBody || null,
      emailSubject: emailSubject || null,
      emailBody: emailBody || null,
      trafficSplit,
    };

    if (data) {
      onUpdate(content);
    } else {
      onSave(content);
    }

    setIsEditing(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('복사되었습니다!');
  };

  return (
    <Card className="p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Variant {variant}</h2>
          {data && <Badge className="ml-2">생성됨</Badge>}
        </div>
        <div className="flex gap-2">
          {data && isDraftOnly && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? '취소' : '✏️ 수정'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onDelete}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-6">
          {/* SMS 본문 */}
          <div>
            <Label htmlFor={`sms-${variant}`} className="mb-2 block">
              📱 SMS 본문
              <span className="text-xs text-gray-500 ml-2">
                {charCount}/{charLimit}자
              </span>
            </Label>
            <Textarea
              id={`sms-${variant}`}
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value.slice(0, charLimit))}
              placeholder="SMS 메시지를 입력하세요..."
              maxLength={charLimit}
              className="h-24 resize-none"
            />
            {/* 진행 바 */}
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  charCount > charLimit * 0.9 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Email 제목 */}
          <div>
            <Label htmlFor={`email-subject-${variant}`} className="mb-2 block">
              📧 Email 제목
            </Label>
            <Input
              id={`email-subject-${variant}`}
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="이메일 제목을 입력하세요..."
              maxLength={200}
            />
          </div>

          {/* Email 본문 */}
          <div>
            <Label htmlFor={`email-body-${variant}`} className="mb-2 block">
              📧 Email 본문
            </Label>
            <Textarea
              id={`email-body-${variant}`}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="이메일 본문을 입력하세요..."
              className="h-32 resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {emailBody.length}/5000자
            </p>
          </div>

          {/* 트래픽 분할 */}
          <div>
            <Label className="mb-2 block">🎯 트래픽 분할</Label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-semibold min-w-20">
                {variant}: {Math.round(trafficSplit * 100)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              반대편: {Math.round((1 - trafficSplit) * 100)}%
            </p>
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? '저장 중...' : '💾 저장'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* SMS 미리보기 */}
          {smsBody && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">
                📱 SMS 미리보기
              </p>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">
                  {smsBody}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(smsBody)}
                className="mt-2"
              >
                <Copy className="w-4 h-4 mr-1" />
                복사
              </Button>
            </div>
          )}

          {/* Email 미리보기 */}
          {emailSubject && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">
                📧 Email 미리보기
              </p>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                <p className="font-semibold text-gray-800">{emailSubject}</p>
                {emailBody && (
                  <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">
                    {emailBody}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 트래픽 분할 */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm font-semibold text-blue-900">
              📊 트래픽 분할: {Math.round(trafficSplit * 100)}%
            </p>
            <p className="text-xs text-blue-700 mt-1">
              이 Variant로 {Math.round(trafficSplit * 100)}% 고객 발송
            </p>
          </div>

          {!smsBody && !emailSubject && !emailBody && (
            <p className="text-sm text-gray-500 italic">아직 내용을 작성하지 않았습니다.</p>
          )}
        </div>
      )}
    </Card>
  );
}
