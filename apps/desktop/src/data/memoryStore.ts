import Database from '@tauri-apps/plugin-sql';
import { isTauriRuntime } from './aiSettings';

export type MemoryKind = 'character' | 'relationship' | 'location' | 'item' | 'event' | 'foreshadow' | 'cognition' | 'rule';
export type MemoryStatus = 'candidate' | 'approved' | 'rejected' | 'superseded';

export interface MemoryItem {
  id: string;
  project_id: string;
  kind: MemoryKind;
  title: string;
  detail: string;
  status: MemoryStatus;
  confidence: number;
  source_scene_id: string | null;
  source_chapter_id: string | null;
  evidence_block_id: string | null;
  evidence: string;
  memory_key: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryCandidateInput {
  kind: MemoryKind;
  title: string;
  detail: string;
  confidence?: number;
  evidence?: string;
}

export interface MemoryStats {
  total: number;
  candidates: number;
  approved: number;
  rejected: number;
}

const DB_URL = 'sqlite:changye-writer.db';
const FALLBACK_KEY = 'weiguang.memory.items.v1';
const MEMORY_KINDS: MemoryKind[] = ['character', 'relationship', 'location', 'item', 'event', 'foreshadow', 'cognition', 'rule'];
let databasePromise: Promise<Database> | null = null;
let schemaReady = false;

async function db(): Promise<Database> {
  if (!databasePromise) databasePromise = Database.load(DB_URL);
  const database = await databasePromise;
  if (!schemaReady) {
    await database.execute(`CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      source_scene_id TEXT NULL,
      source_chapter_id TEXT NULL,
      evidence_block_id TEXT NULL,
      evidence TEXT NOT NULL,
      memory_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await database.execute('CREATE UNIQUE INDEX IF NOT EXISTS memory_items_project_key ON memory_items(project_id, memory_key)');
    await database.execute('CREATE INDEX IF NOT EXISTS memory_items_project_status ON memory_items(project_id, status, updated_at DESC)');
    schemaReady = true;
  }
  return database;
}

function readFallback(): MemoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as MemoryItem[] : [];
  } catch {
    return [];
  }
}

function writeFallback(items: MemoryItem[]): void {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(items.slice(0, 2500)));
}

function normalizeKind(value: unknown): MemoryKind {
  return MEMORY_KINDS.includes(value as MemoryKind) ? value as MemoryKind : 'event';
}

function memoryKey(kind: MemoryKind, title: string, detail: string): string {
  return `${kind}:${title.trim().toLocaleLowerCase()}::${detail.trim().toLocaleLowerCase()}`;
}

export async function listMemoryItems(projectId: string, statuses?: MemoryStatus[]): Promise<MemoryItem[]> {
  if (!isTauriRuntime()) {
    return readFallback()
      .filter((item) => item.project_id === projectId && (!statuses?.length || statuses.includes(item.status)))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const database = await db();
  if (statuses?.length) {
    const placeholders = statuses.map((_, index) => `$${index + 2}`).join(', ');
    return database.select<MemoryItem[]>(
      `SELECT * FROM memory_items WHERE project_id = $1 AND status IN (${placeholders}) ORDER BY updated_at DESC`,
      [projectId, ...statuses],
    );
  }
  return database.select<MemoryItem[]>('SELECT * FROM memory_items WHERE project_id = $1 ORDER BY updated_at DESC', [projectId]);
}

export async function addMemoryCandidates(
  projectId: string,
  sceneId: string,
  chapterId: string,
  candidates: MemoryCandidateInput[],
): Promise<MemoryItem[]> {
  const now = new Date().toISOString();
  const items: MemoryItem[] = [];
  for (const candidate of candidates) {
    const title = String(candidate.title ?? '').trim().slice(0, 180);
    const detail = String(candidate.detail ?? '').trim().slice(0, 2400);
    if (!title || !detail) continue;
    const kind = normalizeKind(candidate.kind);
    items.push({
      id: String(crypto.randomUUID()),
      project_id: projectId,
      kind,
      title,
      detail,
      status: 'candidate',
      confidence: Math.min(1, Math.max(0, Number(candidate.confidence ?? 0.65))),
      source_scene_id: sceneId || null,
      source_chapter_id: chapterId || null,
      evidence_block_id: null,
      evidence: String(candidate.evidence ?? '').trim().slice(0, 500),
      memory_key: memoryKey(kind, title, detail),
      created_at: now,
      updated_at: now,
    });
  }

  if (items.length === 0) return [];
  if (!isTauriRuntime()) {
    const existing = readFallback();
    const keys = new Set(existing.map((item) => `${item.project_id}:${item.memory_key}`));
    const fresh = items.filter((item) => !keys.has(`${item.project_id}:${item.memory_key}`));
    writeFallback([...fresh, ...existing]);
    return fresh;
  }

  const database = await db();
  const fresh: MemoryItem[] = [];
  for (const item of items) {
    const result = await database.execute(
      `INSERT OR IGNORE INTO memory_items
       (id, project_id, kind, title, detail, status, confidence, source_scene_id, source_chapter_id, evidence_block_id, evidence, memory_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [item.id, item.project_id, item.kind, item.title, item.detail, item.status, item.confidence, item.source_scene_id, item.source_chapter_id, item.evidence_block_id, item.evidence, item.memory_key, item.created_at, item.updated_at],
    );
    if (Number((result as { rowsAffected?: number }).rowsAffected ?? 0) > 0) fresh.push(item);
  }
  return fresh;
}

export async function setMemoryItemStatus(projectId: string, itemId: string, status: MemoryStatus): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (!isTauriRuntime()) {
    writeFallback(readFallback().map((item) => item.project_id === projectId && item.id === itemId ? { ...item, status, updated_at: updatedAt } : item));
    return;
  }
  await (await db()).execute('UPDATE memory_items SET status = $1, updated_at = $2 WHERE project_id = $3 AND id = $4', [status, updatedAt, projectId, itemId]);
}

export async function updateMemoryEvidenceBlock(projectId: string, itemId: string, blockId: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallback(readFallback().map((item) => item.project_id === projectId && item.id === itemId ? { ...item, evidence_block_id: blockId } : item));
    return;
  }
  await (await db()).execute('UPDATE memory_items SET evidence_block_id = $1 WHERE project_id = $2 AND id = $3', [blockId, projectId, itemId]);
}

export async function deleteMemoryItem(projectId: string, itemId: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallback(readFallback().filter((item) => !(item.project_id === projectId && item.id === itemId)));
    return;
  }
  await (await db()).execute('DELETE FROM memory_items WHERE project_id = $1 AND id = $2', [projectId, itemId]);
}

export async function clearProjectMemory(projectId: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallback(readFallback().filter((item) => item.project_id !== projectId));
    return;
  }
  await (await db()).execute('DELETE FROM memory_items WHERE project_id = $1', [projectId]);
}

export async function replaceProjectMemory(projectId: string, items: MemoryItem[]): Promise<void> {
  const normalized = items
    .filter((item) => item && item.project_id === projectId && item.title?.trim() && item.detail?.trim())
    .map((item) => ({ ...item, project_id: projectId, id: String(item.id || crypto.randomUUID()) }));
  if (!isTauriRuntime()) {
    writeFallback([...normalized, ...readFallback().filter((item) => item.project_id !== projectId)]);
    return;
  }
  const database = await db();
  await database.execute('DELETE FROM memory_items WHERE project_id = $1', [projectId]);
  for (const item of normalized) {
    await database.execute(
      `INSERT OR REPLACE INTO memory_items
       (id, project_id, kind, title, detail, status, confidence, source_scene_id, source_chapter_id, evidence_block_id, evidence, memory_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [item.id, item.project_id, item.kind, item.title, item.detail, item.status, item.confidence, item.source_scene_id, item.source_chapter_id, item.evidence_block_id, item.evidence, item.memory_key, item.created_at, item.updated_at],
    );
  }
}
export async function getMemoryStats(projectId: string): Promise<MemoryStats> {
  const items = await listMemoryItems(projectId);
  return {
    total: items.length,
    candidates: items.filter((item) => item.status === 'candidate').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected' || item.status === 'superseded').length,
  };
}

function keywords(query: string): string[] {
  const normalized = query.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const raw = normalized.match(/[\p{Script=Han}]{2,}|[a-z0-9_-]{2,}/gu) ?? [];
  const result = new Set<string>();
  for (const segment of raw) {
    result.add(segment.slice(0, 32));
    if (segment.length > 4 && /^[\p{Script=Han}]+$/u.test(segment)) {
      for (let index = 0; index < segment.length - 1; index += 2) result.add(segment.slice(index, index + 2));
    }
  }
  return [...result].slice(0, 28);
}

export async function buildApprovedMemoryContext(projectId: string, query: string, maxChars = 5200): Promise<string> {
  const items = (await listMemoryItems(projectId, ['approved'])).slice(0, 400);
  if (items.length === 0) return '';
  const terms = keywords(query);
  const scored = items.map((item) => {
    const haystack = `${item.title}\n${item.detail}\n${item.evidence}`.toLocaleLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    return { item, score };
  }).sort((a, b) => b.score - a.score || b.item.updated_at.localeCompare(a.item.updated_at));
  const selected = scored.filter((entry) => entry.score > 0).slice(0, 18);
  const fallback = scored.slice(0, 6);
  const unique = [...selected, ...fallback].filter((entry, index, list) => list.findIndex((candidate) => candidate.item.id === entry.item.id) === index);
  const lines = unique.map(({ item }) => {
    const evidence = item.evidence ? `；原文证据：${item.evidence}` : '';
    return `- [${item.kind}] ${item.title}：${item.detail}${evidence}`;
  });
  const text = ['【作者已确认的长期记忆】', '以下内容是作者确认过的创作事实。若与当前正文冲突，应先指出冲突，不得擅自改写。', ...lines].join('\n');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n（长期记忆已按上下文预算截断）`;
}