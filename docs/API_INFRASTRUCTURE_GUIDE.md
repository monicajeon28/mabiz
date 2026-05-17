# API 통합 인프라 가이드

메뉴 #1-5 대시보드 페이지를 위한 통합 에러 핸들링 및 API 호출 인프라입니다.

## 목차

1. [표준 응답 타입](#표준-응답-타입)
2. [useApiCall Hook](#useapicall-hook)
3. [API 클라이언트](#api-클라이언트)
4. [에러 핸들링](#에러-핸들링)
5. [검증](#검증)
6. [Toast 알림](#toast-알림)
7. [사용 예제](#사용-예제)

## 표준 응답 타입

모든 API는 다음의 표준 응답 형식을 따릅니다.

### 성공 응답 (`SuccessResponse<T>`)

```typescript
{
  ok: true,
  data: T  // 실제 응답 데이터
}
```

### 실패 응답 (`ErrorResponse`)

```typescript
{
  ok: false,
  error: string,           // 에러 메시지
  code?: string,           // 에러 코드 (예: NOT_FOUND, UNAUTHORIZED)
  details?: Record<...>    // 상세 정보 (선택)
}
```

### 응답 생성 헬퍼

```typescript
import { successResponse, errorResponse } from '@/lib/api/response';

// 성공 응답
const success = successResponse({ id: 1, name: 'Test' });

// 실패 응답
const error = errorResponse('User not found', 'NOT_FOUND', {
  userId: '123'
});
```

### 타입 가드

```typescript
import { isSuccessResponse, isErrorResponse } from '@/lib/api/response';

if (isSuccessResponse(response)) {
  // response.data는 사용 가능
  console.log(response.data);
} else if (isErrorResponse(response)) {
  // response.error는 사용 가능
  console.error(response.error);
}
```

## useApiCall Hook

재시도 로직, 에러 처리, Toast 알림을 포함한 API 호출 Hook입니다.

### 기본 사용법

```typescript
import { useApiCall } from '@/lib/api/use-api-call';

function MyComponent() {
  const { call, isLoading, error } = useApiCall();

  const handleLoad = async () => {
    const result = await call('/api/users', {
      method: 'GET',
      onSuccess: (data) => {
        console.log('Success:', data);
      },
      onError: (error) => {
        console.error('Error:', error);
      },
    });

    if (result.ok) {
      console.log('Data:', result.data);
    }
  };

  return (
    <button onClick={handleLoad} disabled={isLoading}>
      {isLoading ? '로딩 중...' : '데이터 로드'}
    </button>
  );
}
```

### 옵션

```typescript
interface UseApiCallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';  // HTTP 메서드 (기본: GET)
  body?: Record<string, any>;                      // 요청 본문
  onSuccess?: (data: any) => void;                // 성공 콜백
  onError?: (error: string) => void;              // 실패 콜백
  showErrorToast?: boolean;                       // 에러 토스트 (기본: true)
  showSuccessToast?: boolean;                     // 성공 토스트 (기본: false)
  successMessage?: string;                        // 성공 메시지
  retryCount?: number;                            // 재시도 횟수 (기본: 3)
  headers?: Record<string, string>;               // 추가 헤더
}
```

### POST 요청 예제

```typescript
const { call } = useApiCall();

const result = await call('/api/users', {
  method: 'POST',
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  showSuccessToast: true,
  successMessage: '사용자가 생성되었습니다.',
  onSuccess: (data) => {
    console.log('New user:', data);
  },
});
```

### 재시도 전략

- Exponential Backoff 사용
- 기본 3회 재시도
- 시간 간격: 100ms, 300ms, 900ms

```typescript
const result = await call('/api/unreliable-endpoint', {
  retryCount: 5,  // 최대 5회 재시도
});
```

## API 클라이언트

낮은 수준의 API 호출을 위한 클라이언트입니다. `useApiCall` Hook보다 낮은 수준입니다.

### 사용법

```typescript
import { apiClient } from '@/lib/api/client';

// GET
const result = await apiClient.get('/api/users', {
  query: { page: 1, limit: 10 }
});

// POST
const result = await apiClient.post('/api/users', {
  name: 'John',
  email: 'john@example.com'
});

// PATCH
const result = await apiClient.patch('/api/users/1', {
  name: 'Jane'
});

// DELETE
const result = await apiClient.delete('/api/users/1');

// PUT
const result = await apiClient.put('/api/users/1', {
  name: 'Jane',
  email: 'jane@example.com'
});
```

### 쿼리 파라미터

```typescript
// 자동으로 URL에 추가됨
const result = await apiClient.get('/api/users', {
  query: {
    page: 1,
    limit: 20,
    search: 'john',
    active: true
  }
});
// URL: /api/users?page=1&limit=20&search=john&active=true

// undefined/null/"" 값은 자동으로 제외됨
const result = await apiClient.get('/api/users', {
  query: {
    page: 1,
    limit: undefined,  // 포함 안 됨
    search: ''        // 포함 안 됨
  }
});
// URL: /api/users?page=1
```

### 커스텀 헤더

```typescript
const result = await apiClient.get('/api/protected', {
  headers: {
    'Authorization': 'Bearer token...',
    'X-Custom': 'value'
  }
});
```

## 에러 핸들링

### ErrorBoundary 컴포넌트

React 컴포넌트 트리의 에러를 캐치합니다.

```typescript
import { ErrorBoundary } from '@/components/error-boundary';

function App() {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h2>오류 발생</h2>
          <p>{error.message}</p>
        </div>
      )}
      onError={(error, errorInfo) => {
        // 에러 로깅 서비스로 전송
        console.error('Error caught:', error, errorInfo);
      }}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}
```

### 옵션

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;  // 변경 시 에러 상태 초기화
}
```

### HOC 사용

```typescript
import { withErrorBoundary } from '@/components/error-boundary';

const SafeComponent = withErrorBoundary(
  MyComponent,
  (error) => <div>Error: {error.message}</div>,
  (error, errorInfo) => console.error(error)
);
```

## 검증

### Zod 스키마

```typescript
import {
  PaginationQuerySchema,
  DashboardStatsSchema,
  validateData,
  formatZodError
} from '@/lib/validators';

// 입력 데이터 검증
const queryResult = validateData(req.query, PaginationQuerySchema);

if (!queryResult.ok) {
  // 검증 실패
  console.error(formatZodError(queryResult.error));
  return;
}

const { page, limit } = queryResult.data;
```

### 사전 정의된 스키마

```typescript
// 페이지네이션
PaginationSchema         // 페이지네이션 응답
PaginationQuerySchema    // 쿼리 파라미터

// 대시보드
DashboardStatsSchema     // 대시보드 통계
ChartDataSchema         // 차트 데이터

// 에러
ValidationErrorSchema    // 검증 에러
AuthErrorSchema         // 인증 에러
```

### 커스텀 스키마

```typescript
import { z } from 'zod';
import { SuccessResponseSchema } from '@/lib/validators';

// 사용자 응답 스키마
const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

// 사용자 목록 응답
const UsersResponseSchema = SuccessResponseSchema.extend({
  data: z.array(UserSchema)
});

type UsersResponse = z.infer<typeof UsersResponseSchema>;
```

## Toast 알림

### useToast Hook

```typescript
import { useToast } from '@/lib/api/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: '성공',
      description: '데이터가 저장되었습니다.',
      variant: 'success',
      duration: 3000,  // 3초 후 자동 닫힘
    });
  };

  const handleError = () => {
    toast({
      title: '오류',
      description: '저장에 실패했습니다.',
      variant: 'destructive',
    });
  };

  return (
    <>
      <button onClick={handleSuccess}>성공</button>
      <button onClick={handleError}>오류</button>
    </>
  );
}
```

### ToastProvider 설정

루트 레이아웃에 ToastProvider를 추가합니다.

```typescript
// app/layout.tsx
import { ToastProvider } from '@/components/ui/toast-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

### 옵션

```typescript
interface Toast {
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  duration?: number;  // 밀리초 (기본: 3000)
}
```

## 사용 예제

### 대시보드 데이터 로드

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useApiCall } from '@/lib/api/use-api-call';
import { ErrorBoundary } from '@/components/error-boundary';
import type { ApiResponse } from '@/lib/api/response';

interface DashboardData {
  totalCustomers: number;
  activeDeals: number;
  revenue: number;
}

function DashboardContent() {
  const { call, isLoading, error } = useApiCall();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const result = await call<DashboardData>(
        '/api/dashboard',
        {
          method: 'GET',
          onSuccess: (data) => setData(data),
          onError: (error) => console.error(error),
        }
      );
    };

    loadData();
  }, [call]);

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;
  if (!data) return <div>데이터 없음</div>;

  return (
    <div>
      <p>고객: {data.totalCustomers}</p>
      <p>거래: {data.activeDeals}</p>
      <p>매출: ₩{data.revenue.toLocaleString()}</p>
    </div>
  );
}

export function Dashboard() {
  return (
    <ErrorBoundary fallback={<div>대시보드 오류</div>}>
      <DashboardContent />
    </ErrorBoundary>
  );
}
```

### 폼 제출

```typescript
'use client';

import { useState } from 'react';
import { useApiCall } from '@/lib/api/use-api-call';
import { useToast } from '@/lib/api/use-toast';

function CreateUserForm() {
  const { call, isLoading } = useApiCall();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await call('/api/users', {
      method: 'POST',
      body: formData,
      showSuccessToast: true,
      successMessage: '사용자가 생성되었습니다.',
      onSuccess: (data) => {
        setFormData({ name: '', email: '' });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) =>
          setFormData({ ...formData, name: e.target.value })
        }
        placeholder="이름"
        disabled={isLoading}
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) =>
          setFormData({ ...formData, email: e.target.value })
        }
        placeholder="이메일"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? '생성 중...' : '생성'}
      </button>
    </form>
  );
}
```

## 모범 사례

### 1. 에러 처리

항상 에러 상황을 처리하세요.

```typescript
// 나쁜 예
const result = await call('/api/data');
console.log(result.data);  // 오류 발생 가능

// 좋은 예
const result = await call('/api/data');
if (result.ok) {
  console.log(result.data);
} else {
  console.error('오류:', result.error);
}
```

### 2. 로딩 상태 표시

사용자에게 로딩 상태를 명확히 전달하세요.

```typescript
const { isLoading } = useApiCall();

return (
  <>
    {isLoading && <LoadingSpinner />}
    <Content />
  </>
);
```

### 3. ErrorBoundary 사용

페이지 또는 섹션 단위로 ErrorBoundary로 감싸세요.

```typescript
// 좋은 예: 페이지 레벨
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>

// 좋은 예: 섹션 레벨
<section>
  <h2>Sales</h2>
  <ErrorBoundary>
    <SalesChart />
  </ErrorBoundary>
</section>
```

### 4. 타입 안정성

제네릭을 활용하여 타입을 명확히 하세요.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const result = await call<User>('/api/users/1');
// result.data는 User | undefined
```

### 5. 요청 취소

필요에 따라 AbortController를 사용하세요.

```typescript
const controller = new AbortController();

const result = await call('/api/data', {
  // headers에 signal을 추가할 수 있음
});

// 취소할 때
controller.abort();
```

## 트러블슈팅

### 스타일 오류

ToastProvider가 없으면 Toast가 표시되지 않습니다.

```typescript
// 루트 레이아웃에 추가해야 함
import { ToastProvider } from '@/components/ui/toast-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
```

### 타입 추론 문제

제네릭 타입을 명시적으로 지정하세요.

```typescript
// 타입 추론 안 됨
const result = await call('/api/data');  // any

// 타입 추론 됨
const result = await call<User>('/api/users/1');  // User
```

## 버전 정보

- 생성 날짜: 2026-05-17
- Phase: 0 (기초 인프라)
- API 응답 형식: `{ ok: true/false, ... }`
- Zod: v4.3.6
