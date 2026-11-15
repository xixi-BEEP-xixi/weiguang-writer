// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialWorkspace } from '../domain/defaults';
import { useWriterStore } from '../data/writerStore';
import { ForeshadowView } from './ForeshadowView';
import { OutlineView } from './OutlineView';
import { Sidebar } from './Sidebar';
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

  it('exposes the outline entry in primary navigation', () => {
    act(() => root.render(<Sidebar />));
    expect(container.textContent).toContain('大纲');
  });
  it('renders the outline workspace with an editable chapter goal', () => {
    act(() => root.render(<OutlineView />));
    expect(container.textContent).toContain('大纲');
    expect(container.textContent).toContain('第一章');
    expect(container.textContent).toContain('写作目标');
    const chapter = useWriterStore.getState().data.chapters[0];
    useWriterStore.getState().upsertOutlineItem('chapter', chapter.id, { goal: '主角进入钟楼' });
    act(() => root.render(<OutlineView />));
    expect((container.querySelector('.outline-fields textarea') as HTMLTextAreaElement | null)?.value).toBe('主角进入钟楼');
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