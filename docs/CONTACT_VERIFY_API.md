# Contact 검증 API 가이드

## 개요
크루즈닷 문의 신청 레코드(Contact)의 데이터 상태를 실시간으로 검증하는 API입니다.

## 엔드포인트
- **URL**: `GET /api/contacts/verify`
- **권한**: ADMIN만 접근 가능
- **응답 형식**: JSON

## 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `hours` | integer | 1 | 조회 범위 (시간 단위, 1~24) |

## 요청 예시

```bash
# 최근 1시간 Contact 검증
curl -X GET "http://localhost:3000/api/contacts/verify?hours=1" \
  -H "Authorization: Bearer <admin-token>"

# 최근 24시간 Contact 검증
curl -X GET "http://localhost:3000/api/contacts/verify?hours=24"
```

## 응답 형식

```json
{
  "timestamp": "2026-05-19T10:30:00.000Z",
  "queryRange": {
    "hours": 1,
    "cutoffTime": "2026-05-19T09:30:00.000Z"
  },
  "total": 5,
  "recentContacts": [
    {
      "id": "cuid123...",
      "phone": "01012345678",
      "name": "김철수",
      "email": "kim@example.com",
      "organizationId": "org_123...",
      "assignedUserId": "user_456...",
      "type": "LEAD",
      "sourceOrgId": null,
      "affiliateCode": "AF001",
      "createdAt": "2026-05-19T10:15:00.000Z",
      "updatedAt": "2026-05-19T10:15:00.000Z",
      "tags": ["VIP", "우대"]
    }
    // ... 최대 10개
  ],
  "stats": {
    "totalCount": 5,
    "nullOrgCount": 0,
    "noEmailCount": 1,
    "inquiryPatternCount": 0,
    "assignedCount": 4,
    "unassignedCount": 1,
    "orgDistribution": [
      {
        "organizationId": "org_123...",
        "count": 3
      },
      {
        "organizationId": "NULL",
        "count": 0
      }
    ],
    "typeDistribution": [
      {
        "type": "LEAD",
        "count": 5
      }
    ],
    "assignmentDistribution": [
      {
        "assignedUserId": "user_456...",
        "count": 4
      },
      {
        "assignedUserId": "UNASSIGNED",
        "count": 1
      }
    ]
  },
  "status": "데이터 있음",
  "recommendations": [
    "✅ organizationId 검증 완료 - 모든 데이터가 정상입니다."
  ]
}
```

## 응답 필드 설명

### 상위 레벨

| 필드 | 타입 | 설명 |
|------|------|------|
| `timestamp` | string (ISO 8601) | API 응답 시간 |
| `queryRange` | object | 조회 범위 정보 |
| `total` | integer | 조회된 Contact 총 개수 |
| `recentContacts` | array | 최근 Contact 10개 목록 |
| `stats` | object | 상세 통계 정보 |
| `status` | string | 데이터 상태 요약 |
| `recommendations` | array<string> | 개선 권장사항 |

### recentContacts 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | Contact ID (CUID) |
| `phone` | string | 전화번호 |
| `name` | string | 이름 |
| `email` | string | 이메일 (null일 경우 "NULL") |
| `organizationId` | string | 조직 ID (null일 경우 "NULL") |
| `assignedUserId` | string | 담당자 ID (null일 경우 "UNASSIGNED") |
| `type` | string | Contact 유형 (LEAD, CUSTOMER 등) |
| `sourceOrgId` | string | null | 원본 조직 ID |
| `affiliateCode` | string | null | 제휴 코드 |
| `createdAt` | string (ISO 8601) | 생성 시간 |
| `updatedAt` | string (ISO 8601) | 수정 시간 |
| `tags` | array<string> | 태그 목록 |

### stats 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `totalCount` | integer | 조회 범위 내 전체 Contact 수 |
| `nullOrgCount` | integer | organizationId가 NULL인 Contact 수 |
| `noEmailCount` | integer | email이 NULL인 Contact 수 |
| `inquiryPatternCount` | integer | 이름에 "문의" 또는 "inquiry"가 있는 Contact 수 |
| `assignedCount` | integer | 담당자가 배정된 Contact 수 |
| `unassignedCount` | integer | 미배정 Contact 수 |
| `orgDistribution` | array | Organization별 Contact 분포 |
| `typeDistribution` | array | Type별 Contact 분포 |
| `assignmentDistribution` | array | 담당자별 Contact 분포 |

## 상태 메시지 (status)

| 상태 | 의미 |
|------|------|
| `데이터 있음` | 정상 상태 |
| `조회된 Contact 없음` | 지정된 시간 범위 내 Contact 없음 |
| `경고: N개 Contact의 organizationId가 NULL입니다` | 데이터 무결성 문제 |
| `경고: N개 Contact의 email이 NULL입니다` | 불완전한 연락처 정보 |

## 권장사항 (recommendations)

자동으로 생성되는 권장사항:

1. **데이터 누락 경고**
   - organizationId 또는 email이 NULL인 Contact가 있을 때

2. **미배정 경고**
   - 모든 Contact이 담당자 미배정 상태일 때

3. **정상 완료**
   - 데이터 무결성 검증 완료

## 사용 사례

### 1. 웹훅 데이터 검증
```javascript
// 최근 1시간 내 웹훅으로 들어온 데이터 검증
const response = await fetch('/api/contacts/verify?hours=1');
const data = await response.json();

if (data.stats.nullOrgCount > 0) {
  console.warn('⚠️ 웹훅 데이터에 organizationId가 누락되었습니다');
}
```

### 2. 실시간 모니터링
```javascript
// 1분마다 Contact 데이터 상태 모니터링
setInterval(async () => {
  const response = await fetch('/api/contacts/verify?hours=1');
  const data = await response.json();
  
  // 대시보드에 표시
  updateDashboard({
    totalContacts: data.stats.totalCount,
    issuesFound: data.stats.nullOrgCount + data.stats.noEmailCount,
  });
}, 60000);
```

### 3. 일일 리포트
```javascript
// 어제 들어온 모든 Contact 통계
const yesterday = 24;
const response = await fetch(`/api/contacts/verify?hours=${yesterday}`);
const data = await response.json();

console.log(`어제 들어온 Contact: ${data.stats.totalCount}`);
console.log(`미배정: ${data.stats.unassignedCount}`);
console.log(`문제 건수: ${data.stats.nullOrgCount + data.stats.noEmailCount}`);
```

## UI 접근 경로

1. 관리자 대시보드에서 **/admin/verify** 페이지 방문
2. 조회 시간 범위 설정
3. "검증" 버튼 클릭
4. 실시간 통계 및 데이터 분포 확인

## 오류 처리

### 403 Forbidden
```json
{
  "error": "관리자만 검증 API에 접근 가능합니다"
}
```

### 500 Internal Server Error
```json
{
  "error": "검증 중 오류가 발생했습니다",
  "details": "..."
}
```

## 성능 고려사항

- **조회 범위**: 기본값 1시간 (권장)
- **최근 Contact 목록**: 최대 10개
- **타임아웃**: 30초
- **캐싱**: 없음 (실시간 데이터)

## 관련 엔드포인트

- `GET /api/contacts` — 고객 목록 조회
- `GET /api/contacts/all` — 전체 고객 조회
- `POST /api/contacts` — 고객 생성
- `PATCH /api/contacts/[id]` — 고객 수정

## 웹훅 검증 체크리스트

Contact 검증 API를 사용하여 웹훅 데이터 무결성을 확인하세요:

- [ ] organizationId 필드 존재 여부
- [ ] email 필드 존재 여부
- [ ] phone 필드 필수 확인
- [ ] name 필드 필수 확인
- [ ] 담당자 자동 배정 규칙 작동 확인

## 트러블슈팅

### Q: organizationId가 NULL로 나옵니다
**A**: 웹훅 데이터에서 organizationId가 전달되지 않은 것입니다.
- 웹훅 페이로드 확인
- 크루즈닷몰 API 검증
- 개발팀에 데이터 형식 재검토 요청

### Q: email이 많이 NULL입니다
**A**: 크루즈닷몰 사용자가 이메일을 입력하지 않은 경우입니다.
- 입력 폼 필수 필드 검토
- 웹훅 필터 규칙 조정

### Q: 데이터가 안 나옵니다
**A**: 조회 범위를 확대하세요.
- hours=24로 설정하여 24시간 범위 확인
- 웹훅이 실제로 발동하고 있는지 확인

---

**최종 업데이트**: 2026-05-19
