'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { FiX, FiBell } from 'react-icons/fi';

interface LandingPushNotificationPromptProps {
  landingPageId: number;
  pushNotificationEnabled: boolean;
  boardingTime?: string | null;
  disembarkationTime?: string | null;
  departureWarning?: boolean;
}

/**
 * 랜딩페이지 전용 푸시 알림 권한 요청 컴포넌트
 * - 푸시 알림이 활성화된 랜딩페이지에서만 표시
 * - 갑자기 뜨지 않도록 지연 시간 추가 (5초)
 * - 부드러운 애니메이션으로 표시
 */
export function LandingPushNotificationPrompt({
  landingPageId,
  pushNotificationEnabled,
  boardingTime,
  disembarkationTime,
  departureWarning,
}: LandingPushNotificationPromptProps) {
  const { isSupported, isSubscribed, isLoading, error, requestPermission } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // 푸시 알림이 비활성화되어 있으면 표시하지 않음
    if (!pushNotificationEnabled) {
      return;
    }

    // 이미 구독되어 있으면 표시하지 않음
    if (isSubscribed) {
      return;
    }

    // localStorage에서 해제 상태 확인
    const dismissedKey = `landing-push-dismissed-${landingPageId}`;
    const isDismissed = localStorage.getItem(dismissedKey);
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    // 브라우저가 푸시 알림을 지원하지 않으면 표시하지 않음
    if (!isSupported) {
      return;
    }

    // 권한이 이미 거부된 경우 표시하지 않음
    if ('Notification' in window && Notification.permission === 'denied') {
      return;
    }

    // 5초 지연 후 부드럽게 표시 (갑자기 뜨지 않도록)
    const timer = setTimeout(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setShowPrompt(true);
      }, 100); // 애니메이션 시작 후 표시
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [pushNotificationEnabled, isSubscribed, isSupported, landingPageId]);

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    const dismissedKey = `landing-push-dismissed-${landingPageId}`;
    localStorage.setItem(dismissedKey, 'true');
  };

  const handleEnable = async () => {
    try {
      await requestPermission();
      // 성공 후 프롬프트 숨김
      setShowPrompt(false);
      setDismissed(true);
      const dismissedKey = `landing-push-dismissed-${landingPageId}`;
      localStorage.setItem(dismissedKey, 'true');
    } catch {
      // 알림 활성화 실패
    }
  };

  // 표시 조건 확인
  if (!pushNotificationEnabled || dismissed || !showPrompt || isSubscribed || !isSupported) {
    return null;
  }

  // 알림 내용 구성
  const notificationMessages: string[] = [];
  if (boardingTime) {
    notificationMessages.push(`승선 시간 (${boardingTime})`);
  }
  if (disembarkationTime) {
    notificationMessages.push(`하선 시간 (${disembarkationTime})`);
  }
  if (departureWarning) {
    notificationMessages.push('출항 경고');
  }

  const notificationText = notificationMessages.length > 0
    ? notificationMessages.join(', ')
    : '중요한 일정';

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 transition-all duration-500 ${
        isAnimating && showPrompt
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
    >
      <div className="bg-white rounded-lg shadow-2xl border-2 border-blue-200 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <FiBell className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 mb-1 text-sm sm:text-base">
              📱 중요한 여행 알림을 받아보세요
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-3">
              {notificationText} 등 중요한 일정을 놓치지 않도록 알림을 받아보세요.
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm flex-1"
              >
                {isLoading ? '처리 중...' : '알림 켜기'}
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="닫기"
              >
                <FiX className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            {error && (
              <p className="text-xs mt-2 text-red-600">⚠️ {error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



