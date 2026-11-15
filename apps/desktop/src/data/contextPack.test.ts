import { describe, expect, it } from 'vitest';
import { createInitialWorkspace } from '../domain/defaults';
import { buildContextPack } from './contextPack';

describe('AI context pack', () => {
  it('contains current scene, selected block and project story context', () => {
    const data = createInitialWorkspace();
    const scene = data.scenes[0];
    data.bibleCards.push({
      id: 'card-1',
      projectId: data.activeProjectId,
      kind: 'character',
      name: '林晚',
      aliases: ['小晚'],
      summary: '追查旧案的人。年龄：17',
      details: '',
      tags: [],
      rev: 1,
      createdAt: '',
      updatedAt: '',
    });
    data.foreshadows.push({
      id: 'f-1',
      projectId: data.activeProjectId,
      title: '旧钥匙',
      description: '',
      plantedChapterId: null,
      resolvedChapterId: null,
      plannedPayoff: '',
      status: 'active',
      rev: 1,
      createdAt: '',
      updatedAt: '',
    });
    const pack = buildContextPack(data, scene, '雨夜。', 'block-1', 'block-2');
    expect(pack.scene_snapshot.doc_json).toBe(scene.doc);
    expect(pack.scene_snapshot.content_hash).toMatch(/^[0-9a-f]{8}$/);
    expect(pack.selection?.text).toBe('雨夜。');
    expect(pack.story_cards[0].name).toBe('林晚');
    expect(pack.story_cards[0].details).toContain('小晚');
    expect(pack.foreshadows[0].title).toBe('旧钥匙');
    expect(pack.token_budget).toEqual({ input: 8000, output: 2000 });
  });
});