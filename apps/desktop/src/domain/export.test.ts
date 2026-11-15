import { describe, expect, it } from 'vitest';
import { projectToTxt } from './export';
import type { WorkspaceData } from './types';

describe('TXT export', () => {
  it('exports volume, chapter and scene text in order', () => {
    const data: WorkspaceData = {
      schemaVersion: 3,
      activeProjectId: 'p1',
      activeSceneId: 's1',
      projects: [],
      volumes: [{ id: 'v1', projectId: 'p1', title: '第一卷', sort: 1, goalWords: 0, rev: 1, createdAt: '', updatedAt: '' }],
      chapters: [{ id: 'c1', projectId: 'p1', volumeId: 'v1', title: '第一章', sort: 1, status: 'draft', defaultSceneId: 's1', rev: 1, createdAt: '', updatedAt: '' }],
      scenes: [{
        id: 's1', projectId: 'p1', chapterId: 'c1', title: '正文', sort: 1, status: 'draft',
        wordCount: 4, rev: 1, createdAt: '', updatedAt: '',
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '雨夜。' }] }] },
      }],
      characters: [],
      bibleCards: [],
      timelineEvents: [],
      foreshadows: [],
      outlineItems: [],
    };
    const text = projectToTxt(data, 'p1');
    expect(text).toContain('第一卷');
    expect(text).toContain('第一章');
    expect(text).toContain('雨夜。');
  });
});