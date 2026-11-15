// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppContextMenu } from './AppContextMenu';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('application context menu', () => {
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

  it('replaces the browser menu and triggers entity deletion', () => {
    let deleted = false;
    act(() => root.render(<><AppContextMenu /><div data-context-menu="chapter" data-context-label="章节：测试" data-context-delete-target="#delete-test" data-context-delete-label="删除章节"><span>测试章节</span></div><button id="delete-test" type="button" onClick={() => { deleted = true; }}>删除按钮</button></>));
    const entity = container.querySelector('[data-context-menu="chapter"]')!;
    act(() => entity.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 })));
    const item = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('删除章节'));
    act(() => item!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(deleted).toBe(true);
  });
});