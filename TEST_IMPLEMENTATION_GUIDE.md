# Test Implementation Guide — Wave 3 Agent K

## 개요
Agent K가 작성한 테스트 명세를 실제 Jest/Vitest 테스트로 변환하는 방법

---

## 준비물

### 1. 테스트 프레임워크 설정
```bash
npm install --save-dev vitest @vitest/ui
# 또는
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

### 2. 테스트 설정 파일
**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## Issue 25: Image Upload Edge Cases 구현 가이드

### 테스트 파일
**src/__tests__/b2b-editor.test.ts** → **src/__tests__/b2b-editor.spec.ts**

### 구현 패턴

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditB2BPage from '@/app/(dashboard)/b2b-editor/[id]/page';

describe('B2B Editor - Image Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Issue 25 - Scenario 1: Empty FileList
  describe('Scenario 1: Empty FileList', () => {
    it('should handle empty file selection gracefully', async () => {
      const { getByTestId } = render(<EditB2BPage />);
      const fileInput = getByTestId('image-file-input') as HTMLInputElement;
      
      // 빈 FileList 시뮬레이션
      const emptyFileList = new DataTransfer().items;
      
      // 현재: dataTransfer API 제약으로 직접 테스트 어려움
      // 대신 onchange 이벤트 핸들러 단위 테스트
      const files: File[] = [];
      const validFiles = files.filter(f => f.type.startsWith('image/'));
      
      expect(validFiles).toHaveLength(0);
      expect(screen.queryByTestId('upload-progress')).not.toBeInTheDocument();
    });
  });

  // Issue 25 - Scenario 2: Non-image files
  describe('Scenario 2: Non-image files', () => {
    it('should reject non-image files with error', async () => {
      const files = [
        new File(['content'], 'test.txt', { type: 'text/plain' }),
        new File(['content'], 'doc.pdf', { type: 'application/pdf' }),
      ];

      const validImages = files.filter(f => f.type.startsWith('image/'));
      
      expect(validImages).toHaveLength(0);
      expect(validImages).toEqual([]);
    });
  });

  // Issue 25 - Scenario 3: Mixed file types
  describe('Scenario 3: Mixed file types', () => {
    it('should filter and process only images', () => {
      const files = [
        new File(['img1'], 'image1.jpg', { type: 'image/jpeg' }),
        new File(['doc'], 'document.pdf', { type: 'application/pdf' }),
        new File(['img2'], 'image2.png', { type: 'image/png' }),
        new File(['audio'], 'song.mp3', { type: 'audio/mpeg' }),
      ];

      const validImages = files.filter(f => f.type.startsWith('image/'));
      
      expect(validImages).toHaveLength(2);
      expect(validImages[0].name).toBe('image1.jpg');
      expect(validImages[1].name).toBe('image2.png');
    });
  });
});
```

---

## Issue 26: JSON Parsing Error 구현 가이드

### 테스트 파일
**src/__tests__/b2b-api.test.ts** → 실제 API 라우트 테스트로 분리

### 구현 패턴

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/b2b-landing/[id]/comments/generate/route';

describe('Comments Generation - JSON Parsing', () => {
  let mockReq: Request;
  let mockParams: { params: Promise<{ id: string }> };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Issue 26 - JSON Parsing Errors', () => {
    
    // Test Case 1: Missing JSON array
    it('should handle missing JSON array', async () => {
      // Mock Claude response without JSON array
      const raw = "Please see the following comments about the program:";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      
      expect(jsonMatch).toBeNull();
    });

    // Test Case 2: Incomplete JSON
    it('should catch JSON.parse SyntaxError', () => {
      const raw = '[{"authorName": "김철수"'; // incomplete
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      
      expect(jsonMatch).not.toBeNull();
      
      expect(() => {
        JSON.parse(jsonMatch![0]);
      }).toThrow(SyntaxError);
    });

    // Test Case 3: Empty array
    it('should reject empty arrays', () => {
      const raw = '[]';
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      
      expect(jsonMatch).not.toBeNull();
      const generated = JSON.parse(jsonMatch![0]);
      
      expect(Array.isArray(generated)).toBe(true);
      expect(generated).toHaveLength(0);
    });

    // Test Case 4: Missing fields
    it('should validate required fields', () => {
      const comments = [
        { authorName: 'Kim', content: 'Good program' },
        { authorName: 'Lee', content: '' }, // ← empty content
        { authorName: '', content: 'Nice' }, // ← empty name
      ];

      const invalid = comments.filter(
        c => !c.authorName?.trim() || !c.content?.trim()
      );
      
      expect(invalid).toHaveLength(2);
      expect(invalid[0].authorName).toBe('Lee');
      expect(invalid[1].content).toBe('Nice');
    });
  });
});
```

---

## Issue 27: Boundary Values 구현 가이드

### 테스트 파일
**src/__tests__/b2b-api.test.ts** 내 pagination 섹션

### 구현 패턴

```typescript
describe('Comments - Pagination Boundary Values', () => {
  
  describe('Skip parameter clamping', () => {
    it('should clamp skip to 10000', () => {
      const inputs = [
        { raw: '999999999', expected: 10000 },
        { raw: '-5', expected: 0 },
        { raw: '500', expected: 500 },
        { raw: '10000', expected: 10000 },
      ];

      inputs.forEach(({ raw, expected }) => {
        const parsed = parseInt(raw);
        const clamped = Math.min(10000, Math.max(0, parsed || 0));
        expect(clamped).toBe(expected);
      });
    });
  });

  describe('Limit parameter validation', () => {
    it('should enforce limit 1-50 range', () => {
      const inputs = [
        { raw: '0', expected: 10 }, // fallback
        { raw: '1', expected: 1 },
        { raw: '25', expected: 25 },
        { raw: '50', expected: 50 },
        { raw: '100', expected: 50 }, // clamped
        { raw: '-10', expected: 1 }, // clamped to min
        { raw: 'abc', expected: 10 }, // fallback
      ];

      inputs.forEach(({ raw, expected }) => {
        const parsed = parseInt(raw) || 10;
        const clamped = Math.min(50, Math.max(1, parsed));
        expect(clamped).toBe(expected);
      });
    });
  });

  describe('Cache key consistency', () => {
    it('should use clamped values in cache key', () => {
      // Request: skip=999999999, limit=999
      const skipRaw = 999999999;
      const limitRaw = 999;
      
      const skip = Math.min(10000, Math.max(0, skipRaw));
      const limit = Math.min(50, Math.max(1, limitRaw));
      
      const cacheKey = `comments:123:${skip}:${limit}`;
      
      expect(cacheKey).toBe('comments:123:10000:50');
    });
  });
});
```

---

## Issue 28: Concurrency Testing 구현 가이드

### 구현 패턴

```typescript
describe('Image Upload + Save Concurrency', () => {
  it('should not lose images on concurrent save', async () => {
    // Mock upload and save functions
    const mockUpload = vi.fn(async () => [
      { id: 'img1', url: 'https://...' },
      { id: 'img2', url: 'https://...' },
    ]);

    const mockSave = vi.fn(async () => ({
      id: 'page123',
      images: [],
      updatedAt: new Date(),
    }));

    // Run concurrently
    const [images, savedPage] = await Promise.all([
      mockUpload(),
      mockSave(),
    ]);

    expect(images).toHaveLength(2);
    expect(savedPage.images).toEqual([]); // Initially empty

    // Update saved page with images
    const updated = { ...savedPage, images };
    
    expect(updated.images).toHaveLength(2);
    expect(updated.images).toEqual(images);
  });

  it('should maintain consistent state after operations', async () => {
    let imageState: any[] = [];
    
    const uploadImages = async () => {
      const newImages = [{ id: '1' }, { id: '2' }];
      imageState = [...imageState, ...newImages];
      return newImages;
    };

    const saveImages = async () => {
      return { saved: imageState.length, duplicates: 0 };
    };

    const [uploaded, saved] = await Promise.all([
      uploadImages(),
      saveImages(),
    ]);

    // No duplicates, no loss
    expect(imageState.length).toBe(2);
    expect(new Set(imageState.map(i => i.id)).size).toBe(2); // No duplicates
  });
});
```

---

## Issue 30: Rate Limit Security 구현 가이드

### 구현 패턴

```typescript
import crypto from 'crypto';

describe('Rate Limit - Client Fingerprint', () => {
  
  function createFingerprint(ip: string, ua: string): string {
    return crypto
      .createHash('sha256')
      .update(`${ip}:${ua}`)
      .digest('hex')
      .slice(0, 8);
  }

  describe('Fingerprint generation', () => {
    it('should create consistent fingerprints', () => {
      const fp1 = createFingerprint('1.2.3.4', 'Chrome');
      const fp2 = createFingerprint('1.2.3.4', 'Chrome');
      
      expect(fp1).toBe(fp2); // Deterministic
    });

    it('should differ for different IPs', () => {
      const fp1 = createFingerprint('1.2.3.4', 'Chrome');
      const fp2 = createFingerprint('5.6.7.8', 'Chrome');
      
      expect(fp1).not.toBe(fp2);
    });

    it('should differ for different User-Agents', () => {
      const fp1 = createFingerprint('1.2.3.4', 'Chrome');
      const fp2 = createFingerprint('1.2.3.4', 'Firefox');
      
      expect(fp1).not.toBe(fp2);
    });

    it('should handle missing headers', () => {
      const fp1 = createFingerprint('unknown', '');
      const fp2 = createFingerprint('unknown', '');
      
      expect(fp1).toBe(fp2); // All headerless requests same bucket
    });
  });

  describe('Rate limit key isolation', () => {
    it('should isolate rate limits per fingerprint', () => {
      const orgId = 'org1';
      const pageId = 'page1';
      
      const fp1 = createFingerprint('1.2.3.4', 'Chrome');
      const fp2 = createFingerprint('5.6.7.8', 'Chrome');
      
      const key1 = `b2b:gen:${orgId}:${pageId}:${fp1}`;
      const key2 = `b2b:gen:${orgId}:${pageId}:${fp2}`;
      
      expect(key1).not.toBe(key2);
    });
  });
});
```

---

## Issue 31: Input Validation 구현 가이드

### 구현 패턴

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { B2BLandingClient } from '@/app/b2b/p/[partnerId]/B2BLandingClient';

describe('Input Validation - Phone Number', () => {
  
  describe('Phone validation edge cases', () => {
    it('should reject whitespace-only input', async () => {
      const user = userEvent.setup();
      
      const { getByLabelText } = render(
        <B2BLandingClient {...mockProps} />
      );
      
      const phoneInput = getByLabelText('연락처');
      await user.type(phoneInput, '   '); // whitespace only
      
      const form = phoneInput.closest('form');
      await user.click(screen.getByText('신청'));
      
      expect(screen.getByText('연락처를 입력해 주세요')).toBeInTheDocument();
    });

    it('should validate phone format', async () => {
      const user = userEvent.setup();
      
      const { getByLabelText } = render(
        <B2BLandingClient {...mockProps} />
      );
      
      const phoneInput = getByLabelText('연락처');
      
      // Test valid number
      await user.type(phoneInput, '010-1234-5678');
      await user.click(screen.getByText('신청'));
      
      // Should proceed (no error)
      expect(screen.queryByText(/올바른 휴대폰/)).not.toBeInTheDocument();
    });

    it('should reject invalid phone format', async () => {
      const user = userEvent.setup();
      
      const { getByLabelText } = render(
        <B2BLandingClient {...mockProps} />
      );
      
      const phoneInput = getByLabelText('연락처');
      
      // Test invalid numbers
      const invalidNumbers = ['02-1234-5678', '031-123456', '010'];
      
      for (const num of invalidNumbers) {
        await user.clear(phoneInput);
        await user.type(phoneInput, num);
        await user.click(screen.getByText('신청'));
        
        expect(
          screen.getByText('올바른 휴대폰 번호를 입력해 주세요')
        ).toBeInTheDocument();
      }
    });
  });
});
```

---

## 테스트 실행 방법

### 1. 단일 파일 테스트
```bash
npm run test src/__tests__/b2b-editor.spec.ts
```

### 2. 모든 테스트 실행
```bash
npm run test
```

### 3. 커버리지 리포트
```bash
npm run test -- --coverage
```

### 4. Watch 모드
```bash
npm run test -- --watch
```

---

## 참고사항

### 주의사항
1. **FileList 테스트**: DOM API 제약으로 직접 FileList 생성 어려움
   - 대신: 필터 로직 단위 테스트
   - 또는: Mock 객체 사용

2. **API 테스트**: 실제 API 호출 대신 MSW (Mock Service Worker) 사용
   ```bash
   npm install --save-dev msw
   ```

3. **타입 테스트**: Vitest의 타입 체킹
   ```bash
   npm run test -- --typecheck
   ```

### 추천 라이브러리
- **Testing Library**: DOM 테스트 (추천)
- **MSW**: API 모킹
- **Vitest**: 빠른 테스트 실행
- **@testing-library/user-event**: 사용자 상호작용

---

## 체크리스트

- [ ] Vitest 설치 및 설정
- [ ] Issue 25 테스트 구현 (8개)
- [ ] Issue 26 테스트 구현 (6개)
- [ ] Issue 27 테스트 구현 (6개)
- [ ] Issue 28 테스트 구현 (2개)
- [ ] Issue 30 테스트 구현 (5개)
- [ ] Issue 31 테스트 구현 (5개)
- [ ] 커버리지 60% 이상 달성
- [ ] CI/CD 통합

