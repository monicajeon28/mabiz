# ⭐ 5분 퀵스타트 가이드

**읽기 시간**: 5분 | **대상**: 모두 | **필수도**: ⭐⭐⭐

---

## 🎯 이 문서는 무엇인가?

당신이 **7명의 전문가 분석을 5분에 이해**할 수 있도록 정리했습니다.

---

## 📊 현재 상황 (30초 요약)

```
✅ 완성도: 100% 완성된 랜딩페이지 시스템
❌ 보안 문제: CRITICAL 2개 (배포 전 필수 수정)
⚡ 성능: 좋음 (LCP 40% 개선 가능)
📈 확장성: 높음 (완전 독립적 모듈)
```

---

## 🔴 배포 전 CRITICAL 수정 (지금 해야 할 것)

### **문제 1: 비밀번호 하드코딩**
```typescript
// ❌ 현재 (위험!)
const hashedPassword = await hashPassword('3800');  // 모든 신청자 동일 비밀번호!

// ✅ 수정 후 (안전)
const randomPassword = crypto.randomBytes(16).toString('hex');
await sendPasswordResetEmail(email, randomPassword);
```
**위치**: `app/api/public/landing-pages/[slug]/register/route.ts` 라인 208

### **문제 2: 개인정보 평문 저장**
```typescript
// ❌ 현재 (위험!)
User.name = "김철수";    // 평문 저장
User.phone = "010-1234-5678";  // 평문 저장

// ✅ 수정 후 (안전)
const encrypted = crypto.encrypt('AES-256-GCM', phone);
User.phone = encrypted;  // 암호화 저장
```
**위치**: `prisma/schema.prisma` (User 테이블)

---

## 📋 3단계로 시작하기

### **Step 1: 보안 수정** (20분)
→ `../CHECKLISTS/SECURITY_FIXES.md` 따라하기

```bash
# 1. 파일 열기
app/api/public/landing-pages/[slug]/register/route.ts

# 2. 비밀번호 로직 변경
# 줄 208 수정 (자세한 코드는 SECURITY_FIXES.md 참조)

# 3. 개인정보 암호화 추가
# prisma/schema.prisma User 모델 수정

# 4. npm build 실행
npm run build

# 5. 성공하면 다음 단계!
```

### **Step 2: 현재 구조 이해** (10분)
→ 파일 구조 파악

```
📁 현재 랜딩페이지 시스템:
├─ /app/landing/[slug]/page.tsx      공개 페이지
├─ /app/admin/landing-pages/         어드민 대시보드
├─ /app/partner/landing-pages/       파트너 대시보드
├─ /components/landing/              공유 컴포넌트 (8개)
├─ /app/api/public/landing-pages/    신청/댓글 API
├─ /app/api/admin/landing-pages/     CRUD API
└─ /app/api/payapp/landing/          결제 API
```

### **Step 3: 새 페이지 복제** (1h 45min)
→ `../GUIDES/TECHNICAL_GUIDE.md` 따라하기 (옵션 A)

```
1. TEMPLATES/landing-page.tsx 복사
2. TEMPLATES/components/ 5개 복사
3. TEMPLATES/lib/ 설정 수정
4. npm build + 테스트
→ 완성!
```

---

## 🎯 4가지 옵션 중 선택하기

### **옵션 A: 완전 독립 (⭐⭐⭐⭐⭐ 추천)**
- **시간**: 1h 45min
- **방법**: 새 폴더 `app/cruise-landing/` 생성
- **특징**: ProductList 제거, 정적 데이터만 사용
- **장점**: 빠르고, 깔끔하고, 유지보수 쉬움
- **추천 대상**: 빠르게 시작하고 싶은 팀

### **옵션 B: 공유 컴포넌트**
- **시간**: 3-4시간
- **방법**: 중복 코드 제거, 라이브러리화
- **특징**: 코드 최적화
- **장점**: 유지보수 효율성
- **추천 대상**: 장기 관리할 팀

### **옵션 C: 동적 라우팅**
- **시간**: 2-3시간
- **방법**: 파라미터 기반 동적 렌더링
- **특징**: 한 페이지로 여러 버전 관리
- **추천 대상**: A/B 테스트가 필요한 팀

### **옵션 D: 블로그 플랫폼**
- **시간**: 20-30시간
- **방법**: MDX + Notion API
- **특징**: 콘텐츠 관리 시스템
- **추천 대상**: SEO 최적화가 중요한 팀

---

## 📊 성능 개선 (옵션)

### **LCP 40% 개선하기** (추가 3시간)

```
현재: 6.5s
목표: 2.2s

개선 방법:
1. Redis 캐싱 추가     (-2s)
2. 이미지 최적화       (-1s)
3. 동적 코드 분할      (-1.3s)

자세한 방법: ../GUIDES/PERFORMANCE_GUIDE.md
```

---

## 🔐 보안 체크리스트 (배포 전)

- [ ] CRITICAL 2개 수정 (비밀번호 + 개인정보)
- [ ] npm build 성공
- [ ] 모바일 테스트 (375px)
- [ ] 타블렛 테스트 (768px)
- [ ] 데스크톱 테스트 (1024px+)
- [ ] SEO 메타데이터 확인
- [ ] 외부 링크 동작 확인

---

## 📞 자주 묻는 질문 (FAQ)

### **Q1: 배포하려면 어떻게 해야 하나요?**
A: CRITICAL 2개 수정 → npm build → git commit → vercel deploy

### **Q2: 기존 페이지에 영향이 있나요?**
A: 없습니다. 옵션 A를 선택하면 완전 독립적입니다.

### **Q3: 데이터베이스 변경이 필요한가요?**
A: 비밀번호/개인정보 암호화만 필요 (마이그레이션 1개)

### **Q4: 대리점장에게 어떻게 공유하나요?**
A: `GUIDES/DESIGN_SYSTEM.md`의 "대리점 배포 자동화" 섹션 참고

### **Q5: 지원하는 브라우저는?**
A: Chrome, Safari, Firefox 최신 버전 + iOS 13+, Android 8+

---

## 🚀 다음 단계

**지금 바로 할 것:**
1. ✅ 이 문서 읽음 (완료!)
2. → `../CHECKLISTS/SECURITY_FIXES.md` 보기
3. → CRITICAL 2개 수정하기
4. → npm build 확인
5. → git commit

**예상 시간**: 20-30분

---

## 📍 파일 위치

```
/home/userhyeseon28/projects/cruise-guide-app/.claude/landing-page-clone/

├── README.md (메인 가이드)
├── GUIDES/
│   ├── QUICK_START.md (지금 읽는 파일)
│   ├── TECHNICAL_GUIDE.md (자세한 기술)
│   ├── SECURITY_CHECKLIST.md (배포 전 보안)
│   ├── PERFORMANCE_GUIDE.md (성능 최적화)
│   └── DESIGN_SYSTEM.md (디자인)
├── CHECKLISTS/
│   ├── SECURITY_FIXES.md ← 다음으로 읽기!
│   ├── PRE_DEPLOYMENT.md
│   ├── TESTING_PLAN.md
│   └── MIGRATION_GUIDE.md
└── TEMPLATES/ (복제용 코드)
```

---

## ✨ 최종 정리

| 항목 | 상태 |
|------|------|
| 복제 가능성 | ✅ 100% |
| 안정성 | ⚠️ CRITICAL 2개 수정 필요 |
| 성능 | ✅ 우수 (개선 가능) |
| SEO | ✅ 좋음 |
| 확장성 | ✅ 높음 |

**결론**: 지금 바로 시작할 수 있습니다! 🚀

---

**다음**: `../CHECKLISTS/SECURITY_FIXES.md` 열어보세요!
