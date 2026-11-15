import { describe, expect, it } from 'vitest';
import { countCharacters, countDocumentCharacters } from './wordCount';
import type { JSONContent } from '@tiptap/core';

describe('word count', () => {
  it('counts Chinese characters while ignoring whitespace', () => {
    expect(countCharacters('雨落在 青石板上\n天亮了')).toBe(10);
  });

  it('counts characters recursively through a TipTap document', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '第一段' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '第二段' }] },
      ],
    };
    expect(countDocumentCharacters(doc)).toBe(6);
  });
});