import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialWorkspace } from '../domain/defaults';
import { useWriterStore } from './writerStore';

describe('story module store', () => {
  beforeEach(() => {
    useWriterStore.getState().hydrate(createInitialWorkspace());
  });

  it('creates, edits and removes story bible cards', () => {
    const store = useWriterStore.getState();
    store.addBibleCard('character', '沈砚');
    const card = useWriterStore.getState().data.bibleCards[0];
    expect(card.name).toBe('沈砚');
    expect(card.projectId).toBe(useWriterStore.getState().data.activeProjectId);

    useWriterStore.getState().updateBibleCard(card.id, {
      summary: '追查旧案的人',
      aliases: ['小砚'],
      tags: ['主角'],
    });
    const updated = useWriterStore.getState().data.bibleCards[0];
    expect(updated.summary).toBe('追查旧案的人');
    expect(updated.aliases).toEqual(['小砚']);
    expect(updated.rev).toBe(2);

    useWriterStore.getState().deleteBibleCard(card.id);
    expect(useWriterStore.getState().data.bibleCards).toHaveLength(0);
  });

  it('removes orphan records that would violate database foreign keys', () => {
    const data = createInitialWorkspace();
    data.timelineEvents.push({
      id: 'orphan-event', projectId: 'missing-project', chapterId: null, sceneId: null,
      title: '孤儿事件', description: '', storyTime: '', sort: 1, status: 'planned',
      rev: 1, createdAt: '', updatedAt: '',
    });
    useWriterStore.getState().hydrate(data);
    expect(useWriterStore.getState().data.timelineEvents).toHaveLength(0);
  });
  it('switches the active project when selecting a scene from another project', () => {
    const originalProjectId = useWriterStore.getState().data.activeProjectId;
    useWriterStore.getState().addProject('第二部');
    const secondProject = useWriterStore.getState().data.projects[1];
    const secondScene = useWriterStore.getState().data.scenes.find((scene) => scene.projectId === secondProject.id);
    expect(secondProject.id).not.toBe(originalProjectId);
    expect(secondScene).toBeDefined();
    useWriterStore.getState().selectScene(secondScene!.id);
    expect(useWriterStore.getState().data.activeProjectId).toBe(secondProject.id);
    expect(useWriterStore.getState().data.activeSceneId).toBe(secondScene!.id);
  });

  it('switches whole books and keeps AI memory settings per book', () => {
    useWriterStore.getState().addProject('第二部', true);
    const data = useWriterStore.getState().data;
    const secondProject = data.projects.find((project) => project.name === '第二部');
    expect(secondProject?.aiMemoryEnabled).toBe(true);
    useWriterStore.getState().selectProject(data.projects[0].id);
    expect(useWriterStore.getState().data.activeProjectId).toBe(data.projects[0].id);
    expect(useWriterStore.getState().activeNav).toBe('writing');
    useWriterStore.getState().setProjectMemoryEnabled(data.projects[0].id, true);
    expect(useWriterStore.getState().data.projects[0].aiMemoryEnabled).toBe(true);
  });

  it('renames chapters and cycles their writing status', () => {
    const chapter = useWriterStore.getState().data.chapters[0];
    useWriterStore.getState().updateChapterTitle(chapter.id, '雨夜来客');
    useWriterStore.getState().cycleChapterStatus(chapter.id);
    const updated = useWriterStore.getState().data.chapters[0];
    expect(updated.title).toBe('雨夜来客');
    expect(updated.status).toBe('revising');
  });
  it('deletes writing entities and selects a safe fallback', () => {
    const data = useWriterStore.getState().data;
    const chapter = data.chapters[0];
    const scene = data.scenes.find((item) => item.chapterId === chapter.id)!;
    useWriterStore.getState().selectScene(scene.id);
    useWriterStore.getState().deleteScene(scene.id);
    expect(useWriterStore.getState().data.scenes.find((item) => item.id === scene.id)).toBeUndefined();
    expect(useWriterStore.getState().data.activeSceneId).not.toBe(scene.id);

    useWriterStore.getState().deleteChapter(chapter.id);
    expect(useWriterStore.getState().data.chapters.find((item) => item.id === chapter.id)).toBeUndefined();

    useWriterStore.getState().addCharacter('待删除人物');
    const character = useWriterStore.getState().data.characters[0];
    useWriterStore.getState().deleteCharacter(character.id);
    expect(useWriterStore.getState().data.characters).toHaveLength(0);
  });

  it('deletes a whole book and all of its dependent records', () => {
    useWriterStore.getState().addProject('待删除书', true);
    const project = useWriterStore.getState().data.projects.find((item) => item.name === '待删除书')!;
    useWriterStore.getState().addBibleCard('character', '临时人物');
    useWriterStore.getState().deleteProject(project.id);
    const data = useWriterStore.getState().data;
    expect(data.projects.find((item) => item.id === project.id)).toBeUndefined();
    expect(data.scenes.find((item) => item.projectId === project.id)).toBeUndefined();
    expect(data.bibleCards.find((item) => item.projectId === project.id)).toBeUndefined();
  });
  it('keeps outline data aligned with chapters and scenes', () => {
    useWriterStore.getState().addChapter();
    const data = useWriterStore.getState().data;
    const chapter = data.chapters[data.chapters.length - 1];
    const scene = data.scenes.find((item) => item.chapterId === chapter.id)!;
    expect(data.outlineItems.some((item) => item.entityType === 'chapter' && item.entityId === chapter.id)).toBe(true);
    expect(data.outlineItems.some((item) => item.entityType === 'scene' && item.entityId === scene.id)).toBe(true);

    useWriterStore.getState().upsertOutlineItem('chapter', chapter.id, {
      goal: '主角进入钟楼',
      conflict: '守卫封锁出口',
      status: 'writing',
    });
    const outline = useWriterStore.getState().data.outlineItems.find((item) => item.entityType === 'chapter' && item.entityId === chapter.id)!;
    expect(outline.goal).toBe('主角进入钟楼');
    expect(outline.status).toBe('writing');

    useWriterStore.getState().deleteChapter(chapter.id);
    expect(useWriterStore.getState().data.outlineItems.some((item) => item.entityId === chapter.id || item.entityId === scene.id)).toBe(false);
  });
  it('edits timeline events and foreshadow lifecycle', () => {
    useWriterStore.getState().addTimelineEvent();
    const event = useWriterStore.getState().data.timelineEvents[0];
    useWriterStore.getState().updateTimelineEvent(event.id, {
      title: '城门关闭',
      storyTime: '第一日 · 黄昏',
      status: 'canonical',
    });
    const updatedEvent = useWriterStore.getState().data.timelineEvents[0];
    expect(updatedEvent.title).toBe('城门关闭');
    expect(updatedEvent.status).toBe('canonical');

    useWriterStore.getState().addForeshadow('旧钥匙');
    const foreshadow = useWriterStore.getState().data.foreshadows[0];
    useWriterStore.getState().updateForeshadow(foreshadow.id, {
      status: 'resolved',
      plannedPayoff: '打开地窖',
    });
    const updatedForeshadow = useWriterStore.getState().data.foreshadows[0];
    expect(updatedForeshadow.status).toBe('resolved');
    expect(updatedForeshadow.plannedPayoff).toBe('打开地窖');
  });
});
