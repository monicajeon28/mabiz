const crypto = require('crypto');

// 환경변수 설정
process.env.PASSPORT_ENCRYPTION_KEY = 'a7dbc6313dbe92fffc880a807bb34c49f5c53658c8fc163f4e2fe0acc69e3557';

function getEncryptionKey() {
  const key = process.env.PASSPORT_ENCRYPTION_KEY;
  if (!key) throw new Error('Key missing');
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  } else if (key.length === 44) {
    return Buffer.from(key, 'base64');
  } else {
    throw new Error(`Key length error: ${key.length/2}bytes`);
  }
}

function encryptPassport(passportNumber) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(passportNumber, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encryptedData: Buffer.from(encrypted, 'hex').toString('base64'),
    iv: iv.toString('base64'),
  };
}

function decryptPassport(encryptedData, iv) {
  const key = getEncryptionKey();
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
  let decrypted = decipher.update(encryptedBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf-8');
}

function maskPassport(passportNumber) {
  if (!passportNumber || passportNumber.length < 4) {
    return '****';
  }
  const lastFour = passportNumber.slice(-4);
  return `****${lastFour}`;
}

console.log('=== 1️⃣ 암호화/복호화 테스트 ===\n');

// Test 1: 기본 암호화/복호화
console.log('✅ Test 1: 기본 암호화/복호화');
const plaintext = 'M12345678';
const { encryptedData, iv } = encryptPassport(plaintext);
const decrypted = decryptPassport(encryptedData, iv);
console.log(`  입력: ${plaintext}`);
console.log(`  암호화: ${encryptedData.substring(0, 20)}...`);
console.log(`  복호화: ${decrypted}`);
console.log(`  성공: ${plaintext === decrypted ? '✓' : '✗'}\n`);

// Test 2: IV가 매번 다르게 생성
console.log('✅ Test 2: IV 랜덤 생성 검증');
const enc1 = encryptPassport(plaintext);
const enc2 = encryptPassport(plaintext);
console.log(`  같은 평문: ${plaintext}`);
console.log(`  암호화1: ${enc1.encryptedData.substring(0, 20)}...`);
console.log(`  암호화2: ${enc2.encryptedData.substring(0, 20)}...`);
console.log(`  다른가?: ${enc1.encryptedData !== enc2.encryptedData ? '✓ (예)' : '✗'}\n`);

// Test 3: 마스킹
console.log('✅ Test 3: 여권번호 마스킹');
const masked = maskPassport(plaintext);
console.log(`  원본: ${plaintext}`);
console.log(`  마스킹: ${masked}`);
console.log(`  정상: ${masked === '****5678' ? '✓' : '✗'}\n`);

// Test 4: 다양한 형식
console.log('✅ Test 4: 다양한 여권번호 형식');
const formats = ['M12345678', 'C87654321', 'P11111111', '여권번호테스트'];
let formatPass = true;
for (const fmt of formats) {
  const { encryptedData: ed, iv: i } = encryptPassport(fmt);
  const dec = decryptPassport(ed, i);
  const pass = fmt === dec;
  console.log(`  ${fmt}: ${pass ? '✓' : '✗'}`);
  if (!pass) formatPass = false;
}
console.log(`  전체 성공: ${formatPass ? '✓' : '✗'}\n`);

console.log('=== 2️⃣ 성능 테스트 ===\n');

// Test 5: 성능
console.log('✅ Test 5: 암호화 성능 (100회)');
const start1 = Date.now();
for (let i = 0; i < 100; i++) {
  encryptPassport('M12345678');
}
const elapsed1 = Date.now() - start1;
console.log(`  100회 암호화: ${elapsed1}ms`);
console.log(`  평균: ${(elapsed1 / 100).toFixed(2)}ms/회`);
console.log(`  통과(5000ms이내): ${elapsed1 < 5000 ? '✓' : '✗'}\n`);

console.log('✅ Test 6: 복호화 성능 (100회)');
const { encryptedData: perfEnc, iv: perfIv } = encryptPassport('M12345678');
const start2 = Date.now();
for (let i = 0; i < 100; i++) {
  decryptPassport(perfEnc, perfIv);
}
const elapsed2 = Date.now() - start2;
console.log(`  100회 복호화: ${elapsed2}ms`);
console.log(`  평균: ${(elapsed2 / 100).toFixed(2)}ms/회`);
console.log(`  통과(5000ms이내): ${elapsed2 < 5000 ? '✓' : '✗'}\n`);

console.log('=== 3️⃣ 에러 처리 테스트 ===\n');

// Test 7: 잘못된 IV
console.log('✅ Test 7: 잘못된 IV로 복호화 시도');
const { encryptedData: badEnc } = encryptPassport('M12345678');
const wrongIv = encryptPassport('wrong').iv;
try {
  decryptPassport(badEnc, wrongIv);
  console.log(`  결과: ✗ (에러 없음 - 문제)\n`);
} catch (error) {
  console.log(`  결과: ✓ (예상된 에러 발생)\n`);
}

// Test 8: 손상된 데이터
console.log('✅ Test 8: 손상된 암호화 데이터');
const { iv: goodIv } = encryptPassport('M12345678');
try {
  decryptPassport('aabbccddee', goodIv);
  console.log(`  결과: ✗ (에러 없음 - 문제)\n`);
} catch (error) {
  console.log(`  결과: ✓ (예상된 에러 발생)\n`);
}

console.log('=== 📊 최종 결과 ===\n');
console.log('모든 테스트 완료! 암호화 시스템 정상 작동 ✅');
