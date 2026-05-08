'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiSave, FiRefreshCw } from 'react-icons/fi';
import { showError, showSuccess } from '@/components/ui/Toast';

type PartnerMallEditClientProps = {
  partnerId: string;
  profile: any;
};

export default function PartnerMallEditClient({ partnerId, profile }: PartnerMallEditClientProps) {
  const [formState, setFormState] = useState({
    profileTitle: profile.profileTitle || '',
    landingAnnouncement: profile.landingAnnouncement || '',
    welcomeMessage: profile.welcomeMessage || '',
  });
  const [saving, setSaving] = useState(false);

  const partnerBase = `/partner/${partnerId}`;
  const dashboardUrl = `/partner/${partnerId}/dashboard`;

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/partner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profileTitle: formState.profileTitle,
          landingAnnouncement: formState.landingAnnouncement,
          welcomeMessage: formState.welcomeMessage,
        }),
      });

      let json;
      try {
        const text = await res.text();
        if (!text) {
          throw new Error('서버 응답이 비어있습니다.');
        }
        json = JSON.parse(text);
      } catch (parseError) {
        console.error('[PartnerMallEdit] JSON parse error:', parseError);
        throw new Error('서버 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
      }

      if (!res.ok || !json.ok) {
        const errorMessage = json.message || `프로필 저장에 실패했습니다. (상태 코드: ${res.status})`;
        console.error('[PartnerMallEdit] save error:', {
          status: res.status,
          statusText: res.statusText,
          json,
        });
        throw new Error(errorMessage);
      }

      showSuccess('개인몰 정보가 저장되었습니다.');
    } catch (error: any) {
      console.error('[PartnerMallEdit] save error', error);
      const errorMessage = error?.message || '개인몰 정보 저장 중 오류가 발생했습니다.';
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-10 md:px-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4">
          <Link
            href={dashboardUrl}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <FiArrowLeft className="text-base" />
            돌아가기
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">개인몰 편집</h1>
        </div>

        {/* 안내 */}
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-blue-900 mb-2">고객에게 보여지는 파트너몰 정보</h2>
          <p className="text-sm text-blue-700 mb-2">
            파트너몰의 제목, 랜딩 공지사항, 환영 메시지를 편집할 수 있습니다. 이 정보는 고객이 <span className="font-semibold">/{partnerId}/shop</span> 링크를 통해 방문할 때 보여지는 파트너몰 페이지에 표시됩니다.
          </p>
          <div className="mt-3 rounded-lg bg-white border border-blue-300 p-3">
            <p className="text-xs font-semibold text-blue-900 mb-1">파트너몰 링크:</p>
            <p className="text-xs text-blue-700 break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/${partnerId}/shop` : `/${partnerId}/shop`}
            </p>
          </div>
        </section>

        {/* 편집 폼 */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">프로필 제목</label>
            <input
              type="text"
              value={formState.profileTitle}
              onChange={(e) => setFormState((prev) => ({ ...prev, profileTitle: e.target.value }))}
              placeholder="예: 크루즈 여행 전문가"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">랜딩 공지사항</label>
            <textarea
              value={formState.landingAnnouncement}
              onChange={(e) => setFormState((prev) => ({ ...prev, landingAnnouncement: e.target.value }))}
              placeholder="고객에게 보여질 공지사항을 입력하세요..."
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">환영 메시지</label>
            <textarea
              value={formState.welcomeMessage}
              onChange={(e) => setFormState((prev) => ({ ...prev, welcomeMessage: e.target.value }))}
              placeholder="고객을 환영하는 메시지를 입력하세요..."
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                setFormState({
                  profileTitle: profile.profileTitle || '',
                  landingAnnouncement: profile.landingAnnouncement || '',
                  welcomeMessage: profile.welcomeMessage || '',
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              disabled={saving}
            >
              <FiRefreshCw className="text-base" />
              되돌리기
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
            >
              <FiSave className="text-base" />
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

