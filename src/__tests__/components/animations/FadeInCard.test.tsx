import React from 'react';
import { render, screen } from '@testing-library/react';
import { FadeInCard } from '@/components/animations';

/**
 * FadeInCard 컴포넌트 테스트
 */

describe('FadeInCard', () => {
  beforeEach(() => {
    // IntersectionObserver Mock
    global.IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })) as any;
  });

  it('should render children', () => {
    render(
      <FadeInCard>
        <span>Test Content</span>
      </FadeInCard>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply default animation classes', () => {
    const { container } = render(
      <FadeInCard>
        <span>Content</span>
      </FadeInCard>
    );

    const element = container.querySelector('div');
    expect(element).toHaveClass('transition-all');
  });

  it('should apply custom delay', () => {
    const { container } = render(
      <FadeInCard delay={200}>
        <span>Content</span>
      </FadeInCard>
    );

    const element = container.querySelector('div');
    expect(element?.style.getPropertyValue('--animation-delay')).toBe('200ms');
  });

  it('should apply custom duration', () => {
    const { container } = render(
      <FadeInCard duration={800}>
        <span>Content</span>
      </FadeInCard>
    );

    const element = container.querySelector('div');
    expect(element?.style.getPropertyValue('--animation-duration')).toBe('800ms');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <FadeInCard className="custom-class">
        <span>Content</span>
      </FadeInCard>
    );

    const element = container.querySelector('div');
    expect(element).toHaveClass('custom-class');
  });

  it('should have initial fade-out state', () => {
    const { container } = render(
      <FadeInCard>
        <span>Content</span>
      </FadeInCard>
    );

    const element = container.querySelector('div');
    // 초기 상태는 opacity-0이어야 함
    const classes = element?.className || '';
    expect(classes).toContain('opacity-0');
  });
});
