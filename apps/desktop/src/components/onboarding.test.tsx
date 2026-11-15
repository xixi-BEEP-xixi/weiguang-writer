// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OnboardingGuide } from './OnboardingGuide';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('interface tour', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('walks through the new interface with small contextual bubbles', () => {
    let closed = false;
    act(() => root.render(<OnboardingGuide onClose={() => { closed = true; }} />));
    expect(container.textContent).toContain('书架在这里');
    expect(container.textContent).toContain('1 / 9');

    for (let index = 0; index < 8; index += 1) {
      const next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('下一步'));
      expect(next).toBeDefined();
      act(() => next!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    }

    expect(container.textContent).toContain('设置与外观');
    const finish = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('完成'));
    act(() => finish!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(closed).toBe(true);
  });
});