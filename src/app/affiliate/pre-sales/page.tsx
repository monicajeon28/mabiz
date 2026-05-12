'use client';

/**
 * /affiliate/pre-sales — 크루즈닷 파트너스 가입 신청 1단계 (공개 페이지, 인증 불필요)
 * 이름/연락처/이메일/주소/SNS채널/지원동기만 수집
 *
 * URL 파라미터:
 *   ?agent=홍길동&agency=강남대리점&agentPhone=010-1234-5678
 *   → 대리점장 소개 모드 자동 활성화 (어필리에이트 링크)
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

const COMPANY = {
  name: '크루즈닷',
  ceo: '배연성',
  phone: '010-3289-3800',
  logo: '/크루즈닷파트너스투명배경.png',
  stamp: '/baeyeonseong-stamp.png',
  cruiseStamp: '/cruise-stamp.png',
};

type Step = 'form' | 'success';

// ── 계약서 본문 ───────────────────────────────────────────────────────

function getContractBody(params: {
  name: string;
  phone: string;
  address: string;
  supervisorName: string;
  supervisorAgency: string;
  supervisorPhone: string;
  useSupervisor: boolean;
}) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const {
    name, phone, address,
    supervisorName, supervisorAgency, supervisorPhone, useSupervisor,
  } = params;

  const supervisorSection = useSupervisor && supervisorName
    ? `담당 대리점장: ${supervisorName} (${supervisorAgency}) / ${supervisorPhone}`
    : `담당: 본사 직속 (${COMPANY.phone})`;

  return `크루즈닷 파트너스 프리랜서 용역계약서

본 계약은 크루즈닷(이하 "갑")과 아래의 "을" 사이에 크루즈 상품 홍보 및 판매 용역에 관하여 다음과 같이 체결한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
계약 당사자
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【 갑 】
  회사명  : 크루즈닷
  대표자  : 배연성
  연락처  : ${COMPANY.phone}

【 을 】
  성  명  : ${name || '                    '}
  연락처  : ${phone || '                    '}
  주  소  : ${address || '                    '}
  ${supervisorSection}

계약 체결일 : ${dateStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제1조 (목적)
본 계약은 갑이 운영하는 크루즈 여행 상품 및 서비스를 을이 홍보·소개하고, 성과에 따른 용역 보수를 지급받는 프리랜서 파트너십 관계를 규율하기 위한 것이다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제2조 (용역의 범위)
① 을은 갑의 크루즈 상품을 잠재 고객에게 소개·홍보하는 활동을 수행한다.
② 을은 갑이 제공하는 마케팅 자료 및 정보를 활용하여 영업 활동을 전개한다.
③ 을은 갑의 영업 시스템(CRM 등)에 등록된 고객 정보를 용역 목적 외에 사용하지 않는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제3조 (보수 및 정산)
① 을의 활동 방식은 개인 어필리에이트 링크를 통한 크루즈 상품 판매이며, 갑은 해당 링크를 통해 확정된 판매 건에 대하여 다음의 기준으로 용역 보수를 지급한다.
   - 기본 수수료 : 판매 금액의 1% ~ 5% (상품별 상이)
   - 수수료율은 갑이 정하는 상품별 정책에 따르며, 사전 공지 후 변경될 수 있다.
② 보수는 해당 크루즈 상품의 출발일에 지급한다.
③ 을이 제공한 정산 계좌 정보가 불일치하는 경우 지급이 보류될 수 있다.
④ 가입비·보증금 등 선납 비용은 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제4조 (타사 영업 허용)
① 을은 본 계약과 동시에 타 회사 또는 타 브랜드의 용역 활동을 병행할 수 있다.
② 단, 갑의 고객 정보·영업 자료·마케팅 콘텐츠를 타사 활동에 활용하는 것은 엄격히 금지한다.
③ 갑의 상표·로고·브랜드명을 타사 영업에 사용하거나 혼동을 일으키는 행위는 금지한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제5조 (콘텐츠 보호 및 무단도용 금지)
① 갑이 제공하는 모든 마케팅 자료, 이미지, 영상, 텍스트, 교육 자료 등의 저작권은 갑에게 귀속된다.
② 을은 갑의 콘텐츠를 갑의 사전 서면 동의 없이 복제·수정·배포·판매하거나 타 플랫폼에 게시할 수 없다.
③ 을이 본 조를 위반할 경우, 갑은 을에 대해 즉시 계약을 해지하고, 손해배상 및 위약벌을 청구할 수 있다.
   - 위약벌 : 위반 행위 1건당 금 삼천만 원(₩30,000,000) 이상
④ 계약 해지 이후에도 취득한 콘텐츠의 무단사용 금지 의무는 유효하다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제6조 (자동 해지 조건)
① 다음 각 호에 해당하는 경우, 별도 통보 없이 본 계약은 자동으로 해지된다.
   1. 을의 판매 실적이 계약 체결일 또는 최종 판매일로부터 연속 5개월간 0건인 경우
   2. 을이 갑의 브랜드 또는 상품에 대한 허위 정보를 유포하거나 명예를 훼손한 경우
   3. 을이 경쟁사의 편의를 위해 갑의 내부 정보를 제공하거나 활동한 경우
② 자동 해지 시 갑은 을에게 이메일 또는 문자로 해지 사실을 통보하여야 한다.
③ 자동 해지 이전의 정산 미지급 보수는 통상적인 절차에 따라 지급한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제7조 (계약 해지 후 브랜드 보호 의무)
① 계약이 해지된 날로부터 2년간, 을은 다음 각 호의 행위를 할 수 없다.
   1. 갑의 상표·로고·브랜드명 및 이와 유사한 명칭을 사용하는 행위
   2. "크루즈닷 파트너스 출신" 또는 유사한 표현으로 마케팅·홍보하는 행위
   3. 갑의 상품과 동일하거나 유사한 상품을 갑의 고객에게 판매하는 행위
② 을이 제1항을 위반할 경우, 갑은 손해배상 외에 위반 기간 동안의 부당 이익에 해당하는 금액을 추가로 청구할 수 있다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제8조 (개인정보 보호)
① 갑과 을은 용역 수행 과정에서 취득한 고객 개인정보를 「개인정보 보호법」에 따라 처리하여야 한다.
② 을은 갑의 고객 정보를 계약 목적 이외의 용도로 이용하거나 제3자에게 제공할 수 없다.
③ 을이 본 조를 위반할 경우, 관계 법령에 따른 민·형사상 책임을 진다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제9조 (일반 조항)
① 본 계약에 명시되지 않은 사항은 갑과 을이 협의하여 결정한다.
② 본 계약과 관련한 분쟁이 발생할 경우, 갑의 주소지를 관할하는 법원을 제1심 법원으로 한다.
③ 본 계약은 전자적 방식(전자서명, 온라인 동의)으로 체결될 수 있으며 이는 서면 계약과 동일한 효력을 갖는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 계약 내용을 확인하고 동의합니다.

${dateStr}

갑 : 크루즈닷 대표 배연성  (인)
을 : ${name || '          '}          (서명)
`;
}

// ── 메인 컴포넌트 (내부) ─────────────────────────────────────────────

function CruiseDotPartnersForm() {
  const searchParams = useSearchParams();

  // URL 파라미터로 어필리에이트 링크 자동 처리
  const agentParam = searchParams.get('agent') ?? '';
  const agencyParam = searchParams.get('agency') ?? '';
  const agentPhoneParam = searchParams.get('agentPhone') ?? '';
  const hasAgentParam = agentParam.length > 0;

  const [step, setStep] = useState<Step>('form');
  const [resultId, setResultId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [contractExpanded, setContractExpanded] = useState(false);
  const [contractRead, setContractRead] = useState(false);

  // 신청자 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // SNS 채널
  const [snsYoutube, setSnsYoutube] = useState('');
  const [snsBlog, setSnsBlog] = useState('');
  const [snsInstagram, setSnsInstagram] = useState('');
  const [snsKakao, setSnsKakao] = useState('');
  const [snsEtc, setSnsEtc] = useState('');
  const [applyNote, setApplyNote] = useState('');

  // 담당 대리점장 (URL 파라미터로 자동 설정)
  const useSupervisor = hasAgentParam;
  const supervisorName = agentParam;
  const supervisorAgency = agencyParam;
  const supervisorPhone = agentPhoneParam;

  // 동의
  const [consents, setConsents] = useState({
    privacy: false,
    contract: false,
    commission: false,
    autoTerminate: false,
    brandProtect: false,
  });

  const allConsents = Object.values(consents).every(Boolean);
  const contractBody = getContractBody({
    name, phone, address,
    supervisorName, supervisorAgency, supervisorPhone, useSupervisor,
  });

  const setConsent = (key: keyof typeof consents) => (checked: boolean) => {
    setConsents((prev) => ({ ...prev, [key]: checked }));
  };

  const handleAllConsent = (checked: boolean) => {
    setConsents({
      privacy: checked,
      contract: checked,
      commission: checked,
      autoTerminate: checked,
      brandProtect: checked,
    });
  };

  const handleContractScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      setContractRead(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || name.trim().length < 2) {
      setErrorMsg('이름을 입력해 주세요.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 9) {
      setErrorMsg('연락처를 입력해 주세요.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('이메일을 입력해 주세요. 승인 시 아이디·임시 비밀번호가 이메일로 발송됩니다.');
      return;
    }
    if (!applyNote.trim()) {
      setErrorMsg('지원 동기를 입력해 주세요.');
      return;
    }
    if (!allConsents) {
      setErrorMsg('필수 동의 항목을 모두 확인해 주세요.');
      return;
    }

    const snsChannels: Record<string, string> = {};
    if (snsYoutube.trim()) snsChannels.youtube = snsYoutube.trim();
    if (snsBlog.trim()) snsChannels.blog = snsBlog.trim();
    if (snsInstagram.trim()) snsChannels.instagram = snsInstagram.trim();
    if (snsKakao.trim()) snsChannels.kakao = snsKakao.trim();
    if (snsEtc.trim()) snsChannels.etc = snsEtc.trim();

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim() || undefined,
          consentPrivacy: true,
          consentNonCompete: true,
          consentDbUse: true,
          consentPenalty: true,
          consentRefund: true,
          metadata: {
            type: 'CRUISE_PARTNER',
            snsChannels: Object.keys(snsChannels).length > 0 ? snsChannels : undefined,
            applyNote: applyNote.trim(),
            supervisorName: useSupervisor ? supervisorName : undefined,
            supervisorAgency: useSupervisor ? supervisorAgency : undefined,
            supervisorPhone: useSupervisor ? supervisorPhone : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrorMsg(data.message || '오류가 발생했습니다.');
        return;
      }
      setResultId(data.data?.contractId ?? null);
      setStep('success');
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 완료 화면 ───────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">신청이 접수되었습니다!</h1>
            <p className="text-gray-500 mt-2 text-sm whitespace-pre-line">
              {"담당자 검토 후 승인/반려 결과를 이메일로 안내해 드립니다.\n승인 완료 시 아이디·임시 비밀번호와 함께 서류 제출 링크가 발송됩니다."}
            </p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-left space-y-2">
            <p className="text-blue-700 font-semibold">신청 정보</p>
            <div className="text-gray-700 space-y-1">
              <p>• 구분: 크루즈닷 파트너스 가입 신청</p>
              <p>• 이름: {name}</p>
              {resultId && <p>• 신청번호: #{resultId}</p>}
            </div>
          </div>
          <p className="text-xs text-gray-400">문의: {COMPANY.phone}</p>
        </div>
      </div>
    );
  }

  // ── 신청서 폼 ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <Image
              src={COMPANY.logo}
              alt="크루즈닷 파트너스"
              fill
              className="object-contain"
              onError={() => {}}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-tight">크루즈닷 파트너스</h1>
            <p className="text-xs text-gray-500">프리랜서 용역 계약 신청서</p>
          </div>
          {useSupervisor && (
            <div className="ml-auto flex-shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
              <p className="text-xs text-blue-700 font-medium">{supervisorName} 대리점</p>
            </div>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto px-4 py-6 space-y-5">

        {/* 안내 배너 */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100">
          <div className="bg-blue-700 px-5 py-4 flex items-center gap-3.5">
            <div className="w-12 h-12 flex-shrink-0 bg-white rounded-xl shadow overflow-hidden flex items-center justify-center p-1">
              <div className="relative w-full h-full">
                <Image
                  src={COMPANY.logo}
                  alt="크루즈닷 파트너스"
                  fill
                  className="object-contain"
                  onError={() => {}}
                />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-white text-xl font-extrabold leading-tight">크루즈닷 파트너스 신청</h2>
              <p className="text-blue-100 text-sm font-medium mt-0.5">Cruise Dot Partners Program</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="py-4 px-2 text-center">
              <svg className="w-6 h-6 text-blue-600 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-blue-700 font-extrabold text-lg leading-none">1~5%</p>
              <p className="text-gray-700 text-xs font-semibold mt-1">판매 수수료</p>
            </div>
            <div className="py-4 px-2 text-center">
              <svg className="w-6 h-6 text-blue-600 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-blue-700 font-extrabold text-lg leading-none">무료</p>
              <p className="text-gray-700 text-xs font-semibold mt-1">가입·보증금 없음</p>
            </div>
            <div className="py-4 px-2 text-center">
              <svg className="w-6 h-6 text-blue-600 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-blue-700 font-extrabold text-lg leading-none">타사 겸업</p>
              <p className="text-gray-700 text-xs font-semibold mt-1">허용</p>
            </div>
          </div>
        </div>

        {/* 활동 프로세스 가이드 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h2 className="text-white font-bold text-sm">가입 후 활동 방법</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              {
                step: '1',
                color: 'bg-blue-600',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: '신청 완료 → 승인 대기',
                desc: '담당자(관리자 또는 대리점장)가 서류를 검토합니다.\n승인 시 이메일로 아이디·임시 비밀번호가 발급됩니다.\n반려 시 사유가 이메일로 안내되며 재신청 가능합니다.\n⏱ 승인 처리는 1~3일 소요됩니다.',
              },
              {
                step: '2',
                color: 'bg-indigo-600',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                ),
                title: '나만의 상품 링크 발급',
                desc: '크루즈닷 몰에 발급받은 아이디·비밀번호로 로그인하세요.\n상품을 클릭하면 우측 하단에 나만의 상품몰 링크가 나타납니다.',
              },
              {
                step: '3',
                color: 'bg-violet-600',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                ),
                title: '링크를 내 채널에 공유',
                desc: '유튜브, 인스타그램, 블로그, 카카오채널 등\n나의 SNS 채널에 상품 링크를 공유하세요.',
              },
              {
                step: '4',
                color: 'bg-emerald-600',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: '수수료 수익 발생',
                desc: '링크를 통해 구매 완료 시 1~5% 수수료 지급.\n본사 문의를 통해 구매가 이뤄져도 DB 수수료 1,000원이 구매마다 추가 적립.\n고객 문의는 크루즈닷 전문 세일즈 팀이 대신 처리해 드립니다.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3.5 px-5 py-4">
                <div className={`${item.color} w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm`}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400">STEP {item.step}</span>
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{item.desc}</p>
                </div>
              </div>
            ))}

            {/* STEP 5 — 태극기 + 신뢰 */}
            <div className="flex gap-3.5 px-5 py-4">
              <div className="bg-sky-600 w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-400">STEP 5</span>
                  <p className="text-sm font-bold text-gray-900">크루즈닷 신뢰 & 안전</p>
                </div>
                <div className="flex items-start gap-2 mb-1.5">
                  <svg className="w-5 h-3.5 mt-0.5 flex-shrink-0 rounded-sm overflow-hidden" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">
                    <rect width="30" height="20" fill="white"/>
                    <circle cx="15" cy="10" r="5" fill="#CD2E3A"/>
                    <path d="M15 10 A5 5 0 0 1 10 10 A2.5 2.5 0 0 0 15 10 Z" fill="#003478"/>
                    <path d="M15 10 A5 5 0 0 0 20 10 A2.5 2.5 0 0 1 15 10 Z" fill="#003478"/>
                    <line x1="3" y1="3" x2="8" y2="3" stroke="#000" strokeWidth="1"/>
                    <line x1="3" y1="5" x2="8" y2="5" stroke="#000" strokeWidth="1"/>
                    <line x1="3" y1="7" x2="8" y2="7" stroke="#000" strokeWidth="1"/>
                    <line x1="22" y1="3" x2="24.5" y2="3" stroke="#000" strokeWidth="1"/>
                    <line x1="25.5" y1="3" x2="28" y2="3" stroke="#000" strokeWidth="1"/>
                    <line x1="22" y1="5" x2="24.5" y2="5" stroke="#000" strokeWidth="1"/>
                    <line x1="25.5" y1="5" x2="28" y2="5" stroke="#000" strokeWidth="1"/>
                    <line x1="22" y1="7" x2="24.5" y2="7" stroke="#000" strokeWidth="1"/>
                    <line x1="25.5" y1="7" x2="28" y2="7" stroke="#000" strokeWidth="1"/>
                    <line x1="3" y1="13" x2="8" y2="13" stroke="#000" strokeWidth="1"/>
                    <line x1="3" y1="15" x2="5.5" y2="15" stroke="#000" strokeWidth="1"/>
                    <line x1="6.5" y1="15" x2="8" y2="15" stroke="#000" strokeWidth="1"/>
                    <line x1="3" y1="17" x2="8" y2="17" stroke="#000" strokeWidth="1"/>
                    <line x1="22" y1="13" x2="24.5" y2="13" stroke="#000" strokeWidth="1"/>
                    <line x1="25.5" y1="13" x2="28" y2="13" stroke="#000" strokeWidth="1"/>
                    <line x1="22" y1="15" x2="28" y2="15" stroke="#000" strokeWidth="1"/>
                    <line x1="22" y1="17" x2="24.5" y2="17" stroke="#000" strokeWidth="1"/>
                    <line x1="25.5" y1="17" x2="28" y2="17" stroke="#000" strokeWidth="1"/>
                  </svg>
                  <p className="text-xs text-gray-700 font-semibold leading-relaxed">
                    대한민국 공식 등록 여행사
                  </p>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  크루즈닷은 법적으로 등록된 대한민국 여행사로, 대기업·중소기업 여행사와 공식 제휴하고 있습니다.<br />
                  소비자에게 안전하고 신뢰 있는 여행을 지원해 드립니다.
                </p>
              </div>
            </div>

            {/* STEP 6 — 파트너스 전용 특별 혜택 */}
            <div className="bg-amber-50 border-t-2 border-amber-300">
              <div className="flex gap-3.5 px-5 pt-4 pb-3">
                <div className="bg-amber-500 w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-amber-500">STEP 6</span>
                    <p className="text-sm font-bold text-gray-900">파트너스 전용 특별 혜택</p>
                  </div>
                  <p className="text-xs text-amber-700 font-semibold mb-3">
                    크루즈닷 파트너스에게만 드리는 특별 지원 프로그램입니다.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        icon: (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.88v6.24a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        ),
                        label: 'SNS 마케팅 강의 무료 제공',
                        desc: '5개월 동안 SNS 마케팅 강의를 완전 무료로 제공해 드립니다.',
                        badge: '5개월 무료',
                        badgeColor: 'bg-blue-100 text-blue-700',
                      },
                      {
                        icon: (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 16.243a4 4 0 010-8.486m5.656 8.486a4 4 0 010-8.486M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                        ),
                        label: '매주 세일즈 상품 방송',
                        desc: '파트너스를 위한 세일즈 상품 방송이 매주 화요일 저녁 7시에 열립니다.',
                        badge: '매주 화요일 19:00',
                        badgeColor: 'bg-violet-100 text-violet-700',
                      },
                      {
                        icon: (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        ),
                        label: '시스템 사용법 무료 특강',
                        desc: '크루즈닷 파트너스 시스템 활용 무료 특강 초대장을 드립니다.',
                        badge: '무료 초대',
                        badgeColor: 'bg-emerald-100 text-emerald-700',
                      },
                      {
                        icon: (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        ),
                        label: '멘토십 커뮤니티 카톡방 초대',
                        desc: '파트너스 전용 멘토십 커뮤니티 카카오톡 방에 초대해 드립니다.',
                        badge: '전용 커뮤니티',
                        badgeColor: 'bg-yellow-100 text-yellow-700',
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-white rounded-xl border border-amber-200 px-3.5 py-3 flex items-start gap-3 shadow-sm">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0 mt-0.5">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-xs font-bold text-gray-900">{item.label}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mx-5 mb-4 mt-1 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm">
                <svg className="w-4 h-4 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <p className="text-white text-xs font-bold">지금 신청하고 파트너스 전용 혜택을 모두 누리세요!</p>
              </div>
            </div>
          </div>
        </div>

        {/* 담당자 안내 (URL 파라미터 또는 본사) */}
        <div className={`rounded-xl p-4 border ${useSupervisor ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <svg className={`w-4 h-4 ${useSupervisor ? 'text-teal-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className={`text-sm font-semibold ${useSupervisor ? 'text-teal-800' : 'text-gray-700'}`}>
              {useSupervisor ? '담당 대리점장' : '담당: 본사 직속'}
            </p>
          </div>
          {useSupervisor ? (
            <div className="mt-2 text-sm text-teal-700 space-y-0.5">
              <p>{supervisorName}{supervisorAgency ? ` · ${supervisorAgency}` : ''}</p>
              {supervisorPhone && <p className="text-teal-600">{supervisorPhone}</p>}
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">문의: {COMPANY.phone}</p>
          )}
        </div>

        {/* ① 신청자 정보 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-700 px-5 py-3.5">
            <h2 className="text-white font-bold text-sm">① 신청자 정보</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-blue-600 mt-1 font-medium">
                ✉ 승인 완료 시 이메일로 아이디·임시 비밀번호가 발송됩니다.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="서울특별시 ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </section>

        {/* ② SNS 채널 & 지원동기 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-violet-700 px-5 py-3.5">
            <h2 className="text-white font-bold text-sm">② SNS 채널 & 지원동기</h2>
            <p className="text-violet-200 text-xs mt-0.5">포트폴리오 및 활동 채널을 알려주세요 (선택)</p>
          </div>
          <div className="p-5 space-y-3">
            {[
              { key: 'youtube', label: '유튜브', placeholder: 'https://youtube.com/@...', value: snsYoutube, setter: setSnsYoutube, color: 'text-red-500', icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              )},
              { key: 'instagram', label: '인스타그램', placeholder: 'https://instagram.com/...', value: snsInstagram, setter: setSnsInstagram, color: 'text-pink-500', icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              )},
              { key: 'blog', label: '블로그', placeholder: 'https://blog.naver.com/...', value: snsBlog, setter: setSnsBlog, color: 'text-green-600', icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
              )},
              { key: 'kakao', label: '카카오채널', placeholder: 'https://pf.kakao.com/...', value: snsKakao, setter: setSnsKakao, color: 'text-yellow-600', icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.742 1.579 5.153 3.969 6.636L4.89 21l4.394-2.303C10.083 18.88 11.02 19 12 19c5.523 0 10-3.582 10-8S17.523 3 12 3z"/></svg>
              )},
            ].map((item) => (
              <div key={item.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                  <span className={item.color}>{item.icon}</span>
                  {item.label}
                </label>
                <input
                  type="url"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  placeholder={item.placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none bg-gray-50"
                />
              </div>
            ))}

            {/* 기타 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">기타 채널 / 링크</label>
              <input
                type="text"
                value={snsEtc}
                onChange={(e) => setSnsEtc(e.target.value)}
                placeholder="틱톡, 네이버카페, 홈페이지 등"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none bg-gray-50"
              />
            </div>

            <div className="border-t border-gray-100 pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                지원 동기 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder={"지원 동기와 활동 계획을 최대한 꼼꼼하게 작성해 주세요.\n미작성 또는 불성실한 내용은 반려 사유가 될 수 있습니다."}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none resize-none bg-gray-50"
              />
            </div>
          </div>
        </section>

        {/* ③ 계약서 확인 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-800 px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-white font-bold text-sm">③ 계약서 확인</h2>
            {contractRead && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">확인 완료</span>
            )}
          </div>

          {!contractExpanded ? (
            <div className="p-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-2">
                <p className="font-semibold text-gray-800">크루즈닷 파트너스 프리랜서 용역계약서</p>
                <ul className="text-xs space-y-1.5 text-gray-500">
                  <li className="flex items-start gap-1.5"><span className="text-blue-400 mt-0.5">•</span> 제3조 보수 및 정산 · 수수료 1~5%, 출발일 지급</li>
                  <li className="flex items-start gap-1.5"><span className="text-blue-400 mt-0.5">•</span> 제4조 타사 영업 허용</li>
                  <li className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">•</span> 제5조 콘텐츠 무단도용 금지 · 위약벌 건당 3,000만원</li>
                  <li className="flex items-start gap-1.5"><span className="text-orange-400 mt-0.5">•</span> 제6조 5개월 무매출 시 자동 해지</li>
                  <li className="flex items-start gap-1.5"><span className="text-orange-400 mt-0.5">•</span> 제7조 해지 후 2년 브랜드보호 의무</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setContractExpanded(true)}
                className="mt-4 w-full py-3 bg-gray-800 text-white rounded-xl font-medium text-sm hover:bg-gray-700 transition-colors"
              >
                계약서 전체 내용 확인하기
              </button>
            </div>
          ) : (
            <div className="p-4">
              <div
                className="h-80 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-4"
                onScroll={handleContractScroll}
              >
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="relative w-24 h-10">
                    <Image src={COMPANY.logo} alt="크루즈닷 파트너스" fill className="object-contain" onError={() => {}} />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative w-12 h-12 opacity-75">
                      <Image src={COMPANY.cruiseStamp} alt="크루즈닷 도장" fill className="object-contain" onError={() => {}} />
                    </div>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono leading-relaxed">{contractBody}</pre>
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-end">
                  <div className="text-xs text-gray-500">
                    <p>갑: 크루즈닷 대표 배연성</p>
                    <div className="relative w-14 h-14 mt-1 opacity-80">
                      <Image src={COMPANY.stamp} alt="배연성 도장" fill className="object-contain" onError={() => {}} />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <p>을: {name || '___________'}</p>
                  </div>
                </div>
              </div>
              {!contractRead && (
                <p className="text-xs text-gray-400 text-center mt-2">스크롤하여 계약서 전체를 읽어주세요</p>
              )}
              {contractRead && (
                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer p-3 bg-green-50 border border-green-200 rounded-xl">
                    <input
                      type="checkbox"
                      checked={consents.contract}
                      onChange={(e) => setConsent('contract')(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-green-800">계약서 전체 내용을 읽고 이해하였으며 동의합니다.</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ④ 필수 동의 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-orange-600 px-5 py-3.5">
            <h2 className="text-white font-bold text-sm">④ 필수 동의</h2>
          </div>
          <div className="p-5 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <input
                type="checkbox"
                checked={allConsents}
                onChange={(e) => handleAllConsent(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
              <span className="text-sm font-bold text-orange-800">전체 동의</span>
            </label>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {[
                {
                  key: 'privacy' as const,
                  title: '개인정보 처리 동의 (필수)',
                  desc: '수집 항목: 이름·연락처·이메일·주소 · 목적: 파트너 계약 및 정산 · 보유: 계약 종료 후 5년',
                },
                {
                  key: 'commission' as const,
                  title: '수수료 및 정산 조건 동의 (필수)',
                  desc: '어필리에이트 링크 판매 기준 수수료 1~5% (상품별 상이), 해당 상품 출발일 지급 조건에 동의합니다.',
                },
                {
                  key: 'autoTerminate' as const,
                  title: '자동해지 조건 동의 (필수)',
                  desc: '연속 5개월 무매출 시 별도 통보 없이 계약이 자동 해지됨에 동의합니다.',
                },
                {
                  key: 'brandProtect' as const,
                  title: '브랜드보호 및 콘텐츠 보호 동의 (필수)',
                  desc: '계약 해지 후 2년간 브랜드 보호 의무 준수, 콘텐츠 무단 도용 시 건당 3,000만원 위약벌에 동의합니다.',
                },
              ].map((item) => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={consents[item.key]}
                    onChange={(e) => setConsent(item.key)(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* 반려 시 파기 안내 */}
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-500 leading-relaxed">
                반려 시 계약서 및 제출 서류는 <span className="font-semibold text-gray-700">즉시 자동 파기</span>됩니다.
              </p>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{errorMsg}</div>
        )}

        {/* 동기부여 문구 */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl px-5 py-4 text-center shadow-lg shadow-blue-200">
          <p className="text-white text-base font-extrabold leading-snug tracking-tight">
            상위 0.1% 새로운 세대로 진입하세요.
          </p>
          <p className="text-blue-200 text-sm font-medium mt-1">행운을 빕니다 🚢</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-700 text-white rounded-2xl font-bold text-base hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              제출 중...
            </span>
          ) : '크루즈닷 파트너스 가입 신청'}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          제출 후 담당자가 확인하여 연락드립니다 · {COMPANY.phone}
        </p>
      </form>
    </div>
  );
}

// ── Suspense 래퍼 (useSearchParams 요구사항) ──────────────────────────

export default function CruiseDotPartnersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    }>
      <CruiseDotPartnersForm />
    </Suspense>
  );
}
