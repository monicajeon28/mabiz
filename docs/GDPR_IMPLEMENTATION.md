# 🇪🇺 GDPR (General Data Protection Regulation) 구현 가이드

**버전**: 1.0  
**작성일**: 2026-05-27  
**범위**: EU 거주자 데이터 처리

---

## 📋 GDPR 체크리스트

마비즈 CRM이 준수해야 할 GDPR 요구사항과 현재 상태:

### 1️⃣ Article 5: 데이터 처리 원칙

| 원칙 | 요구사항 | 구현 상태 | 증거 |
|------|---------|----------|------|
| **Lawfulness** | 적법한 근거(동의 또는 계약) 필요 | ✅ 구현 | Contact.consentGivenAt 필드 |
| **Fairness** | 공정한 처리 (투명성) | ✅ 구현 | 개인정보처리방침 공개 |
| **Transparency** | 명확한 공지 | ✅ 구현 | Sign-up 페이지 동의 문구 |
| **Purpose Limitation** | 명시된 목적 범위 내만 처리 | ✅ 구현 | Contact.purpose 필드 |
| **Data Minimization** | 필요한 정보만 수집 | ✅ 구현 | Contact 필드 최소화 |
| **Accuracy** | 정확한 데이터 유지 | ✅ 구현 | 감시 로그로 추적 |
| **Storage Limitation** | 필요한 기간만 보관 | ✅ 구현 | 삭제 정책 (우측: 포기) |
| **Integrity & Confidentiality** | 보안 (암호화, 접근제어) | ✅ 구현 | PII 마스킹, HTTPS |

### 2️⃣ Article 13/14: 정보 공시 (Privacy Notice)

**필수 공개 정보**:

- [ ] 데이터 컨트롤러 신원 및 연락처
  - 회사명: 마비즈
  - 주소: [본사 주소]
  - 이메일: privacy@mabiz.com

- [ ] 처리 목적
  - CRM 고객 관리
  - SMS/이메일 마케팅
  - 분석 및 리포팅

- [ ] 법적 근거
  - 사용자 동의 (GDPR 6(1)(a))
  - 계약 이행 (GDPR 6(1)(b))

- [ ] 수신자 (제3자 처리자)
  - Aligo (SMS 서비스)
  - SendGrid (이메일 서비스)
  - Neon (데이터베이스)
  - 각 서비스와 DPA 체결 필수

- [ ] 보관 기간
  - Contact: 계약 종료 후 3년
  - SMS/Email 로그: 1년
  - 감시 로그: 7년

- [ ] 권리 설명
  - Article 15: 접근 권리
  - Article 17: 삭제 권리 (우측)
  - Article 20: 이식성 권리
  - Article 21: 거부 권리

### 3️⃣ Article 15: 데이터 접근 권리 (Right of Access)

**구현**: `/api/compliance/my-data?contactId=xxx`

사용자가 요청하면 30일 이내에 제공해야 함:

- ✅ Contact 정보
- ✅ SMS/이메일 로그
- ✅ Call 로그
- ✅ 메모 및 분류
- ✅ 그룹 정보
- ✅ JSON 형식 다운로드

**처리 프로세스**:

```
사용자 요청
    ↓
데이터 조회 (1일 이내)
    ↓
JSON 파일 생성
    ↓
사용자에게 제공 (이메일 또는 다운로드)
    ↓
감시 로그 기록
```

### 4️⃣ Article 17: 삭제 권리 (Right to be Forgotten)

**구현**: `/api/compliance/data-deletion-request`

사용자 요청 후 처리 절차:

1. **신청 접수** (즉시)
   - Contact 상태: PENDING_DELETION
   - 예약된 SMS/이메일 취소
   - Contact 숨기기 (대시보드에서)

2. **유예기간** (30일)
   - 사용자가 취소 가능
   - 백업 유지
   - 일부 법적 의무 때문에 보관 (세금, 감사)

3. **영구 삭제** (30일 후)
   - 모든 Contact 데이터 삭제
   - SMS/Call 로그 삭제
   - 메모, 분류 삭제
   - 감시 로그만 유지 (7년)

**예외**: 다음의 경우 삭제 불가

- [ ] 법적 의무 (세금, 감사)
- [ ] 법적 청구 (소송 증거)
- [ ] 공공 이익 (공중 보건)
- [ ] 과학/역사적 목적 (비식별화된 데이터)

### 5️⃣ Article 20: 데이터 이식성 (Data Portability)

**구현**: `/api/compliance/my-data` (JSON 형식)

요구사항:
- ✅ 구조화된 형식 (JSON)
- ✅ 기계 판독 가능 (API)
- ✅ 30일 이내 제공
- ✅ 사용자가 다른 서비스로 전달 가능

### 6️⃣ Article 21: 거부 권리 (Right to Object)

**마케팅 거부**:

- [ ] Contact.doNotMarket = true
- [ ] SMS 발송 중단
- [ ] Email 발송 중단
- [ ] 타게팅 광고 중단

**구현**:
```typescript
// Contact에 doNotMarket 플래그 추가
const contact = await prisma.contact.update({
  where: { id: contactId },
  data: { doNotMarket: true },
});

// SMS 발송 전 체크
if (contact.doNotMarket) {
  throw new Error('Contact has opted out of marketing');
}
```

### 7️⃣ Article 22: 자동화된 의사결정 (Automated Decision Making)

**현재 상태**: 
- ✅ SMS Day 0-3 자동화 (사용자가 설정한 기준)
- ✅ 심리학 렌즈 자동 분류 (투명)
- ⚠️ 규제 항목: 완전 자동 거부 금지 (항상 인간 개입 필요)

**준수 사항**:
- [ ] 자동 의사결정 사용 시 명확한 공지
- [ ] 사용자의 이의 제기 권리
- [ ] 인간 개입 요청 가능
- [ ] 결정 설명 제공

### 8️⃣ Article 32: 데이터 보안 (Security)

**구현 사항**:

| 조치 | 상태 | 세부사항 |
|------|------|---------|
| 암호화 | ✅ | HTTPS 전송, 데이터베이스 암호화 |
| 접근 제어 | ✅ | RBAC, PII 마스킹 |
| 감시 로그 | ✅ | 모든 접근/수정/삭제 기록 |
| 백업 | ✅ | 일일 백업, 7년 보관 |
| 이상 탐지 | ✅ | 비정상 접근 패턴 감지 |
| 직원 교육 | ⏳ | GDPR 교육 프로그램 (예정) |
| 침투 테스트 | ⏳ | 연간 보안 감사 (예정) |

### 9️⃣ Article 33: 위반 신고 (Breach Notification)

**절차** (48시간 이내):

1. **감지**
   - 감시 로그 시스템이 비정상 감지
   - 자동 경고 발생

2. **평가**
   - 위반 규모 및 영향 평가
   - 개인정보보호 담당자에게 보고

3. **신고**
   - 감독 당국 (GDPR 33조)
   - 개인 (GDPR 34조)
   - 언론 (필요시)

**구현 예정**:
```typescript
// 구현 예정: 데이터 유출 감지 및 신고
async function reportDataBreach(details: {
  affectedContactCount: number;
  dataType: string;
  cause: string;
  discoveryDate: Date;
}) {
  // 1. 감독 당국 신고 (예: GDPR Authority)
  // 2. Contact에게 이메일 발송
  // 3. 감시 로그 기록
}
```

### 🔟 Article 34: 개인 신고 (Individual Notification)

**데이터 유출 시 개인에게 통지**:

- [ ] 무엇이 누출되었는가
- [ ] 위험이 무엇인가
- [ ] 어떤 조치를 취했는가
- [ ] 개인이 취할 수 있는 조치
- [ ] 연락처 (DPO, 회사)

---

## 📝 구현 로드맵

### Phase 1: 즉시 (2026-05-27)

- [x] Privacy Notice 작성 (privacy.md)
- [x] DPA 검토 (Aligo, SendGrid, Neon)
- [x] 데이터 접근/삭제 API 구현
- [x] 감시 로그 시스템

### Phase 2: 1주 (2026-06-03)

- [ ] Privacy Notice 사이트에 게시
- [ ] Contact.doNotMarket 플래그 추가
- [ ] 대시보드에 GDPR 체크리스트 추가
- [ ] 직원 GDPR 교육

### Phase 3: 1개월 (2026-07-01)

- [ ] 데이터 유출 신고 프로세스
- [ ] 개인정보보호 담당자(DPO) 임명
- [ ] GDPR 감사 (외부 컨설턴트)

### Phase 4: 3개월 (2026-09-01)

- [ ] 모든 Contact에 명시적 동의 확보
- [ ] 침투 테스트 및 보안 감사
- [ ] GDPR 컴플라이언스 인증

---

## 📊 GDPR 체크리스트 (관리자용)

매월 이 목록을 검토하세요:

```markdown
# GDPR 월간 점검 (2026-05월)

## 데이터 수집
- [ ] 모든 신규 Contact에 동의 기록 (consentGivenAt)
- [ ] 동의 문구가 명확한가?
- [ ] 마케팅/분석 동의가 분리되어 있는가?

## 데이터 처리
- [ ] SMS/이메일은 사용자 동의 기반인가?
- [ ] 마케팅 거부(doNotMarket)한 Contact는 제외되는가?
- [ ] 목적 이외로 데이터 사용하지 않았는가?

## 데이터 보안
- [ ] 최근 비정상 접근 탐지된 것이 있는가?
- [ ] 모든 PII 접근이 기록되었는가?
- [ ] 백업은 정상적으로 진행되고 있는가?

## 권리 행사
- [ ] 미처리 데이터 접근 요청이 있는가?
- [ ] 미처리 삭제 요청이 있는가? (30일 내 처리 필수)
- [ ] 사용자 이의제기에 대응했는가?

## 법적 의무
- [ ] Privacy Notice가 최신 상태인가?
- [ ] 제3자 처리자(Aligo 등)와 DPA가 유효한가?
- [ ] 감시 로그가 7년 보관되고 있는가?

## 점검 결과
- 준수: ___/10
- 문제: ___________
- 조치: ___________
```

---

## 🚨 GDPR 위반 사례

### 사례 1: 30일 초과 미처리 삭제 요청

❌ **위반**:
```
사용자 요청: 2026-05-01
아직도 미처리: 2026-06-15 (45일)
```

✅ **해결**:
```
감시 로그 시스템이 자동 감지
→ 관리자에게 경고
→ 자동 영구 삭제 실행 (이미 30일 경과)
```

### 사례 2: 마케팅 거부 후에도 SMS 발송

❌ **위반**:
```
Contact.doNotMarket = true
아직도 SMS 발송 중
```

✅ **해결**:
```typescript
// SMS 발송 전 체크
const contact = await prisma.contact.findUnique({ ... });
if (contact.doNotMarket) {
  throw new Error('Contact has opted out');
}
```

### 사례 3: 비동의 수집

❌ **위반**:
```
Contact 생성 시 consentGivenAt = null
→ 감시 로그 경고: "95% 미만 동의 기록"
```

✅ **해결**:
```typescript
// Contact 생성 시 필수
const contact = await prisma.contact.create({
  data: {
    ...
    consentGivenAt: new Date(), // 필수
  },
});
```

---

## 📞 GDPR 관련 연락처

- **개인정보보호 담당자(DPO)**: privacy@mabiz.com
- **법무팀**: legal@mabiz.com
- **EU 감독 당국**: [국가별 감독 당국 목록]

---

## 참고 자료

- [GDPR 원본](https://gdpr-info.eu/)
- [EU 위원회 가이드](https://ec.europa.eu/info/law/law-topic/data-protection_en)
- [ICO (UK) 가이드](https://ico.org.uk/)
- [CNIL (France) 가이드](https://www.cnil.fr/)
