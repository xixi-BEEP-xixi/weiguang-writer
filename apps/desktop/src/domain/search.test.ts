import { describe, expect, it } from 'vitest';
import { createInitialWorkspace, createProjectBundle } from './defaults';
import { searchWorkspaceScenes } from './search';

describe('cross-project full-text search', () => {
  it('returns matching scenes from every project with their project label', () => {
    const data = createInitialWorkspace();
    const first = data.scenes[0];
    first.doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '雾港里藏着旧钥匙' }] }] };
    const bundle = createProjectBundle('第二部');
    bundle.scene.doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '另一把旧钥匙出现在钟楼' }] }] };
    data.projects.push(bundle.project);
    data.volumes.push(bundle.volume);
    data.chapters.push(bundle.chapter);
    data.scenes.push(bundle.scene);

    const results = searchWorkspaceScenes(data, '旧钥匙');
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.project.name)).toContain('第二部');
    expect(results[1].snippet).toContain('旧钥匙');
  });
});
