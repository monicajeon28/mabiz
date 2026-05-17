#!/usr/bin/env node

/**
 * Phase 0 인프라 검증 스크립트
 * 생성된 모든 파일이 올바르게 있는지 확인합니다.
 *
 * 사용:
 *   npx ts-node scripts/verify-phase0-infrastructure.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileCheck {
  path: string;
  name: string;
  required: boolean;
  minSize: number;
}

const projectRoot = path.join(__dirname, '..');

const filesToCheck: FileCheck[] = [
  // API 인프라
  {
    path: 'src/lib/api/response.ts',
    name: '응답 타입 정의',
    required: true,
    minSize: 100,
  },
  {
    path: 'src/lib/api/use-api-call.ts',
    name: 'useApiCall Hook',
    required: true,
    minSize: 150,
  },
  {
    path: 'src/lib/api/use-toast.ts',
    name: 'useToast Hook',
    required: true,
    minSize: 50,
  },
  {
    path: 'src/lib/api/client.ts',
    name: 'API 클라이언트',
    required: true,
    minSize: 100,
  },
  {
    path: 'src/lib/api/__init__.ts',
    name: '공용 진입점',
    required: true,
    minSize: 30,
  },

  // 검증
  {
    path: 'src/lib/validators/index.ts',
    name: 'Zod 스키마',
    required: true,
    minSize: 100,
  },

  // 컴포넌트
  {
    path: 'src/components/error-boundary.tsx',
    name: 'ErrorBoundary 컴포넌트',
    required: true,
    minSize: 100,
  },
  {
    path: 'src/components/ui/toast-provider.tsx',
    name: 'Toast Provider',
    required: true,
    minSize: 50,
  },

  // 테스트
  {
    path: 'src/lib/__tests__/api-response.test.ts',
    name: '응답 타입 테스트',
    required: false,
    minSize: 50,
  },
  {
    path: 'src/lib/__tests__/api-client.test.ts',
    name: 'API 클라이언트 테스트',
    required: false,
    minSize: 50,
  },

  // 문서
  {
    path: 'docs/API_INFRASTRUCTURE_GUIDE.md',
    name: 'API 가이드',
    required: false,
    minSize: 500,
  },
  {
    path: 'PHASE0_COMPLETION_CHECKLIST.md',
    name: 'Phase 0 체크리스트',
    required: false,
    minSize: 100,
  },
];

// 검증 타입 가드들
function checkTypesInFile(filePath: string): {
  hasSuccessResponse: boolean;
  hasErrorResponse: boolean;
  hasApiResponse: boolean;
  hasHooks: boolean;
} {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      hasSuccessResponse: content.includes('SuccessResponse'),
      hasErrorResponse: content.includes('ErrorResponse'),
      hasApiResponse: content.includes('ApiResponse'),
      hasHooks: content.includes('useApiCall') || content.includes('useToast'),
    };
  } catch {
    return {
      hasSuccessResponse: false,
      hasErrorResponse: false,
      hasApiResponse: false,
      hasHooks: false,
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function main() {
  console.log('📋 Phase 0 인프라 검증\n');
  console.log('=' .repeat(60));

  let totalFiles = 0;
  let foundFiles = 0;
  let missingRequired = 0;

  const results: {
    check: FileCheck;
    exists: boolean;
    size: number;
    valid: boolean;
  }[] = [];

  // 파일 검증
  for (const check of filesToCheck) {
    totalFiles++;
    const fullPath = path.join(projectRoot, check.path);
    const exists = fs.existsSync(fullPath);

    let size = 0;
    let valid = true;

    if (exists) {
      foundFiles++;
      const stats = fs.statSync(fullPath);
      size = stats.size;
      valid = size >= check.minSize;

      if (!valid && check.required) {
        missingRequired++;
      }
    } else if (check.required) {
      missingRequired++;
    }

    results.push({
      check,
      exists,
      size,
      valid,
    });
  }

  // 결과 출력
  for (const result of results) {
    const { check, exists, size, valid } = result;
    const status = exists ? '✅' : '❌';
    const sizeStr = exists ? ` (${formatBytes(size)})` : '';
    const requiredStr = check.required ? '[필수]' : '[선택]';

    console.log(`${status} ${check.name.padEnd(25)} ${requiredStr}${sizeStr}`);

    if (exists && !valid) {
      console.log(
        `   ⚠️  파일 크기가 너무 작습니다. 최소: ${formatBytes(check.minSize)}, 실제: ${formatBytes(size)}`
      );
    }
  }

  console.log('=' .repeat(60));

  // 통계
  console.log(`\n📊 통계:`);
  console.log(`  전체 파일: ${totalFiles}`);
  console.log(`  발견된 파일: ${foundFiles}/${totalFiles}`);
  console.log(`  누락된 필수 파일: ${missingRequired}`);

  // 타입 검증
  console.log(`\n🔍 타입 검증:`);
  const responseTypePath = path.join(projectRoot, 'src/lib/api/response.ts');
  if (fs.existsSync(responseTypePath)) {
    const types = checkTypesInFile(responseTypePath);
    console.log(`  ✅ SuccessResponse: ${types.hasSuccessResponse ? '있음' : '없음'}`);
    console.log(`  ✅ ErrorResponse: ${types.hasErrorResponse ? '있음' : '없음'}`);
    console.log(`  ✅ ApiResponse: ${types.hasApiResponse ? '있음' : '없음'}`);
  }

  const hooksPath = path.join(projectRoot, 'src/lib/api/use-api-call.ts');
  if (fs.existsSync(hooksPath)) {
    const types = checkTypesInFile(hooksPath);
    console.log(`  ✅ useApiCall Hook: ${types.hasHooks ? '있음' : '없음'}`);
  }

  // 최종 결과
  console.log('\n' + '=' .repeat(60));
  if (missingRequired === 0 && foundFiles === totalFiles) {
    console.log('✅ Phase 0 인프라 검증 완료!\n');
    console.log('모든 필수 파일이 생성되었습니다.');
    console.log('다음 단계: 루트 레이아웃에 ToastProvider 추가');
    process.exit(0);
  } else {
    console.log('❌ Phase 0 인프라 검증 실패!\n');
    if (missingRequired > 0) {
      console.log(`누락된 필수 파일: ${missingRequired}개`);
    }
    if (foundFiles < totalFiles) {
      console.log(`발견되지 않은 파일: ${totalFiles - foundFiles}개`);
    }
    process.exit(1);
  }
}

main();
