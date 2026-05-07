// Service Worker for Web Push Notifications

self.addEventListener('push', e => {
  try {
    const data = e.data ? e.data.json() : { title: '알림', body: '알림이 도착했습니다' };
    const { title, body, icon = '/icon-192.png', badge, tag = 'call-notification', data: notifData = {} } = data;

    e.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        data: notifData,
        requireInteraction: false,
      })
    );
  } catch (err) {
    console.error('푸시 알림 표시 실패:', err);
  }
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // 기존 탭 중 같은 경로의 탭을 찾으면 포커스
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 탭 열기
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// 알림 닫기 이벤트
self.addEventListener('notificationclose', e => {
  // 선택 사항: 닫힌 알림 추적
});
