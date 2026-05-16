/**
 * Cypress E2E 테스트 공통 설정
 */

// 글로벌 로그인 헬퍼
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit('/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
  // 로그인 완료 대기
  cy.url().should('not.include', '/login')
})

// API 인증 헬퍼
Cypress.Commands.add('loginViaAPI', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  }).then((resp) => {
    expect(resp.status).to.eq(200)
  })
})

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>
      loginViaAPI(email: string, password: string): Chainable<void>
    }
  }
}

export {}
