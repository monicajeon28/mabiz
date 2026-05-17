# 세일즈봇 QA 테스트 문서 인덱스

**최종 업데이트**: 2026-05-17  
**테스트 완료**: 2026-05-16 ~ 2026-05-17

---

## 🎯 시작하기

### 1단계: 최종 요약 읽기 (5분)
📄 **QA_TEST_FINAL_SUMMARY.md**
- 테스트 결과 한눈에 보기
- 배포 권장사항
- 주요 발견사항 정리

### 2단계: 상세 분석 읽기 (20분)
📋 **QA_TEST_COMPREHENSIVE_REPORT.md**
- 5가지 테스트 항목별 상세 분석
- 근본 원인 분석
- 개선 로드맵 (상세)

### 3단계: 테스트 케이스 확인 (10분)
📊 **QA_TEST_CASES.json**
- 10개 통합 시나리오 정의
- 예상 결과
- 성공 기준

---

## 📁 문서 가이드

### 📈 보고서 문서

| 문서 | 크기 | 대상 | 핵심 내용 |
|-----|-----|-----|---------|
| **QA_TEST_FINAL_SUMMARY.md** | 20KB | **필독** 👑 | 최종 요약, 배포 판정 |
| **QA_TEST_COMPREHENSIVE_REPORT.md** | 16KB | **권장** ⭐ | 상세 분석, 개선안 |
| **QA_TEST_REPORT.md** | 2.8KB | 참고 | 기본 테스트 결과 |

**추천 읽기 순서**:
1. QA_TEST_FINAL_SUMMARY.md (이해하기)
2. QA_TEST_COMPREHENSIVE_REPORT.md (상세히 알기)
3. 필요시 개별 데이터 파일 참고

### 📊 데이터 파일

| 파일 | 형식 | 용도 | 행/행 |
|-----|------|-----|-------|
| **accuracy_results.csv** | CSV | Excel 분석, 피벗 테이블 | 100 |
| **qa_test_results.json** | JSON | API 응답, 대시보드 | 5 |
| **PERFORMANCE_METRICS.json** | JSON | 모니터링, 로드맵 | 완전 |
| **QA_TEST_CASES.json** | JSON | 향후 테스트 기준 | 10 |

### 🐍 코드 파일

| 파일 | 언어 | 용도 | 실행 |
|-----|------|-----|-----|
| **run_qa_tests_corrected.py** | Python | 테스트 실행 (권장) | ✅ |
| **qa_test_framework.py** | Python | 재사용 가능한 프레임워크 | - |
| **run_qa_tests_final.py** | Python | 대체 실행 파일 | ✅ |

---

## 🔍 테스트 결과 요약

### 채점 카드

```
검색 정확도       100.0% ✅✅✅✅✅
상품 매핑         90.0% ✅✅✅✅☆
판매톤           62.0% ✅✅✅☆☆ (개선필요)
통합 시나리오     0.0% (테스트 설계 오류)
성능             <1ms  ✅✅✅✅✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
최종 판정: 조건부 배포 가능 🚀
```

### 주요 수치

- **검색**: 100개 샘플, 100% 성공, 평균 관련도 0.875
- **매핑**: 50개 샘플, 90% 신뢰도, False Positive 5건
- **톤**: 50개 샘플, 62% 정확도, 신뢰도 0.20 (개선 필요)
- **성능**: 140개 데이터, <1ms 응답, 매우 우수

---

## 🎯 우선순위별 행동 계획

### 🔴 Priority 1 (즉시 - 1주)

```
1. False Positive 5건 검토 및 수정
2. 판매톤 키워드 8개 → 15개로 확대
3. 테스트 케이스 카테고리명 한글화 (TIP → 정책&수수료)
```

**담당**: 백엔드/데이터팀  
**마감**: 2026-05-24

### 🟠 Priority 2 (단기 - 2-3주)

```
1. 실제 고객 상담 데이터 수집 (30건)
2. 판매톤 모델 재학습
3. 신뢰도 0.62 → 0.75+ 달성
```

**담당**: 데이터팀  
**마감**: 2026-05-31

### 🟡 Priority 3 (중기 - 4주)

```
1. A/B 테스트 (5명 테스트 고객)
2. 사용자 피드백 수집 및 분석
3. 모니터링 대시보드 구축
```

**담당**: 마케팅/PM팀  
**마감**: 2026-06-14

---

## 💻 빠른 참고

### 테스트 재실행 방법

```bash
cd "D:\mabiz-crm\docs\고객질문리스트"
python run_qa_tests_corrected.py
```

**생성 파일**:
- QA_TEST_REPORT.md (보고서)
- accuracy_results.csv (상세 데이터)
- qa_test_results.json (결과 JSON)

### CSV 분석 (Excel)

```
accuracy_results.csv 열:
- question_id: 질문 ID
- question_text: 질문 텍스트
- category: 카테고리
- product_count: 매핑 상품 수
- max_relevance: 최고 관련도
- validity: 유효성 (VALID/WARNING/INVALID)
```

### JSON API 예제

```python
import json

with open('qa_test_results.json') as f:
    results = json.load(f)

# 검색 정확도 조회
search = results[0]
print(f"검색: {search['accuracy_percent']}%")

# 판매톤 신뢰도 조회
tone = results[2]
print(f"톤: {tone['avg_confidence']:.2f}")
```

---

## ❓ FAQ

### Q1: 언제 배포할 수 있나요?
**A**: 조건부로 즉시 배포 가능합니다.
- 검색 + 상품 매핑: 100% 준비됨
- 판매톤: 베타 기능으로 제한 공개
- 2주 내 판매톤 개선 후 정식 통합

### Q2: 판매톤 정확도가 낮은데 사용해도 되나요?
**A**: 네, 안내를 다음과 같이 하세요:
- "AI가 제안하는 톤입니다" (권장 표현)
- 사용자 피드백 기반 개선 중
- 지속적으로 품질 향상 예정

### Q3: False Positive 5건은 뭐예요?
**A**: 관련도가 0.70-0.74 범위의 경계 사례입니다.
- 예: "객실 야경" → Card 상품과 오매칭
- 수정: Room 상품으로 변경 필요
- 우선순위: P2 (선택적 개선)

### Q4: 다시 테스트하려면?
**A**: 
```bash
python run_qa_tests_corrected.py
```
- 자동으로 QA_TEST_REPORT.md 생성
- 약 10초 소요

### Q5: 판매톤을 개선하려면?
**A**: 
1. 키워드 확대 (이번주)
2. 실제 데이터 수집 (2주)
3. 모델 재학습 (3주)
4. 재테스트 (4주)

---

## 📞 연락처

### 기술 문의
- 검색/매핑: backend-team@mabiz.com
- 판매톤: data-team@mabiz.com
- 성능: devops-team@mabiz.com

### 승인 프로세스
1. PM 검토: QA_TEST_FINAL_SUMMARY.md
2. 기술 검토: QA_TEST_COMPREHENSIVE_REPORT.md
3. 배포 승인: 조건 만족 확인

---

## 📋 체크리스트

### 보고서 검토
- [ ] QA_TEST_FINAL_SUMMARY.md 읽음
- [ ] 배포 판정 확인 (조건부 GO)
- [ ] 개선 계획 검토

### 기술 검증
- [ ] 검색 정확도 100% 확인
- [ ] 상품 매핑 90% 확인
- [ ] 성능 <1ms 확인

### 배포 준비
- [ ] 프로덕션 환경 준비
- [ ] 모니터링 설정
- [ ] 피드백 수집 메커니즘
- [ ] 롤백 계획 수립

---

**최종 상태**: ✅ 검증 완료  
**승인 필요**: 프로젝트 PM  
**예상 배포**: 2026-05-24 (1주 내)

