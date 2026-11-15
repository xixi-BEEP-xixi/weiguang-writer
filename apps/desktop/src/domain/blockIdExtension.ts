import { Extension } from '@tiptap/core';

const TYPES = ['paragraph', 'heading', 'blockquote', 'listItem', 'horizontalRule'];

export const BlockIdExtension = Extension.create({
  name: 'blockId',
  addGlobalAttributes() {
    return [{ types: TYPES, attributes: {
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id'),
        renderHTML: (attributes) => attributes.blockId ? { 'data-block-id': attributes.blockId } : {},
      },
      aiGenerated: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-ai-generated') === 'true',
        renderHTML: (attributes) => attributes.aiGenerated ? { 'data-ai-generated': 'true' } : {},
      },
      generationId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-generation-id'),
        renderHTML: (attributes) => attributes.generationId ? { 'data-generation-id': attributes.generationId } : {},
      },
    } }];
  },
});