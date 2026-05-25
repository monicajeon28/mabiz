/**
 * L7 Lens (Family Persuasion) SMS Template Seeder
 * Menu #50: 동반자 설득 SMS 템플릿 24개 생성
 * 역할 3개 × 일수 4개 × 변형 2개 = 24개 템플릿
 */

import { prisma } from '../src/lib/prisma';

const L7_SMS_TEMPLATES = [
  // SPOUSE (배우자) - Day 0: 초기 제안 + 기본 SMS (PASONA P+A)
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day0-A-초기제안',
    content:
      '안녕하세요 {spouse_name}님! {contact_name}님과 함께 하실 프리미엄 크루즈여행, 정말 좋으시지 않나요? 무료 상담 예약: {link}',
    triggerType: 'COMPANION_DAY0',
    triggerOffset: 0,
    isSystem: true,
    psychologyTag: 'L7_spouse_initial',
    segmentCode: 'spouse_day0_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day0-B-감정적연결',
    content:
      '{spouse_name}님, 이번 크루즈는 {contact_name}님과의 특별한 추억을 만드는 기회입니다. 무료 상담 예약: {link}',
    triggerType: 'COMPANION_DAY0',
    triggerOffset: 0,
    isSystem: true,
    psychologyTag: 'L7_spouse_emotional',
    segmentCode: 'spouse_day0_b',
  },

  // SPOUSE - Day 1: 의문 해소 + 신뢰 구축 (PASONA S)
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day1-A-의문해소',
    content:
      '{spouse_name}님, 크루즈 비용 부담 걱정하세요? 저희가 1000만원대 최저가로 모든 불안감을 해결해드립니다. {link}',
    triggerType: 'COMPANION_DAY1',
    triggerOffset: 1,
    isSystem: true,
    psychologyTag: 'L7_spouse_solve_concern',
    segmentCode: 'spouse_day1_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day1-B-사회증명',
    content:
      '많은 부부들(월 평균 850쌍)이 이 크루즈를 함께 선택합니다. {spouse_name}님도 가족과 행복한 추억을 만들어보세요. {link}',
    triggerType: 'COMPANION_DAY1',
    triggerOffset: 1,
    isSystem: true,
    psychologyTag: 'L7_spouse_social_proof',
    segmentCode: 'spouse_day1_b',
  },

  // SPOUSE - Day 2: 가치 강조 + 희소성 (PASONA O+N)
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day2-A-가격가치',
    content:
      '{spouse_name}님, 이 가격에 이 품질을 제공하는 크루즈는 드뭅니다. 지금 예약하면 50% 할인 추가혜택! {link}',
    triggerType: 'COMPANION_DAY2',
    triggerOffset: 2,
    isSystem: true,
    psychologyTag: 'L7_spouse_value',
    segmentCode: 'spouse_day2_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day2-B-결정촉구',
    content:
      '가족과의 소중한 시간을 위해 {spouse_name}님의 결정이 필요합니다. {contact_name}님과 함께 결정해주세요! {link}',
    triggerType: 'COMPANION_DAY2',
    triggerOffset: 2,
    isSystem: true,
    psychologyTag: 'L7_spouse_decision',
    segmentCode: 'spouse_day2_b',
  },

  // SPOUSE - Day 3: 긴박감 + 최종 클로징 (PASONA A)
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day3-A-마감임박',
    content:
      '⏰ {spouse_name}님! 예약 마감이 24시간만 남았습니다. 지금 결정하세요! 더 이상 이 기회는 없습니다. {link}',
    triggerType: 'COMPANION_DAY3',
    triggerOffset: 3,
    isSystem: true,
    psychologyTag: 'L7_spouse_urgency',
    segmentCode: 'spouse_day3_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_SPOUSE',
    title: 'L7-배우자-Day3-B-최종클로징',
    content:
      '{spouse_name}님의 동의로 {contact_name}님과의 행복한 여행이 시작됩니다. 지금이 최종 기회입니다! {link}',
    triggerType: 'COMPANION_DAY3',
    triggerOffset: 3,
    isSystem: true,
    psychologyTag: 'L7_spouse_close',
    segmentCode: 'spouse_day3_b',
  },

  // PARENT (부모) - Day 0: 초기 제안 + 감정 호소
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day0-A-자녀효심',
    content:
      '안녕하세요 {parent_name}님! {contact_name}님이 드리는 가족 크루즈 여행 초대입니다. 함께 즐거운 시간을 보내세요! {link}',
    triggerType: 'COMPANION_DAY0',
    triggerOffset: 0,
    isSystem: true,
    psychologyTag: 'L7_parent_filial',
    segmentCode: 'parent_day0_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day0-B-가족단합',
    content:
      '{parent_name}님, {contact_name}님이 선택한 프리미엄 크루즈에 초대합니다. 건강하고 행복한 가족 단합의 기회! {link}',
    triggerType: 'COMPANION_DAY0',
    triggerOffset: 0,
    isSystem: true,
    psychologyTag: 'L7_parent_family',
    segmentCode: 'parent_day0_b',
  },

  // PARENT - Day 1: 자녀 배려 + 신뢰
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day1-A-배려심',
    content:
      '{parent_name}님, 자녀를 배려하는 {contact_name}님의 마음으로 이 크루즈를 추천드립니다. 건강하고 행복한 추억을 함께 만들어보세요. {link}',
    triggerType: 'COMPANION_DAY1',
    triggerOffset: 1,
    isSystem: true,
    psychologyTag: 'L7_parent_filial_care',
    segmentCode: 'parent_day1_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day1-B-시간소중함',
    content:
      '부모님과의 소중한 시간, {contact_name}님이 준비했습니다. 함께하실래요? 부모님의 건강을 위한 최고의 선물입니다. {link}',
    triggerType: 'COMPANION_DAY1',
    triggerOffset: 1,
    isSystem: true,
    psychologyTag: 'L7_parent_time_value',
    segmentCode: 'parent_day1_b',
  },

  // PARENT - Day 2: 가격 합리성 + 평판
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day2-A-가격합리성',
    content:
      '{parent_name}님, 많은 부모님들이 이 가격에 만족하시고 예약하십니다. 망설이지 마세요! 베스트셀러 상품입니다. {link}',
    triggerType: 'COMPANION_DAY2',
    triggerOffset: 2,
    isSystem: true,
    psychologyTag: 'L7_parent_value',
    segmentCode: 'parent_day2_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day2-B-결정권',
    content:
      '자녀의 효심을 받으시고 행복한 여행을 함께하세요. {parent_name}님의 결정을 기다리고 있습니다! 가족이 함께 결정하는 여행입니다. {link}',
    triggerType: 'COMPANION_DAY2',
    triggerOffset: 2,
    isSystem: true,
    psychologyTag: 'L7_parent_decision',
    segmentCode: 'parent_day2_b',
  },

  // PARENT - Day 3: 마감 + 최종 청유
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day3-A-마지막기회',
    content:
      '⏰ {parent_name}님! 마지막 기회입니다. 이번이 아니면 내년을 기다려야 합니다. 지금 함께하시겠습니까? {link}',
    triggerType: 'COMPANION_DAY3',
    triggerOffset: 3,
    isSystem: true,
    psychologyTag: 'L7_parent_urgency',
    segmentCode: 'parent_day3_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_PARENT',
    title: 'L7-부모-Day3-B-행복약속',
    content:
      '{contact_name}님과의 행복한 크루즈, {parent_name}님의 손길을 기다립니다. 가족의 행복을 약속받으세요. 예약하세요! {link}',
    triggerType: 'COMPANION_DAY3',
    triggerOffset: 3,
    isSystem: true,
    psychologyTag: 'L7_parent_close',
    segmentCode: 'parent_day3_b',
  },

  // FRIEND (친구) - Day 0: 우정 호소 + 공동 경험
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day0-A-우정제안',
    content:
      '안녕하세요 {friend_name}님! {contact_name}님이 함께 할 크루즈여행에 초대합니다. 친구와의 최고의 추억을 만들어보세요! {link}',
    triggerType: 'COMPANION_DAY0',
    triggerOffset: 0,
    isSystem: true,
    psychologyTag: 'L7_friend_camaraderie',
    segmentCode: 'friend_day0_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day0-B-공동경험',
    content:
      '{friend_name}님, {contact_name}님과 함께하는 특별한 크루즈 여행을 제안합니다. 친구들끼리 가장 즐거워요! {link}',
    triggerType: 'COMPANION_DAY0',
    triggerOffset: 0,
    isSystem: true,
    psychologyTag: 'L7_friend_shared_experience',
    segmentCode: 'friend_day0_b',
  },

  // FRIEND - Day 1: 공동 고민 해소 + 신뢰
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day1-A-공동고민',
    content:
      '{friend_name}님, 친구들과 함께하는 여행이 최고의 추억을 만듭니다. 비용 걱정? 다 해결됩니다. 이번 기회를 놓치지 마세요! {link}',
    triggerType: 'COMPANION_DAY1',
    triggerOffset: 1,
    isSystem: true,
    psychologyTag: 'L7_friend_shared_concern',
    segmentCode: 'friend_day1_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day1-B-신뢰관계',
    content:
      '{friend_name}님도 걱정하세요? 모든 친구들이 겪는 고민입니다. 함께 고민 나누고 함께 해결해드립니다. {link}',
    triggerType: 'COMPANION_DAY1',
    triggerOffset: 1,
    isSystem: true,
    psychologyTag: 'L7_friend_trust',
    segmentCode: 'friend_day1_b',
  },

  // FRIEND - Day 2: 가격 공유 + 함께의 가치
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day2-A-가격공유',
    content:
      '{friend_name}님, 이 가격은 정말 특별합니다. 친구들과 함께 공유하세요! 넷이 함께하면 더 저렴해집니다. {link}',
    triggerType: 'COMPANION_DAY2',
    triggerOffset: 2,
    isSystem: true,
    psychologyTag: 'L7_friend_price',
    segmentCode: 'friend_day2_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day2-B-함께의가치',
    content:
      '친구의 초대가 이번 여행의 핵심입니다. {friend_name}님의 결정을 기다리고 있습니다! 함께여야 진짜 재미있습니다! {link}',
    triggerType: 'COMPANION_DAY2',
    triggerOffset: 2,
    isSystem: true,
    psychologyTag: 'L7_friend_together',
    segmentCode: 'friend_day2_b',
  },

  // FRIEND - Day 3: 긴박감 + 친구 유대
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day3-A-최종확인',
    content:
      '⏰ {friend_name}님! 최종 확인입니다. 친구들과 함께하시겠습니까? 우리 다시 모을 시간이 없어요! {link}',
    triggerType: 'COMPANION_DAY3',
    triggerOffset: 3,
    isSystem: true,
    psychologyTag: 'L7_friend_urgency',
    segmentCode: 'friend_day3_a',
  },
  {
    organizationId: 'default',
    category: 'L7_COMPANION_FRIEND',
    title: 'L7-친구-Day3-B-우정약속',
    content:
      '{contact_name}님과 최고의 추억을 만들 마지막 기회입니다. {friend_name}님의 선택을 기다립니다. 우정을 위해 지금 결정하세요! {link}',
    triggerType: 'COMPANION_DAY3',
    triggerOffset: 3,
    isSystem: true,
    psychologyTag: 'L7_friend_close',
    segmentCode: 'friend_day3_b',
  },
];

async function seedL7Templates() {
  try {
    console.log('🌱 L7 Lens SMS Templates Seeding started...');

    const created = await prisma.smsTemplate.createMany({
      data: L7_SMS_TEMPLATES as any,
      skipDuplicates: true,
    });

    console.log(`✅ ${created.count} L7 SMS templates created successfully`);
    console.log('📊 Template Breakdown:');
    console.log('   - 배우자(Spouse): 8개 (Day 0-3 × 2변형)');
    console.log('   - 부모(Parent): 8개 (Day 0-3 × 2변형)');
    console.log('   - 친구(Friend): 8개 (Day 0-3 × 2변형)');
    console.log('   - 총 24개 템플릿');
    console.log(
      '\n💡 심리학 적용:',
      '\n   - L7 (동반자 설득): PASONA + Grant Cardone 이의대응 렌즈',
      '\n   - Day 0: P(Problem)+A(Agitate) 단계',
      '\n   - Day 1: S(Solution) 단계',
      '\n   - Day 2: O(Offer)+N(Narrow) 단계',
      '\n   - Day 3: A(Action) 단계',
      '\n   - 성과 목표: 동반 예약율 40% → 55-70%',
      '\n   - 월별 예상 효과: $180K-250K'
    );
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedL7Templates();
