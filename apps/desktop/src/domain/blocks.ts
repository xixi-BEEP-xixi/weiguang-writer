import type { JSONContent } from '@tiptap/core';
import { createId } from './ids';

const LOCATABLE_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'listItem', 'horizontalRule', 'sceneMarker']);

export function ensureBlockIds(node: JSONContent): JSONContent {
  const next: JSONContent = { ...node };
  if (node.attrs || LOCATABLE_TYPES.has(node.type ?? '')) {
    next.attrs = { ...(node.attrs ?? {}) };
    if (!next.attrs.blockId) next.attrs.blockId = createId();
  }
  if (node.content) {
    next.content = node.content.map((child) => ensureBlockIds(child));
  }
  return next;
}

export function collectPlainText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';
  return node.content.map((child) => collectPlainText(child)).join('');
}