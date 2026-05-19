# Contact 검증 API 빠른 시작

## 1분 요약

**목적**: 크루즈닷 웹훅으로부터 들어온 Contact 데이터가 실제로 DB에 저장되고 있는지, 그리고 데이터가 정상인지 확인

## 3가지 방법

### 방법 1: 웹 UI (가장 간단)
```
1. /admin/verify 페이지 방문
2. 시간 범위 설정 (기본값: 1시간)
3. "검증" 버튼 클릭
4. 결과 확인
```

### 방법 2: API 호출 (curl)
```bash
curl -X GET "http://localhost:3000/api/contacts/verify?hours=1" \
  -H "Cookie: session=<your-admin-token>"
```

### 방법 3: 자동화 (JavaScript)
```javascript
async function verifyContacts(hours = 1) {
  const res = await fetch(`/api/contacts/verify?hours=${hours}`);
  const data = await res.json();
  
  console.log(`📊 Total: ${data.stats.totalCount}`);
  console.log(`⚠️ NULL Organization: ${data.stats.nullOrgCount}`);
  console.log(`⚠️ NULL Email: ${data.stats.noEmailCount}`);
  console.log(`📋 Status: ${data.status}`);
  
  // 문제가 있으면 권장사항 출력
  if (data.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    data.recommendations.forEach(rec => console.log('  - ' + rec));
  }
}

verifyContacts(1);
```

## 확인 항목

| 항목 | 정상 | 문제 |
|------|------|------|
| **organizationId NULL** | 0개 | >0개면 웹훅 데이터 검증 필요 |
| **email NULL** | <30% | >30%면 크루즈닷몰 입력 폼 확인 |
| **할당된 담당자** | >0명 | 0명이면 자동 배정 규칙 설정 |
| **전체 Contact 수** | >0개 | 0개면 웹훅이 작동 안 함 |

## 실시간 모니터링

```javascript
// 1분마다 자동 검증
setInterval(() => {
  fetch('/api/contacts/verify?hours=1')
    .then(r => r.json())
    .then(data => {
      if (data.stats.nullOrgCount > 0) {
        alert(`⚠️ Alert: ${data.stats.nullOrgCount} Contacts missing organizationId`);
      }
    });
}, 60000);
```

## 응답 구조 (핵심만)

```json
{
  "status": "데이터 있음",                    // 상태
  "stats": {
    "totalCount": 10,                        // 총 Contact 수
    "nullOrgCount": 0,                       // organizationId NULL 수
    "noEmailCount": 2,                       // email NULL 수
    "unassignedCount": 3                     // 미배정 담당자 수
  },
  "recentContacts": [                        // 최근 10개
    {
      "id": "...",
      "name": "김철수",
      "phone": "01012345678",
      "email": "kim@example.com",
      "organizationId": "org_123...",
      "assignedUserId": "user_456..."
    }
  ],
  "recommendations": [
    "✅ organizationId 검증 완료"
  ]
}
```

## 일반적인 시나리오

### 시나리오 1: 웹훅이 제대로 작동하는지 확인
```javascript
// 웹훅 발동 후 즉시 확인
setTimeout(async () => {
  const res = await fetch('/api/contacts/verify?hours=1');
  const data = await res.json();
  
  if (data.stats.totalCount > 0) {
    console.log('✅ 웹훅이 정상입니다');
  } else {
    console.log('❌ 웹훅이 작동하지 않습니다');
  }
}, 1000);
```

### 시나리오 2: 어제 들어온 모든 Contact 통계
```javascript
const res = await fetch('/api/contacts/verify?hours=24');
const data = await res.json();

console.log(`어제 들어온 Contact: ${data.stats.totalCount}`);
console.log(`평균 이메일 입력율: ${((1 - data.stats.noEmailCount / data.stats.totalCount) * 100).toFixed(1)}%`);
console.log(`담당자 배정률: ${((data.stats.assignedCount / data.stats.totalCount) * 100).toFixed(1)}%`);
```

### 시나리오 3: 데이터 품질 대시보드
```javascript
const healthCheck = async () => {
  const res = await fetch('/api/contacts/verify?hours=1');
  const data = await res.json();
  
  return {
    health: data.stats.nullOrgCount === 0 ? '✅ Good' : '⚠️ Warning',
    issues: data.stats.nullOrgCount + data.stats.noEmailCount,
    recommendations: data.recommendations
  };
};
```

## 문제 해결

### Q: Contact 데이터가 안 보입니다
```
A: 1. 웹훅이 발동하고 있는지 크루즈닷몰 확인
   2. hours=24로 범위 확대
   3. 데이터베이스 연결 확인
```

### Q: organizationId가 NULL입니다
```
A: 1. 웹훅 페이로드에 organizationId 포함되는지 확인
   2. 크루즈닷몰 API 문서 재검토
   3. 개발팀 문의
```

### Q: email이 많이 없습니다
```
A: 1. 크루즈닷몰 입력 폼에서 이메일 필수 표시 확인
   2. 100% 수집 불가능할 수 있음
   3. 전화번호로 연락처 확인 가능
```

## API 엔드포인트

| 엔드포인트 | 용도 |
|-----------|------|
| `GET /api/contacts/verify?hours=1` | Contact 검증 (권장) |
| `GET /api/contacts/verify?hours=24` | 일일 통계 |
| `GET /api/contacts` | 전체 Contact 목록 (필터 지원) |
| `POST /api/contacts` | Contact 수동 생성 |

## 권한

- **ADMIN**: 전체 접근 권한
- **AGENT**: 접근 불가 (403)

## 다음 단계

1. ✅ API 생성 완료
2. ✅ UI 페이지 생성 완료
3. 📋 데이터 수집 (실제 Contact 생성 필요)
4. 📊 모니터링 대시보드 연동
5. 🔔 알림 시스템 구축

---

**더 알아보기**: [상세 가이드](./CONTACT_VERIFY_API.md)
