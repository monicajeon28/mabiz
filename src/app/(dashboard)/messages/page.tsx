'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function MessagesPage() {
  const [messageType, setMessageType] = useState<'sms' | 'kakao'>('sms');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!phone || !content) {
      setResult({ ok: false, message: '전화번호와 내용을 입력해주세요' });
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        messageType === 'sms'
          ? '/api/messages/send-sms'
          : '/api/messages/send-kakao';
      const res = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ phone, content }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      setResult(data);

      if (data.ok) {
        setPhone('');
        setContent('');
      }
    } catch (err) {
      setResult({ ok: false, message: '발송 실패' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>메시지 발송</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 메시지 타입 선택 */}
          <div className="flex gap-2">
            <Button
              variant={messageType === 'sms' ? 'default' : 'outline'}
              onClick={() => setMessageType('sms')}
            >
              📱 SMS
            </Button>
            <Button
              variant={messageType === 'kakao' ? 'default' : 'outline'}
              onClick={() => setMessageType('kakao')}
            >
              💬 카카오톡
            </Button>
          </div>

          {/* 입력 폼 */}
          <Input
            placeholder="전화번호 (010-1234-5678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Textarea
            placeholder="메시지 내용"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
          />

          {/* 발송 버튼 */}
          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? '발송 중...' : '발송'}
          </Button>

          {/* 결과 */}
          {result && (
            <div
              className={`p-3 rounded ${
                result.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {result.ok ? '✓' : '✕'} {result.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
