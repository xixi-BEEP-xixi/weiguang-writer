// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialWorkspace } from '../domain/defaults';
import { useWriterStore } from '../data/writerStore';
import { BookshelfView } from './BookshelfView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('bookshelf', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useWriterStore.getState().hydrate(createInitialWorkspace());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows books and opens the selected one', () => {
    useWriterStore.getState().addProject('第二部', true);
    act(() => root.render(<BookshelfView />));
    expect(container.textContent).toContain('我的书架');
    expect(container.textContent).toContain('第二部');
    expect(container.textContent).toContain('记忆开启');

    const firstBook = Array.from(container.querySelectorAll<HTMLButtonElement>('button.book-card')).find((button) => button.textContent?.includes('未命名长篇'));
    act(() => firstBook!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useWriterStore.getState().activeNav).toBe('writing');
  });
});