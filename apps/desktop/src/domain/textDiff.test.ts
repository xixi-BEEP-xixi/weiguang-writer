import { describe, expect, it } from 'vitest';
import { diffParagraphs, textToParagraphs } from './textDiff';

describe('text diff', () => {
  it('splits paragraphs and marks replacements', () => {
    const before = textToParagraphs('第一段。\n第二段。');
    const after = textToParagraphs('第一段。\n第二段改写。');
    expect(before).toEqual(['第一段。', '第二段。']);
    expect(diffParagraphs(before, after)).toEqual([
      { kind: 'same', text: '第一段。' },
      { kind: 'removed', text: '第二段。' },
      { kind: 'added', text: '第二段改写。' },
    ]);
  });
});