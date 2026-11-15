import type { JSONContent } from '@tiptap/core';
import { collectPlainText } from './blocks';

export function countCharacters(text: string): number {
  return Array.from(text.replace(/\s/g, '')).length;
}

export function countDocumentCharacters(doc: JSONContent): number {
  return countCharacters(collectPlainText(doc));
}