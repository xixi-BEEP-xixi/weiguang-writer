import Database from '@tauri-apps/plugin-sql';
import { isTauriRuntime } from './aiSettings';

export type AiOperationStatus = 'generated' | 'inserted' | 'dismissed' | 'report';

export interface AiOperationRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  chapter_id: string | null;
  operation: string;
  instruction: string;
  output: string;
  status: AiOperationStatus;
  model: string;
  created_at: string;
}

export interface AiMemoryStats {
  total: number;
  inserted: number;
  generated: number;
  lastCreatedAt: string | null;
}

const DB_URL = 'sqlite:changye-writer.db';
const FALLBACK_KEY = 'weiguang.ai-memory.sqlite-fallback.v1';
let databasePromise: Promise<Database> | null = null;
let schemaReady = false;

async function db(): Promise<Database> {
  if (!databasePromise) databasePromise = Database.load(DB_URL);
  const database = await databasePromise;
  if (!schemaReady) {
    await database.execute(`CREATE TABLE IF NOT EXISTS ai_operations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      scene_id TEXT NULL,
      chapter_id TEXT NULL,
      operation TEXT NOT NULL,
      instruction TEXT NOT NULL,
      output TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    await database.execute('CREATE INDEX IF NOT EXISTS ai_operations_project_created ON ai_operations(project_id, created_at DESC)');
    schemaReady = true;
  }
  return database;
}

function readFallback(): AiOperationRow[] {
  try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? '[]') as AiOperationRow[]; } catch { return []; }
}

function writeFallback(rows: AiOperationRow[]): void {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(rows.slice(-1500)));
}

export async function saveAiOperation(row: AiOperationRow): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallback([...readFallback().filter((item) => item.id !== row.id), row]);
    return;
  }
  const database = await db();
  await database.execute(
    `INSERT OR REPLACE INTO ai_operations
      (id, project_id, scene_id, chapter_id, operation, instruction, output, status, model, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [row.id, row.project_id, row.scene_id, row.chapter_id, row.operation, row.instruction, row.output, row.status, row.model, row.created_at],
  );
}

export async function listAiOperations(projectId: string): Promise<AiOperationRow[]> {
  if (!isTauriRuntime()) {
    return readFallback().filter((item) => item.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return (await db()).select<AiOperationRow[]>(
    'SELECT * FROM ai_operations WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId],
  );
}

export async function markAiOperationInserted(projectId: string, operationId: string): Promise<void> {
  if (!operationId) return;
  if (!isTauriRuntime()) {
    const rows = readFallback().map((item) => item.project_id === projectId && item.id === operationId
      ? { ...item, status: 'inserted' as const }
      : item);
    writeFallback(rows);
    return;
  }
  await (await db()).execute(
    "UPDATE ai_operations SET status = 'inserted' WHERE id = $1 AND project_id = $2",
    [operationId, projectId],
  );
}

export async function clearAiOperations(projectId: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallback(readFallback().filter((item) => item.project_id !== projectId));
    return;
  }
  await (await db()).execute('DELETE FROM ai_operations WHERE project_id = $1', [projectId]);
}

export async function getAiMemoryStats(projectId: string): Promise<AiMemoryStats> {
  const rows = await listAiOperations(projectId);
  return {
    total: rows.length,
    inserted: rows.filter((row) => row.status === 'inserted').length,
    generated: rows.filter((row) => row.status === 'generated').length,
    lastCreatedAt: rows[0]?.created_at ?? null,
  };
}

function queryKeywords(query: string): string[] {
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const segments = normalized.match(/[\p{Script=Han}]{2,}|[a-z0-9_-]{2,}/gu) ?? [];
  const keywords = new Set<string>();
  for (const segment of segments) {
    keywords.add(segment.slice(0, 24));
    if (segment.length > 4 && /^[\p{Script=Han}]+$/u.test(segment)) {
      for (let index = 0; index < segment.length - 1; index += 2) keywords.add(segment.slice(index, index + 2));
    }
  }
  return [...keywords].slice(0, 24);
}

function scoreOperation(row: AiOperationRow, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const instruction = row.instruction.toLowerCase();
  const output = row.output.toLowerCase();
  return keywords.reduce((score, keyword) => score + (instruction.includes(keyword) ? 3 : 0) + (output.includes(keyword) ? 1 : 0), 0);
}

function excerpt(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}……`;
}

export async function buildAiMemoryContext(projectId: string, query: string, maxChars = 4200): Promise<string> {
  const allRows = await listAiOperations(projectId);
  const rows = allRows.filter((row) => row.status === 'inserted' || row.status === 'report');
  if (rows.length === 0) return '';
  const keywords = queryKeywords(query);
  const relevant = rows
    .map((row) => ({ row, score: scoreOperation(row, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.row.created_at.localeCompare(a.row.created_at))
    .slice(0, 6)
    .map((item) => item.row);
  const recent = rows.slice(0, 4);
  const compactIndex = rows.slice(0, 60).map((row) => {
    const when = row.created_at.slice(0, 10);
    return `- ${when} [${row.operation}/${row.status}] ${excerpt(row.instruction || '无额外要求', 60)} → ${excerpt(row.output, 80)}`;
  }).join('\n');

  const parts = [
    '【全书 AI 操作记忆】',
    `此书共记录 ${rows.length} 次 AI 操作。以下内容是历史建议，不一定已进入正文；必须以当前正文、故事圣经和作者本次要求为事实基准。`,
    `已插入正文的操作：${rows.filter((row) => row.status === 'inserted').length} 次。`,
    '\n【操作总览（近期）】',
    compactIndex,
  ];
  if (relevant.length > 0) {
    parts.push('\n【与本次任务相关的历史操作】');
    for (const row of relevant) {
      parts.push(`- [${row.operation}/${row.status}] 要求：${excerpt(row.instruction, 180)}\n  结果摘要：${excerpt(row.output, 650)}`);
    }
  }
  if (recent.length > 0) {
    parts.push('\n【最近操作】');
    for (const row of recent) {
      parts.push(`- [${row.operation}/${row.status}] ${excerpt(row.instruction, 140)}\n  ${excerpt(row.output, 700)}`);
    }
  }
  const text = parts.join('\n');
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n（记忆摘要已按上下文预算截断）`;
}