# Neon DB 복구 최종 계획 (2026-05-26)

## 🎯 목표
**"너무 많아서 꼬였던" 무한 루프 문제 해결 → 데이터 안전하게 복구 → 배포**

---

## 📊 문제 원인 분석

### 발견된 P0 무한 루프 문제들
```
✗ infinite loop in gold-members + analytics (10렌즈 최적화)
✗ infinite loop in funnels (10렌즈 검토)
✗ infinite loop in contract-templates (Menu #45)
✗ Memory leak: setTimeout cleanup missing (5곳)
✗ Race condition: Promise.allSettled 부분 처리 미흡
✗ Timeout: 대량 데이터 조회시 초과
✗ Concurrency: 동시성 제어 부재
```

### 현재 코드 상태
- **무한 루프 패턴**: 241개 발견
- **스키마**: 50+ 테이블, 68개 마이그레이션 ✅
- **데이터**: Google Drive에 백업됨 ✅
- **문제**: 코드의 자동화 로직이 데이터를 반복 처리하다가 꼬임

---

## 🔧 해결 순서 (병렬 진행)

### Phase 1️⃣: 코드 안정화 (동시 진행)
**목표**: 무한 루프 원인 제거
- [ ] ContactLensSequence 자동화 루프 확인 (렌즈 분류)
- [ ] SMS/이메일 발송 루프 검증
- [ ] Campaign 실행 루프 점검
- [ ] setTimeout cleanup 완료
- [ ] Promise.allSettled 에러 처리

### Phase 2️⃣: 데이터 복구 (동시 진행)
**목표**: Google Drive 백업에서 데이터 로드
- [ ] Backup_2026-05-25 Excel 파일 다운로드
  - AffiliateProduct (판매 상품)
  - CruiseProduct (크루즈)
  - User (사용자/등급)
  - ProductImage, ProductCabinPrice
  
- [ ] Prisma 마이그레이션 적용
  - prisma/migrations/ 전체 로드
  - npx prisma db push 실행

- [ ] Excel → JSON → DB 변환 스크립트
  - CSV 파싱
  - 외래키 검증
  - 데이터 정합성 확인

### Phase 3️⃣: 검증 (순차)
**목표**: 모든 것이 정상인지 확인
- [ ] 스키마 검증 (50+ 테이블 확인)
- [ ] 외래키 무결성 (고아 레코드 제거)
- [ ] 렌즈 데이터 일관성
- [ ] SMS 시퀀스 정상 작동
- [ ] 상품 가격 데이터
- [ ] 사용자 등급별 권한

### Phase 4️⃣: 배포 (순차)
**목표**: Vercel에 안전하게 배포
- [ ] Git 커밋 (복구 이력 기록)
- [ ] npm run build 검증
- [ ] Vercel 배포
- [ ] 라이브 테스트

---

## 📁 필요한 파일들

### 로컬 백업 (준비됨 ✅)
```
D:\mabiz-crm\backups\
├── schema_backup_2026-05-24.prisma
├── prisma_migrations_backup_2026-05-24.zip
├── neon_backup_manifest_2026-05-24.md
└── FINAL_BACKUP_STATUS_2026-05-24.txt
```

### Google Drive 백업 (다운로드 필요 🔄)
```
Backup_2026-05-25/
├── AffiliateProduct_*.xlsx (판매 상품)
├── CruiseProduct_*.xlsx
├── User_*.xlsx (사용자/등급)
├── ProductImage_*.xlsx
├── ProductCabinPrice_*.xlsx
└── ProductPricePeriod_*.xlsx
```

---

## 🛠️ 실행 명령어 (순서대로)

### Step 1: 로컬 Neon 초기화
```bash
# Neon 콘솔에서 수동으로 Reset (또는)
npm run db:reset
```

### Step 2: 마이그레이션 적용
```bash
unzip backups/prisma_migrations_backup_2026-05-24.zip -d prisma/
npx prisma migrate deploy
```

### Step 3: 데이터 복구 (스크립트 필요)
```bash
npm run script:restore-from-backup
```

### Step 4: 검증
```bash
npm run db:validate
npm run test:integrity
```

### Step 5: 배포
```bash
git add .
git commit -m "chore: Neon 복구 후 데이터 재적재 + 무한루프 문제 해결"
git push
# Vercel 자동 배포
```

---

## ⚠️ 주의사항

1. **무한 루프 문제 미해결 시**
   - 복구 후 같은 문제 재발 가능
   - 반드시 코드 검증 필수

2. **데이터 정합성**
   - 외래키 검증 필수
   - 고아 레코드 제거
   - 렌즈 분류 재검증

3. **배포 전**
   - 로컬 테스트 완료
   - 데이터베이스 쿼리 성능 확인
   - SMS/이메일 자동화 테스트

---

## 📅 예상 소요 시간

| Phase | Task | Time |
|-------|------|------|
| Phase 1 | 코드 무한 루프 수정 | 30-45분 |
| Phase 2 | 데이터 다운로드 + 복구 | 20-30분 |
| Phase 3 | 검증 테스트 | 30-45분 |
| Phase 4 | 배포 | 10-15분 |
| **총합** | | **90-135분** |

---

## 🎯 최종 확인

복구 후 확인할 것:
- ✅ 모든 상품이 보임 (실제 판매 상품들)
- ✅ 후기/리뷰 데이터
- ✅ 커뮤니티 데이터
- ✅ 사용자 등급별 접근 정상
- ✅ SMS 자동화 정상
- ✅ 어필리에이트 데이터 정상
- ✅ 무한 루프 없음

---

**상태**: 🔄 **시작 대기 중**  
**작성**: 2026-05-26  
**담당**: Claude Agent (병렬 진행)
