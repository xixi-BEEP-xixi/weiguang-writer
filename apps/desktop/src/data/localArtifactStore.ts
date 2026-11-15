import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { isTauriRuntime } from './aiSettings';

export interface SceneVersionRow {
  id: string;
  project_id: string;
  scene_id: string;
  label: string;
  content_hash: string;
  word_count: number;
  restored_from: string | null;
  created_at: string;
  preview: string;
  doc_json: string;
}

export interface StoredAnalysisReport {
  id: string;
  kind: string;
  source: string;
  text: string;
  created_at: string;
}

const DB_URL = 'sqlite:changye-writer.db';
const VERSIONS_FALLBACK = 'weiguang.versions.sqlite-fallback.v1';
const REPORTS_FALLBACK = 'weiguang.reports.sqlite-fallback.v1';
let databasePromise: Promise<Database> | null = null;
let schemaReady = false;

async function db(): Promise<Database> {
  if (!databasePromise) databasePromise = Database.load(DB_URL);
  const database = await databasePromise;
  if (!schemaReady) {
    await database.execute('PRAGMA busy_timeout = 5000');
    await database.execute(`CREATE TABLE IF NOT EXISTS scene_versions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, scene_id TEXT NOT NULL, label TEXT NOT NULL,
      content_hash TEXT NOT NULL, word_count INTEGER NOT NULL, restored_from TEXT NULL,
      created_at TEXT NOT NULL, preview TEXT NOT NULL, doc_json TEXT NOT NULL
    )`);
    await database.execute(`CREATE TABLE IF NOT EXISTS analysis_reports (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, source TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
    )`);
    await database.execute('CREATE INDEX IF NOT EXISTS scene_versions_scene_created ON scene_versions(scene_id, created_at DESC)');
    await database.execute('CREATE INDEX IF NOT EXISTS analysis_reports_kind_created ON analysis_reports(kind, created_at DESC)');
    schemaReady = true;
  }
  return database;
}

function readFallbackVersions(): SceneVersionRow[] {
  try { return JSON.parse(localStorage.getItem(VERSIONS_FALLBACK) ?? '[]') as SceneVersionRow[]; } catch { return []; }
}

function writeFallbackVersions(rows: SceneVersionRow[]): void {
  localStorage.setItem(VERSIONS_FALLBACK, JSON.stringify(rows.slice(0, 200)));
}

function readFallbackReports(): StoredAnalysisReport[] {
  try { return JSON.parse(localStorage.getItem(REPORTS_FALLBACK) ?? '[]') as StoredAnalysisReport[]; } catch { return []; }
}

function writeFallbackReports(rows: StoredAnalysisReport[]): void {
  localStorage.setItem(REPORTS_FALLBACK, JSON.stringify(rows.slice(0, 50)));
}

export async function listSceneVersionRows(sceneId: string): Promise<SceneVersionRow[]> {
  if (!isTauriRuntime()) return readFallbackVersions().filter((row) => row.scene_id === sceneId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const result = await (await db()).select<SceneVersionRow[]>('SELECT * FROM scene_versions WHERE scene_id = $1 ORDER BY created_at DESC LIMIT 40', [sceneId]);
  return result;
}

export async function listAllSceneVersionRows(projectId: string): Promise<SceneVersionRow[]> {
  if (!isTauriRuntime()) return readFallbackVersions().filter((row) => row.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (await db()).select<SceneVersionRow[]>('SELECT * FROM scene_versions WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
}

export async function replaceProjectSceneVersions(projectId: string, rows: SceneVersionRow[]): Promise<void> {
  const normalized = rows.filter((row) => row.project_id === projectId);
  if (!isTauriRuntime()) {
    writeFallbackVersions([...normalized, ...readFallbackVersions().filter((row) => row.project_id !== projectId)]);
    return;
  }
  const database = await db();
  await database.execute('DELETE FROM scene_versions WHERE project_id = $1', [projectId]);
  for (const row of normalized) {
    await database.execute(
      `INSERT OR REPLACE INTO scene_versions
       (id, project_id, scene_id, label, content_hash, word_count, restored_from, created_at, preview, doc_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.id, row.project_id, row.scene_id, row.label, row.content_hash, row.word_count, row.restored_from, row.created_at, row.preview, row.doc_json],
    );
  }
}

export async function getSceneVersionRow(sceneId: string, versionId: string): Promise<SceneVersionRow | null> {
  if (!isTauriRuntime()) return readFallbackVersions().find((row) => row.scene_id === sceneId && row.id === versionId) ?? null;
  const rows = await (await db()).select<SceneVersionRow[]>('SELECT * FROM scene_versions WHERE id = $1 AND scene_id = $2 LIMIT 1', [versionId, sceneId]);
  return rows[0] ?? null;
}

export async function insertSceneVersionRow(row: SceneVersionRow): Promise<void> {
  if (!isTauriRuntime()) {
    const rows = readFallbackVersions().filter((item) => !(item.scene_id === row.scene_id && item.content_hash === row.content_hash && item.label === row.label));
    rows.unshift(row);
    writeFallbackVersions(rows);
    return;
  }
  const database = await db();
  await database.execute(
    `INSERT INTO scene_versions (id, project_id, scene_id, label, content_hash, word_count, restored_from, created_at, preview, doc_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [row.id, row.project_id, row.scene_id, row.label, row.content_hash, row.word_count, row.restored_from, row.created_at, row.preview, row.doc_json],
  );
  await database.execute(`DELETE FROM scene_versions WHERE scene_id = $1 AND id NOT IN (
    SELECT id FROM scene_versions WHERE scene_id = $1 ORDER BY created_at DESC LIMIT 40
  )`, [row.scene_id]);
}

export async function deleteSceneVersionRow(sceneId: string, versionId: string): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallbackVersions(readFallbackVersions().filter((row) => !(row.scene_id === sceneId && row.id === versionId)));
    return;
  }
  await (await db()).execute('DELETE FROM scene_versions WHERE id = $1 AND scene_id = $2', [versionId, sceneId]);
}

async function retryDatabase<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (!/locked|busy/i.test(String(error)) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function saveAnalysisReport(kind: string, source: string, text: string): Promise<StoredAnalysisReport> {
  const report: StoredAnalysisReport = { id: crypto.randomUUID(), kind, source, text, created_at: new Date().toISOString() };
  const saveFallback = () => writeFallbackReports([report, ...readFallbackReports().filter((row) => row.kind !== kind)]);
  if (!isTauriRuntime()) {
    saveFallback();
    return report;
  }
  try {
    const database = await db();
    await retryDatabase(async () => {
      await database.execute('INSERT INTO analysis_reports (id, kind, source, text, created_at) VALUES ($1, $2, $3, $4, $5)', [report.id, kind, source, text, report.created_at]);
      await database.execute(`DELETE FROM analysis_reports WHERE kind = $1 AND id NOT IN (
        SELECT id FROM analysis_reports WHERE kind = $1 ORDER BY created_at DESC LIMIT 10
      )`, [kind]);
    });
    return report;
  } catch (error) {
    // Never discard a completed report just because another app instance is
    // holding a brief SQLite write lock.
    if (/locked|busy|database/i.test(String(error))) {
      saveFallback();
      return report;
    }
    throw error;
  }
}

export async function listAllAnalysisReports(): Promise<StoredAnalysisReport[]> {
  if (!isTauriRuntime()) return readFallbackReports().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (await db()).select<StoredAnalysisReport[]>('SELECT * FROM analysis_reports ORDER BY created_at DESC');
}

export async function replaceAnalysisReports(rows: StoredAnalysisReport[]): Promise<void> {
  if (!isTauriRuntime()) {
    writeFallbackReports(rows);
    return;
  }
  const database = await db();
  await database.execute('DELETE FROM analysis_reports');
  for (const row of rows) {
    await database.execute('INSERT OR REPLACE INTO analysis_reports (id, kind, source, text, created_at) VALUES ($1, $2, $3, $4, $5)', [row.id, row.kind, row.source, row.text, row.created_at]);
  }
}

export async function loadLatestAnalysisReport(kind: string): Promise<StoredAnalysisReport | null> {
  const fallback = readFallbackReports().filter((row) => row.kind === kind);
  if (!isTauriRuntime()) return fallback.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  try {
    const rows = await (await db()).select<StoredAnalysisReport[]>('SELECT * FROM analysis_reports WHERE kind = $1 ORDER BY created_at DESC LIMIT 1', [kind]);
    return [...rows, ...fallback].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  } catch {
    return fallback.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  }
}
export async function createLocalDatabaseBackup(force = false): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (!force && localStorage.getItem('weiguang.lastBackupDate') === today) return null;
  const path = await invoke<string>('prepare_database_backup');
  const database = await db();
  await database.execute(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  await invoke('prune_database_backups', { keep: 14 });
  localStorage.setItem('weiguang.lastBackupDate', today);
  return path;
}
