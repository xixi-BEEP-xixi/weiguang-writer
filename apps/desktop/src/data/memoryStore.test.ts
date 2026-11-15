// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMemoryCandidates,
  buildApprovedMemoryContext,
  clearProjectMemory,
  getMemoryStats,
  listMemoryItems,
  setMemoryItemStatus,
} from './memoryStore';

describe('structured long-term memory', () => {
  beforeEach(() => { localStorage.clear(); });

  it('deduplicates candidates and only injects approved memory into AI context', async () => {
    const added = await addMemoryCandidates('p1', 's1', 'c1', [
      { kind: 'character', title: '林晚', detail: '左臂有旧伤', confidence: 0.9, evidence: '雨水顺着她的左臂流下。' },
    ]);
    expect(added).toHaveLength(1);
    const duplicate = await addMemoryCandidates('p1', 's1', 'c1', [
      { kind: 'character', title: '林晚', detail: '左臂有旧伤', confidence: 0.9 },
    ]);
    expect(duplicate).toHaveLength(0);
    expect((await getMemoryStats('p1')).candidates).toBe(1);

    const before = await buildApprovedMemoryContext('p1', '林晚的伤');
    expect(before).toBe('');

    await setMemoryItemStatus('p1', added[0].id, 'approved');
    const items = await listMemoryItems('p1', ['approved']);
    expect(items).toHaveLength(1);
    const context = await buildApprovedMemoryContext('p1', '林晚的伤');
    expect(context).toContain('作者已确认的长期记忆');
    expect(context).toContain('左臂有旧伤');
  });

  it('clears only the selected project memory', async () => {
    await addMemoryCandidates('p1', 's1', 'c1', [{ kind: 'event', title: '雨夜', detail: '城门在雨夜关闭。' }]);
    await addMemoryCandidates('p2', 's2', 'c2', [{ kind: 'event', title: '清晨', detail: '队伍在清晨出发。' }]);
    await clearProjectMemory('p1');
    expect(await listMemoryItems('p1')).toHaveLength(0);
    expect(await listMemoryItems('p2')).toHaveLength(1);
  });
});