'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Eye, Trash2 } from 'lucide-react';

const DEFAULT_TEMPLATE = `<!-- FORM_TOP -->
<section class="text-center pt-12 pb-20 px-4">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-4xl md:text-6xl font-black leading-tight my-8">
      <span class="text-yellow-400">"비교불가 차원이 다른 압도적인 시스템"</span>
      <span class="block text-2xl md:text-3xl font-bold mt-4 text-gray-200">
        고객을 '인솔'하고 '관리'하는<br />
        크루즈 마케터 전문가 과정
      </span>
    </h1>
  </div>
</section>
<!-- FORM_MIDDLE -->
`;

interface Partner {
  id: number;
  name: string | null;
  phone: string | null;
  mallUserId: string | null;
  affiliateType: string | null;
}

export default function B2BEditorPage() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [previewPartnerId, setPreviewPartnerId] = useState('test');

  // Partner Selection State
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('global');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPartners();
    fetchTemplate('global');
  }, []);

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/members?affiliateType=affiliate&limit=200', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.members) {
        setPartners(
          data.members.map((m: Record<string, unknown>) => ({
            id: m.id,
            name: m.name,
            phone: m.phone,
            mallUserId: m.mallUserId,
            affiliateType: m.affiliateType,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to fetch partners', e);
    }
  };

  const fetchTemplate = async (targetId: string) => {
    setLoading(true);
    try {
      const partnerId = targetId !== 'global' ? targetId : undefined;
      const url = partnerId
        ? `/api/b2b/templates?partnerId=${encodeURIComponent(partnerId)}`
        : '/api/b2b/templates';

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (data.ok && data.config?.configValue) {
        setHtml(data.config.configValue);
      } else if (targetId !== 'global') {
        // 파트너별 템플릿이 없으면 전역 템플릿을 base로 불러오기
        console.log('No custom template found, loading global template as base');
        const globalRes = await fetch('/api/b2b/templates', {
          credentials: 'include',
        });
        const globalData = await globalRes.json();
        if (globalData.ok && globalData.config?.configValue) {
          setHtml(globalData.config.configValue);
        } else {
          setHtml(DEFAULT_TEMPLATE);
        }
      } else {
        setHtml(DEFAULT_TEMPLATE);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: '템플릿 로드 실패' });
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedPartnerId(newId);
    fetchTemplate(newId);

    if (newId === 'global') {
      setPreviewPartnerId('test');
    } else {
      const partner = partners.find((p) => p.id.toString() === newId);
      if (partner) {
        setPreviewPartnerId(
          partner.mallUserId || partner.phone || 'test'
        );
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: { htmlContent: string; partnerId?: string } = {
        htmlContent: html,
      };
      if (selectedPartnerId !== 'global') {
        body.partnerId = selectedPartnerId;
      }

      const res = await fetch('/api/b2b/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.ok) {
        setMessage({
          type: 'success',
          text:
            selectedPartnerId === 'global'
              ? '전역 템플릿이 저장되었습니다. 모든 파트너에게 반영됩니다.'
              : '해당 파트너의 개별 템플릿이 저장되었습니다.',
        });
      } else {
        throw new Error(data.message || data.error);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `저장 실패: ${errMsg}` });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (selectedPartnerId === 'global') return;
    if (
      !confirm(
        '이 파트너의 개별 템플릿을 삭제하고 전역 템플릿을 사용하시겠습니까?'
      )
    )
      return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/b2b/templates?partnerId=${encodeURIComponent(selectedPartnerId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (data.ok) {
        setMessage({
          type: 'success',
          text: '개별 템플릿이 삭제되었습니다. 전역 템플릿을 불러옵니다.',
        });
        fetchTemplate('global');
      } else {
        throw new Error(data.message || data.error);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: `초기화 실패: ${errMsg}` });
    } finally {
      setSaving(false);
    }
  };

  const filteredPartners = partners.filter(
    (p) =>
      (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (p.phone?.includes(searchTerm) ?? false) ||
      (p.mallUserId?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            B2B 유입 랜딩페이지 편집기
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedPartnerId === 'global'
              ? '모든 파트너에게 적용되는 기본 템플릿을 수정합니다.'
              : '선택한 파트너에게만 적용되는 개별 템플릿을 수정합니다.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Partner Selector */}
          <div className="relative">
            <input
              type="text"
              placeholder="파트너 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white mb-1 text-sm"
            />
            <select
              value={selectedPartnerId}
              onChange={handlePartnerChange}
              className="w-full md:w-64 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="global">전역 기본 템플릿 (Global)</option>
              <optgroup label="대리점장 선택">
                {filteredPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '이름없음'} ({p.mallUserId || p.phone || p.id})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="flex gap-2">
            <a
              href={`/b2b/p/${previewPartnerId}?preview=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">미리보기</span>
            </a>
            {selectedPartnerId !== 'global' && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-2"
                title="전역 템플릿으로 초기화"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">초기화</span>
              </button>
            )}
            <button
              onClick={() => fetchTemplate(selectedPartnerId)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 mb-6 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Guide */}
      <div className="mb-4 text-sm text-gray-600 bg-yellow-50 p-4 rounded border border-yellow-200">
        <h3 className="font-bold text-yellow-800 text-lg mb-2">
          HTML 편집 가이드 (필독)
        </h3>
        <div className="space-y-3">
          <div>
            <p className="font-bold text-gray-800">
              1. 입력폼 자동 생성 (이름, 연락처)
            </p>
            <p className="mt-1">
              아래의 <strong>주석 코드</strong>를 원하는 위치에 붙여넣으면,
              해당 위치에{' '}
              <span className="text-blue-600 font-bold">
                이름 입력칸, 연락처 입력칸, 신청하기 버튼
              </span>
              이 자동으로 생성됩니다.
            </p>
            <div className="mt-2 p-2 bg-gray-800 text-yellow-300 font-mono rounded text-xs">
              {'<!-- FORM_TOP -->'}
              <span className="text-gray-400">
                {' // 상단용 입력폼 (주로 메인 비주얼 아래)'}
              </span>
              <br />
              {'<!-- FORM_MIDDLE -->'}
              <span className="text-gray-400">
                {' // 중간용 입력폼 (설명 섹션 사이)'}
              </span>
            </div>
            <p className="mt-1 text-red-600 text-xs font-bold">
              * 주의: 직접 &lt;input&gt; 태그를 작성하지 마세요! 위 주석
              코드만 넣으면 시스템이 알아서 입력폼을 만들어줍니다.
            </p>
          </div>

          <div className="border-t border-yellow-200 pt-2">
            <p className="font-bold text-gray-800">2. 적용 범위</p>
            <p>
              전역 템플릿을 수정하면{' '}
              <strong>모든 파트너(대리점장, 판매원)</strong>의 B2B
              랜딩페이지에 공통으로 적용됩니다. 파트너를 선택하면 해당
              파트너에게만 적용되는 개별 템플릿을 수정합니다.
            </p>
          </div>

          <div className="border-t border-yellow-200 pt-2">
            <p className="font-bold text-gray-800">3. 스타일링</p>
            <p>
              Tailwind CSS 클래스를 자유롭게 사용하여 디자인할 수
              있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* Editor */}
      {loading ? (
        <div className="h-96 flex items-center justify-center text-gray-500">
          로딩 중...
        </div>
      ) : (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="w-full h-[800px] font-mono text-sm p-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-900 text-gray-100"
          spellCheck={false}
        />
      )}
    </div>
  );
}
