'use client';

import { useState, useEffect, useRef } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { useRouter } from 'next/navigation';

interface Notification {
  id: number;
  notificationType: string;
  title: string;
  content: string;
  relatedCustomerId: number | null;
  relatedNoteId: number | null;
  relatedMessageId: number | null;
  isRead: boolean;
  priority: string;
  createdAt: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [teamMessageCount, setTeamMessageCount] = useState(0); // 팀 메시지 개수
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 알림 로드
  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/notifications?includeRead=false&limit=10', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 팀 메시지 개수 로드
  const loadTeamMessageCount = async () => {
    try {
      const isPartner = window.location.pathname.startsWith('/partner');
      if (!isPartner) return; // 파트너 페이지에서만 팀 메시지 카운트 표시

      const response = await fetch('/api/partner/messages?type=received', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.ok && data.messages) {
        const unreadTeamMessages = data.messages.filter((msg: any) => !msg.isRead);
        setTeamMessageCount(unreadTeamMessages.length);
      }
    } catch (error) {
      console.error('Failed to load team message count:', error);
    }
  };

  // 알림 읽음 처리
  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notificationId }),
      });
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markAllAsRead: true }),
      });
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // 알림 클릭 처리
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.relatedCustomerId) {
      router.push(`/admin/customers/${notification.relatedCustomerId}`);
      setIsOpen(false);
    } else if (notification.relatedMessageId) {
      router.push(`/admin/messages`);
      setIsOpen(false);
    }
  };

  // 폴링 시작 (30초마다, 서버 부하 최소화)
  useEffect(() => {
    // 초기 로드
    loadNotifications();
    loadTeamMessageCount();

    // 페이지가 보일 때만 폴링 (탭이 비활성화되면 중지)
    const startPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          loadNotifications();
          loadTeamMessageCount();
        }
      }, 30000); // 30초마다
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    startPolling();

    // 페이지 가시성 변경 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
        loadTeamMessageCount();
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 알림 타입별 아이콘 및 색상
  const getNotificationStyle = (notification: Notification) => {
    switch (notification.priority) {
      case 'urgent':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'normal':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="relative">
      {/* 알림 종 버튼 */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        className="relative p-2.5 hover:bg-white/20 rounded-xl transition-all"
        title="알림"
      >
        <FiBell size={22} className="text-white drop-shadow-sm" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-white text-slate-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 목록 모달 */}
      {isOpen && (
        <>
          {/* 배경 클릭 시 닫기 */}
          <div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          {/* 알림 패널 - 화면 중앙 고정 모달 */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-200 z-[9999] max-h-[80vh] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">알림</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    모두 읽음
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <FiX size={18} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* 알림 목록 */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  알림이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${notification.isRead
                        ? 'border-transparent bg-white'
                        : 'border-slate-900 bg-slate-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-slate-900">
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-slate-900 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {notification.content}
                          </p>
                          <span className="text-xs text-slate-400 mt-1 block">
                            {new Date(notification.createdAt).toLocaleString('ko-KR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / Quick Menu */}
            <div className="p-3 border-t border-slate-100 bg-slate-50">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const isPartner = window.location.pathname.startsWith('/partner');
                    if (isPartner) {
                      const pathParts = window.location.pathname.split('/');
                      const partnerId = pathParts[2];
                      if (partnerId) {
                        router.push(`/partner/${partnerId}/messages`);
                      } else {
                        console.error('Partner ID not found in URL');
                      }
                    } else {
                      router.push('/admin/affiliate/team-dashboard');
                    }
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-900 transition-colors relative"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  팀 메시지
                  {teamMessageCount > 0 && (
                    <span className="ml-1 bg-slate-900 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {teamMessageCount > 9 ? '9+' : teamMessageCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    router.push('/admin/message-center');
                    setIsOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  전체 알림
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


