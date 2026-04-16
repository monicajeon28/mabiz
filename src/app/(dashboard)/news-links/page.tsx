"use client";
import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw, Newspaper } from "lucide-react";
import { showError } from "@/components/ui/Toast";

type NewsLink = { id: string; shortCode: string; title: string; url: string; createdAt: string };

export default function NewsLinksPage() {
  const [links,   setLinks]   = useState<NewsLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [copied,  setCopied]  = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/tools/news-links').then(r => r.json())
      .then(d => { if (d.ok) setLinks(d.links ?? []); })
      .catch(() => showError('로드 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    await fetch('/api/cron/news-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    }).catch(() => {});
    load();
    setSyncing(false);
  };

  const copy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6" /> 크루즈닷 뉴스 링크
          </h1>
          <p className="text-sm text-gray-500 mt-1">SMS [링크] 치환 변수에 사용할 뉴스 URL</p>
        </div>
        <button onClick={sync} disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>아직 동기화된 뉴스가 없습니다</p>
          <button onClick={sync} className="mt-3 text-sm text-blue-600 underline">지금 동기화</button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <div key={link.id} className="border rounded-xl p-4 bg-white shadow-sm flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{link.title}</p>
                <p className="text-xs text-blue-600 mt-0.5">{link.url}</p>
              </div>
              <button onClick={() => copy(link.url, link.id)}
                className="shrink-0 p-2 hover:bg-gray-100 rounded-lg">
                {copied === link.id
                  ? <Check className="w-4 h-4 text-green-500" />
                  : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center">
        크루즈닷에서 뉴스 발행 시 자동 동기화됩니다
      </p>
    </div>
  );
}
