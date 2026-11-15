// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NewProjectDialog } from './ProjectDialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('project dialog', () => {
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

  it('explains memory benefits and tradeoffs when creating a book', () => {
    let created: { name: string; memory: boolean } | null = null;
    act(() => root.render(<NewProjectDialog open onConfirm={(name, memory) => { created = { name, memory }; }} onClose={() => undefined} />));
    expect(container.textContent).toContain('启用长期记忆');
    expect(container.textContent).toContain('开启后会更好');
    expect(container.textContent).toContain('需要注意');
    const submit = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('创建书籍'));
    act(() => submit!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(created).toEqual({ name: '未命名长篇', memory: true });
  });
});
