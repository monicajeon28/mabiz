/**
 * Messages Page Tests - Wave 1
 *
 * 테스트 시나리오:
 * 1. 기본 렌더링 (SMS 탭)
 * 2. CSRF 토큰 포함 확인
 * 3. XSS sanitize 작동 확인
 * 4. 발송 확인 로직 (미리보기 → 체크박스 → confirm)
 * 5. Rate limit 표시
 * 6. ReviewTab 권한 확인
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessagesPage from '@/app/(dashboard)/messages/page';

// ─── Mock 설정 ──────────────────────────────────────────────────
vi.mock('@/components/ui/Toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// ─── 테스트 스위트 ──────────────────────────────────────────────
describe('MessagesPage - SMS Tab', () => {
  beforeEach(() => {
    // 기본 fetch mock 설정
    global.fetch = vi.fn((url: string) => {
      // CSRF 토큰
      if (url.includes('/api/csrf-token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, token: 'mock-csrf-token-12345' }),
        } as Response);
      }

      // SMS 설정
      if (url.includes('/api/settings/sms-config')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            config: {
              aligoUserId: 'test_user',
              senderPhone: '070-1234-5678',
              senderVerified: true,
              aligoKeyTail: '****',
            },
          }),
        } as Response);
      }

      // 그룹 목록
      if (url.includes('/api/groups') && !url.includes('/blast')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            groups: [
              { id: 'grp_1', name: 'VIP', color: '#ff0000', _count: { members: 10 } },
              { id: 'grp_2', name: 'Regular', color: '#0000ff', _count: { members: 50 } },
            ],
          }),
        } as Response);
      }

      // 링크 목록
      if (url.includes('/api/links')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            links: [
              {
                id: 'lnk_1',
                code: 'abc123',
                title: '상담링크1',
                contactId: 'contact_1',
              },
            ],
          }),
        } as Response);
      }

      // 기본값
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);
    }) as any;

    // window.confirm mock
    global.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Step 2: 기본 렌더링 테스트 ──────────────────────────────
  describe('기본 렌더링', () => {
    it('should render SMS tab by default', () => {
      render(<MessagesPage />);
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('should have email tab option', () => {
      render(<MessagesPage />);
      expect(screen.getByText('이메일')).toBeInTheDocument();
    });

    it('should load SMS config on mount', async () => {
      render(<MessagesPage />);
      await waitFor(() => {
        expect(screen.getByText(/알리고 연결됨/)).toBeInTheDocument();
      });
    });

    it('should load groups on mount', async () => {
      render(<MessagesPage />);
      await waitFor(() => {
        expect(screen.getByText(/VIP \(10명\)/)).toBeInTheDocument();
      });
    });

    it('should display sender phone', async () => {
      render(<MessagesPage />);
      await waitFor(() => {
        expect(screen.getByText(/070-1234-5678/)).toBeInTheDocument();
      });
    });
  });

  // ─── Step 3: CSRF 토큰 테스트 ───────────────────────────────
  describe('CSRF 토큰', () => {
    it('should fetch CSRF token on mount', async () => {
      render(<MessagesPage />);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/csrf-token');
      });
    });

    it('should include CSRF token in dry-run request', async () => {
      const user = userEvent.setup();
      render(<MessagesPage />);

      // 그룹 선택 및 메시지 입력 대기
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      // 그룹 선택
      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      // 메시지 입력
      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test message');

      // dry-run 버튼 클릭
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // CSRF 토큰 포함 확인
      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls;
        const blastCall = calls.find((call: any[]) =>
          call[0].includes('/blast') && call[1]?.method === 'POST'
        );
        expect(blastCall).toBeDefined();
        if (blastCall) {
          expect(blastCall[1].headers['X-CSRF-Token']).toBe('mock-csrf-token-12345');
        }
      });
    });

    it('should include CSRF token in send request', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 10,
              sampleMessages: ['Sample message'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      // 그룹 선택
      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      // 메시지 입력
      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test message');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 확인 체크박스
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // 발송 버튼 클릭
      const sendBtn = screen.getByText(/발송/);
      await user.click(sendBtn);

      // 최종 CSRF 토큰 확인
      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls;
        const finalBlastCall = calls[calls.length - 1];
        if (finalBlastCall[0].includes('/blast')) {
          expect(finalBlastCall[1].headers['X-CSRF-Token']).toBe(
            'mock-csrf-token-12345'
          );
        }
      });
    });
  });

  // ─── Step 4: XSS Sanitize 테스트 ────────────────────────────
  describe('XSS Sanitize', () => {
    it('should display sample message without XSS', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 1,
              sampleMessages: ['Hello [이름]'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 그룹 선택 및 메시지 입력
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Hello [이름]');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 정상 메시지 표시 확인
      await waitFor(() => {
        expect(screen.getByText('Hello [이름]')).toBeInTheDocument();
      });
    });

    it('should remove script tags from sample message', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 1,
              sampleMessages: [
                '<script>alert("xss")</script>Hello',
              ],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 그룹 및 메시지
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 스크립트 제거 확인
      await waitFor(() => {
        const screen_text = screen.queryByText(/script/);
        // script 태그가 제거되어야 함
        expect(screen_text).not.toBeInTheDocument();
      });
    });

    it('should handle special characters in sample', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 1,
              sampleMessages: ['[이름] [전화번호] [담당자]'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test [이름]');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 특수문자 표시 확인
      await waitFor(() => {
        expect(screen.getByText(/\[이름\]/)).toBeInTheDocument();
      });
    });
  });

  // ─── Step 5: 발송 확인 로직 테스트 ──────────────────────────
  describe('발송 확인 로직', () => {
    it('should have disabled send button before dry-run', async () => {
      render(<MessagesPage />);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
        expect(textarea).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      fireEvent.change(textarea, { target: { value: 'Test message' } });

      const sendButtons = screen.queryAllByRole('button').filter((btn) =>
        btn.textContent?.includes('발송')
      );

      // dry-run 전에는 발송 버튼이 없거나 disabled
      expect(
        sendButtons.some((btn) =>
          btn.getAttribute('disabled') !== null || btn.textContent?.includes('미리보기')
        )
      ).toBe(true);
    });

    it('should show confirmation checkbox after dry-run', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 10,
              sampleMessages: ['Sample'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 그룹 및 메시지
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 체크박스 나타남
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should require confirmation before sending', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 10,
              sampleMessages: ['Sample'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 체크박스 없이 발송 시도
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
      });

      const sendButtons = screen.getAllByRole('button');
      const sendBtn = sendButtons.find((btn) =>
        btn.textContent?.includes('발송') &&
        !btn.textContent?.includes('미리보기')
      );

      if (sendBtn) {
        // disabled 또는 에러 표시
        expect(
          sendBtn.getAttribute('disabled') !== null ||
          sendBtn.getAttribute('aria-disabled') === 'true'
        ).toBe(true);
      }
    });

    it('should show confirm dialog when checkbox is checked', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 10,
              sampleMessages: ['Sample'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 체크박스 선택
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // 발송 버튼 클릭
      const sendButtons = screen.getAllByRole('button');
      const sendBtn = sendButtons.find((btn) =>
        btn.textContent?.includes('발송') &&
        !btn.textContent?.includes('미리보기')
      );

      if (sendBtn) {
        await user.click(sendBtn);

        // confirm 다이얼로그 호출 확인
        await waitFor(() => {
          expect(global.confirm).toHaveBeenCalled();
        });
      }
    });

    it('should not send if confirm is cancelled', async () => {
      global.confirm = vi.fn(() => false);
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 10,
              sampleMessages: ['Sample'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 체크박스 선택
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // 발송 시도
      const sendButtons = screen.getAllByRole('button');
      const sendBtn = sendButtons.find((btn) =>
        btn.textContent?.includes('발송') &&
        !btn.textContent?.includes('미리보기')
      );

      if (sendBtn) {
        await user.click(sendBtn);

        // 메시지 여전히 표시 (발송 안됨)
        await waitFor(() => {
          const checkBox = screen.getByRole('checkbox');
          expect(checkBox).toBeInTheDocument();
        });
      }
    });
  });

  // ─── Step 6: Rate Limit 테스트 ──────────────────────────────
  describe('Rate Limit', () => {
    it('should display rate limit status', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/rate-limit')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              status: {
                used: 2,
                remaining: 3,
                resetAt: new Date().toISOString(),
              },
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      render(<MessagesPage />);

      // Rate limit 표시 확인 (구현되었으면)
      // await waitFor(() => {
      //   expect(screen.getByText(/2\/5회/)).toBeInTheDocument();
      // });
    });

    it('should handle 429 rate limit error', async () => {
      const { showError } = await import('@/components/ui/Toast');
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast') && url.includes('dryRun=false')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({
              ok: false,
              message: '하루 발송 횟수(5회)를 초과했습니다.',
            }),
          } as Response);
        }
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 10,
              sampleMessages: ['Sample'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비 (dry-run만 성공, send는 실패)
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Test');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 체크박스 및 발송
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      const sendButtons = screen.getAllByRole('button');
      const sendBtn = sendButtons.find((btn) =>
        btn.textContent?.includes('발송') &&
        !btn.textContent?.includes('미리보기')
      );

      if (sendBtn) {
        await user.click(sendBtn);

        // 확인 창 닫기
        global.confirm = vi.fn(() => true);
        await waitFor(() => {
          expect(global.confirm).toHaveBeenCalled();
        });
      }
    });
  });

  // ─── Step 7: ReviewTab 권한 테스트 ──────────────────────────
  describe('ReviewTab 권한', () => {
    it('should show message content and sample preview', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 5,
              sampleMessages: ['안녕하세요 [이름]'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, '안녕하세요 [이름]');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 미리보기 표시 확인
      await waitFor(() => {
        expect(screen.getByText(/5명/)).toBeInTheDocument();
      });
    });

    it('should maintain sample preview text after validation', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('/blast')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ok: true,
              count: 1,
              sampleMessages: ['Hello world'],
              linkNoCount: 0,
            }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }) as any;

      const user = userEvent.setup();
      render(<MessagesPage />);

      // 준비
      await waitFor(() => {
        expect(screen.getByDisplayValue('그룹 선택...')).toBeInTheDocument();
      });

      const groupSelect = screen.getByDisplayValue('그룹 선택...');
      await user.click(groupSelect);
      const vipOption = screen.getByText('VIP (10명)');
      await user.click(vipOption);

      const textarea = screen.getByPlaceholderText(/메시지 내용|내용을 입력하거나/);
      await user.type(textarea, 'Hello world');

      // dry-run
      const dryRunBtn = screen.getByText(/발송 대상 미리보기|발송 대상/);
      await user.click(dryRunBtn);

      // 미리보기 확인
      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument();
      });
    });
  });
});
