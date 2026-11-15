// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageGuideBubble } from './PageGuideBubble';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('page guide bubble', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('opens a contextual bubble from the small hint trigger', () => {
    act(() => root.render(<PageGuideBubble id="story-bible" target="#missing" title="故事圣经怎么用" points={['创建设定卡', '补充详情', '写作时查阅']} />));
    const trigger = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('提示'));
    act(() => trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('故事圣经怎么用');
    expect(container.textContent).toContain('创建设定卡');
  });
});