import type { FeatureDefinition } from '@/configs/features.config';
import { FeatureCard } from '@/screens/menu/FeatureCard';
import { h, render } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFeature: FeatureDefinition = {
  id: 'test-feature',
  name: 'Tính Năng Thử Nghiệm',
  description: 'Mô tả chi tiết tính năng thử nghiệm phân phối tin',
  isEnabledByDefault: true,
  routePath: '/feature/test-feature',
  detailComponentKey: 'test-component',
};

describe('FeatureCard Component (T010: Event Bubbling Isolation & Navigation)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should render feature information correctly with active badge when isEnabled is true', () => {
    const onToggle = vi.fn();
    const onNavigate = vi.fn();

    render(
      h(FeatureCard, {
        feature: mockFeature,
        isEnabled: true,
        onToggle,
        onNavigate,
      }),
      container,
    );

    expect(container.textContent).toContain('Tính Năng Thử Nghiệm');
    expect(container.textContent).toContain('Mô tả chi tiết tính năng thử nghiệm phân phối tin');
    expect(container.textContent).toContain('Đang Bật');
    expect(container.textContent).not.toContain('Đã Tắt');

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);
  });

  it('should render inactive badge when isEnabled is false', () => {
    const onToggle = vi.fn();
    const onNavigate = vi.fn();

    render(
      h(FeatureCard, {
        feature: mockFeature,
        isEnabled: false,
        onToggle,
        onNavigate,
      }),
      container,
    );

    expect(container.textContent).toContain('Đã Tắt');
    expect(container.textContent).not.toContain('Đang Bật');

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.checked).toBe(false);
  });

  it('should call onNavigate with routePath when card body is clicked', () => {
    const onToggle = vi.fn();
    const onNavigate = vi.fn();

    render(
      h(FeatureCard, {
        feature: mockFeature,
        isEnabled: true,
        onToggle,
        onNavigate,
      }),
      container,
    );

    const card = container.querySelector<HTMLElement>('[data-testid="feature-card-test-feature"]');
    expect(card).not.toBeNull();

    card?.click();

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('/feature/test-feature');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('MECHANICAL PROOF: should call onToggle and NEVER trigger onNavigate when ToggleSwitch is clicked (Event Bubbling Isolation)', () => {
    const onToggle = vi.fn();
    const onNavigate = vi.fn();

    render(
      h(FeatureCard, {
        feature: mockFeature,
        isEnabled: true,
        onToggle,
        onNavigate,
      }),
      container,
    );

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    // Trigger change on checkbox
    checkbox?.click();

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('test-feature', false);
    // OnNavigate must NEVER be called when clicking the switch
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
