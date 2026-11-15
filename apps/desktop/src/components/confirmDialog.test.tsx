// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfirmDialogProvider, useConfirm } from './ConfirmDialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Consumer() {
  const confirm = useConfirm();
  const [result, setResult] = useState('none');
  return <><button type="button" onClick={() => { void confirm({ title: '删除测试？', description: '测试弹窗', confirmLabel: '确认删除', tone: 'danger' }).then((value) => setResult(String(value))); }}>开始</button><span>{result}</span></>;
}

describe('confirm dialog', () => {
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

  it('returns true after confirming the custom dialog', async () => {
    act(() => root.render(<ConfirmDialogProvider><Consumer /></ConfirmDialogProvider>));
    const start = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '开始');
    act(() => start!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(document.body.textContent).toContain('删除测试？');
    const confirm = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === '确认删除');
    await act(async () => { confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('true');
  });
});