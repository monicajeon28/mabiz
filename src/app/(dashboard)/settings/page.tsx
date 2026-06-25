'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Mail, Users, Shield, FileText, Lock, ScrollText, CheckCircle, XCircle, Download } from 'lucide-react';

const items = [
  {
    href: '/settings/documents',
    icon: FileText,
    title: '서류 제출',
    desc: '신분증, 통장사본 업로드 — 정산 승인 필수',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    href: '/settings/contract',
    icon: ScrollText,
    title: '계약 정보',
    desc: '계약 상태, 서명일, 유효기간 확인',
    color: 'bg-sky-50 text-sky-600',
  },
  {
    href: '/settings/password',
    icon: Lock,
    title: '비밀번호 변경',
    desc: '로그인 비밀번호 변경 (아이디 변경 불가)',
    color: 'bg-slate-50 text-slate-600',
  },
  {
    href: '/settings/sms',
    icon: MessageSquare,
    title: '문자(SMS) 설정',
    desc: '자동으로 문자 보내기 (서비스 연결)',
    color: 'bg-green-50 text-green-600',
  },
  {
    href: '/settings/email',
    icon: Mail,
    title: '이메일 설정',
    desc: '자동으로 이메일 보내기 (서비스 연결)',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/settings/members',
    icon: Users,
    title: '팀원 관리',
    desc: '대리점장 초대, 할 일 설정',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    href: '/settings/organization',
    icon: Shield,
    title: '조직 설정',
    desc: '회사명 변경, 플랜 확인, 대리점 코드',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    href: '/settings/backup',
    icon: Download,
    title: '데이터 자동 저장',
    desc: '고객 정보를 자동으로 저장 (안전하게 보관)',
    color: 'bg-indigo-50 text-indigo-600',
  },
];

type DocStatus = { hasIdCard: boolean; hasBankBook: boolean };

export default function SettingsPage() {
  const [docs, setDocs] = useState<DocStatus | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/settings/documents/upload', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (d.ok) setDocs({ hasIdCard: d.hasIdCard, hasBankBook: d.hasBankBook }); })
      .catch((e) => { if (e.name !== 'AbortError') { /* 로드 실패 무시 */ } });
    return () => ctrl.abort();
  }, []);

  const allDocs = docs?.hasIdCard && docs?.hasBankBook;

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <h1 className="text-xl font-bold text-navy-900 mb-4">설정</h1>

      {/* 서류 제출 상태 배너 */}
      {docs !== null && (
        <div className={`mb-4 rounded-xl border p-3.5 flex items-center gap-3 ${
          allDocs ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {allDocs ? (
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${allDocs ? 'text-green-800' : 'text-amber-800'}`}>
              {allDocs ? '서류 제출 완료' : '서류 미제출'}
            </p>
            <p className={`text-xs mt-0.5 ${allDocs ? 'text-green-700' : 'text-amber-700'}`}>
              {allDocs
                ? '신분증 ✓ 통장사본 ✓ — 정산 승인 준비됐습니다.'
                : `${!docs.hasIdCard ? '신분증 ' : ''}${!docs.hasBankBook ? '통장사본 ' : ''}미제출 — 정산 승인 전 필수입니다.`}
            </p>
          </div>
          {!allDocs && (
            <Link
              href="/settings/documents"
              className="shrink-0 text-xs font-semibold text-amber-700 underline hover:no-underline"
            >
              업로드
            </Link>
          )}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-gold-300 hover:shadow-sm transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <span className="ml-auto text-gray-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
