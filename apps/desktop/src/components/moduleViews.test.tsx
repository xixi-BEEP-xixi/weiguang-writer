// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialWorkspace } from '../domain/defaults';
import { useWriterStore } from '../data/writerStore';
import { ForeshadowView } from './ForeshadowView';
import { StoryBibleView } from './StoryBibleView';
import { TimelineView } from './TimelineView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('story module views', () => {
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

  it('renders bible cards and their editor', () => {
    useWriterStore.getState().addBibleCard('location', '雾港');
    act(() => root.render(<StoryBibleView />));
    expect(container.textContent).toContain('故事圣经');
    expect(container.textContent).toContain('雾港');
    expect(container.textContent).toContain('详细设定');
  });

  it('renders timeline and foreshadow editors', () => {
    useWriterStore.getState().addTimelineEvent();
    act(() => root.render(<TimelineView />));
    expect(container.textContent).toContain('事件 1');
    act(() => root.render(<ForeshadowView />));
    useWriterStore.getState().addForeshadow('钟声异常');
    expect(container.textContent).toContain('先埋下一枚钩子');
  });
});