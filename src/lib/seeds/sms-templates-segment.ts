/**
 * SMS 템플릿 시딩 데이터
 * 세그먼트별 자동 추천 메시지
 */

export const SEGMENT_SMS_TEMPLATES = [
  {
    category: 'AUTO_RECOMMEND',
    title: '세그먼트 A 추천 (30대 커플)',
    content: '[이름]님을 위한 프리미엄 크루즈 패키지 추천 ✨\n신혼부부를 위한 특별한 경험을 준비했습니다.\n낭만적인 크루즈 여행으로 추억을 만들어보세요!\n[링크]에서 자세히 보기',
    segmentCode: 'A',
    isSystem: true,
    psychologyTag: 'Novelty + Romance',
  },
  {
    category: 'AUTO_RECOMMEND',
    title: '세그먼트 B 추천 (40대 가족)',
    content: '[이름]님 가족을 위한 맞춤 크루즈 여행 👨‍👩‍👧‍👦\n아이들과 함께하는 특별한 시간!\n안전하고 재미있는 크루즈로 가족의 추억을 완성하세요.\n[링크]에서 자세히 보기',
    segmentCode: 'B',
    isSystem: true,
    psychologyTag: 'Family + Safety',
  },
  {
    category: 'AUTO_RECOMMEND',
    title: '세그먼트 C 추천 (중년 부부)',
    content: '[이름]님을 위한 안정적인 크루즈 여행 🌅\n편안하고 신뢰할 수 있는 크루즈 경험!\n삶의 여유를 즐기는 최고의 선택입니다.\n[링크]에서 자세히 보기',
    segmentCode: 'C',
    isSystem: true,
    psychologyTag: 'Trust + Comfort',
  },
  {
    category: 'AUTO_RECOMMEND',
    title: '세그먼트 D 추천 (50-60대)',
    content: '[이름]님을 위한 경험 중심 크루즈 🎓\n배움과 즐거움이 함께하는 크루즈!\n또래 친구들과 함께 의미 있는 여행을 떠나세요.\n[링크]에서 자세히 보기',
    segmentCode: 'D',
    isSystem: true,
    psychologyTag: 'Experience + Learning',
  },
  {
    category: 'AUTO_RECOMMEND',
    title: '세그먼트 E 추천 (60대+)',
    content: '[이름]님을 위한 편안한 크루즈 여행 🏡\n가족과 함께하는 안전하고 간편한 크루즈!\n건강하고 행복한 여행을 약속합니다.\n[링크]에서 자세히 보기',
    segmentCode: 'E',
    isSystem: true,
    psychologyTag: 'Safety + Convenience',
  },
];
