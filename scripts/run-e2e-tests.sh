#!/bin/bash

###############################################################################
# E2E Test Runner: Group Management (3회 연속 실행)
#
# 용도: Track C Phase 5 E2E 테스트 검증
# 목표: 3회 모두 PASS (Register + Clone + Blast + 권한 + Rate Limiting)
###############################################################################

set -e  # 에러 발생 시 즉시 종료

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경변수 설정
export API_URL="${API_URL:-http://localhost:3000/api}"
export TEST_TOKEN="${TEST_TOKEN:-test-token-123}"
export TEST_GROUP_ID="${TEST_GROUP_ID:-group-123}"
export TEST_ORG_ID="${TEST_ORG_ID:-org-123}"
export NODE_ENV="test"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}E2E Test Runner: Group Management${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 먼저 서버가 실행 중인지 확인
echo -e "${YELLOW}[Step 1] 서버 상태 확인...${NC}"
if ! curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  서버가 실행 중이 아닙니다. (http://localhost:3000)${NC}"
    echo -e "${YELLOW}다음 명령으로 서버를 시작하세요:${NC}"
    echo -e "${YELLOW}  npm run dev${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 서버 실행 중${NC}"
echo ""

# 2. 테스트 3회 실행
RESULTS=()
TOTAL_TESTS=3

for ((i = 1; i <= TOTAL_TESTS; i++)); do
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}E2E Test Run #$i / $TOTAL_TESTS${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    if npm run cypress:run -- \
        --spec "cypress/e2e/group-management.cy.ts" \
        --headed=false \
        --browser=chrome \
        2>&1 | tee "/tmp/e2e-test-$i.log"; then

        RESULTS+=("✅ Run #$i: PASS")
        echo -e "${GREEN}✅ Test Run #$i completed successfully${NC}"
    else
        RESULTS+=("❌ Run #$i: FAIL")
        echo -e "${RED}❌ Test Run #$i failed${NC}"
        echo ""
        echo -e "${RED}Failed test log:${NC}"
        cat "/tmp/e2e-test-$i.log" | tail -50
    fi

    echo ""

    # 다음 테스트 전에 대기
    if [ $i -lt $TOTAL_TESTS ]; then
        echo -e "${YELLOW}📌 다음 테스트 전 3초 대기...${NC}"
        sleep 3
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}E2E Test 최종 결과${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

for result in "${RESULTS[@]}"; do
    echo "$result"
done

echo ""

# 최종 판정
PASS_COUNT=$(printf '%s\n' "${RESULTS[@]}" | grep -c "✅" || true)
FAIL_COUNT=$(printf '%s\n' "${RESULTS[@]}" | grep -c "❌" || true)

echo -e "${BLUE}통계:${NC}"
echo -e "  ${GREEN}✅ PASS: $PASS_COUNT/$TOTAL_TESTS${NC}"
echo -e "  ${RED}❌ FAIL: $FAIL_COUNT/$TOTAL_TESTS${NC}"

echo ""

if [ $PASS_COUNT -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}🎉 모든 E2E 테스트 3회 연속 PASS!${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}❌ E2E 테스트 실패 (재실행 필요)${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
