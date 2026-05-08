// 테스트: 콜 기록 생성 (scheduledAt 포함)
const contact_id = 'YOUR_CONTACT_ID'; // 고객 ID 입력
const today = new Date();
today.setHours(14, 30, 0, 0); // 오늘 14:30

const payload = {
  content: '크루즈 상품 설명',
  result: 'INTERESTED',
  duration: 15,
  convictionScore: 8,
  nextAction: '2026-05-10 재콜',
  scheduledAt: today.toISOString(), // 중요! 이 필드
};

console.log('📝 테스트 콜 기록:');
console.log(JSON.stringify(payload, null, 2));
console.log('');
console.log('🔗 이 데이터로 POST 요청:');
console.log(`POST /api/contacts/${contact_id}/call-logs`);
console.log('');
console.log('⚠️  YOUR_CONTACT_ID를 실제 고객 ID로 바꾸세요!');
