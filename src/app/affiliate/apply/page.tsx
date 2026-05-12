'use client';

/**
 * /affiliate/apply — 공개 계약 신청 페이지 (인증 불필요)
 * 등급 선택 → 계약서 본문 확인 → 계약자 정보 → 정산 계좌 → 필수 동의 → 사인+이름
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { CONTRACT_PRICE_TIERS, type PriceTierKey } from '@/lib/affiliate/priceTiers';

// ─── 회사 정보 ────────────────────────────────────────────────────
const COMPANY = {
  name: '마비즈스쿨 원격평생교육원',
  brand: '(주)크루즈닷기능',
  bizNo: '851-67-00338',
  ceo: '전혜선',
  address: '서울특별시 마포구 월드컵로 196, B105-M26호',
  phone: '010-2495-8013',
};

// ─── 서비스 혜택 (3개 계약 공통) ────────────────────────────────────
const SERVICES = [
  { name: '개인판매몰', value: 11_000_000 },
  { name: 'AI 마케팅 시스템지원', value: 21_000_000 },
  { name: 'AI 마케팅 강의', value: 2_200_000 },
];

const totalServiceValue = SERVICES.reduce((s, v) => s + v.value, 0);

// ─── 계약서 본문 생성 함수 ────────────────────────────────────────
function getContractBody(tierKey: PriceTierKey): string {
  const tier = CONTRACT_PRICE_TIERS[tierKey];
  const price =
    tierKey !== 'BRANCH_750'
      ? (tier.priceKRW / 10_000).toLocaleString() + '만원'
      : '별도 협의';
  const isDirectMarketer = tierKey === 'SALES_330';
  const isInstructor = tierKey === 'SALES_540';
  const isBranch = tierKey === 'BRANCH_750';

  // 계약 기간: 직속마케터=3개월, 직속인솔스탭=6개월, 대리점장=1년
  const contractPeriod = isDirectMarketer ? '3개월' : isInstructor ? '6개월' : '1년(12개월)';

  return `${tier.contractTitle}

본 계약은 크루즈닷기능(이하 "회사"), 판매원(이하 "판매원"), 그리고 고객(이하 "고객") 사이에서 체결되었습니다. 이하 "회사", "판매원", "고객" 중 1인을 각각 "당사자", 그 전체를 가리키는 "당사자들"이라 한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제1조 (목적)
본 계약의 "판매원"은 "회사"와 "고객"으로부터 제공받는 홍보 및 마케팅서비스 사용(이하 "마케팅서비스")에 관련된 제반 사항을 처리하고, 판매원 자체 판매, 의뢰 및 기타 서비스 활동을 독자적으로 수행하기로 한다. 제공되는 서비스에는 DB 영업, 크루즈 소개, 판매원 관련 활동 등이 포함된다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제2조 (용어의 정의)
본 계약에서 사용하는 용어는 다음과 같이 정의한다.

• 플랫폼이란: "회사", "판매원" 및 "고객"이 활용하는 "마케팅서비스"를 이용하는 제반 활동을 의미한다.
• 영업활동이란: "판매원"이 자체 고객자를 유치하고 타인 고객자를 배치하기 위한 제반 활동을 의미하며, "마케팅서비스"란 "회사"에서 제공 받을 수 있는 서비스를 의미한다.
• 영업 DB(데이터베이스): 고객의 요청에 이름, 전화번호 및 영업에 필요한 정보의 총체를 의미하며, 이 계약에 따라 "고객"이 소유한다.
• 마케팅플랫폼이란: "회사"가 운영하는 사이트나 프로그램의 총칭을 의미한다.
• "누출"이란: "판매원"이 본 계약 약정에 준하여 "회사" 또는 "고객"의 자체 영업 활동하거나 제3자로 하여서 유통하거나 하는 것을 의미한다.
• "스카웃"이란: "회사" 또는 "고객"의 종업원이나 고객자를 영입하거나 고객자를 유치하거나 이탈하는 것을 의미한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제3조 (계약기간 및 갱신)
${
  isDirectMarketer
    ? `① 본 계약의 계약기간은 계약 체결일로부터 ${contractPeriod}이며, 양측의 서면 상 합의 또는 30일 전부터 어느측도 계약 종료의 의사를 표명하지 않는 한 동일한 내용으로 1기씩 자동으로 갱신된다.
② 계약 기간 및 해지 관련 이유 시, 양측은 해지 통보를 할 수 있다.`
    : isInstructor
    ? `① 본 계약의 계약기간은 계약 체결일로부터 ${contractPeriod}이며, 크루즈여행 인솔 스탭으로서 관련 활동을 수행한다.
② 해당 기간이 종료되면 "회사"의 주도 아래 의무를 이행시킬 방법으로 완료 책임을 하게 된다.
③ 제9조에 규정된 부가 서비스는 별도 계약으로도 유지되며, 그 이용 기간은 체결일로부터 12개월간 유효하다.
④ 제3항에서 정한 이용 기간(12개월) 내에 30일 전부터 양측의 서면 상 계약 종료 의사를 표명하지 않는 한 부가 서비스 이용 계약은 동일한 내용으로 1기씩 자동으로 갱신된다.
⑤ 계약 기간 및 해지 관련 이유 시, 양측은 해지 통보를 할 수 있다.`
    : `① 본 계약의 계약기간은 계약 체결일로부터 ${contractPeriod}이며, 대리점장으로서 산하 판매원 관리 및 영업 총괄 활동을 수행한다.
② 해당 기간이 종료되면 "회사"의 주도 아래 의무를 이행시킬 방법으로 완료 책임을 하게 된다.
③ 제9조에 규정된 부가 서비스는 별도 계약으로도 유지되며, 그 이용 기간은 체결일로부터 12개월간 유효하다.
④ 제3항에서 정한 이용 기간(12개월) 내에 30일 전부터 양측의 서면 상 계약 종료 의사를 표명하지 않는 한 부가 서비스 이용 계약은 동일한 내용으로 1기씩 자동으로 갱신된다.
⑤ 계약 기간 및 해지 관련 이유 시, 양측은 해지 통보를 할 수 있다.`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제4조 (회사의 의무)
"회사"는 다음의 각항 의무를 다한다.
① 마케팅서비스 계획, 운영 및 지원: "마케팅플랫폼"에 따른 마케팅서비스의 계획, 구축, 지속 운영을 관리한다.
② 플랫폼 및 시스템 지원: "마케팅플랫폼" 및 관련 서비스를 위해 신뢰도와 품질을 갖출 수 있는 시스템을 지원한다.
③ 판매원 관리 및 지원: "판매원" 소속 기업 또는 직속 판매원들에게 지원의 관리 및 시스템적을 지원한다.
④ 영업 DB 사용 지원: "고객"으로부터 제공된 영업 DB를 실시하며, "판매원"이 이를 활용할 수 있도록 지원한다.
⑤ 추가 서비스 지원: "회사"가 운영하는 추가 서비스들을 "판매원"에게 제공하여 확인한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제5조 (판매원의 의무)
"판매원"은 "회사"와 "고객"의 마케팅서비스 품질 유지를 위해 다음의 의무를 진다.
① 적법 활동의 의무: 영업 활동에 관한 법령을 준수하고, 판매원 및 고객자의 행동 관련 법적 "회사"와 "고객"에 알린다.
② 품질 및 서비스에 대한 책임: "판매원"은 판매원 활동에 관한 책임을 독자적으로 부담하며, "회사"와 "고객"의 분쟁이 발생한 경우 이를 통보해야 한다.
③ DB 유출 금지: 취득하는 DB를 이 계약에서의 정해진 경우에만 독자적으로 활용해야 하며, 이를 위반하는 경우 관련 책임이 발생한다.
④ 단계적 영업 방해 행위 금지: "판매원"은 다른 판매원을 영입하여 영업 서비스를 추가적으로 지원하는 비영리기반 활동을 지원해서는 안 된다. 이는 단계적 마케팅으로 인한 것이며, 이를 위반하는 경우 "회사"와 "고객"은 관련 한편 및 관련 손해 요청을 청구할 수 있다.
${
  isInstructor
    ? `⑤ 활동 의무 체크 (미이행 시 해지 가능):
    1) 1개월 이하 1회 회의에 대한 2회 이상 진행 없는 경우
    2) 1개월 이하 인솔스탭으로서 크루즈여행을 진행하지 않는 경우
    3) 1개월 이하 인솔스탭으로서 활동 진행 2회 이상 활동 없는 경우
    2번에 해당 되는 경우에만 계약관리자에 대하여 해지할 수 있다.`
    : isBranch
    ? `⑤ 활동 의무 체크 (미이행 시 해지 가능):
    1) 분기별 및 이 중 1회 회의에 2회 이상 참여 없는 경우
    2) 분기별 대리점장으로서 1개월 이상 진행 없는 경우
    3) 분기별 대리점장으로서 활동 진행 2회 이상 활동 없는 경우`
    : `⑤ 마케팅서비스 활용 관련 책임: "판매원"은 회원권에 있는 서비스를 받고 활용을 해야 할 의무를 진다.
    1) DB 영업 1건에 이상 영업 활동이 판매원으로 해야 : 판매원으로 영업 활동 시에는 별도
    2) DB에 관한 해당일로부터 유효한 영업 활동에 대하여 해야 1일 이상 영업 활동을 해야
    2번에 해당 되는 경우에만 마케팅서비스 활동을 할 수 있다.`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제6조 (DB 관리 및 이동/이관 절차)
① DB 소속: 이 계약에 따른 모든 영업 DB는 "고객"에 소속하며, DB의 소속이 될 수 있는 관련 관련 담당이 "고객"에게 있다.
② DB 유출 금지: "판매원"은 취득하는 DB를 다른 회원이거나 다른 영업 활동에 사용될 수 없으며, 이를 위반하는 경우 3,000만 원의 손해배상을 "고객"에게 배상해야 한다.
③ DB 이동 절차: "판매원"은 타인 DB 1건에 1회 이하의 이관요청을 "고객"에게 진행해야 한다.
    요청 이후로부터 3일 안에 DB를 이관한다.
④ DB 활용 방법: 활용할 영업 관련 DB 데이터의 1개월에 1건을 한하고, 활용 활동한 이후의 1개월 안에 적어 (고객이 있는 DB 체크리스트 리스트에서 1회 이상 활용하는 별도) 활용 활동이 이루어야 한다. 다시 할 활동 요청 시 활용에 대하여 타인 DB에서 관련 영업 활동 혹은 활동 확인하여 타인 DB가 관련 할 수 있다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제7조 (영업비밀 및 경업금지, 스카웃 금지)
① 영업비밀: "판매원"은 계약 기간 중 및 그 이후 7개월간 "회사"와 "고객"에 관련 사항, 관련 자료, 마케팅 활동 및 기타 영업 비밀을 공개하지 않아야 하며, 제3자에게 제공하거나 공개하여 활용해서는 안 된다.
② 경업 금지: "판매원"은 계약 기간 이전 및 이후 7개월간 "회사" 및 "고객"의 영업하거나 판매원을 영입하거나 영업활동하거나 제3자를 관련 유통하는 행위, "고객"의 관련 DB를 활용하여 관련 서비스를 활용하는 행위를 할 수 없다.
③ 스카웃 금지: "판매원"은 계약 기간 중 및 그 이후 7개월간 "회사" 또는 "고객"의 종업원이나 고객자를 영입하거나 고객자를 유치하거나 이탈하는 스카웃 활동을 할 수 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제8조 (수수료 및 정산)
① 계약 대금: "판매원"은 ${price} 계약 체결 시 1회 "회사"에 납부한다.
    납입계좌 : 농협 531301-04-166504 (마비즈스쿨 원격평생교육원)

② 수수료 정산: 타인 DB에 관한 수수료의 1건은 1건에 이하다. 매월 15일에 "고객"에게 정산한다.
③ 수수료 내용: "회사"는 매월 수수료가 발생한 경우 월에 15일까지 "판매원"에게 공지하며, "판매원"은 해당 달 15일까지 납부를 "회사"와 "고객"에게 공지해야 한다.
④ 추가 서비스 정산: 필요 시 관련 계약 수수료 정책은 활용 날이나 판매원 운영을 수 있다.
⑤ 커미션 정산: "판매원"은 취득시키는 경우, 판매원(금액)에 따른 제품 수수료의 1~6%에 해당하는 수수료를 "회사"로부터 받을 수 있다.
    예) 650,000원 크루즈 관련 제품을 판매 하였을 때 관련 책임 5%인경우
    다만, 회사는 특정한 다양한 제품 판매를 위해 취급처 확인하여 판매(금액)에 따른 제품 회원권 할인율이 6% 이하(1~5%)이 되는 제품이 있는 경우에 취급처 협의에 따라 수수료를 받는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제9조 (부가 혜택 및 서비스)
(주)크루즈닷기능 및 마비즈스쿨의 회원권 서비스를 보유한 이의 서비스를 독자적으로 제공하는 플랫폼이며, 회원권 판매원으로 등재될 시 다음과 같이 ${price}에 1회에 한해 아래 서비스를 제공하여 이용할 수 있다.

▶ 제공 서비스 (총 ${(totalServiceValue / 10_000).toLocaleString()}만원 상당)
${SERVICES.map((s) => `  · ${s.name}: ${(s.value / 10_000).toLocaleString()}만원 상당`).join('\n')}

이용 조건:
${
  isDirectMarketer
    ? `  · 조건 1 : 본 계약이 유지되고 있는 판매원이어야 한다.
  · 조건 2 : 회원권에 본 계약에 따른 의무이행을 충분하게 이행하지 않아야 한다.
  · 조건 3 : 회원권에 계약한 경우는 판매원에 대하여 또는 이용가입서에 대하여 회원권 판매원에서 플랫폼이 1% 카드 할인 결제에 따른 협의에 따라 협의할 수 있는 마케팅서비스 지원을 이용하게 할 수 있다.`
    : isInstructor
    ? `  · 조건 1 : 1개월 이하 1회 회의에 대한 2회 이상 진행 없는 경우
  · 조건 2 : 1개월 이하 인솔스탭으로서 크루즈여행을 진행하지 않는 경우
  · 조건 3 : 1개월 이하 인솔스탭으로서 활동 진행 2회 이상 활동 없는 경우
  2번에 해당되는 경우에만 계약관리자에 대하여 해지할 수 있다.`
    : `  · 조건 1 : 분기별 및 이 중 1회 회의에 2회 이상 참여 없는 경우
  · 조건 2 : 분기별 대리점장으로서 1개월 이상 진행 없는 경우
  · 조건 3 : 분기별 대리점장으로서 활동 진행 2회 이상 활동 없는 경우
  3번에 해당되는 경우에만 계약관리자에 대하여 해지할 수 있다.`
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제10조 (소비자 피해 및 책임분배)
소비자는 관련 환매정책에 있는 경우에 14일의 기간에 청하여 환매를 요구할 수 없는 경우 및 양측의 취득하는 판매원 아닌 경우가 있거나 환매할 수 있다.
본 계약 관련 환매에 있는 환매정책에 있는 환매가 있는 경우 책임이 있는 판매원이 독자적이며, 관련에서 발생한 관련 손해를 배상하기로 한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제11조 (계약의 해지 및 환불 정책)

[환불 정책 — 소비자보호법 준수]
계약 체결 후 7일 이내: 전액 환불 (단, 이미 사용된 서비스 제외)
계약 체결 후 7일 초과 ~ 10일 이내: 카드수수료 149,000원 제외 후 잔액의 25% 환불
계약 체결 후 10일 초과 ~ 15일 이내: 카드수수료 149,000원 제외 후 잔액의 20% 환불
계약 체결 후 15일 초과 ~ 20일 이내: 카드수수료 149,000원 제외 후 잔액의 15% 환불
계약 체결 후 20일 초과 ~ 30일 이내: 카드수수료 149,000원 제외 후 잔액의 10% 환불
계약 체결 후 1개월 초과: 환불 불가

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제12조 (저작권 및 지식재산권 보호)
"회사"와 "고객"의 마케팅 광고물, 영상 자료, 교육 자료에 관한 모든 저작권은 "회사" 및 "고객"에게 귀속되며, "판매원"은 이를 계약 범위 외에 사용할 수 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제13조 (독점적 공급의무 및 우선거래)
"판매원"은 계약기간 이내 이 계약에 규정된 경우에 "회사"에 대해서는 관련된 서비스를 지원해야 하며, "회사"의 관련 제3자를 관련 지원하거나 유통하는 서비스를 할 수 없다. 이를 위반하는 경우 손해배상 1,000만 원을 "회사"에 배상해야 한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제14조 (계약 서류보관의 의무)
"회사"와 "판매원"의 계약에 관련 서류는 5기간 보관해야 하며, 필요 시 자료를 제출해야 한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제15조 (계약의 해지 및 위약벌)
① 계약 해지 권리: 소비자는 환매정책에 따른 조건에서 환매할 수 있다. 단 소비자보호법 제17조 제2항에 따른 아래 경우는 청약철회가 제한될 수 있다.
② 위약벌: 책임이 있는 소비자는 관련 제3자가 관련 손해를 배상해야 한다. 다만, 천재지변 및 불가항력에 관한 경우는 예외로 한다.
③ 계약 의무 불이행 시: 잔여 계약 기간 동안 발생한 DB 손해배상 책임이 발생한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제16조 (기밀정보 보호)
"판매원"은 계약 기간 이전 및 이후 7개월간 "회사"와 "고객"으로부터 취득하는 기밀정보를 외부에 공개해서는 안 된다. 기밀정보는 경영 방침, 고객 정보, 영업 자료, 영업 DB를 포함한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제17조 (비밀유지의무 및 정보보안 관리)
"판매원"은 계약 체결 전부터 계약 이후 7개월 이내에 "회사"와 "고객"의 경영방침, 제품사양, 마케팅계획 관련 내용을 제3자에게 공개하거나 유통할 수 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제18조 (판매의무의 양도 금지)
소비자는 이 계약에서 발생하는 판매의 의무를 제3자에게 양도하거나 유통할 수 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제19조 (독립계약자)
이 계약의 소비자는 독자적인 계약의 이행자이며, 이로 인한 책임 관련 의무는 이 계약상의 총체에 대한 의무이다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제20조 (일부 무효)
이 계약의 일부 조항이 법률에 의하여 무효가 되더라도, 나머지 조항의 효력은 유지된다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제21조 (계약의 변경)
이 계약의 변경은 쌍방의 서면 상 합의에 따른 변경이 될 수 있으며, 구두에 의한 변경은 효력이 없다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제22조 (통지)
① 이 계약에 따른 모든 통보는 서면(이메일, 문서)에 의하여 이루어져야 한다.
② "판매원"은 계약 체결 후 연락처 변경이 있는 경우 즉시 "회사"와 "고객"에게 서면으로 통보해야 한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제23조 (관할법원)
이 계약에 관하여 발생하는 모든 분쟁은 서울특별시법원을 전속관할법원으로 하여 해결한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[계약 당사자 정보]

(갑) 회사명 : ${COMPANY.name}
     사업자번호 : ${COMPANY.bizNo}
     대표자 : ${COMPANY.ceo} (인)
     주      소 : ${COMPANY.address}
     연 락 처 : ${COMPANY.phone}`;
}

// ─── 동의 항목 ────────────────────────────────────────────────
const CONSENT_ITEMS = [
  {
    key: 'consentPrivacy',
    title: '개인정보 처리 동의 (필수)',
    detail: `본인은 마비즈스쿨 원격평생교육원(이하 "회사")이 아래와 같이 개인정보를 수집·이용하는 것에 동의합니다.

• 수집 항목: 이름, 연락처, 이메일, 주소, 주민등록번호, 계좌정보
• 수집 목적: 계약 체결 및 이행, 수수료 정산, 서비스 제공
• 보유 기간: 계약 종료 후 5년 (제14조)
• 제3자 제공: 정산 및 법적 의무 이행 목적에 한하여 최소한의 정보 제공

본인은 동의를 거부할 권리가 있으며, 거부 시 계약 체결이 불가합니다.`,
  },
  {
    key: 'consentNonCompete',
    title: '경업금지 조항 동의 (필수)',
    detail: `계약 기간 중 및 계약 종료 후 7개월간 다음 행위를 금지함에 동의합니다 (제7조).

• "회사" 또는 "고객"과 경쟁 관계에 있는 유사 서비스 판매 및 영업 활동
• "회사" 또는 "고객"의 고객·직원 스카웃 행위
• 취득한 DB 및 영업 자료를 타사에 유출하는 행위
• 단계적 마케팅(다단계) 방식으로 타 판매원을 모집하는 행위

위반 시 손해배상금(최소 1,000만 원) 청구에 동의합니다.`,
  },
  {
    key: 'consentDbUse',
    title: 'DB 활용 동의 (필수)',
    detail: `고객 데이터베이스(DB) 관련 다음 사항에 동의합니다 (제6조).

• 영업 DB는 계약 목적 범위 내에서만 활용
• DB를 타 업체 또는 타 영업 활동에 무단 사용 시 3,000만 원 손해배상
• 계약 종료 후 모든 DB는 즉시 반환 또는 파기
• DB 이관은 정해진 절차(요청 후 3일 이내)에 따라 진행
• DB 무단 유출 적발 시 계약 즉시 해지 및 법적 조치 동의`,
  },
  {
    key: 'consentPenalty',
    title: '위약금 조항 동의 (필수)',
    detail: `다음 위약금 조항에 동의합니다 (제13조, 제15조).

• 계약 의무 불이행 시: 잔여 계약 기간 동안 발생한 DB 손해배상 책임
• 경업금지 위반 시: 1,000만 원 이상의 위약금
• 독점공급 의무 위반 시: 1,000만 원 위약금
• DB 무단 유출 시: 3,000만 원 위약금
• 계약서 서명 후 허위 사실로 취소 요청 시: 환불 불가

위 위약금은 실제 손해와 별도로 청구될 수 있습니다.`,
  },
  {
    key: 'consentRefund',
    title: '환불 정책 동의 (필수)',
    detail: `다음 환불 정책에 동의합니다 (제11조).

• 계약 체결 후 7일 이내: 전액 환불 (단, 이미 사용된 서비스 제외)
• 7일 초과 ~ 10일 이내: 카드수수료 149,000원 제외 후 잔액의 25% 환불
• 10일 초과 ~ 15일 이내: 카드수수료 149,000원 제외 후 잔액의 20% 환불
• 15일 초과 ~ 20일 이내: 카드수수료 149,000원 제외 후 잔액의 15% 환불
• 20일 초과 ~ 30일 이내: 카드수수료 149,000원 제외 후 잔액의 10% 환불
• 계약 체결 후 1개월 초과: 환불 불가

소비자보호법 제17조 제2항에 따라 이미 사용된 서비스, 다운로드 완료된 콘텐츠는 환불이 제한될 수 있습니다.`,
  },
];

// ─── 사인 캔버스 컴포넌트 ─────────────────────────────────────────
function SignatureCanvas({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onChangeCb = useCallback(onChange, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const startDraw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e, canvas);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const draw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;
      const pos = getPos(e, canvas);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };
    const stopDraw = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      setHasSignature(true);
      onChangeCb(canvas.toDataURL('image/png'));
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [onChangeCb]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChangeCb(null);
  }, [onChangeCb]);

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-40 cursor-crosshair touch-none"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm select-none">이곳에 사인해 주세요</span>
          </div>
        )}
      </div>
      {hasSignature && (
        <button
          type="button"
          onClick={clearSignature}
          className="text-xs text-red-500 hover:text-red-700 underline"
        >
          다시 쓰기
        </button>
      )}
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────
export default function AffiliatApplyPage() {
  const [selectedTier, setSelectedTier] = useState<PriceTierKey>('SALES_330');
  const [step, setStep] = useState<'form' | 'success'>('form');

  // 계약자 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [residentId, setResidentId] = useState('');

  // 정산 계좌
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  // 계약서 확인
  const [contractConfirmed, setContractConfirmed] = useState(false);

  // 동의 항목
  const [consents, setConsents] = useState({
    consentPrivacy: false,
    consentNonCompete: false,
    consentDbUse: false,
    consentPenalty: false,
    consentRefund: false,
  });
  const [expandedConsent, setExpandedConsent] = useState<string | null>(null);

  // 사인 + 이름
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signName, setSignName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultData, setResultData] = useState<{ contractId: number } | null>(null);

  const allConsents = Object.values(consents).every(Boolean);
  const tier = CONTRACT_PRICE_TIERS[selectedTier];

  const toggleAllConsents = () => {
    const next = !allConsents;
    setConsents({
      consentPrivacy: next,
      consentNonCompete: next,
      consentDbUse: next,
      consentPenalty: next,
      consentRefund: next,
    });
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
    if (!contractConfirmed) {
      setErrorMsg('계약서 내용을 확인하고 동의해 주세요.');
      return;
    }
    if (!allConsents) {
      setErrorMsg('필수 동의 항목을 모두 확인해 주세요.');
      return;
    }
    if (!signatureDataUrl) {
      setErrorMsg('사인을 해주세요.');
      return;
    }
    if (!signName.trim()) {
      setErrorMsg('성함을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/affiliate/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          residentId: residentId.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankAccount: bankAccount.trim() || undefined,
          bankAccountHolder: bankAccountHolder.trim() || undefined,
          signatureImageUrl: signatureDataUrl,
          tierKey: selectedTier,
          amount: tier.priceKRW,
          ...consents,
          metadata: { signName: signName.trim() },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setErrorMsg(data.message || '오류가 발생했습니다.');
        return;
      }
      setResultData(data.data);
      setStep('success');
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">계약 신청 완료!</h1>
            <p className="text-gray-500 mt-2 text-sm">담당자가 확인 후 연락드리겠습니다.</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-left space-y-2">
            <p className="text-blue-700 font-semibold">신청 정보</p>
            <div className="text-gray-700 space-y-1">
              <p>• 등급: {tier.label}</p>
              {selectedTier !== 'BRANCH_750' && (
                <p>• 계약금: {(tier.priceKRW / 10_000).toLocaleString()}만원</p>
              )}
              <p>• 신청번호: #{resultData?.contractId}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">문의: {COMPANY.phone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{COMPANY.name}</h1>
            <p className="text-xs text-gray-500">파트너 계약 신청서</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* ① 등급 선택 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">① 계약 등급 선택</h2>
            <p className="text-blue-100 text-sm mt-0.5">원하시는 계약 등급을 선택해 주세요</p>
          </div>
          <div className="p-6 grid grid-cols-3 gap-3">
            {(Object.keys(CONTRACT_PRICE_TIERS) as PriceTierKey[]).map((key) => {
              const t = CONTRACT_PRICE_TIERS[key];
              const isSelected = selectedTier === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelectedTier(key); setContractConfirmed(false); }}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`text-sm font-bold mb-1 ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                    {t.label}
                  </div>
                  {key !== 'BRANCH_750' ? (
                    <div className={`text-xs font-semibold ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                      {(t.priceKRW / 10_000).toLocaleString()}만원
                    </div>
                  ) : (
                    <div className={`text-xs ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}>별도 협의</div>
                  )}
                </button>
              );
            })}
          </div>
          {/* 서비스 혜택 안내 */}
          <div className="px-6 pb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 font-semibold text-sm mb-2">
                제공 서비스 혜택 (총 {(totalServiceValue / 10_000).toLocaleString()}만원 상당)
              </p>
              <div className="space-y-1">
                {SERVICES.map((s) => (
                  <div key={s.name} className="flex justify-between text-sm text-amber-700">
                    <span>• {s.name}</span>
                    <span className="font-medium">{(s.value / 10_000).toLocaleString()}만원</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ② 계약서 본문 확인 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-700 px-6 py-4">
            <h2 className="text-white font-bold text-lg">② 계약서 내용 확인</h2>
            <p className="text-gray-300 text-sm mt-0.5">{tier.contractTitle}</p>
          </div>
          <div className="p-6 space-y-4">
            <div
              className="h-80 overflow-y-auto border border-gray-200 rounded-xl p-5 bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
              style={{ scrollbarWidth: 'thin', fontFamily: 'inherit' }}
            >
              {getContractBody(selectedTier)}
            </div>
            <label className="flex items-start gap-3 cursor-pointer group p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
              <input
                type="checkbox"
                checked={contractConfirmed}
                onChange={(e) => setContractConfirmed(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-800">
                위 계약서의 내용을 모두 읽고 확인하였으며, 내용을 확인했음에 동의합니다.
              </span>
            </label>
          </div>
        </section>

        {/* ③ 계약자 정보 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-green-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">③ 계약자 정보</h2>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주민등록번호</label>
              <input
                type="text"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                placeholder="000000-0000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
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

        {/* ④ 정산 계좌 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-purple-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">④ 수수료 정산 계좌</h2>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">은행명</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="농협, 국민, 신한 ..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예금주</label>
              <input
                type="text"
                value={bankAccountHolder}
                onChange={(e) => setBankAccountHolder(e.target.value)}
                placeholder="홍길동"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="000-0000-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </section>

        {/* ⑤ 필수 동의 항목 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-orange-500 px-6 py-4">
            <h2 className="text-white font-bold text-lg">⑤ 필수 동의 항목</h2>
          </div>
          <div className="p-6 space-y-3">
            {/* 전체 동의 */}
            <label className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={allConsents}
                onChange={toggleAllConsents}
                className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
              />
              <span className="font-semibold text-orange-800 text-sm">전체 동의</span>
            </label>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {CONSENT_ITEMS.map((item) => (
                <div key={item.key} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={consents[item.key as keyof typeof consents]}
                        onChange={(e) =>
                          setConsents((prev) => ({ ...prev, [item.key]: e.target.checked }))
                        }
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">{item.title}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedConsent(expandedConsent === item.key ? null : item.key)
                      }
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 shrink-0 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                    >
                      {expandedConsent === item.key ? '접기' : '내용 보기'}
                    </button>
                  </div>
                  {expandedConsent === item.key && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {item.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ⑥ 사인 + 이름 + 도장 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-red-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">⑥ 서명</h2>
            <p className="text-red-100 text-sm mt-0.5">사인 및 성함을 입력해 주세요</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 계약자 사인 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">계약자 사인</p>
                <SignatureCanvas onChange={setSignatureDataUrl} />
                <div>
                  <label className="block text-xs text-gray-500 mb-1">성함 (정자로 기입)</label>
                  <input
                    type="text"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="홍 길 동"
                    className="w-full border-b-2 border-gray-300 focus:border-blue-500 outline-none py-2 text-sm text-center font-medium tracking-widest bg-transparent"
                  />
                </div>
              </div>

              {/* 회사 도장 */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">회사 도장</p>
                <div className="h-40 border-2 border-dashed border-red-200 rounded-lg bg-red-50 flex flex-col items-center justify-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/jeonhyesun-stamp.png"
                    alt="전혜선 도장"
                    className="h-28 w-28 object-contain"
                    onError={(e) => {
                      // fallback to second stamp file
                      const img = e.currentTarget as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = '/jeonhyesun-stamp2.png';
                      } else {
                        const el = img.parentElement;
                        if (el) {
                          el.innerHTML =
                            '<div class="text-red-400 text-center text-xs px-4">도장<br/>(관리자 승인 후 날인)</div>';
                        }
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">{COMPANY.name}</p>
              </div>
            </div>

            {/* 계약 당사자 서명란 */}
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">계약 당사자</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-gray-700">
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-800 pb-1 border-b border-gray-300">(을) 계약자</p>
                  <p>이름 : {name || '________________'}</p>
                  <p>연락처 : {phone || '________________'}</p>
                  <p>주소 : {address || '________________'}</p>
                  <p className="text-xs text-gray-400 mt-2">서명 : (위 사인란 참조)</p>
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-800 pb-1 border-b border-gray-300">(갑) 회사</p>
                  <p>상호명 : {COMPANY.name}</p>
                  <p>사업자번호 : {COMPANY.bizNo}</p>
                  <p>대표 : {COMPANY.ceo} (인)</p>
                  <p>주소 : {COMPANY.address}</p>
                  <p>연락처 : {COMPANY.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              제출 중...
            </span>
          ) : (
            '계약 신청서 제출'
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          제출 후 담당자가 확인하여 연락드립니다 · {COMPANY.phone}
        </p>
      </form>
    </div>
  );
}
