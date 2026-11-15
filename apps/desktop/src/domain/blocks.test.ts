import { describe, expect, it } from 'vitest';
import { ensureBlockIds } from './blocks';
import { createId, isId } from './ids';
import type { JSONContent } from '@tiptap/core';

describe('block IDs', () => {
  it('assigns and preserves stable block IDs', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '雨夜' }] }],
    };
    const first = ensureBlockIds(doc);
    const second = ensureBlockIds(first);
    const id = first.content?.[0]?.attrs?.blockId;
    expect(id).toBeTruthy();
    expect(second.content?.[0]?.attrs?.blockId).toBe(id);
  });
});

describe('ULID-like IDs', () => {
  it('creates sortable 26 character IDs', () => {
    const early = createId(1_000_000);
    const later = createId(2_000_000);
    expect(early).toHaveLength(26);
    expect(later).toHaveLength(26);
    expect(isId(early)).toBe(true);
    expect(early < later).toBe(true);
  });
});