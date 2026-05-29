/**
 * 마비즈 CRM 병렬 에이전트 Workflow 템플릿
 *
 * 사용법:
 *   /workflow scripts/parallel-agents-workflow.js
 *
 * args 형식:
 *   {
 *     feature: "기능명",
 *     domains: ["crm", "sms", "aff"],   // 작업할 도메인 목록
 *     tasks: {
 *       crm: "CRM 도메인 작업 설명",
 *       sms: "SMS 도메인 작업 설명",
 *       aff: "Affiliate 도메인 작업 설명",
 *     }
 *   }
 */

export const meta = {
  name: 'parallel-agents',
  description: '도메인별 병렬 에이전트 실행 — EBUSY 없이 충돌 방지 병렬 작업',
  phases: [
    { title: '분석', detail: '작업 분해 및 도메인 매핑' },
    { title: '병렬구현', detail: '도메인별 독립 에이전트 동시 실행' },
    { title: '검증', detail: 'TSC 검증 + 통합 확인' },
  ],
}

// 도메인 소유권 맵
const DOMAIN_PATHS = {
  crm: {
    label: 'CRM/Contacts',
    paths: ['src/app/(dashboard)/contacts/', 'src/app/api/contacts/'],
    forbidden: ['prisma/schema.prisma'],
  },
  mkt: {
    label: 'Marketing/Campaigns',
    paths: ['src/app/(dashboard)/marketing/', 'src/app/(dashboard)/campaigns/', 'src/app/api/campaigns/'],
    forbidden: ['prisma/schema.prisma'],
  },
  sms: {
    label: 'SMS/Messages',
    paths: ['src/app/(dashboard)/messages/', 'src/app/(dashboard)/sms-logs/', 'src/app/api/messages/', 'src/app/api/cron/'],
    forbidden: ['prisma/schema.prisma'],
  },
  aff: {
    label: 'Affiliate/Partner',
    paths: ['src/app/(dashboard)/partner', 'src/app/(dashboard)/commission-ledger/', 'src/app/api/affiliate'],
    forbidden: ['prisma/schema.prisma'],
  },
  adm: {
    label: 'Admin/Analytics',
    paths: ['src/app/(dashboard)/admin/', 'src/app/(dashboard)/dashboard/', 'src/app/api/admin/'],
    forbidden: ['prisma/schema.prisma'],
  },
  whk: {
    label: 'Webhooks',
    paths: ['src/app/api/webhooks/', 'src/app/api/payapp/'],
    forbidden: ['prisma/schema.prisma'],
  },
  set: {
    label: 'Settings/Auth',
    paths: ['src/app/(dashboard)/settings/', 'src/app/api/auth/'],
    forbidden: ['prisma/schema.prisma'],
  },
  lib: {
    label: 'Lib/Utils (순차 전용)',
    paths: ['src/lib/'],
    forbidden: ['prisma/schema.prisma'],
    sequential: true,
  },
}

// ─── Phase 1: 분석 ─────────────────────────────────────────────────────────
phase('분석')

const featureName = args?.feature || '병렬 에이전트 작업'
const requestedDomains = args?.domains || ['crm', 'sms']
const domainTasks = args?.tasks || {}

log(`기능: ${featureName} | 도메인: ${requestedDomains.join(', ')}`)

// lib 도메인은 순차 처리 필수
const sequentialDomains = requestedDomains.filter(d => DOMAIN_PATHS[d]?.sequential)
const parallelDomains = requestedDomains.filter(d => !DOMAIN_PATHS[d]?.sequential)

if (sequentialDomains.length > 0) {
  log(`순차 처리 도메인 (lib): ${sequentialDomains.join(', ')}`)
}

// ─── Phase 2: 병렬 구현 ────────────────────────────────────────────────────
phase('병렬구현')

const buildAgentPrompt = (domainKey, task) => {
  const domain = DOMAIN_PATHS[domainKey]
  return `[도메인: Agent-${domainKey.toUpperCase()} | 전담 경로: ${domain.paths.join(', ')}]
[금지: ${domain.forbidden.join(', ')} 수정, 다른 도메인 파일 수정]
[검증: npx tsc --noEmit (npm run build 절대 사용 금지)]

# 작업: ${featureName} — ${domain.label} 도메인

## 전담 파일 범위
${domain.paths.map(p => `- ${p}`).join('\n')}

## 작업 내용
${task || `${domain.label} 도메인에서 ${featureName} 기능 구현`}

## 필수 규칙
1. 위 전담 경로 밖의 파일은 절대 수정하지 않음
2. prisma/schema.prisma 수정 금지 (Prisma 변경은 별도 순차 작업)
3. npm run build 실행 금지 (dev 서버와 충돌 → EBUSY 오류)
4. 작업 완료 후 수정한 파일 목록을 반환

## 완료 기준
- TypeScript 오류 없는 코드 작성
- ${featureName} 기능이 해당 도메인 범위 내에서 완전히 동작
- 수정/생성한 파일 목록 반환`
}

// 병렬 도메인 동시 실행
let parallelResults = []
if (parallelDomains.length > 0) {
  parallelResults = await parallel(
    parallelDomains.map(domainKey => () =>
      agent(
        buildAgentPrompt(domainKey, domainTasks[domainKey]),
        {
          label: `Agent-${domainKey.toUpperCase()}: ${DOMAIN_PATHS[domainKey].label}`,
          phase: '병렬구현',
        }
      )
    )
  )
}

// 순차 도메인 처리 (lib는 항상 마지막)
const sequentialResults = []
for (const domainKey of sequentialDomains) {
  log(`순차 처리 중: ${DOMAIN_PATHS[domainKey].label}`)
  const result = await agent(
    buildAgentPrompt(domainKey, domainTasks[domainKey]),
    {
      label: `Agent-${domainKey.toUpperCase()}: ${DOMAIN_PATHS[domainKey].label} (순차)`,
      phase: '병렬구현',
    }
  )
  sequentialResults.push(result)
}

// ─── Phase 3: 검증 ─────────────────────────────────────────────────────────
phase('검증')

const allResults = [...parallelResults, ...sequentialResults].filter(Boolean)
log(`${allResults.length}개 도메인 구현 완료 → TSC 검증 시작`)

const validationResult = await agent(
  `다음 병렬 에이전트 작업 결과를 검증하세요:

기능: ${featureName}
완료 도메인: ${requestedDomains.join(', ')}

에이전트 결과 요약:
${allResults.map((r, i) => `[${requestedDomains[i]}]: ${typeof r === 'string' ? r.slice(0, 200) : JSON.stringify(r).slice(0, 200)}`).join('\n')}

검증 절차:
1. \`npx tsc --noEmit\` 실행하여 TypeScript 오류 확인
   - 오류 있으면 수정 후 재실행
   - npm run build는 절대 실행하지 말 것 (EBUSY 위험)
2. 각 도메인이 올바른 파일만 수정했는지 확인
3. 통합 동작 확인 (API 경로, 타입 import 등)

검증 완료 후:
- 수정된 파일 목록 요약
- TSC 결과 (오류 수)
- 커밋 준비 상태 여부`,
  {
    label: '통합 검증',
    phase: '검증',
  }
)

return {
  feature: featureName,
  domains: requestedDomains,
  results: allResults,
  validation: validationResult,
}
