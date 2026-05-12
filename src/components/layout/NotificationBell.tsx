"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { logger } from "@/lib/logger";

type FeedItem = {
  id:        string;
  type:      'LANDING_REG' | 'SALE_PENDING' | 'GOLD_INQUIRY' | 'B2B_LEAD' | 'NEW_CONTACT' | 'ORG_CONTRACT' | 'CALL_DUE';
  name:      string;
  phone:     string | null;
  detail:    string | null;
  amount:    number | null;
  linkPath:  string;
  createdAt: string;
};

const TYPE_CONFIG = {
  LANDING_REG:  { label: '랜딩 신규 등록', emoji: '👤', color: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500'   },
  SALE_PENDING: { label: '판매 승인 대기', emoji: '💰', color: 'bg-amber-50 border-amber-200',  dot: 'bg-amber-500'  },
  GOLD_INQUIRY: { label: '골드문의 신규',  emoji: '⭐', color: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  B2B_LEAD:     { label: 'B2B 잠재고객',  emoji: '🏢', color: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  NEW_CONTACT:  { label: '신규 고객',      emoji: '📋', color: 'bg-green-50 border-green-200',   dot: 'bg-green-500'  },
  ORG_CONTRACT: { label: '신규 대리점',    emoji: '🤝', color: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  CALL_DUE:     { label: '오늘 콜 예정',    emoji: '📞', color: 'bg-rose-50 border-rose-200',    dot: 'bg-rose-500'   },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const since = localStorage.getItem("mabiz_notification_since") ?? "";
      const url = since
        ? `/api/notifications/feed?since=${encodeURIComponent(since)}`
        : "/api/notifications/feed";
      const res = await fetch(url);
      const d = (await res.json()) as { ok: boolean; items?: FeedItem[] };
      if (d.ok) setItems(d.items ?? []);
    } catch (err) {
      logger.log("[NotificationBell] fetchFeed 실패", { err });
    } finally {
      setLoading(false);
    }
  };

  // 마운트 시 + 10초마다 폴링 (백그라운드 탭에서는 중단)
  // + 서비스 워커 등록 및 푸시 권한 요청
  useEffect(() => {
    fetchFeed();

    // 서비스 워커 등록 (처음 1회)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
        logger.log('[NotificationBell] SW 등록 실패', { err: err.message });
      });
    }

    // 푸시 권한 상태 확인
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }

    let interval: ReturnType<typeof setInterval> | null = setInterval(fetchFeed, 30_000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (interval) { clearInterval(interval); interval = null; }
      } else {
        fetchFeed(); // 탭 복귀 시 즉시 갱신
        interval = setInterval(fetchFeed, 30_000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = () => {
    localStorage.setItem("mabiz_notification_since", new Date().toISOString());
    setItems([]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchFeed();
        }}
        className="relative p-2 rounded-lg hover:bg-navy-700 transition-colors"
        aria-label="알림"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {items.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">
              신규 DB 알림
            </span>
            {items.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline"
              >
                모두 확인
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="p-4 text-xs text-gray-400 text-center">
                불러오는 중...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-4 text-xs text-gray-400 text-center">
                새 알림이 없습니다
              </div>
            )}
            {!loading &&
              items.map((item) => {
                const cfg = TYPE_CONFIG[item.type];
                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 border-b last:border-0 border ${cfg.color}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-xs font-semibold text-gray-600 flex-1">
                        {cfg.emoji} {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-800">
                      {item.name}
                      {item.phone && (
                        <span className="ml-2 text-xs text-gray-500 font-normal">{item.phone}</span>
                      )}
                      {item.detail && (
                        <span className="ml-2 text-xs text-gray-500 font-normal">{item.detail}</span>
                      )}
                    </div>
                    {item.amount != null && (
                      <div className="text-xs text-gray-700 font-semibold mt-0.5">
                        {(item.amount / 10000).toLocaleString()}만원
                      </div>
                    )}
                    <button
                      onClick={() => {
                        router.push(item.linkPath);
                        setOpen(false);
                      }}
                      className="mt-1.5 text-xs text-blue-600 hover:underline"
                    >
                      → 바로가기
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
