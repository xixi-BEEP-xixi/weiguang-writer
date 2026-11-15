import type { JSONContent } from '@tiptap/core';
import { collectPlainText } from '../domain/blocks';
import type { Scene, WorkspaceData } from '../domain/types';

export interface AIContextPack {
  scene_snapshot: { doc_json: JSONContent; content_hash: string };
  selection: { block_start_id: string; block_end_id: string; text: string } | null;
  nearby_text: string;
  story_cards: Array<{
    type: string;
    id: string;
    name: string;
    summary: string;
    details: string;
  }>;
  foreshadows: Array<{ id: string; title: string; status: string }>;
  timeline_events: Array<{ id: string; title: string; description: string; story_time: string; status: string }>;
  token_budget: { input: number; output: number };
}

export type AIOperation = 'continue' | 'rewrite' | 'outline' | 'character' | 'ask';

function hashDocument(document: JSONContent): string {
  const text = JSON.stringify(document);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildContextPack(
  data: WorkspaceData,
  scene: Scene,
  selectionText = '',
  blockStartId = '',
  blockEndId = '',
): AIContextPack {
  const bibleCards = data.bibleCards
    .filter((card) => card.projectId === scene.projectId)
    .slice(0, 24)
    .map((card) => ({
      type: card.kind,
      id: card.id,
      name: card.name,
      summary: card.summary,
      details: card.aliases.length ? `${card.details}\n别名：${card.aliases.join('、')}` : card.details,
    }));
  const legacyCharacters = data.characters
    .filter((character) => character.projectId === scene.projectId)
    .map((character) => ({
      type: 'character',
      id: character.id,
      name: character.name,
      summary: character.role,
      details: character.notes,
    }));
  const chapterScenes = data.scenes
    .filter((item) => item.chapterId === scene.chapterId)
    .sort((a, b) => a.sort - b.sort);
  const sceneIndex = chapterScenes.findIndex((item) => item.id === scene.id);
  const previousScene = sceneIndex > 0 ? chapterScenes[sceneIndex - 1] : null;
  const nextScene = sceneIndex >= 0 && sceneIndex < chapterScenes.length - 1 ? chapterScenes[sceneIndex + 1] : null;
  const previousTail = previousScene ? collectPlainText(previousScene.doc).trim().slice(-1800) : '';
  const nextHead = nextScene ? collectPlainText(nextScene.doc).trim().slice(0, 900) : '';
  const nearbyText = [
    previousTail ? `【上一场景结尾】\n${previousTail}` : '',
    nextHead ? `【下一场景开头】\n${nextHead}` : '',
  ].filter(Boolean).join('\n\n');
  const timelineEvents = data.timelineEvents
    .filter((item) => item.projectId === scene.projectId && (!item.chapterId || item.chapterId === scene.chapterId))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 24)
    .map((item) => ({ id: item.id, title: item.title, description: item.description, story_time: item.storyTime, status: item.status }));
  return {
    scene_snapshot: {
      doc_json: scene.doc,
      content_hash: hashDocument(scene.doc),
    },
    selection: selectionText.trim()
      ? { block_start_id: blockStartId, block_end_id: blockEndId, text: selectionText.slice(0, 12_000) }
      : null,
    nearby_text: nearbyText,
    story_cards: [...bibleCards, ...legacyCharacters].slice(0, 30),
    foreshadows: data.foreshadows
      .filter((item) => item.projectId === scene.projectId)
      .slice(0, 60)
      .map((item) => ({ id: item.id, title: item.title, status: item.status })),
    timeline_events: timelineEvents,
    token_budget: { input: 8000, output: 2000 },
  };
}