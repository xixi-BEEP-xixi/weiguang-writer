// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildAiMemoryContext, clearAiOperations, getAiMemoryStats, markAiOperationInserted, saveAiOperation } from './aiMemoryStore';

describe('project AI memory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('isolates books, retrieves relevant operations and tracks insertion', async () => {
    const base = { scene_id: 'scene-a', chapter_id: 'chapter-a', model: 'test-model', created_at: new Date().toISOString() };
    await saveAiOperation({ ...base, id: 'op-1', project_id: 'book-a', operation: 'continue', instruction: '让沈砚发现旧钥匙', output: '沈砚在钟楼下发现了那把旧钥匙。', status: 'generated' });
    await saveAiOperation({ ...base, id: 'op-2', project_id: 'book-a', operation: 'outline', instruction: '安排码头追逐', output: '码头追逐与旧钥匙线索汇合。', status: 'generated' });
    await saveAiOperation({ ...base, id: 'op-3', project_id: 'book-b', operation: 'continue', instruction: '另一本书', output: '不应进入第一本书的记忆。', status: 'generated' });

    await markAiOperationInserted('book-a', 'op-1');
    const context = await buildAiMemoryContext('book-a', '旧钥匙接下来怎么用');
    expect(context).toContain('全书 AI 操作记忆');
    expect(context).toContain('沈砚');
    expect(context).not.toContain('另一本书');
    expect(context).not.toContain('不应进入');
    const stats = await getAiMemoryStats('book-a');
    expect(stats.total).toBe(2);
    expect(stats.inserted).toBe(1);

    await clearAiOperations('book-a');
    expect((await getAiMemoryStats('book-a')).total).toBe(0);
  });
});