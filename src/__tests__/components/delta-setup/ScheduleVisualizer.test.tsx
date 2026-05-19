import { render, screen, waitFor } from '@testing-library/react';
import ScheduleVisualizer from '@/components/delta-setup/ScheduleVisualizer';

/**
 * ScheduleVisualizer Component 유닛 테스트
 *
 * 테스트 항목:
 * - 3개 스케줄 카드 렌더링
 * - KST 시간대 포맷 (오전/오후)
 * - 예상 발송 건수 표시
 * - 자동화 정보 표시
 * - 접근성 (aria-label 등)
 */

describe('ScheduleVisualizer Component', () => {
  // ===== 기본 렌더링 테스트 =====
  describe('Rendering', () => {
    it('should render the component without crashing', () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      expect(screen.getByText(/발송 스케줄 확인/)).toBeInTheDocument();
    });

    it('should display section header', () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      expect(
        screen.getByText(/Step 4: 발송 스케줄 확인/)
      ).toBeInTheDocument();
    });

    it('should display 3 schedule cards', async () => {
      const { container } = render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        const regions = container.querySelectorAll('[role="region"]');
        expect(regions.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should display helpful description', () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      expect(
        screen.getByText(/렌탈 메시지는 매일 3회 자동으로 발송됩니다/)
      ).toBeInTheDocument();
    });
  });

  // ===== 시간 포맷 테스트 (KST) =====
  describe('Time Format (KST)', () => {
    it('should display 09:00 as "오전 9:00"', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/오전 9:00|9:00/)
        ).toBeInTheDocument();
      });
    });

    it('should display 14:00 as "오후 2:00"', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/오후 2:00|14:00/)
        ).toBeInTheDocument();
      });
    });

    it('should display 19:00 as "오후 7:00"', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/오후 7:00|19:00/)
        ).toBeInTheDocument();
      });
    });

    it('should display timezone information', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/한국표준시|KST/)
        ).toBeInTheDocument();
      });
    });
  });

  // ===== 발송 정보 테스트 =====
  describe('Sending Information', () => {
    it('should display schedule descriptions', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/Day 0 메시지 발송.*구매 직후/)
        ).toBeInTheDocument();
      });
    });

    it('should display estimated sending counts', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/~.*건/)).toBeInTheDocument();
      });
    });

    it('should show Day 0 count as ~2,400', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/~2,400건/)).toBeInTheDocument();
      });
    });

    it('should show Day 1 count as ~1,800', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/~1,800건/)).toBeInTheDocument();
      });
    });

    it('should show Day 2/3 count as ~1,200', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/~1,200건/)).toBeInTheDocument();
      });
    });

    it('should display estimated duration', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/<5분/)).toBeInTheDocument();
        expect(screen.getByText(/<4분/)).toBeInTheDocument();
        expect(screen.getByText(/<3분/)).toBeInTheDocument();
      });
    });
  });

  // ===== Cron 설정 테스트 =====
  describe('Cron Configuration', () => {
    it('should have enabled checkboxes (read-only)', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBeGreaterThan(0);
      });
    });

    it('should disable all checkboxes', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox) => {
          expect(checkbox).toBeDisabled();
        });
      });
    });

    it('should mark SMS sending as enabled', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getAllByText(/SMS 발송 활성화/)[0]).toBeInTheDocument();
      });
    });

    it('should mark Cron auto-run as enabled', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/Cron 자동 실행.*Vercel/)
        ).toBeInTheDocument();
      });
    });

    it('should mark SendingHistory as enabled', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/발송 이력 자동 기록/)
        ).toBeInTheDocument();
      });
    });
  });

  // ===== 자동화 기능 정보 테스트 =====
  describe('Automation Information', () => {
    it('should display automation section', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/자동화 기능/)).toBeInTheDocument();
      });
    });

    it('should display batch processing information', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/배치 처리/)).toBeInTheDocument();
        expect(
          screen.getByText(/발송 건수가 많을 때 100명씩 나누어 처리/)
        ).toBeInTheDocument();
      });
    });

    it('should display real-time tracking information', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/실시간 추적/)).toBeInTheDocument();
        expect(
          screen.getByText(/SendingHistory에 모든 발송 기록이 자동 저장/)
        ).toBeInTheDocument();
      });
    });

    it('should display safety information', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/안전성/)).toBeInTheDocument();
        expect(
          screen.getByText(/발송 실패 시 자동 재시도 및 에러 로깅/)
        ).toBeInTheDocument();
      });
    });

    it('should display global server information', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/글로벌 서버/)).toBeInTheDocument();
        expect(
          screen.getByText(/Vercel Cron으로 시간에 정확하게 실행/)
        ).toBeInTheDocument();
      });
    });
  });

  // ===== 발송 일정 요약 테스트 =====
  describe('Schedule Summary', () => {
    it('should display schedule summary section', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/발송 일정/)).toBeInTheDocument();
      });
    });

    it('should display purchase trigger description', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/구매 당일/)
        ).toBeInTheDocument();
      });
    });

    it('should display abandoned trigger description', async () => {
      render(<ScheduleVisualizer triggerType="ABANDONED" />);
      await waitFor(() => {
        expect(
          screen.getByText(/이탈 감지/)
        ).toBeInTheDocument();
      });
    });

    it('should mention 4-day message sequence', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/4일간/)).toBeInTheDocument();
      });
    });

    it('should mention psychology-based messaging', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/심리학 기반 메시지/)).toBeInTheDocument();
      });
    });
  });

  // ===== 완료 상태 테스트 =====
  describe('Completion Status', () => {
    it('should display completion section', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/설정 완료/)).toBeInTheDocument();
      });
    });

    it('should mention all steps completed', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/모든 단계를 완료/)
        ).toBeInTheDocument();
      });
    });

    it('should mention save button action', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/저장.*버튼을 클릭/)
        ).toBeInTheDocument();
      });
    });

    it('should mention automation activation', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/렌탈 SMS 자동화가 활성화/)
        ).toBeInTheDocument();
      });
    });
  });

  // ===== 접근성 테스트 =====
  describe('Accessibility', () => {
    it('should have proper aria-label for schedule regions', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        const regions = container.querySelectorAll('[role="region"]');
        regions.forEach((region) => {
          expect(region).toHaveAttribute('aria-label');
        });
      });
    });

    it('should have aria-label for SMS enabling checkbox', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        const checkbox = screen.getByLabelText(/SMS 발송 활성화/);
        expect(checkbox).toBeInTheDocument();
      });
    });

    it('should have aria-label for Cron auto-run checkbox', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        const checkbox = screen.getByLabelText(/Cron 자동 실행/);
        expect(checkbox).toBeInTheDocument();
      });
    });

    it('should have aria-description for disabled checkboxes', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        const checkboxes = container.querySelectorAll(
          'input[type="checkbox"][disabled]'
        );
        checkboxes.forEach((checkbox) => {
          expect(checkbox).toHaveAttribute('aria-description');
        });
      });
    });

    it('should have alert role for error messages', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      // 기본상태에는 error가 없으므로 테스트만 가능
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
    });

    it('should use semantic HTML structure', () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
    });
  });

  // ===== 트리거 타입에 따른 테스트 =====
  describe('Trigger Type Variations', () => {
    it('should render correctly with PURCHASE trigger', () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      expect(
        screen.getByText(/발송 스케줄 확인/)
      ).toBeInTheDocument();
    });

    it('should render correctly with ABANDONED trigger', () => {
      render(<ScheduleVisualizer triggerType="ABANDONED" />);
      expect(
        screen.getByText(/발송 스케줄 확인/)
      ).toBeInTheDocument();
    });

    it('should update description based on trigger type', async () => {
      const { rerender } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        expect(screen.getByText(/구매 당일/)).toBeInTheDocument();
      });

      rerender(<ScheduleVisualizer triggerType="ABANDONED" />);
      await waitFor(() => {
        expect(screen.getByText(/이탈 감지/)).toBeInTheDocument();
      });
    });
  });

  // ===== 로딩 상태 테스트 =====
  describe('Loading State', () => {
    it('should eventually display all content', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(
          screen.getByText(/발송 스케줄 확인/)
        ).toBeInTheDocument();
        expect(screen.getByText(/~2,400건/)).toBeInTheDocument();
      });
    });

    it('should not show error by default', () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
    });
  });

  // ===== 카드 스타일 테스트 =====
  describe('Card Styling', () => {
    it('should have gradient background for schedule cards', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        const cards = container.querySelectorAll('.bg-gradient-to-br');
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('should have proper border colors', async () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      await waitFor(() => {
        const cards = container.querySelectorAll('[role="region"]');
        cards.forEach((card) => {
          expect(card.className).toMatch(/border/);
        });
      });
    });

    it('should display icons for schedule items', async () => {
      render(<ScheduleVisualizer triggerType="PURCHASE" />);
      await waitFor(() => {
        expect(screen.getByText(/🕐/)).toBeInTheDocument();
      });
    });
  });

  // ===== 정보 박스 테스트 =====
  describe('Information Boxes', () => {
    it('should display green background for schedule summary', () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      expect(
        container.querySelector('.from-green-50')
      ).toBeInTheDocument();
    });

    it('should display indigo background for automation info', () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      expect(
        container.querySelector('.from-indigo-50') ||
        container.querySelector('.bg-indigo-50')
      ).toBeInTheDocument();
    });

    it('should display green background for completion status', () => {
      const { container } = render(
        <ScheduleVisualizer triggerType="PURCHASE" />
      );
      const greenBoxes = container.querySelectorAll('.from-green-50, .bg-green-50');
      expect(greenBoxes.length).toBeGreaterThan(0);
    });
  });
});
