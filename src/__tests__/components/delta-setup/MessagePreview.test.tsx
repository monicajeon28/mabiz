import { render, screen } from '@testing-library/react';
import MessagePreview from '@/components/delta-setup/MessagePreview';

/**
 * MessagePreview Component 유닛 테스트
 *
 * 테스트 항목:
 * - 4개 Day 카드 렌더링
 * - 메시지 내용 표시
 * - 메시지 길이 지표
 * - 상태 색상 (safe/warning/danger)
 * - 접근성 (aria-label, role 등)
 */

describe('MessagePreview Component', () => {
  const mockMessages = {
    day0: 'Day 0 메시지입니다.',
    day1: 'Day 1 메시지입니다. 좀 더 긴 메시지입니다.',
    day2: 'Day 2 메시지입니다. 아주 아주 아주 긴 메시지입니다. 이것은 LMS 형식입니다.',
    day3: 'Day 3 최종 메시지입니다.',
  };

  // ===== 기본 렌더링 테스트 =====
  describe('Rendering', () => {
    it('should render the component without crashing', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/메시지 미리보기/)).toBeInTheDocument();
    });

    it('should render 4 message cards', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const regions = container.querySelectorAll('[role="region"]');
      expect(regions.length).toBeGreaterThanOrEqual(4);
    });

    it('should display section header', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/Step 3: 메시지 미리보기/)).toBeInTheDocument();
    });

    it('should display helpful description', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(
        screen.getByText(/고객에게 이렇게 보입니다/)
      ).toBeInTheDocument();
    });
  });

  // ===== 메시지 콘텐츠 테스트 =====
  describe('Message Content Display', () => {
    it('should display day0 message', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(mockMessages.day0)).toBeInTheDocument();
    });

    it('should display day1 message', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(mockMessages.day1)).toBeInTheDocument();
    });

    it('should display day2 message', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(mockMessages.day2)).toBeInTheDocument();
    });

    it('should display day3 message', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(mockMessages.day3)).toBeInTheDocument();
    });

    it('should handle empty messages', () => {
      const emptyMessages = {
        day0: '',
        day1: '',
        day2: '',
        day3: '',
      };
      render(<MessagePreview messages={emptyMessages} />);
      expect(screen.getByText(/Step 3: 메시지 미리보기/)).toBeInTheDocument();
    });

    it('should handle very long messages', () => {
      const longMessages = {
        day0: 'A'.repeat(90),
        day1: 'B'.repeat(160),
        day2: 'C'.repeat(200),
        day3: 'D'.repeat(150),
      };
      render(<MessagePreview messages={longMessages} />);
      expect(screen.getByText('A'.repeat(90))).toBeInTheDocument();
    });
  });

  // ===== 메시지 길이 지표 테스트 =====
  describe('Message Length Indicator', () => {
    it('should display character count for day0', () => {
      render(<MessagePreview messages={mockMessages} />);
      const messageLength = mockMessages.day0.length;
      expect(screen.getByText(new RegExp(`${messageLength}/90`))).toBeInTheDocument();
    });

    it('should display character count for day1', () => {
      render(<MessagePreview messages={mockMessages} />);
      const messageLength = mockMessages.day1.length;
      expect(screen.getByText(new RegExp(`${messageLength}/160`))).toBeInTheDocument();
    });

    it('should display correct max length for day0 (SMS)', () => {
      render(<MessagePreview messages={{ ...mockMessages, day0: 'Test' }} />);
      expect(screen.getByText(/4\/90/)).toBeInTheDocument();
    });

    it('should display correct max length for day1-3 (LMS)', () => {
      render(<MessagePreview messages={{ ...mockMessages, day1: 'Test' }} />);
      expect(screen.getByText(/4\/160/)).toBeInTheDocument();
    });

    it('should show progress bars for all messages', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const progressBars = container.querySelectorAll('[role="progressbar"]');
      expect(progressBars.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ===== 상태 색상 테스트 =====
  describe('Message Status Colors', () => {
    it('should show SAFE (green) status for short messages', () => {
      const shortMessages = {
        day0: 'Short',
        day1: 'Short',
        day2: 'Short',
        day3: 'Short',
      };
      const { container } = render(<MessagePreview messages={shortMessages} />);
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    });

    it('should show WARNING (amber) status for medium messages', () => {
      const mediumMessages = {
        day0: 'A'.repeat(80),
        day1: 'B'.repeat(120),
        day2: 'C'.repeat(140),
        day3: 'D'.repeat(150),
      };
      const { container } = render(<MessagePreview messages={mediumMessages} />);
      // WARNING 상태 확인
      expect(
        container.querySelector('.bg-amber-50') ||
        container.querySelector('.text-amber-600')
      ).toBeInTheDocument();
    });

    it('should show DANGER (red) status for very long messages', () => {
      const longMessages = {
        day0: 'A'.repeat(95), // Day 0: 90자 초과
        day1: 'B'.repeat(165), // Day 1: 160자 초과
        day2: 'C'.repeat(170),
        day3: 'D'.repeat(170),
      };
      const { container } = render(<MessagePreview messages={longMessages} />);
      // DANGER 상태 확인
      expect(
        container.querySelector('.bg-red-50') ||
        container.querySelector('.text-red-600')
      ).toBeInTheDocument();
    });

    it('should update status color based on message length', () => {
      const { container, rerender } = render(
        <MessagePreview
          messages={{ day0: 'A'.repeat(50), day1: '', day2: '', day3: '' }}
        />
      );

      const initialStatus = container.querySelector('.bg-green-50');
      expect(initialStatus).toBeInTheDocument();

      rerender(
        <MessagePreview
          messages={{ day0: 'A'.repeat(100), day1: '', day2: '', day3: '' }}
        />
      );

      const updatedStatus = container.querySelector('.bg-red-50');
      expect(updatedStatus).toBeInTheDocument();
    });
  });

  // ===== Day별 레이블 테스트 =====
  describe('Day Labels and Descriptions', () => {
    it('should show day0 label as "구매 직후"', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/구매 직후/)).toBeInTheDocument();
    });

    it('should show day1 label as "+1일"', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/\+1일/)).toBeInTheDocument();
    });

    it('should show day2 label as "+2일"', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/\+2일/)).toBeInTheDocument();
    });

    it('should show day3 label as "+3일 (선택)"', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/\+3일.*선택/)).toBeInTheDocument();
    });

    it('should show day0 description as "구매 당일 오전 발송"', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/구매 당일 오전 발송/)).toBeInTheDocument();
    });

    it('should show day1 description as "구매 다음날 오후 발송"', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/구매 다음날 오후 발송/)).toBeInTheDocument();
    });
  });

  // ===== 메시지 형식 가이드 테스트 =====
  describe('Message Format Guide', () => {
    it('should display SMS format information', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/SMS \(0-90자\)/)).toBeInTheDocument();
      expect(screen.getByText(/요금 저렴, 빠른 전송/)).toBeInTheDocument();
    });

    it('should display LMS format information', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/LMS \(91-160자\)/)).toBeInTheDocument();
      expect(screen.getByText(/장문 메시지 가능/)).toBeInTheDocument();
    });

    it('should display day3 information', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(
        screen.getByText(/Day 3.*선택사항이지만 모두 입력된 상태/)
      ).toBeInTheDocument();
    });
  });

  // ===== 접근성 테스트 =====
  describe('Accessibility', () => {
    it('should have proper aria-label for each message card', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const regions = container.querySelectorAll('[role="region"]');
      regions.forEach((region) => {
        expect(region).toHaveAttribute('aria-label');
      });
    });

    it('should have progress bar with aria-valuenow', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const progressBars = container.querySelectorAll('[role="progressbar"]');
      progressBars.forEach((bar) => {
        expect(bar).toHaveAttribute('aria-valuenow');
      });
    });

    it('should have progress bar with aria-valuemin and aria-valuemax', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const progressBars = container.querySelectorAll('[role="progressbar"]');
      progressBars.forEach((bar) => {
        expect(bar).toHaveAttribute('aria-valuemin');
        expect(bar).toHaveAttribute('aria-valuemax');
      });
    });

    it('should have descriptive aria-label for progress bars', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const progressBars = container.querySelectorAll('[role="progressbar"]');
      progressBars.forEach((bar) => {
        const ariaLabel = bar.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/메시지 길이/);
      });
    });

    it('should have disabled buttons with description', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const buttons = container.querySelectorAll('button[disabled]');
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-description');
      });
    });

    it('should use semantic HTML structure', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
    });
  });

  // ===== 버튼 테스트 =====
  describe('Button States', () => {
    it('should have disabled detail buttons', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const detailButtons = Array.from(container.querySelectorAll('button')).filter(
        (btn) => btn.textContent?.includes('자세히')
      );
      detailButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });

    it('should have disabled close buttons', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const closeButtons = Array.from(container.querySelectorAll('button')).filter(
        (btn) => btn.textContent?.includes('닫기')
      );
      closeButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });

  // ===== 조건부 렌더링 테스트 =====
  describe('Conditional Rendering', () => {
    it('should render correctly with empty day0 message', () => {
      const messages = {
        ...mockMessages,
        day0: '',
      };
      render(<MessagePreview messages={messages} />);
      expect(screen.getByText(/0\/90/)).toBeInTheDocument();
    });

    it('should render correctly with empty day3 message', () => {
      const messages = {
        ...mockMessages,
        day3: '',
      };
      render(<MessagePreview messages={messages} />);
      expect(screen.getByText(/0\/160/)).toBeInTheDocument();
    });

    it('should handle emoji in messages', () => {
      const messages = {
        day0: '🎉 Hello',
        day1: '🎊 World',
        day2: '🚀 Test',
        day3: '✨ Message',
      };
      render(<MessagePreview messages={messages} />);
      expect(screen.getByText(/🎉 Hello/)).toBeInTheDocument();
      expect(screen.getByText(/🎊 World/)).toBeInTheDocument();
    });

    it('should handle Korean characters', () => {
      const messages = {
        day0: '안녕하세요 고객님',
        day1: '렌탈을 감사합니다',
        day2: '특별한 혜택을 드립니다',
        day3: '최종 확인 메시지',
      };
      render(<MessagePreview messages={messages} />);
      expect(screen.getByText(/안녕하세요 고객님/)).toBeInTheDocument();
    });
  });

  // ===== 레이아웃 테스트 =====
  describe('Layout', () => {
    it('should have scrollable message container', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const scrollContainer = container.querySelector('.max-h-\\[600px\\]');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('should have proper spacing between cards', () => {
      const { container } = render(<MessagePreview messages={mockMessages} />);
      const spacingContainer = container.querySelector('.space-y-4');
      expect(spacingContainer).toBeInTheDocument();
    });

    it('should display information box at the bottom', () => {
      render(<MessagePreview messages={mockMessages} />);
      expect(screen.getByText(/메시지 형식 안내/)).toBeInTheDocument();
    });
  });
});
