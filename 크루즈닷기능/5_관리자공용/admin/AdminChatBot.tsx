'use client';

import { useState, useRef, useEffect } from 'react';
import { FiMessageCircle, FiX, FiSend, FiMinimize2, FiMaximize2 } from 'react-icons/fi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AdminChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '안녕하세요! 관리자 도우미입니다. 🎉\n\n어떤 도움이 필요하신가요?\n\n• 기능 사용법 질문\n• 고객 검색 도움\n• 데이터 조회 방법\n• 시스템 문의\n\n언제든지 물어보세요!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || '응답을 받을 수 없습니다.');
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || '응답을 생성할 수 없습니다.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[AdminChatBot] Failed to send message:', error);
      let errorContent = '죄송합니다. 오류가 발생했습니다.';
      
      if (error instanceof Error) {
        console.error('[AdminChatBot] Error details:', error.message, error.stack);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorContent = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
        } else if (error.message.includes('401') || error.message.includes('403')) {
          errorContent = '인증이 필요합니다. 관리자 로그인을 다시 해주세요.';
        } else {
          errorContent = `오류: ${error.message}`;
        }
      }
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent + '\n\n다시 시도해 주세요.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-red hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-110"
        aria-label="관리자 도우미 열기"
      >
        <FiMessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isMinimized ? 'w-80' : 'w-96'
      }`}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col h-[600px] max-h-[80vh]">
        {/* 헤더 */}
        <div className="bg-brand-red text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiMessageCircle className="w-5 h-5" />
            <span className="font-semibold">관리자 도우미</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-red-700 rounded transition-colors"
              aria-label={isMinimized ? '확대' : '축소'}
            >
              {isMinimized ? (
                <FiMaximize2 className="w-4 h-4" />
              ) : (
                <FiMinimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-red-700 rounded transition-colors"
              aria-label="닫기"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-brand-red text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="메시지를 입력하세요..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-none disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-brand-red hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="전송"
                >
                  <FiSend className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* 축소된 상태 */}
        {isMinimized && (
          <div className="p-4 text-center text-gray-600 text-sm">
            채팅봇이 축소되었습니다. 확대 버튼을 클릭하여 다시 열 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}

