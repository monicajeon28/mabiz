/**
 * 상품 이미지 업로드 API 테스트 시나리오
 *
 * 테스트 실행:
 * npm test -- app/api/admin/products/[productId]/images/__tests__/upload.test.ts
 *
 * 또는 직접 API 테스트:
 * curl -X POST http://localhost:3000/api/admin/products/1/images/upload \
 *   -H "X-CSRF-Token: {token}" \
 *   -F "file=@test.jpg" \
 *   -b "cg.sid.v2={sessionId}"
 */

/**
 * 테스트 케이스
 */

// 1. 성공 케이스: 단일 파일 업로드
test('POST /api/admin/products/[productId]/images/upload - 단일 파일 업로드 성공', async () => {
  // 전제 조건:
  // - 유효한 관리자 세션 쿠키 필수
  // - 유효한 CSRF 토큰 필수
  // - 상품 ID: 1 (존재하는 상품)

  // 요청
  const formData = new FormData();
  const fileBlob = new Blob(['image data'], { type: 'image/jpeg' });
  const file = new File([fileBlob], 'test.jpg', { type: 'image/jpeg' });
  formData.append('file', file);

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  // 검증
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ok).toBe(true);
  expect(data.images.length).toBe(1);
  expect(data.images[0]).toHaveProperty('id');
  expect(data.images[0]).toHaveProperty('url');
  expect(data.images[0]).toHaveProperty('size');
  expect(data.images[0]).toHaveProperty('webpUrl');
});

// 2. 성공 케이스: 배치 업로드 (최대 10개)
test('POST /api/admin/products/[productId]/images/upload - 배치 업로드 (5개)', async () => {
  // 요청
  const formData = new FormData();
  for (let i = 0; i < 5; i++) {
    const file = new File(['data'], `test${i}.jpg`, { type: 'image/jpeg' });
    formData.append('file', file);
  }

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  // 검증
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ok).toBe(true);
  expect(data.images.length).toBe(5);
  expect(data.message).toContain('5개 파일 모두 업로드 성공');
});

// 3. 부분 실패: 일부 파일이 검증 실패
test('POST /api/admin/products/[productId]/images/upload - 부분 실패', async () => {
  // 요청: 1개 성공 + 1개 크기 초과
  const formData = new FormData();
  const file1 = new File(['data'], 'valid.jpg', { type: 'image/jpeg' });
  const file2 = new File(
    ['x'.repeat(51 * 1024 * 1024)],  // 51MB > 50MB 제한
    'toolarge.jpg',
    { type: 'image/jpeg' }
  );
  formData.append('file', file1);
  formData.append('file', file2);

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  // 검증
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ok).toBe(true);
  expect(data.images.length).toBe(1);  // 1개만 성공
  expect(data.failed).toBeDefined();
  expect(data.failed.length).toBe(1);  // 1개 실패
  expect(data.message).toContain('1개 실패');
});

// 4. 오류: 전체 실패 (모든 파일이 검증 실패)
test('POST /api/admin/products/[productId]/images/upload - 모두 실패', async () => {
  // 요청: 비이미지 파일
  const formData = new FormData();
  const file = new File(['text data'], 'notimage.txt', { type: 'text/plain' });
  formData.append('file', file);

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  // 검증
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.ok).toBe(false);
  expect(data.error).toContain('지원하는 이미지 형식');
});

// 5. 오류: 관리자 권한 없음
test('POST /api/admin/products/[productId]/images/upload - 403 Forbidden (관리자 아님)', async () => {
  const formData = new FormData();
  const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
  formData.append('file', file);

  // 일반 사용자 세션
  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=user-session-id',
    },
  });

  expect(response.status).toBe(403);
  const data = await response.json();
  expect(data.error).toContain('관리자만 접근');
});

// 6. 오류: CSRF 토큰 없음
test('POST /api/admin/products/[productId]/images/upload - 400 (CSRF 토큰 없음)', async () => {
  const formData = new FormData();
  const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
  formData.append('file', file);

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      // X-CSRF-Token 없음
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('CSRF');
});

// 7. 오류: 파일 없음
test('POST /api/admin/products/[productId]/images/upload - 400 (파일 없음)', async () => {
  const formData = new FormData();
  // 파일 추가 안함

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('파일이 없습니다');
});

// 8. 오류: 상품 없음
test('POST /api/admin/products/[productId]/images/upload - 404 (상품 없음)', async () => {
  const formData = new FormData();
  const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
  formData.append('file', file);

  const response = await fetch('/api/admin/products/99999/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(404);
  const data = await response.json();
  expect(data.error).toContain('상품을 찾을 수 없습니다');
});

// 9. 오류: 파일 개수 초과
test('POST /api/admin/products/[productId]/images/upload - 400 (파일 개수 초과)', async () => {
  const formData = new FormData();
  // 11개 파일 추가 (최대 10개)
  for (let i = 0; i < 11; i++) {
    const file = new File(['data'], `test${i}.jpg`, { type: 'image/jpeg' });
    formData.append('file', file);
  }

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('최대 10개');
});

// 10. 오류: 파일 크기 초과
test('POST /api/admin/products/[productId]/images/upload - 400 (파일 크기 초과)', async () => {
  const formData = new FormData();
  const largeFile = new File(
    ['x'.repeat(51 * 1024 * 1024)],  // 51MB
    'large.jpg',
    { type: 'image/jpeg' }
  );
  formData.append('file', largeFile);

  const response = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('50MB');
});

// 11. 오류: 잘못된 productId 형식
test('POST /api/admin/products/[productId]/images/upload - 400 (잘못된 productId)', async () => {
  const formData = new FormData();
  const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
  formData.append('file', file);

  const response = await fetch('/api/admin/products/abc/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain('유효하지 않은');
});

// 12. Cloudinary 폴더 검증
test('DB에 저장된 이미지의 cloudinaryFolder 검증', async () => {
  // 이미지 업로드 후
  const uploadResponse = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  const uploadData = await uploadResponse.json();
  const imageId = uploadData.images[0].id;

  // 이미지 조회
  const getResponse = await fetch(`/api/admin/products/1/images/${imageId}`, {
    headers: {
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  const getData = await getResponse.json();
  const image = getData.image;

  // 검증: 폴더는 products/{productCode} 형식
  expect(image.cloudinaryFolder).toMatch(/^products\/[A-Z0-9]+$/);
});

/**
 * 보안 테스트
 */

// 13. IDOR 방지: 다른 상품의 이미지 접근 시도
test('DELETE /api/admin/products/[productId]/images/[imageId] - IDOR 방지', async () => {
  // 시나리오:
  // - 상품 1의 이미지 ID 123 존재
  // - 상품 2에서 이미지 123 삭제 시도

  const response = await fetch('/api/admin/products/2/images/123', {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(404);  // IDOR 공격으로 판단하여 404 반환
  const data = await response.json();
  expect(data.error).toBe('이미지를 찾을 수 없습니다.');
});

// 14. 이미지 목록 조회: 페이지네이션
test('GET /api/admin/products/[productId]/images/list - 페이지네이션', async () => {
  const response = await fetch('/api/admin/products/1/images/list?page=1&limit=10', {
    headers: {
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.pagination).toHaveProperty('page');
  expect(data.pagination).toHaveProperty('limit');
  expect(data.pagination).toHaveProperty('total');
  expect(data.pagination).toHaveProperty('totalPages');
  expect(data.pagination).toHaveProperty('hasNextPage');
});

// 15. 이미지 삭제: 소프트 삭제 검증
test('DELETE /api/admin/products/[productId]/images/[imageId] - 소프트 삭제', async () => {
  // 이미지 업로드
  const uploadResponse = await fetch('/api/admin/products/1/images/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  const uploadData = await uploadResponse.json();
  const imageId = uploadData.images[0].id;

  // 이미지 삭제
  const deleteResponse = await fetch(`/api/admin/products/1/images/${imageId}`, {
    method: 'DELETE',
    headers: {
      'X-CSRF-Token': 'valid-csrf-token',
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(deleteResponse.status).toBe(200);

  // 다시 조회: 404 (소프트 삭제됨)
  const getResponse = await fetch(`/api/admin/products/1/images/${imageId}`, {
    headers: {
      'Cookie': 'cg.sid.v2=valid-session-id',
    },
  });

  expect(getResponse.status).toBe(404);
});
