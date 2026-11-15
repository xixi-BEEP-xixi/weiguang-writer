import type { JSONContent } from '@tiptap/core';
import { deleteSceneVersionRow, getSceneVersionRow, insertSceneVersionRow, listSceneVersionRows, type SceneVersionRow } from './localArtifactStore';

export interface SceneVersionSummary {
  id: string; project_id: string; scene_id: string; label: string; content_hash: string;
  word_count: number; restored_from: string | null; created_at: string; preview: string; deduplicated?: boolean;
}

export interface SceneVersionDetail extends SceneVersionSummary { doc_json: JSONContent; }

function collectText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const value = node as { type?: string; text?: string; content?: unknown[] };
  if (value.type === 'text') return value.text ?? '';
  if (!Array.isArray(value.content)) return '';
  return value.content.map(collectText).join('');
}

function hashDocument(document: JSONContent): string {
  const text = JSON.stringify(document);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function summary(row: SceneVersionRow): SceneVersionSummary {
  const { doc_json: _doc, ...rest } = row;
  return rest;
}

function detail(row: SceneVersionRow): SceneVersionDetail {
  return { ...summary(row), doc_json: JSON.parse(row.doc_json) as JSONContent };
}

export async function listSceneVersions(_projectId: string, sceneId: string): Promise<SceneVersionSummary[]> {
  return (await listSceneVersionRows(sceneId)).map(summary);
}

export async function createSceneVersion(projectId: string, sceneId: string, docJson: JSONContent,
                                         label: string, restoredFrom: string | null = null): Promise<SceneVersionSummary> {
  const contentHash = hashDocument(docJson);
  const existing = (await listSceneVersionRows(sceneId)).find((version) => version.content_hash === contentHash && version.label === label);
  if (existing) return { ...summary(existing), deduplicated: true };
  const text = collectText(docJson).trim();
  const row: SceneVersionRow = {
    id: crypto.randomUUID(), project_id: projectId, scene_id: sceneId, label,
    content_hash: contentHash, word_count: text.replace(/\s/g, '').length,
    restored_from: restoredFrom, created_at: new Date().toISOString(),
    preview: text.slice(0, 180), doc_json: JSON.stringify(docJson),
  };
  await insertSceneVersionRow(row);
  return summary(row);
}

export async function getSceneVersion(_projectId: string, sceneId: string, versionId: string): Promise<SceneVersionDetail> {
  const row = await getSceneVersionRow(sceneId, versionId);
  if (!row) throw new Error('本地版本不存在');
  return detail(row);
}

export async function deleteSceneVersion(_projectId: string, sceneId: string, versionId: string): Promise<void> {
  await deleteSceneVersionRow(sceneId, versionId);
}