# 🔐 개인정보 처리 및 보호 가이드

**버전**: 1.0  
**작성일**: 2026-05-27  
**대상**: 마비즈 CRM 팀원

---

## 📋 목차

1. [개인정보 분류](#개인정보-분류)
2. [수집 및 처리 원칙](#수집-및-처리-원칙)
3. [접근 제어](#접근-제어)
4. [PII 마스킹](#pii-마스킹)
5. [데이터 보안](#데이터-보안)
6. [감시 로그](#감시-로그)
7. [팀원 책임](#팀원-책임)
8. [위반 신고](#위반-신고)

---

## 개인정보 분류

### 1️⃣ 일반 정보 (No Restriction)

자유롭게 처리 가능한 정보:

- Contact 이름 (공개 목적으로도 가능)
- 회사명, 직급
- 조직 정보
- 타임스탬프, 메타데이터

### 2️⃣ 민감 정보 (PII - Personally Identifiable Information)

신중하게 처리해야 하는 정보:

| 정보 | 제한사항 | 마스킹 |
|------|---------|--------|
| **전화번호** | 읽기/쓰기 권한 필요 | 010-****-5678 |
| **이메일** | 읽기/쓰기 권한 필요 | j***@example.com |
| **주소** | 읽기 권한 필요 | 마스킹 필수 |
| **생년월일** | 읽기 권한 필요 | 마스킹 필수 |

### 3️⃣ 매우 민감 정보 (Highly Restricted)

엄격히 보호해야 하는 정보:

| 정보 | 제한사항 | 저장 방식 |
|------|---------|----------|
| **주민번호** | ADMIN만 읽기 | 암호화 + 해시 |
| **여권번호** | ADMIN만 읽기 | 암호화 + 해시 |
| **계좌번호** | ADMIN만 읽기 | 암호화 + 해시 |
| **신용카드** | PAYMENT 시스템만 접근 | 외부 서비스 (PCI-DSS) |

### 4️⃣ 민감 카테고리 (Special Categories)

GDPR Article 9에서 특별 보호:

- 인종/민족
- 정치적 의견
- 종교
- 노조 가입
- 유전 정보
- 생체 정보
- 건강 정보
- 성생활

**원칙**: 특별한 법적 근거 없이 수집 금지

---

## 수집 및 처리 원칙

### 수집 할 때

✅ **해야 할 것**:

1. **명시적 동의 확보**
   ```typescript
   const contact = await prisma.contact.create({
     data: {
       name: "John Doe",
       phone: "010-1234-5678",
       email: "john@example.com",
       consentGivenAt: new Date(), // 필수
       consentType: "MARKETING", // 또는 "ANALYSIS"
       consentDocument: "privacy-v1.pdf",
     },
   });
   ```

2. **목적 명시**
   - "CRM 고객 관리"
   - "SMS 마케팅"
   - "통계 분석"

3. **거부 옵션 제공**
   ```
   ☐ CRM 고객 관리에 동의합니다
   ☐ SMS/이메일 마케팅에 동의합니다 (선택)
   ☐ 통계 분석에 동의합니다 (선택)
   ```

4. **Privacy Notice 제공**
   - 개인정보처리방침 링크
   - 권리 설명 (삭제, 수정, 접근 요청)
   - 담당자 연락처

❌ **하지 말아야 할 것**:

1. 미동의 수집
   ```typescript
   // ❌ 잘못된 예
   const contact = await prisma.contact.create({
     data: {
       phone: "010-1234-5678",
       // consentGivenAt 없음 ← 위반!
     },
   });
   ```

2. 목적 이외 사용
   ```typescript
   // ❌ 잘못된 예
   // "CRM"용 동의만 받았는데
   // SMS 마케팅에 사용 ← 위반!
   ```

3. 제한된 정보 수집
   ```typescript
   // ❌ 잘못된 예
   const contact = await prisma.contact.create({
     data: {
       ssn: "123456-7890123", // 주민번호 ← 필요없으면 금지!
     },
   });
   ```

### 처리할 때

✅ **해야 할 것**:

1. **접근 로그 기록**
   - 누가, 언제, 어디서, 무엇을 접근했는지 기록
   - 자동으로 감시 로그 시스템에서 처리

2. **권한 확인**
   ```typescript
   // API 핸들러에서
   const ctx = await getAuthContext();
   if (ctx.role !== 'AGENT' && ctx.role !== 'OWNER') {
     throw new UnauthorizedError('No access to PII');
   }
   ```

3. **필요한 정보만 반환**
   ```typescript
   // ❌ 전체 정보 반환
   const contact = await prisma.contact.findUnique({
     where: { id: contactId },
   }); // phone, email 포함됨

   // ✅ 필터링해서 반환
   const contact = await prisma.contact.findUnique({
     where: { id: contactId },
     select: {
       id: true,
       name: true,
       // phone, email 제외
     },
   });
   ```

4. **마스킹 적용**
   ```typescript
   // PII 필드는 마스킹해서 반환
   const masked = {
     ...contact,
     phone: piiAccessControl.maskPiiValue('phone', contact.phone),
     email: piiAccessControl.maskPiiValue('email', contact.email),
   };
   ```

❌ **하지 말아야 할 것**:

1. 승인 없이 PII 수출
   ```typescript
   // ❌ 잘못된 예
   const allContacts = await prisma.contact.findMany();
   saveToFile(allContacts); // 마스킹 없이 파일 저장 ← 위반!
   ```

2. 목적 변경
   ```typescript
   // ❌ 잘못된 예
   // "마케팅" 동의로 수집했는데
   // "3차 판매"에 사용 ← 위반!
   ```

3. 오래된 데이터 보관
   ```typescript
   // ❌ 잘못된 예
   const oldContact = await prisma.contact.findUnique({
     where: { id: contactId },
   });
   // 2019년 데이터인데 아직 보유 ← 보관 기간 초과!
   ```

---

## 접근 제어

### 역할별 권한 매트릭스

| 역할 | 전화번호 | 이메일 | 주소 | 생년월일 | 주민번호 |
|------|---------|--------|------|---------|---------|
| GLOBAL_ADMIN | 📖 ✏️ | 📖 ✏️ | 📖 ✏️ | 📖 ✏️ | 📖 (감시 + 마스킹) |
| OWNER | 📖 ✏️ | 📖 ✏️ | 📖 ✏️ | 📖 | ❌ |
| AGENT | 📖 ✏️ | 📖 ✏️ | 📖 | 📖 | ❌ |
| ANALYST | 📖 (마스킹) | 📖 (마스킹) | ❌ | ❌ | ❌ |
| READONLY | ❌ | ❌ | ❌ | ❌ | ❌ |

범례: 📖 읽기 | ✏️ 쓰기 | 마스킹 | ❌ 접근 금지

### 권한 요청 프로세스

PII에 접근이 필요한 경우:

1. **요청 제출**
   - 대상: 관리자
   - 내용: 접근 목적, 기간, 필드

2. **승인**
   - 관리자가 검토 (1일 이내)
   - 경우에 따라 거부 가능

3. **접근 권한 부여**
   - 임시 권한 (최대 7일)
   - 자동 실패 (7일 후)

4. **감시 로그**
   - 모든 PII 접근 기록
   - 월간 리뷰

---

## PII 마스킹

### 마스킹 규칙

#### 전화번호
```
원본: 010-1234-5678
마스킹: 010-****-5678

원본: 02-123-4567
마스킹: 02-****-4567
```

#### 이메일
```
원본: john.doe@company.com
마스킹: j***@company.com

원본: a@b.com
마스킹: a***@b.com
```

#### 이름
```
원본: John Doe
마스킹: J***

원본: 김철수
마스킹: 김***
```

#### 주소
```
원본: 서울시 강남구 테헤란로 123, 456호
마스킹: 서울시 강남구 ***
```

#### 생년월일
```
원본: 1990-05-15
마스킹: 1990-**-**
```

#### 주민번호/여권/계좌
```
원본: 900515-1234567
마스킹: [MASKED]

원본: M12345678
마스킹: [MASKED]
```

### 마스킹 적용 위치

1. **감시 로그에서**
   ```typescript
   // 감시 로그는 항상 마스킹
   await auditLogger.record({
     piiValuesAfter: {
       phone: "010-****-5678", // 마스킹됨
       email: "j***@example.com", // 마스킹됨
     },
   });
   ```

2. **대시보드 UI에서**
   ```typescript
   // 전체 권한 사용자도 UI에서는 마스킹
   const masked = piiAccessControl.maskPiiValue('phone', contact.phone);
   // 필요시만 원본 표시 (별도 버튼 "마스크 해제" 등)
   ```

3. **CSV/JSON 수출에서**
   ```typescript
   // 수출 파일도 마스킹 필수
   const exportData = contacts.map(c => ({
     ...c,
     phone: piiAccessControl.maskPiiValue('phone', c.phone),
     email: piiAccessControl.maskPiiValue('email', c.email),
   }));
   ```

4. **로그 파일에서**
   ```typescript
   // 어플리케이션 로그도 PII 마스킹
   logger.info('Contact updated', {
     contactId: contact.id,
     phone: "010-****-5678", // 마스킹됨
   });
   ```

---

## 데이터 보안

### 저장 시 보안 (Data at Rest)

```
┌─────────────────────────────────────┐
│   PostgreSQL Database               │
├─────────────────────────────────────┤
│ Contact (일반 정보)                  │
│  - id, name, company, job_title     │
│                                      │
│ Contact_PII (암호화)                 │
│  - phone_encrypted                  │
│  - email_encrypted                  │
│  - ssn_encrypted (암호화 + 해시)    │
│                                      │
│ AuditLog (감시)                     │
│  - 모든 접근/수정 기록              │
│  - PII는 마스킹된 형태만 저장       │
└─────────────────────────────────────┘
```

**암호화 방식**:
- 알고리즘: AES-256-GCM
- 키 관리: AWS KMS 또는 HashiCorp Vault
- 키 로테이션: 매년

### 전송 시 보안 (Data in Transit)

```
┌──────────────────────────────────────┐
│   Client (브라우저/앱)               │
└───────────────────┬──────────────────┘
                    │
                    ↓ HTTPS/TLS 1.3
                    │ (암호화)
                    ↓
┌──────────────────────────────────────┐
│   Server (마비즈 CRM)                │
├──────────────────────────────────────┤
│ 1. 요청 검증                         │
│ 2. 권한 확인                         │
│ 3. 감시 로그 기록                    │
│ 4. 데이터 조회 (암호화 상태)        │
│ 5. 복호화 (메모리에서만)             │
│ 6. 마스킹 적용                       │
│ 7. HTTPS로 응답 (암호화)             │
└──────────────────────────────────────┘
                    ↓
                    ↑ HTTPS/TLS 1.3
```

**프로토콜**:
- HTTPS/TLS 1.3 필수
- 자가 서명 인증서 금지
- 인증서는 신뢰할 수 있는 CA에서 발급

### 사용 시 보안 (Data in Use)

```typescript
// ✅ 올바른 예
async function getContact(contactId: string) {
  // 1. 권한 확인
  const ctx = await getAuthContext();
  if (ctx.role !== 'AGENT' && ctx.role !== 'OWNER') {
    throw new UnauthorizedError('No access to PII');
  }

  // 2. 감시 로그 기록
  await auditLogger.record({
    userId: ctx.userId,
    action: 'READ',
    resourceType: 'Contact',
    resourceId: contactId,
    piiFieldsAccessed: ['phone', 'email'],
  });

  // 3. 데이터 조회 (필요한 필드만)
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      name: true,
      phone: true, // 복호화됨 (메모리에서만)
      email: true,
    },
  });

  // 4. 마스킹 적용 (응답 전)
  const masked = {
    ...contact,
    phone: piiAccessControl.maskPiiValue('phone', contact.phone),
    email: piiAccessControl.maskPiiValue('email', contact.email),
  };

  return masked; // HTTPS로 전송 (암호화)
}
```

---

## 감시 로그

### 감시 로그에 기록되는 항목

| 항목 | 예시 | 필수 |
|------|------|------|
| 타임스탐프 | 2026-05-27T10:30:45Z | ✅ |
| 사용자 ID | user-12345 | ✅ |
| 액션 | READ, WRITE, DELETE | ✅ |
| 리소스 | Contact, Document | ✅ |
| 리소스 ID | contact-abc123 | ✅ |
| 상태 | SUCCESS, FAILED, DENIED | ✅ |
| IP 주소 | 192.168.1.1 | ✅ |
| PII 필드 | ['phone', 'email'] | ✅ |
| 사유 | Compliance, Business | ✅ |

### 감시 로그 조회

**대시보드**: `/admin/compliance` → "감시 로그" 탭

```sql
-- 예시 쿼리
SELECT *
FROM audit_logs
WHERE organization_id = 'org-123'
  AND created_at > NOW() - INTERVAL '7 days'
  AND pii_fields_accessed IS NOT NULL
ORDER BY created_at DESC;
```

**필터링 가능**:
- 날짜 범위
- 액션 (READ, WRITE, DELETE, EXPORT)
- 사용자
- 리소스 타입
- 상태 (SUCCESS, FAILED, DENIED)

### 감시 로그 보관

- **보관 기간**: 7년 (GDPR 요구사항)
- **삭제 금지**: 감시 로그는 절대 삭제 불가
- **수정 금지**: 감시 로그는 Append-only
- **백업**: 일일 백업, 오프사이트 보관

---

## 팀원 책임

### 모든 팀원이 지켜야 할 사항

1. **비밀유지**
   - 접근한 개인정보는 직무 범위 내에서만 사용
   - 외부인과 공유 금지
   - 휴가 중 접근 권한 자동 해제

2. **의심 신고**
   - 비정상 접근 패턴 발견 시 즉시 보고
   - 예: 밤 12시에 대량 데이터 다운로드
   - 연락처: privacy@mabiz.com

3. **교육 이수**
   - 연 1회 GDPR/데이터 보호 교육
   - 신입은 입사 1주 내 완료

4. **장비 보안**
   - 공용 컴퓨터 사용 금지
   - 화면 사용 중 다른 사람이 보지 않게 주의
   - 야외에서 민감한 정보 논의 금지

### 개발팀 책임

1. **코드 리뷰**
   - PII 접근 코드는 필수 리뷰
   - 마스킹이 적용되었는지 확인

2. **테스트**
   - PII 필드 접근 권한 테스트
   - 마스킹 적용 테스트
   - 감시 로그 기록 테스트

3. **배포**
   - 배포 전 보안 검사
   - 감시 로그 시스템 정상 작동 확인

### 관리팀 책임

1. **접근 권한 관리**
   - 신입: 입사 시 권한 부여
   - 이직: 퇴사 시 권한 회수
   - 승진: 역할 변경 시 권한 조정

2. **감시 로그 리뷰**
   - 월 1회 감시 로그 검토
   - 비정상 패턴 발견 시 조사

3. **위반 신고**
   - 의심 신고 접수 시 즉시 조사
   - 위반 사항은 GDPR 감독 당국에 신고 (48시간)

---

## 위반 신고

### 위반 신고 절차

```
단계 1: 발견
  └─ 누군가 비정상 접근 감지
     또는 데이터 유출 발견

단계 2: 평가 (24시간 이내)
  └─ 영향 범위 파악
  └─ 개인 정보 몇 개가 영향되었나?
  └─ 어떤 정보가 유출되었나?
  └─ 얼마나 심각한가?

단계 3: 준비 (24시간 이내)
  └─ 담당자 소집 (privacy@mabiz.com)
  └─ 필요시 외부 법무팀 자문

단계 4: 신고 (48시간 이내)
  └─ GDPR 감독 당국에 신고
     (예: 한국: 개인정보보호위원회)
  └─ 영향받은 개인에게 통지

단계 5: 사후 조치
  └─ 원인 분석
  └─ 재발 방지 조치
  └─ 3개월 후 결과 보고
```

### 신고 연락처

- **개인정보 담당자**: privacy@mabiz.com
- **법무팀**: legal@mabiz.com
- **CEO**: ceo@mabiz.com
- **한국 감독 당국**: http://www.privacy.go.kr

---

## 체크리스트 (월간)

마비즈 팀원들이 매월 확인하세요:

```markdown
## 2026-05월 개인정보 보호 체크리스트

### 기술적 조치
- [ ] 감시 로그 시스템 정상 작동
- [ ] 모든 PII 필드 마스킹 적용
- [ ] HTTPS 인증서 유효 (만료일 확인)
- [ ] 접근 권한이 정확한가? (새 입사자/퇴사자)
- [ ] 백업이 정상적으로 진행되는가?

### 조직적 조치
- [ ] 의심 신고가 있었는가? (즉시 조사)
- [ ] Privacy Notice는 최신 상태인가?
- [ ] 직원 교육은 완료되었는가?
- [ ] 외부 처리자(Aligo 등)와 DPA가 유효한가?
- [ ] 미처리 데이터 요청(접근/삭제)이 있는가?

### 규정 준수
- [ ] 감시 로그 7년 보관 중인가?
- [ ] 30일 초과 미처리 삭제 요청이 있는가?
- [ ] 비동의 Contact가 있는가? (consentGivenAt 없음)
- [ ] 마케팅 거부(doNotMarket)한 Contact가 포함되었는가?

### 점검 결과
- 문제 없음: ___/10
- 개선 필요: ___________
- 조치 예정일: ___________
```

---

## 참고 자료

- [개인정보보호위원회](https://www.privacy.go.kr/)
- [GDPR 원본](https://gdpr-info.eu/)
- [ISO 27001 (정보보안)](https://www.iso.org/isoiec-27001-information-security-management.html)
