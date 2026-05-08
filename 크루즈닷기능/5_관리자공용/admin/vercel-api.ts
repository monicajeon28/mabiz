/**
 * Vercel API를 사용하여 환경변수를 관리하는 유틸리티
 */

const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelEnvVariable {
  id: string;
  key: string;
  value: string;
  type: 'system' | 'secret' | 'encrypted' | 'plain';
  target?: ('production' | 'preview' | 'development')[];
  gitBranch?: string;
  configurationId?: string;
  updatedAt?: number;
  createdAt?: number;
}

interface VercelApiResponse<T> {
  envs?: T[];
  env?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Vercel API 토큰과 프로젝트 ID 가져오기
 */
function getVercelConfig() {
  const apiToken = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID || process.env.NEXT_PUBLIC_VERCEL_PROJECT_ID;

  if (!apiToken) {
    return { apiToken: null, projectId: null, error: 'VERCEL_API_TOKEN이 설정되지 않았습니다.' };
  }

  if (!projectId) {
    return { apiToken, projectId: null, error: 'VERCEL_PROJECT_ID가 설정되지 않았습니다.' };
  }

  return { apiToken, projectId, error: null };
}

/**
 * Vercel API 요청 헤더 생성
 */
function getVercelHeaders(apiToken: string) {
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Vercel 프로젝트의 환경변수 목록 조회
 */
export async function getVercelEnvVariables(): Promise<{ ok: boolean; envs?: VercelEnvVariable[]; error?: string }> {
  const { apiToken, projectId, error } = getVercelConfig();

  if (error || !apiToken || !projectId) {
    return { ok: false, error: error || 'Vercel 설정이 완료되지 않았습니다.' };
  }

  try {
    const response = await fetch(
      `${VERCEL_API_BASE}/v9/projects/${projectId}/env`,
      {
        method: 'GET',
        headers: getVercelHeaders(apiToken),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: `Vercel API 오류 (${response.status}): ${errorData.error?.message || response.statusText}`,
      };
    }

    const data: VercelApiResponse<VercelEnvVariable> = await response.json();
    return { ok: true, envs: data.envs || [] };
  } catch (error) {
    return {
      ok: false,
      error: `Vercel API 요청 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * Vercel 환경변수 생성 또는 업데이트
 */
export async function upsertVercelEnvVariable(
  key: string,
  value: string,
  target: ('production' | 'preview' | 'development')[] = ['production', 'preview', 'development']
): Promise<{ ok: boolean; env?: VercelEnvVariable; error?: string }> {
  const { apiToken, projectId, error } = getVercelConfig();

  if (error || !apiToken || !projectId) {
    return { ok: false, error: error || 'Vercel 설정이 완료되지 않았습니다.' };
  }

  try {
    // 먼저 기존 환경변수 확인
    const existingEnvResult = await getVercelEnvVariables();
    if (!existingEnvResult.ok) {
      return existingEnvResult;
    }

    const existingEnv = existingEnvResult.envs?.find(env => env.key === key);

    if (existingEnv) {
      // 기존 환경변수 업데이트
      const response = await fetch(
        `${VERCEL_API_BASE}/v9/projects/${projectId}/env/${existingEnv.id}`,
        {
          method: 'PATCH',
          headers: getVercelHeaders(apiToken),
          body: JSON.stringify({
            value,
            target,
            type: 'encrypted', // 민감한 정보는 암호화
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: `Vercel 환경변수 업데이트 실패 (${response.status}): ${errorData.error?.message || response.statusText}`,
        };
      }

      const data: VercelApiResponse<VercelEnvVariable> = await response.json();
      return { ok: true, env: data.env };
    } else {
      // 새 환경변수 생성
      const response = await fetch(
        `${VERCEL_API_BASE}/v9/projects/${projectId}/env`,
        {
          method: 'POST',
          headers: getVercelHeaders(apiToken),
          body: JSON.stringify({
            key,
            value,
            target,
            type: 'encrypted', // 민감한 정보는 암호화
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: `Vercel 환경변수 생성 실패 (${response.status}): ${errorData.error?.message || response.statusText}`,
        };
      }

      const data: VercelApiResponse<VercelEnvVariable> = await response.json();
      return { ok: true, env: data.env };
    }
  } catch (error) {
    return {
      ok: false,
      error: `Vercel API 요청 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
    };
  }
}

/**
 * 여러 환경변수를 한 번에 업데이트
 */
export async function updateVercelEnvVariables(
  updates: Record<string, string>
): Promise<{ ok: boolean; updated: string[]; errors: string[] }> {
  const updated: string[] = [];
  const errors: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!value || value.trim() === '') {
      continue; // 빈 값은 건너뛰기
    }

    const result = await upsertVercelEnvVariable(key, value);

    if (result.ok) {
      updated.push(key);
    } else {
      errors.push(`${key}: ${result.error || '알 수 없는 오류'}`);
    }
  }

  return {
    ok: errors.length === 0 || updated.length > 0,
    updated,
    errors,
  };
}
