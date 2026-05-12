# 🔴 CRITICAL 보안 수정 체크리스트

**필수도**: ⭐⭐⭐ (배포 전 필수!)  
**소요시간**: 2-3시간  
**난이도**: 중간

---

## 🚨 CRITICAL 이슈 2개

### **CRITICAL-1: 비밀번호 하드코딩 (P0 보안 위험)**

**문제**:
```typescript
// ❌ 현재 코드 (위험!)
// 모든 신청자가 비밀번호 '3800'으로 계정 생성
// 누구든 phone + '3800'으로 로그인 가능 → 전계정 장악

const hashedPassword = await hashPassword('3800');
```

**위치**: `app/api/public/landing-pages/[slug]/register/route.ts` 라인 208

**영향도**: 🔴 **CRITICAL** — 전체 계정 시스템 침해 가능

---

### **수정 방법 1: 임시 비밀번호 + 이메일 발송** (권장)

```typescript
// ✅ 수정 후 (안전)

import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

// Step 1: 무작위 비밀번호 생성
const randomPassword = crypto.randomBytes(16).toString('hex');  // 예: "a3f7e2b1c9d4e8f0"

// Step 2: 사용자에게 이메일 발송
await sendPasswordResetEmail(email, {
  name: customerName,
  password: randomPassword,
  loginUrl: `https://www.cruisedot.co.kr/auth/login`
});

// Step 3: DB에 해시된 비밀번호 저장
const hashedPassword = await hashPassword(randomPassword);

// Step 4: 사용자 생성
const user = await prisma.user.create({
  data: {
    name: customerName,
    phone: encryptPhone(phone),  // ← 암호화 (다음 이슈 참고)
    email: email,
    password: hashedPassword,
    role: 'USER'
  }
});
```

**필요한 추가 코드**:
```typescript
// lib/email.ts (새로 생성)
export async function sendPasswordResetEmail(
  email: string,
  options: { name: string; password: string; loginUrl: string }
) {
  // SendGrid / AWS SES / Nodemailer 사용
  await emailProvider.send({
    to: email,
    subject: '[크루즈닷] 임시 비밀번호 안내',
    html: `
      <h2>안녕하세요, ${options.name}님!</h2>
      <p>회원가입이 완료되었습니다.</p>
      <p><strong>임시 비밀번호:</strong> <code>${options.password}</code></p>
      <p><a href="${options.loginUrl}">로그인</a></p>
      <p style="color: #999; font-size: 12px;">
        로그인 후 [설정] → [비밀번호 변경]에서 안전한 비밀번호로 변경하세요.
      </p>
    `
  });
}
```

**체크리스트**:
- [ ] randomPassword 생성 로직 추가
- [ ] sendPasswordResetEmail 함수 구현
- [ ] 이메일 서비스 선택 (SendGrid/SES/Nodemailer)
- [ ] 이메일 템플릿 작성
- [ ] 테스트 (테스트 이메일로 발송 확인)
- [ ] npm build 성공

---

### **수정 방법 2: 소셜 로그인만 사용** (장기 권장)

```typescript
// ✅ 대안: 비밀번호 제거 (Google/GitHub OAuth 사용)

const user = await prisma.user.create({
  data: {
    name: customerName,
    phone: encryptPhone(phone),
    email: email,
    password: null,  // 비밀번호 없음!
    authProvider: 'landing-page-oauth',  // Google/GitHub로 로그인
    role: 'USER'
  }
});
```

**장점**: 비밀번호 관리 불필요, 보안 향상  
**단점**: OAuth 구현 필요 (별도 작업)

---

## CRITICAL-2: 개인정보 평문 저장 (PIPA 위반)

**문제**:
```typescript
// ❌ 현재 코드 (위험!)
// DB 침해 시 전체 사용자의 이름/연락처 노출
model User {
  name    String?     // 평문 저장
  phone   String?     // 평문 저장
  email   String?     // 평문 저장
}

model LandingPageRegistration {
  customerName  String  // 평문 저장
  phone         String  // 평문 저장
  email         String? // 평문 저장
}
```

**위치**: `prisma/schema.prisma` (User, LandingPageRegistration)

**영향도**: 🔴 **CRITICAL** — PIPA 컴플라이언스 위반

---

### **수정 방법: AES-256 암호화 추가**

#### Step 1️⃣: 암호화 유틸 생성

```typescript
// lib/crypto.ts (새로 생성)

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.scryptSync(process.env.DATABASE_PASSWORD!, 'salt', 32);
const ALGORITHM = 'aes-256-gcm';

export function encryptPII(data: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

export function decryptPII(
  encrypted: string,
  iv: string,
  authTag: string
): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// 편의 함수
export function encryptPhone(phone: string) {
  const { encrypted, iv, authTag } = encryptPII(phone);
  return JSON.stringify({ encrypted, iv, authTag });
}

export function decryptPhone(encryptedData: string): string {
  const { encrypted, iv, authTag } = JSON.parse(encryptedData);
  return decryptPII(encrypted, iv, authTag);
}
```

#### Step 2️⃣: Prisma 스키마 수정

```prisma
// prisma/schema.prisma

model User {
  id                Int    @id @default(autoincrement())
  
  // 평문 저장 (로그인용)
  email             String? @unique
  
  // 암호화 저장 (개인정보)
  name_encrypted    String?  // JSON: {encrypted, iv, authTag}
  phone_encrypted   String?  // JSON: {encrypted, iv, authTag}
  
  // 검증용 (마스킹된 버전)
  phone_masked      String?  // "*****1234" (검색용)
  
  password          String?
  role              String   @default("USER")
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([email])
  @@index([phone_masked])  // 마스킹된 번호로 검색 가능
}

model LandingPageRegistration {
  id                Int    @id @default(autoincrement())
  
  // 암호화 저장
  customerName_encrypted String  // JSON: {encrypted, iv, authTag}
  phone_encrypted        String  // JSON: {encrypted, iv, authTag}
  email_encrypted        String? // JSON: {encrypted, iv, authTag}
  
  // 검증용 (마스킹)
  phone_masked           String  // "*****1234"
  
  landingPageId     Int
  landingPage       LandingPage @relation(fields: [landingPageId], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([landingPageId])
  @@index([phone_masked])
}
```

#### Step 3️⃣: API 라우트 수정

```typescript
// app/api/public/landing-pages/[slug]/register/route.ts

import { encryptPhone, encryptPII } from '@/lib/crypto';

export async function POST(request: Request) {
  const { customerName, phone, email } = await request.json();
  
  // 검증
  const schema = landingPageRegisterSchema.parse({
    customerName,
    phone,
    email
  });
  
  // 암호화
  const phoneEncrypted = encryptPhone(phone);
  const nameEncrypted = JSON.stringify(encryptPII(customerName));
  const emailEncrypted = email ? JSON.stringify(encryptPII(email)) : null;
  
  // 마스킹 (검색용)
  const phoneMasked = '*'.repeat(phone.length - 4) + phone.slice(-4);
  
  // DB 저장
  const registration = await prisma.landingPageRegistration.create({
    data: {
      customerName_encrypted: nameEncrypted,
      phone_encrypted: phoneEncrypted,
      email_encrypted: emailEncrypted,
      phone_masked: phoneMasked,
      landingPageId: landingPage.id
    }
  });
  
  return NextResponse.json({ ok: true });
}
```

#### Step 4️⃣: 관리자 패널 수정

```typescript
// app/api/admin/landing-pages/[id]/registrations/route.ts

import { decryptPhone, decryptPII } from '@/lib/crypto';

export async function GET(request: Request) {
  const registrations = await prisma.landingPageRegistration.findMany({
    where: { landingPageId: id }
  });
  
  // 복호화해서 관리자에게 보여주기
  const decrypted = registrations.map(r => ({
    id: r.id,
    customerName: decryptPII(JSON.parse(r.customerName_encrypted)),
    phone: decryptPhone(r.phone_encrypted),
    email: r.email_encrypted ? decryptPII(JSON.parse(r.email_encrypted)) : null,
    createdAt: r.createdAt
  }));
  
  return NextResponse.json(decrypted);
}
```

**체크리스트**:
- [ ] `lib/crypto.ts` 생성
- [ ] `prisma/schema.prisma` 수정
- [ ] `prisma migrate dev` 실행
- [ ] API 라우트 암호화 로직 추가
- [ ] 관리자 패널 복호화 로직 추가
- [ ] 테스트 (암호화/복호화 동작 확인)
- [ ] npm build 성공

---

## 📋 환경변수 설정

```env
# .env.local 또는 Vercel 대시보드

# 기존
DATABASE_URL=postgresql://...

# 신규 추가
ENCRYPTION_KEY=your-256-bit-base64-encoded-key
EMAIL_SERVICE=sendgrid  # 또는 ses, nodemailer
SENDGRID_API_KEY=...
```

**ENCRYPTION_KEY 생성하기**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🧪 테스트 방법

### **테스트 1: 비밀번호 로직**
```bash
# 1. 로컬 개발 서버 시작
npm run dev

# 2. 테스트 랜딩페이지 접속
http://localhost:3000/landing/test-slug

# 3. 폼 제출
- 이름: 테스트 사용자
- 폰: 010-1234-5678
- 이메일: test@example.com

# 4. 이메일 확인
- 콘솔에 이메일 내용 출력되는지 확인
- 임시 비밀번호가 포함되었는지 확인

# 5. 로그인 테스트
- 폰 + 임시 비밀번호로 로그인 가능한지 확인
```

### **테스트 2: 암호화 로직**
```typescript
// lib/crypto.test.ts (또는 수동 테스트)

import { encryptPhone, decryptPhone } from '@/lib/crypto';

const originalPhone = '010-1234-5678';
const encrypted = encryptPhone(originalPhone);
const decrypted = decryptPhone(encrypted);

console.assert(decrypted === originalPhone, 'Encryption failed!');
console.log('✅ Encryption test passed');
```

### **테스트 3: DB 마이그레이션**
```bash
# 1. 마이그레이션 생성
npx prisma migrate dev --name encrypt_pii

# 2. 데이터 백업
# (기존 데이터는 그대로 두고, 새 신청부터 암호화됨)

# 3. 확인
npx prisma db seed  # (seed 파일이 있다면)

# 4. 테스트 환경에서 확인
npm run dev
```

---

## ✅ 최종 체크리스트

### **CRITICAL-1: 비밀번호**
- [ ] `crypto.randomBytes()` 로직 추가
- [ ] `sendPasswordResetEmail()` 함수 구현
- [ ] 이메일 템플릿 작성
- [ ] 테스트 (임시 비밀번호 이메일 발송 확인)
- [ ] npm build 성공
- [ ] git commit

### **CRITICAL-2: 개인정보**
- [ ] `lib/crypto.ts` 생성 (encrypt/decrypt 함수)
- [ ] `prisma/schema.prisma` 스키마 수정
- [ ] `prisma migrate dev` 실행
- [ ] 모든 API에서 암호화/복호화 적용
- [ ] 테스트 (암호화/복호화 동작)
- [ ] npm build 성공
- [ ] git commit

### **환경변수**
- [ ] `.env.local`에 ENCRYPTION_KEY 추가
- [ ] Vercel 대시보드에 ENCRYPTION_KEY 추가
- [ ] SENDGRID_API_KEY 또는 이메일 서비스 키 추가

### **배포 전**
- [ ] npm run build 성공
- [ ] npm run dev 로컬 테스트
- [ ] git push
- [ ] Vercel 배포 테스트
- [ ] 프로덕션 환경변수 확인

---

## 🚨 주의사항

### **주의 1: 기존 데이터**
- 기존 평문 데이터는 **자동 암호화 안 됨**
- 필요시 마이그레이션 스크립트 작성

```typescript
// scripts/encrypt-existing-data.ts
import { PrismaClient } from '@prisma/client';
import { encryptPhone, encryptPII } from '@/lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { phone_encrypted: null }
  });
  
  for (const user of users) {
    if (user.phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone_encrypted: encryptPhone(user.phone),
          phone_masked: '*'.repeat(user.phone.length - 4) + user.phone.slice(-4)
        }
      });
    }
  }
  
  console.log(`✅ Encrypted ${users.length} users`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

```bash
# 실행
npx ts-node scripts/encrypt-existing-data.ts
```

### **주의 2: 키 관리**
- ENCRYPTION_KEY는 절대 GitHub에 커밋하지 마세요
- `.env.local` + `.gitignore`에 추가
- Vercel 대시보드에서 환경변수로 관리

### **주의 3: 백업**
- 마이그레이션 전에 DB 백업
- Neon 콘솔 → Backups

---

## 📞 문제 해결

### **문제: "crypto module not found"**
```bash
# Node.js 내장 모듈이므로 설치 불필요
# 하지만 타입 정의가 필요하면:
npm install --save-dev @types/node
```

### **문제: "ENCRYPTION_KEY not found"**
```bash
# .env.local에 추가
ENCRYPTION_KEY=your-base64-encoded-key

# 또는
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### **문제: "Prisma migration conflict"**
```bash
npx prisma migrate resolve --rolled-back
npx prisma migrate dev --name encrypt_pii
```

---

## 🎯 다음 단계

✅ **이 문서 완료 후:**
1. git commit (CRITICAL 2개 수정)
2. npm build 확인
3. 배포 (Vercel deploy)
4. 모니터링 (에러 로그 확인)

---

**상태**: ✅ 수정 가능 | **우선도**: 🔴 **CRITICAL** (지금 해야!)

다음: `../GUIDES/TECHNICAL_GUIDE.md`
