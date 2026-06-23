#!/usr/bin/env npx tsx
/**
 * Funnel Lens Templates Seed Script
 *
 * 렌즈별 기본 퍼널 템플릿을 DB에 로드합니다.
 * 모든 조직이 공유하는 PUBLIC 템플릿입니다 (organizationId = GLOBAL_ORG_ID).
 *
 * 실행 방법:
 *   npx tsx src/lib/seed/funnel-lens-templates.ts
 *
 * 구조:
 *   - Funnel (10개): L0-L10 렌즈별 기본 템플릿
 *     - FunnelSmsMessage (4개/Funnel): Day 0-3 SMS 시퀀스
 *     - FunnelEmailMessage (4개/Funnel): Day 0-3 이메일 시퀀스
 *
 * 2026-06-24 작성
 */

// 환경변수 미리 로드
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
  console.error('설정 방법: export DATABASE_URL="postgresql://..."');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 전역 조직 ID (모든 조직이 공유하는 템플릿용)
// 실제로는 DB에 있는 조직을 사용합니다
const GLOBAL_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-cruisedot-main';

interface LensTemplate {
  lensCode: string;
  name: string;
  description: string;
  smsMessages: {
    day: number;
    pasonaStage: string;
    content: string;
  }[];
  emailMessages: {
    day: number;
    pasonaStage: string;
    subject: string;
    bodyHtml: string;
  }[];
}

// 10개 렌즈별 템플릿 데이터
const LENS_TEMPLATES: LensTemplate[] = [
  {
    lensCode: 'L0',
    name: 'L0: 부재중 고객 자동메시지',
    description: '3개월 이상 연락 없는 고객을 자동으로 재활성화하는 시퀀스',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '안녕하세요! 저희는 지난 몇 개월간 연락이 없었네요. 근황이 어떠신가요? 특별한 할인 혜택을 준비했습니다 😊',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '많은 고객분들이 다시 선택하신 이유는 신뢰와 가치 때문입니다. 처음과 다른 새로운 서비스도 추가되었어요!',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '복귀 고객 전용 20% 할인 혜택을 드립니다. 이번 주 금요일까지만 유효합니다! [링크]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '이 기회를 놓치지 마세요! 지금 바로 신청하시면 추가 선물도 드릴게요. [지금 신청]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '오랜만입니다! 크루즈닷에서 특별한 소식이 있어요',
        bodyHtml: '<h1>오랜만입니다!</h1><p>저희는 지난 몇 개월간 연락이 없었네요.</p><p>근황이 어떠신가요? 특별한 할인 혜택을 준비했습니다 😊</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '왜 많은 고객들이 다시 선택할까요?',
        bodyHtml: '<h1>신뢰와 가치</h1><p>많은 고객분들이 다시 선택하신 이유는 신뢰와 가치 때문입니다.</p><p>처음과 다른 새로운 서비스도 추가되었어요!</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '복귀 고객 전용 20% 할인 혜택',
        bodyHtml: '<h1>특별 혜택</h1><p>복귀 고객 전용 20% 할인 혜택을 드립니다.</p><p>이번 주 금요일까지만 유효합니다!</p><a href="#">지금 확인하기</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '마지막 기회! 오늘 신청하면 추가 선물도 드립니다',
        bodyHtml: '<h1>마지막 기회!</h1><p>이 기회를 놓치지 마세요!</p><p>지금 바로 신청하시면 추가 선물도 드릴게요.</p><a href="#">지금 신청</a>',
      },
    ],
  },
  {
    lensCode: 'L1',
    name: 'L1: 가격 이의 고객 대응',
    description: '가격이 비싸다는 이의를 제기한 고객을 위한 할부/옵션 제안',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '가격이 걱정되시나요? 많은 고객이 같은 고민을 하셨어요. 저희만의 해결책이 있습니다!',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '월 60만원씩 5개월 할부로 부담을 크게 줄일 수 있어요. 이자 0% 특가 중입니다!',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '더불어 첫 회차 할부금에서 10만원을 할인해드립니다. 이 조건은 오늘만 유효해요!',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '지금 신청하시면 당일 처리됩니다. 망설이지 마시고 지금 바로 [신청하기]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '가격이 걱정이신가요? 합리적인 방법이 있습니다',
        bodyHtml: '<h1>가격 걱정, 이제 끝!</h1><p>가격이 비싸다는 것 충분히 이해합니다.</p><p>많은 고객이 같은 고민을 하셨어요. 저희만의 해결책이 있습니다!</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '월 60만원씩 5개월 할부 - 이자 0%',
        bodyHtml: '<h1>합리적인 분할 결제</h1><p>월 60만원씩 5개월 할부로 부담을 크게 줄일 수 있어요.</p><p>이자 0% 특가 중입니다!</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '오늘만! 첫 회차 10만원 추가 할인',
        bodyHtml: '<h1>시간 제한 특가!</h1><p>더불어 첫 회차 할부금에서 10만원을 할인해드립니다.</p><p>이 조건은 오늘만 유효해요!</p>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '지금 신청하면 당일 처리됩니다',
        bodyHtml: '<h1>더 이상 미루지 마세요!</h1><p>지금 신청하시면 당일 처리됩니다.</p><a href="#">지금 신청하기</a>',
      },
    ],
  },
  {
    lensCode: 'L2',
    name: 'L2: 준비 복잡도 공감 및 해소',
    description: '준비 과정이 복잡하다고 느끼는 고객을 위한 단순화 설명',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '여행 준비가 복잡해 보이나요? 사실 생각보다 훨씬 간단해요! 저희가 직접 도와드릴게요.',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '필요한 서류는 딱 3가지. 주민등록증, 통장, 휴대폰. 이게 다입니다! 다른 건 저희가 챙겨요.',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '준비 상담 무료! 전문가가 15분만에 모든 것을 설명해드립니다. [무료 상담 예약]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '지금 상담 받으면 첫 비용 50만원을 줄여드립니다! 더 이상 미루지 마세요. [지금 예약]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '여행 준비, 생각보다 간단합니다!',
        bodyHtml: '<h1>준비가 복잡해 보이나요?</h1><p>여행 준비가 복잡해 보이나요? 사실 생각보다 훨씬 간단해요!</p><p>저희가 직접 도와드릴게요.</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '필요한 서류는 딱 3가지!',
        bodyHtml: '<h1>정말 간단합니다</h1><p>필요한 서류는 딱 3가지입니다.</p><ul><li>주민등록증</li><li>통장</li><li>휴대폰</li></ul><p>이게 다입니다! 다른 건 저희가 챙겨요.</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '무료 준비 상담 - 전문가 15분 완성',
        bodyHtml: '<h1>무료 상담 서비스</h1><p>준비 상담 무료!</p><p>전문가가 15분만에 모든 것을 설명해드립니다.</p><a href="#">무료 상담 예약</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '지금 상담하면 첫 비용 50만원 감면!',
        bodyHtml: '<h1>시간 제한 특가</h1><p>지금 상담 받으면 첫 비용 50만원을 줄여드립니다!</p><p>더 이상 미루지 마세요.</p><a href="#">지금 예약</a>',
      },
    ],
  },
  {
    lensCode: 'L3',
    name: 'L3: 경쟁사 비교 및 차별성 강조',
    description: '다른 업체와 비교하는 고객을 위한 우월성 입증',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '다른 업체와 비교하고 계신가요? 맞습니다! 비교는 꼭 해야 해요. 저희의 특별함을 보여드릴게요.',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '6년 연속 고객만족도 1위! 환급률 업계 최고 97.8%. 서비스 품질은 업계 기준입니다.',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '우리는 후불제 1순위 제공업체. 불안감 0%! 그 증거로 비교표를 준비했습니다. [비교표 확인]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '이제 확신하셨나요? 지금 신청하면 보증금도 없습니다. [지금 신청]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '다른 업체와 비교하고 계신가요? 좋은 생각입니다!',
        bodyHtml: '<h1>비교는 필수입니다!</h1><p>다른 업체와 비교하고 계신가요? 맞습니다!</p><p>비교는 꼭 해야 해요. 저희의 특별함을 보여드릴게요.</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '6년 연속 고객만족도 1위!',
        bodyHtml: '<h1>업계 최고의 성적</h1><p>6년 연속 고객만족도 1위!</p><p>환급률 업계 최고 97.8%</p><p>서비스 품질은 업계 기준입니다.</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '후불제 1순위 제공업체 - 불안감 0%!',
        bodyHtml: '<h1>업계 최고 수준의 신뢰</h1><p>우리는 후불제 1순위 제공업체입니다.</p><p>불안감 0%! 그 증거로 비교표를 준비했습니다.</p><a href="#">상세 비교표 확인</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '이제 확신하셨나요? 보증금도 없습니다',
        bodyHtml: '<h1>더 이상 고민하지 마세요!</h1><p>이제 확신하셨나요?</p><p>지금 신청하면 보증금도 없습니다!</p><a href="#">지금 신청</a>',
      },
    ],
  },
  {
    lensCode: 'L4',
    name: 'L4: 유연성 입증 및 선택지 확대',
    description: '자유도와 유연성을 중시하는 고객을 위한 옵션 확장',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '자유롭게 선택하고 싶으신가요? 당연합니다! 우리는 모든 선택을 존중합니다.',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '일정 변경 무료! 객실 업그레이드 자유! 탑승 일시 조정 100% 가능! 당신이 주인입니다.',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '추가 선택지: 특식(할랄/채식), 객실 수정, 일정 재조정. 모두 무료입니다! [자세히 보기]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '완전한 자유를 경험해보세요. 지금 신청하면 추가 변경 3회까지 완전 무료! [지금 신청]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '완전한 자유를 원하시나요?',
        bodyHtml: '<h1>자유는 우리의 가치입니다</h1><p>자유롭게 선택하고 싶으신가요? 당연합니다!</p><p>우리는 모든 선택을 존중합니다.</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '일정도, 객실도, 모든 게 자유입니다!',
        bodyHtml: '<h1>최고의 자유도</h1><ul><li>일정 변경 무료!</li><li>객실 업그레이드 자유!</li><li>탑승 일시 조정 100% 가능!</li></ul><p>당신이 주인입니다.</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '더 많은 선택지 - 모두 무료입니다!',
        bodyHtml: '<h1>무한한 커스터마이징</h1><p>추가 선택지들이 있습니다:</p><ul><li>특식(할랄/채식)</li><li>객실 수정</li><li>일정 재조정</li></ul><p>모두 무료입니다!</p><a href="#">자세히 보기</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '지금 신청하면 변경 3회까지 완전 무료!',
        bodyHtml: '<h1>완전한 자유를 경험해보세요!</h1><p>지금 신청하면 추가 변경 3회까지 완전 무료입니다!</p><a href="#">지금 신청</a>',
      },
    ],
  },
  {
    lensCode: 'L5',
    name: 'L5: 자기투영 및 성공 사례',
    description: '고객 본인의 모습을 투영할 수 있는 성공 사례 제시',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '저 사람도 나처럼 여행을 준비했나? 네! 제 고객들도 처음엔 당신처럼 조심스러웠어요.',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '이재민(42세) 사업가: "3개월만에 가족 여행 완성!" 김순희(56세) 전직자: "꿈이 이뤄졌어요"',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '그들도 시작했어요. 당신도 할 수 있어요! 실제 고객 후기와 일정표를 공유합니다. [확인]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '다음 주자는 당신입니다! 지금 시작하면 성공 일정표도 받으실 수 있어요. [시작하기]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '나도 할 수 있을까? 네, 충분합니다!',
        bodyHtml: '<h1>당신도 충분합니다!</h1><p>저 사람도 나처럼 여행을 준비했나?</p><p>네! 제 고객들도 처음엔 당신처럼 조심스러웠어요.</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '실제 고객들의 성공 사례',
        bodyHtml: '<h1>이들도 성공했습니다!</h1><ul><li><strong>이재민(42세) 사업가:</strong> "3개월만에 가족 여행 완성!"</li><li><strong>김순희(56세) 전직자:</strong> "꿈이 이뤄졌어요"</li></ul>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '그들도 시작했어요. 당신도 할 수 있어요!',
        bodyHtml: '<h1>시작이 반입니다</h1><p>그들도 시작했어요. 당신도 할 수 있어요!</p><p>실제 고객 후기와 일정표를 공유합니다.</p><a href="#">성공 사례 확인</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '다음 주자는 바로 당신입니다!',
        bodyHtml: '<h1>당신의 성공 이야기를 시작하세요!</h1><p>지금 시작하면 성공 일정표도 받으실 수 있어요.</p><a href="#">지금 시작</a>',
      },
    ],
  },
  {
    lensCode: 'L6',
    name: 'L6: 타이밍/손실회피 - 긴박감',
    description: '시간이 제한되어 있다는 긴박감을 강조하는 고객용',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '⏰ 긴급! 이 가격은 오늘뿐입니다. 내일은 300만원 인상됩니다!',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '마지막 남은 할인! 지금이 진짜 기회입니다. 1,200만원 → 900만원. 이 기회를 놓치면 후회합니다.',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '⏳ 마감까지 18시간! 추가 100만원 보너스는 오늘 신청자만! [지금 신청]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '⚠️ 최종 마감! 이 시간 이후 특가는 종료됩니다. 지금 바로 [신청하기]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '⏰ 긴급! 이 가격은 오늘뿐입니다',
        bodyHtml: '<h1 style="color: red;">긴급 알림!</h1><p>이 가격은 오늘뿐입니다.</p><p>내일은 300만원 인상됩니다!</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '마지막 남은 할인! 지금이 진짜 기회입니다',
        bodyHtml: '<h1 style="color: red;">마지막 기회!</h1><p>지금이 진짜 기회입니다.</p><h2>1,200만원 → 900만원</h2><p>이 기회를 놓치면 후회합니다.</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '⏳ 마감까지 18시간! 추가 100만원 보너스',
        bodyHtml: '<h1 style="color: red;">⏳ 시간 제한 중!</h1><p>마감까지 18시간만 남았습니다!</p><p>추가 100만원 보너스는 오늘 신청자만!</p><a href="#">지금 신청</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '⚠️ 최종 마감! 이 시간 이후 특가 종료',
        bodyHtml: '<h1 style="color: red;">최종 마감!</h1><p>이 시간 이후 특가는 종료됩니다.</p><p>지금 바로 신청하세요!</p><a href="#">신청하기</a>',
      },
    ],
  },
  {
    lensCode: 'L7',
    name: 'L7: 동반자/가족 설득',
    description: '배우자나 가족과 함께 결정해야 하는 고객용',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '배우자분과 함께 준비하시나요? 좋은 생각입니다! 가족 함께 여행하는 게 최고의 추억입니다.',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '부부 함께하면 10% 추가 할인! 아이들 동반 시 어린이 패키지 무료! 가족 모두 행복입니다.',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '실제 고객 후기: "남편이 너무 좋아했어요!" "아이들이 영원히 기억할 추억!" [후기 보기]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '가족 함께 신청하면 특별 일정도 커스터마이징해드립니다! [가족 함께 신청]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '배우자분과 함께 준비하세요!',
        bodyHtml: '<h1>가족이 함께하는 행복</h1><p>배우자분과 함께 준비하시나요? 좋은 생각입니다!</p><p>가족 함께 여행하는 게 최고의 추억입니다.</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '부부 할인 10%, 아이 패키지 무료!',
        bodyHtml: '<h1>가족 함께하는 혜택</h1><ul><li>부부 함께하면 10% 추가 할인!</li><li>아이들 동반 시 어린이 패키지 무료!</li></ul><p>가족 모두 행복합니다.</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '실제 고객 가족들의 행복한 후기',
        bodyHtml: '<h1>가족들의 목소리</h1><ul><li>"남편이 너무 좋아했어요!"</li><li>"아이들이 영원히 기억할 추억!"</li><li>"가족 모두 다시 가고 싶대요"</li></ul><a href="#">더 많은 후기 보기</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '가족 함께 신청하면 특별 일정도 커스터마이징',
        bodyHtml: '<h1>가족 맞춤 여행</h1><p>가족 함께 신청하면 특별 일정도 커스터마이징해드립니다!</p><a href="#">가족 함께 신청</a>',
      },
    ],
  },
  {
    lensCode: 'L8',
    name: 'L8: 재구매 및 습관적 성장',
    description: '이미 한번 경험한 고객을 위한 재구매 자극',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '다시 한번 그 느낌을 경험하고 싶으신가요? 지난번 만족했던 고객들이 모두 재신청했어요!',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '재신청 고객 전용 특가! 지난번 가격에서 20% 할인! 같은 객실, 더 좋은 가격!',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '올해 3회차 여행자: "매년 이 시즌에 떠나요" "습관처럼 선택합니다" [후기 보기]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '이제 습관이 되셨나요? 정기 멤버십 가입하면 매년 30% 할인! [멤버십 가입]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '그 행복을 다시 경험하고 싶으신가요?',
        bodyHtml: '<h1>다시 그 느낌!</h1><p>다시 한번 그 느낌을 경험하고 싶으신가요?</p><p>지난번 만족했던 고객들이 모두 재신청했어요!</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '재신청 고객 전용 특가 - 20% 할인!',
        bodyHtml: '<h1>다시 만나요!</h1><p>재신청 고객 전용 특가!</p><p>지난번 가격에서 20% 할인!</p><p>같은 객실, 더 좋은 가격!</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '이미 습관이 되셨나요?',
        bodyHtml: '<h1>정기 고객들의 이야기</h1><ul><li>"매년 이 시즌에 떠나요"</li><li>"습관처럼 선택합니다"</li><li>"이제 없으면 안 돼요"</li></ul><a href="#">재신청 고객 후기</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '정기 멤버십 가입 - 매년 30% 할인',
        bodyHtml: '<h1>최고의 혜택</h1><p>이제 습관이 되셨나요?</p><p>정기 멤버십 가입하면 매년 30% 할인!</p><a href="#">멤버십 가입하기</a>',
      },
    ],
  },
  {
    lensCode: 'L9',
    name: 'L9: 건강/안전 및 신뢰 강조',
    description: '건강과 안전을 최우선으로 생각하는 고객용',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '안전하고 건강한 여행을 원하시나요? 당연합니다! 저희도 그것이 최우선입니다.',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '5성급 의료 선박! 선상 의사 24시간 상주! 응급 헬리콥터 서비스 포함! 당신의 건강이 우선입니다.',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '국제 보건 인증 획득! WHO 권장 검역 기준 충족! 99.8% 안전 기록! [인증서 확인]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '당신의 건강한 여행을 위해 보험도 무료 제공합니다. 지금 신청하세요! [신청하기]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '안전하고 건강한 여행을 우선으로',
        bodyHtml: '<h1>안전이 최우선입니다</h1><p>안전하고 건강한 여행을 원하시나요?</p><p>당연합니다! 저희도 그것이 최우선입니다.</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '5성급 의료 선박, 의사 24시간 상주',
        bodyHtml: '<h1>최고 수준의 의료 서비스</h1><ul><li>5성급 의료 선박</li><li>선상 의사 24시간 상주</li><li>응급 헬리콥터 서비스 포함</li></ul><p>당신의 건강이 우선입니다.</p>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '국제 보건 인증 획득, 99.8% 안전 기록',
        bodyHtml: '<h1>검증된 안전성</h1><ul><li>국제 보건 인증 획득</li><li>WHO 권장 검역 기준 충족</li><li>99.8% 안전 기록</li></ul><a href="#">국제 인증서 확인</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '건강한 여행을 위한 무료 보험 제공',
        bodyHtml: '<h1>완벽한 건강 관리</h1><p>당신의 건강한 여행을 위해 보험도 무료 제공합니다.</p><p>지금 안전하게 신청하세요!</p><a href="#">신청하기</a>',
      },
    ],
  },
  {
    lensCode: 'L10',
    name: 'L10: 즉시 구매 결정 클로징',
    description: '마지막 한 번의 결정 고리를 끊기 위한 강력한 클로징',
    smsMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        content: '이제 결정하실 차례입니다! 더 이상 미루지 마세요. 이 순간이 당신의 변화입니다!',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        content: '지금 신청하면 즉시 일정 확정! 24시간 안에 서류 완성! 3일 내 출발 준비 완료!',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        content: '마지막 선물! 공항 픽업 무료! 짐 배송료 무료! 환전 수수료 무료! [지금 신청]',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        content: '🎉 마지막 기회! 이제 행동하세요! 망설임은 이미 답입니다. [지금 시작하기]',
      },
    ],
    emailMessages: [
      {
        day: 0,
        pasonaStage: 'PROBLEM',
        subject: '이제 당신의 순서입니다!',
        bodyHtml: '<h1 style="color: #27AE60;">결정의 시간입니다!</h1><p>이제 결정하실 차례입니다!</p><p>더 이상 미루지 마세요. 이 순간이 당신의 변화입니다!</p>',
      },
      {
        day: 1,
        pasonaStage: 'SOLUTION',
        subject: '지금 신청하면 즉시 일정 확정!',
        bodyHtml: '<h1 style="color: #27AE60;">빠른 처리!</h1><ul><li>즉시 일정 확정!</li><li>24시간 안에 서류 완성!</li><li>3일 내 출발 준비 완료!</li></ul>',
      },
      {
        day: 2,
        pasonaStage: 'OFFER',
        subject: '마지막 선물 4가지 무료!',
        bodyHtml: '<h1 style="color: #27AE60;">특별한 선물을 준비했습니다!</h1><ul><li>공항 픽업 무료!</li><li>짐 배송료 무료!</li><li>환전 수수료 무료!</li><li>여행 보험 무료!</li></ul><a href="#">지금 신청</a>',
      },
      {
        day: 3,
        pasonaStage: 'ACTION',
        subject: '🎉 마지막 기회! 이제 시작하세요!',
        bodyHtml: '<h1 style="color: #27AE60; font-size: 2em;">🎉 마지막 기회!</h1><p>이제 행동하세요!</p><p>망설임은 이미 답입니다.</p><p>당신의 꿈은 지금 시작됩니다!</p><a href="#" style="background-color: #27AE60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">지금 시작하기</a>',
      },
    ],
  },
];

async function main() {
  console.log('🌱 Funnel Lens Templates Seed Script 시작...\n');

  try {
    // 1. organizationId 확인
    console.log(`📍 Organization ID: ${GLOBAL_ORG_ID}`);

    // 2. 기존 템플릿 확인 (중복 방지)
    const existingCount = await prisma.funnelSms.count({
      where: {
        organizationId: GLOBAL_ORG_ID,
        isTemplate: true,
      },
    });

    if (existingCount > 0) {
      console.log(
        `⚠️  이미 ${existingCount}개의 템플릿이 존재합니다. 중복을 피하기 위해 기존 템플릿을 삭제합니다...`
      );
      // 기존 템플릿 삭제
      await prisma.funnelSmsMessage.deleteMany({
        where: {
          funnelSms: {
            organizationId: GLOBAL_ORG_ID,
            isTemplate: true,
          },
        },
      });
      await prisma.funnelEmailMessage.deleteMany({
        where: {
          funnelEmail: {
            organizationId: GLOBAL_ORG_ID,
            isTemplate: true,
          },
        },
      });
      await prisma.funnelSms.deleteMany({
        where: {
          organizationId: GLOBAL_ORG_ID,
          isTemplate: true,
        },
      });
      await prisma.funnelEmail.deleteMany({
        where: {
          organizationId: GLOBAL_ORG_ID,
          isTemplate: true,
        },
      });
      console.log('✅ 기존 템플릿 삭제 완료\n');
    }

    // 3. 렌즈별 템플릿 생성
    let totalFunnelCount = 0;
    let totalSmsMessageCount = 0;
    let totalEmailMessageCount = 0;

    for (const template of LENS_TEMPLATES) {
      console.log(`📋 생성 중: ${template.name}`);

      // SMS Funnel 생성
      const funnelSms = await prisma.funnelSms.create({
        data: {
          organizationId: GLOBAL_ORG_ID,
          title: template.name,
          description: template.description,
          lensType: template.lensCode,
          visibility: 'PUBLIC',
          isTemplate: true,
          isActive: true,
          messages: {
            create: template.smsMessages.map((msg, idx) => ({
              order: idx + 1,
              daysAfter: msg.day,
              content: msg.content,
              msgType: 'SMS',
            })),
          },
        },
        include: {
          messages: true,
        },
      });
      totalFunnelCount++;
      totalSmsMessageCount += funnelSms.messages.length;
      console.log(`  ✓ SMS Funnel: ${funnelSms.id} (4개 메시지)`);

      // Email Funnel 생성
      const funnelEmail = await prisma.funnelEmail.create({
        data: {
          organizationId: GLOBAL_ORG_ID,
          title: template.name.replace('L', 'L') + ' (이메일)',
          description: template.description,
          lensType: template.lensCode,
          visibility: 'PUBLIC',
          isTemplate: true,
          isActive: true,
          messages: {
            create: template.emailMessages.map((msg, idx) => ({
              order: idx + 1,
              daysAfter: msg.day,
              subject: msg.subject,
              bodyHtml: msg.bodyHtml,
              previewText: msg.subject,
            })),
          },
        },
        include: {
          messages: true,
        },
      });
      totalFunnelCount++;
      totalEmailMessageCount += funnelEmail.messages.length;
      console.log(`  ✓ Email Funnel: ${funnelEmail.id} (4개 메시지)\n`);
    }

    // 4. 결과 출력
    console.log('═══════════════════════════════════════════════');
    console.log('✅ Seed 완료!\n');
    console.log('📊 생성된 레코드:');
    console.log(`  • Funnel 총 ${totalFunnelCount}개 (SMS: 10, Email: 10)`);
    console.log(`  • FunnelSmsMessage 총 ${totalSmsMessageCount}개`);
    console.log(`  • FunnelEmailMessage 총 ${totalEmailMessageCount}개`);
    console.log(`  • 총 메시지: ${totalSmsMessageCount + totalEmailMessageCount}개\n`);
    console.log('🎯 렌즈별 템플릿:');
    LENS_TEMPLATES.forEach((t) => {
      console.log(`  • ${t.lensCode}: ${t.name}`);
    });
    console.log('\n═══════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
