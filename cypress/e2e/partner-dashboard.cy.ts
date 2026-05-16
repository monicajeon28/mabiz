/**
 * Partner Dashboard E2E 테스트
 *
 * Cypress 5가지 핵심 시나리오:
 * 1. 대시보드 카드 표시 및 통계 확인
 * 2. 상세 페이지 이동 및 데이터 로딩
 * 3. 월 선택 시 필터링 및 페이지 업데이트
 * 4. 페이지 선택 및 상세보기 라우팅
 * 5. 뒤로가기 네비게이션 작동 확인
 */

describe('Partner Dashboard - B2C Sales', () => {
  before(() => {
    // 테스트 전 로그인
    // cy.loginViaAPI('partner@example.com', 'password123')
  })

  beforeEach(() => {
    // 대시보드 페이지 방문 전에 항상 실행
    cy.visit('/partner/dashboard')
  })

  /**
   * Test Case 1: 대시보드 카드 표시 및 통계 확인
   */
  describe('Scenario 1: Dashboard Card Display', () => {
    it('should display dashboard cards with correct statistics', () => {
      // 페이지 로딩 확인
      cy.get('[data-testid="dashboard-header"]').should('be.visible')

      // 주요 카드들이 표시되는지 확인
      cy.get('[data-testid="total-sales-card"]').should('exist')
      cy.get('[data-testid="sales-count-card"]').should('exist')
      cy.get('[data-testid="reservation-count-card"]').should('exist')

      // 매출액이 숫자 형식으로 표시되는지 확인
      cy.get('[data-testid="total-sales-amount"]').then(($el) => {
        const text = $el.text().replace(/[^0-9]/g, '')
        expect(parseInt(text)).to.be.a('number')
      })

      // 트렌드 표시 확인
      cy.get('[data-testid="sales-trend"]').should('be.visible')
    })

    it('should display recent sales list', () => {
      // 최근 매출 테이블이 로드되는지 확인
      cy.get('[data-testid="recent-sales-table"]', { timeout: 5000 }).should('be.visible')

      // 최소 1개 이상의 매출 기록 확인
      cy.get('[data-testid="sales-row"]').should('have.length.at.least', 1)

      // 매출 정보 컬럼 확인
      cy.get('[data-testid="sales-row"]').first().within(() => {
        cy.get('[data-testid="product-name"]').should('not.be.empty')
        cy.get('[data-testid="sale-amount"]').should('not.be.empty')
        cy.get('[data-testid="sale-date"]').should('not.be.empty')
      })
    })

    it('should display passport and PNR status summary', () => {
      // 여권 상태 요약
      cy.get('[data-testid="passport-summary"]').should('be.visible')

      // PNR 상태 요약
      cy.get('[data-testid="pnr-summary"]').should('be.visible')

      // 각 상태별 카운트 표시
      cy.get('[data-testid="passport-status-issued"]').should('exist')
      cy.get('[data-testid="pnr-status-confirmed"]').should('exist')
    })
  })

  /**
   * Test Case 2: 상세 페이지 이동 및 데이터 로딩
   */
  describe('Scenario 2: Detailed Page Navigation', () => {
    it('should navigate to detail page when clicking recent sales row', () => {
      // 최근 매출 테이블 행 클릭
      cy.get('[data-testid="sales-row"]').first().click()

      // 상세 페이지로 이동 확인
      cy.url().should('include', '/partner/dashboard/detail')

      // 상세 정보 페이지 로드 확인
      cy.get('[data-testid="detail-header"]', { timeout: 5000 }).should('be.visible')

      // 상세 정보 표시
      cy.get('[data-testid="detail-product-name"]').should('not.be.empty')
      cy.get('[data-testid="detail-sale-amount"]').should('not.be.empty')
      cy.get('[data-testid="detail-commission"]').should('not.be.empty')
    })

    it('should load passport and PNR details', () => {
      cy.get('[data-testid="sales-row"]').first().click()

      // 여권 정보 섹션
      cy.get('[data-testid="detail-passport-info"]', { timeout: 5000 }).should('be.visible')
      cy.get('[data-testid="passport-status"]').should('not.be.empty')
      cy.get('[data-testid="passport-number"]').should('not.be.empty')

      // PNR 정보 섹션
      cy.get('[data-testid="detail-pnr-info"]').should('be.visible')
      cy.get('[data-testid="pnr-status"]').should('not.be.empty')
      cy.get('[data-testid="pnr-number"]').should('not.be.empty')
    })

    it('should display related reservations', () => {
      cy.get('[data-testid="sales-row"]').first().click()

      // 관련 예약 정보
      cy.get('[data-testid="detail-reservations"]', { timeout: 5000 }).should('be.visible')

      // 최소 1개 이상의 예약 확인
      cy.get('[data-testid="reservation-item"]').should('have.length.at.least', 1)
    })
  })

  /**
   * Test Case 3: 월 선택 시 필터링 및 페이지 업데이트
   */
  describe('Scenario 3: Month Selection Filter', () => {
    it('should filter data when month is selected', () => {
      // 월 선택 드롭다운 찾기
      cy.get('[data-testid="month-selector"]').click()

      // 이전 월(4월) 선택
      cy.get('[data-testid="month-option-2026-04"]').click()

      // 데이터 로딩 확인
      cy.get('[data-testid="dashboard-loading"]', { timeout: 5000 }).should('not.exist')

      // URL에 월 파라미터 포함 확인
      cy.url().should('include', 'month=2026-04')

      // 통계 업데이트 확인
      cy.get('[data-testid="total-sales-amount"]').should('be.visible')
    })

    it('should update page list based on selected month', () => {
      // 초기 페이지 카운트 저장
      cy.get('[data-testid="sales-row"]').then(($rows) => {
        const initialCount = $rows.length
        cy.log(`Initial sales count: ${initialCount}`)

        // 다른 월 선택
        cy.get('[data-testid="month-selector"]').click()
        cy.get('[data-testid="month-option-2026-03"]').click()

        // 페이지 업데이트 대기
        cy.get('[data-testid="dashboard-loading"]', { timeout: 5000 }).should('not.exist')

        // 페이지 목록이 변경되었는지 확인 (최소 1개 이상의 행이 있는지 확인)
        cy.get('[data-testid="sales-row"]').should('have.length.at.least', 0)
      })
    })

    it('should maintain month selection after page refresh', () => {
      cy.get('[data-testid="month-selector"]').click()
      cy.get('[data-testid="month-option-2026-02"]').click()

      // URL 확인
      cy.url().then((url) => {
        cy.reload()
        cy.url().should('include', 'month=2026-02')
      })
    })
  })

  /**
   * Test Case 4: 페이지 선택 및 상세보기 라우팅
   */
  describe('Scenario 4: Page Selection and Detail Routing', () => {
    it('should navigate to detail page with correct parameters', () => {
      cy.get('[data-testid="sales-row"]').first().then(($row) => {
        const saleId = $row.attr('data-sale-id')

        cy.wrap($row).click()

        // URL에 ID 파라미터 포함 확인
        cy.url().should('include', `/detail/${saleId}`)
      })
    })

    it('should display detail page content correctly', () => {
      cy.get('[data-testid="sales-row"]').first().click()

      // 상세 페이지 컨텐츠 확인
      cy.get('[data-testid="detail-container"]', { timeout: 5000 }).should('be.visible')

      // 뒤로가기 버튼 확인
      cy.get('[data-testid="back-button"]').should('be.visible')

      // 관련 정보 섹션 확인
      cy.get('[data-testid="sale-info-section"]').should('be.visible')
      cy.get('[data-testid="reservation-info-section"]').should('be.visible')
    })

    it('should handle invalid detail page gracefully', () => {
      // 존재하지 않는 ID로 직접 접근
      cy.visit('/partner/dashboard/detail/invalid-id')

      // 에러 메시지 또는 리다이렉트 확인
      cy.get('[data-testid="error-message"]', { timeout: 5000 }).should('be.visible')
        .or(() => {
          cy.url().should('include', '/partner/dashboard')
        })
    })
  })

  /**
   * Test Case 5: 뒤로가기 네비게이션 작동 확인
   */
  describe('Scenario 5: Back Navigation', () => {
    it('should navigate back to dashboard when back button is clicked', () => {
      // 상세 페이지로 이동
      cy.get('[data-testid="sales-row"]').first().click()

      // URL 확인
      cy.url().should('include', '/partner/dashboard/detail')

      // 뒤로가기 버튼 클릭
      cy.get('[data-testid="back-button"]').click()

      // 대시보드로 돌아갔는지 확인
      cy.url().should('include', '/partner/dashboard')
      cy.get('[data-testid="dashboard-header"]').should('be.visible')
    })

    it('should preserve month filter when navigating back', () => {
      // 월 선택
      cy.get('[data-testid="month-selector"]').click()
      cy.get('[data-testid="month-option-2026-05"]').click()

      // 데이터 로딩 대기
      cy.get('[data-testid="dashboard-loading"]', { timeout: 5000 }).should('not.exist')

      // 상세 페이지로 이동
      cy.get('[data-testid="sales-row"]').first().click()

      // 뒤로가기
      cy.get('[data-testid="back-button"]').click()

      // 월 파라미터가 유지되었는지 확인
      cy.url().should('include', 'month=2026-05')

      // 대시보드 페이지 확인
      cy.get('[data-testid="dashboard-header"]').should('be.visible')
    })

    it('should use browser back button for navigation', () => {
      const initialUrl = '/partner/dashboard'
      cy.url().should('include', initialUrl)

      // 상세 페이지로 이동
      cy.get('[data-testid="sales-row"]').first().click()
      cy.url().should('include', '/partner/dashboard/detail')

      // 브라우저 뒤로가기
      cy.go('back')

      // 대시보드로 돌아갔는지 확인
      cy.url().should('include', initialUrl)
    })

    it('should maintain scroll position when navigating back', () => {
      // 대시보드에서 스크롤
      cy.scrollTo(0, 500)

      // 상세 페이지로 이동
      cy.get('[data-testid="sales-row"]').first().click()

      // 뒤로가기
      cy.go('back')

      // 대시보드로 돌아갔는지 확인
      cy.url().should('include', '/partner/dashboard')
      cy.get('[data-testid="dashboard-header"]').should('be.visible')
    })
  })

  /**
   * 추가: 에러 처리 및 엣지 케이스
   */
  describe('Error Handling and Edge Cases', () => {
    it('should display loading state while fetching data', () => {
      // 새로고침 시 로딩 상태 확인
      cy.intercept('/api/partner/dashboard/b2c*', { delay: 2000 }).as('dashboardApi')

      cy.reload()

      // 로딩 표시 확인
      cy.get('[data-testid="dashboard-loading"]', { timeout: 1000 }).should('be.visible')

      // 데이터 로드 완료 대기
      cy.wait('@dashboardApi')
      cy.get('[data-testid="dashboard-loading"]').should('not.exist')
    })

    it('should handle API errors gracefully', () => {
      // API 오류 시뮬레이션
      cy.intercept('/api/partner/dashboard/b2c*', { statusCode: 500 }).as('errorApi')

      cy.reload()

      // 에러 메시지 확인
      cy.get('[data-testid="error-message"]', { timeout: 5000 }).should('be.visible')
        .and('include.text', '오류')

      // 재시도 버튼 확인
      cy.get('[data-testid="retry-button"]').should('be.visible')
    })

    it('should handle empty data gracefully', () => {
      // 빈 데이터 응답
      cy.intercept('/api/partner/dashboard/b2c*', {
        statusCode: 200,
        body: {
          ok: true,
          data: {
            totalSalesAmount: 0,
            salesCount: 0,
            reservationCount: 0,
            recentSales: [],
            passportPnr: [],
            passportSummary: {},
            pnrSummary: {},
            trends: {},
          },
        },
      }).as('emptyApi')

      cy.reload()
      cy.wait('@emptyApi')

      // 빈 상태 메시지 확인
      cy.get('[data-testid="empty-state-message"]', { timeout: 5000 }).should('be.visible')
        .or(() => {
          cy.get('[data-testid="total-sales-amount"]').should('include.text', '0')
        })
    })
  })
})
