import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createEmptyDoc, createInitialWorkspace } from '../domain/defaults';
import { createId } from '../domain/ids';
import type { BibleCard, Character, Chapter, Foreshadow, Project, Scene, SceneStatus, TimelineEvent, Volume, WorkspaceData } from '../domain/types';
import type { JSONContent } from '@tiptap/core';
import { readStoredWorkspace, saveLegacyWorkspace } from './localRepository';
import { WORKSPACE_SCHEMA } from './schema';

const IDB_NAME = 'changye-writer';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'workspace';
const SCHEMA = WORKSPACE_SCHEMA;
let database: Database | null = null;

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'));
  });
}

async function readDatabaseBytes(): Promise<Uint8Array | null> {
  const idb = await openIndexedDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const request = tx.objectStore(IDB_STORE).get(IDB_KEY);
      request.onsuccess = () => {
        const value: unknown = request.result;
        if (value instanceof Uint8Array) resolve(value);
        else if (value instanceof ArrayBuffer) resolve(new Uint8Array(value));
        else resolve(null);
      };
      request.onerror = () => reject(request.error ?? new Error('读取 SQLite 数据库失败'));
    });
  } finally {
    idb.close();
  }
}

async function writeDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('写入 SQLite 数据库失败'));
    });
  } finally {
    idb.close();
  }
}

function getRows(db: Database, sql: string): Record<string, unknown>[] {
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

function getScalar(db: Database, sql: string, params: unknown[] = []): unknown {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params as never[]);
    if (!stmt.step()) return null;
    return stmt.get()[0];
  } finally {
    stmt.free();
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
function loadWorkspaceFromDatabase(db: Database): WorkspaceData {
  const projects: Project[] = getRows(db, 'SELECT * FROM projects ORDER BY created_at ASC').map((row) => ({
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as Project['type'],
    goalWords: Number(row.goal_words),
    status: String(row.status),
    aiMemoryEnabled: Number(row.ai_memory_enabled ?? 0) === 1,
    rev: Number(row.rev),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  }));
  const volumes: Volume[] = getRows(db, 'SELECT * FROM volumes ORDER BY sort ASC').map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    sort: Number(row.sort),
    goalWords: Number(row.goal_words),
    rev: Number(row.rev),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  const chapters: Chapter[] = getRows(db, 'SELECT * FROM chapters ORDER BY sort ASC').map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    volumeId: String(row.volume_id),
    title: String(row.title),
    sort: Number(row.sort),
    status: String(row.status) as SceneStatus,
    defaultSceneId: String(row.default_scene_id),
    rev: Number(row.rev),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  const scenes: Scene[] = getRows(db, 'SELECT * FROM scenes ORDER BY sort ASC').map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    chapterId: String(row.chapter_id),
    title: String(row.title),
    sort: Number(row.sort),
    status: String(row.status) as SceneStatus,
    doc: parseJson<JSONContent>(row.doc_json, createEmptyDoc()),
    wordCount: Number(row.word_count),
    rev: Number(row.rev),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  const characters: Character[] = getRows(db, 'SELECT * FROM characters ORDER BY updated_at DESC').map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    aliases: parseJson<string[]>(row.aliases_json, []),
    role: String(row.role),
    notes: String(row.notes),
    rev: Number(row.rev),
    updatedAt: String(row.updated_at),
  }));

  const bibleCards: BibleCard[] = getRows(db, 'SELECT * FROM bible_cards ORDER BY updated_at DESC').map((row) => ({
    id: String(row.id), projectId: String(row.project_id), kind: String(row.kind) as BibleCard['kind'],
    name: String(row.name), aliases: parseJson<string[]>(row.aliases_json, []), summary: String(row.summary),
    details: String(row.details), tags: parseJson<string[]>(row.tags_json, []), rev: Number(row.rev),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const timelineEvents: TimelineEvent[] = getRows(db, 'SELECT * FROM timeline_events ORDER BY sort ASC').map((row) => ({
    id: String(row.id), projectId: String(row.project_id), chapterId: row.chapter_id ? String(row.chapter_id) : null,
    sceneId: row.scene_id ? String(row.scene_id) : null, title: String(row.title), description: String(row.description),
    storyTime: String(row.story_time), sort: Number(row.sort), status: String(row.status) as TimelineEvent['status'],
    rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const foreshadows: Foreshadow[] = getRows(db, 'SELECT * FROM foreshadows ORDER BY created_at ASC').map((row) => ({
    id: String(row.id), projectId: String(row.project_id), title: String(row.title), description: String(row.description),
    plantedChapterId: row.planted_chapter_id ? String(row.planted_chapter_id) : null,
    resolvedChapterId: row.resolved_chapter_id ? String(row.resolved_chapter_id) : null,
    plannedPayoff: String(row.planned_payoff), status: String(row.status) as Foreshadow['status'],
    rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const storedProjectId = getScalar(db, "SELECT value FROM settings WHERE key = 'active_project_id'");
  const storedSceneId = getScalar(db, "SELECT value FROM settings WHERE key = 'active_scene_id'");
  const activeProjectId = typeof storedProjectId === 'string' && projects.some((item) => item.id === storedProjectId)
    ? storedProjectId
    : projects[0]?.id ?? '';
  const activeSceneId = typeof storedSceneId === 'string' && scenes.some((item) => item.id === storedSceneId)
    ? storedSceneId
    : scenes[0]?.id ?? '';

  return { schemaVersion: 2, projects, volumes, chapters, scenes, characters, bibleCards, timelineEvents, foreshadows, activeProjectId, activeSceneId };
}

function insertRows(db: Database, sql: string, rows: Array<Array<string | number | null>>): void {
  if (rows.length === 0) return;
  const stmt = db.prepare(sql);
  try {
    for (const row of rows) stmt.run(row as never[]);
  } finally {
    stmt.free();
  }
}

function writeWorkspaceToDatabase(db: Database, data: WorkspaceData): void {
  db.run('BEGIN IMMEDIATE');
  try {
    db.run('DELETE FROM foreshadows; DELETE FROM timeline_events; DELETE FROM bible_cards; DELETE FROM characters; DELETE FROM scenes; DELETE FROM chapters; DELETE FROM volumes; DELETE FROM projects; DELETE FROM settings;');
    insertRows(db, 'INSERT INTO projects (id, name, type, goal_words, status, ai_memory_enabled, rev, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      data.projects.map((item) => [item.id, item.name, item.type, item.goalWords, item.status, item.aiMemoryEnabled ? 1 : 0, item.rev, item.createdAt, item.updatedAt, item.deletedAt ?? null]));
    insertRows(db, 'INSERT INTO volumes (id, project_id, title, sort, goal_words, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      data.volumes.map((item) => [item.id, item.projectId, item.title, item.sort, item.goalWords, item.rev, item.createdAt, item.updatedAt]));
    insertRows(db, 'INSERT INTO chapters (id, project_id, volume_id, title, sort, status, default_scene_id, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      data.chapters.map((item) => [item.id, item.projectId, item.volumeId, item.title, item.sort, item.status, item.defaultSceneId, item.rev, item.createdAt, item.updatedAt]));
    insertRows(db, 'INSERT INTO scenes (id, project_id, chapter_id, title, sort, status, doc_json, word_count, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      data.scenes.map((item) => [item.id, item.projectId, item.chapterId, item.title, item.sort, item.status, JSON.stringify(item.doc), item.wordCount, item.rev, item.createdAt, item.updatedAt]));
    insertRows(db, 'INSERT INTO characters (id, project_id, name, aliases_json, role, notes, rev, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      data.characters.map((item) => [item.id, item.projectId, item.name, JSON.stringify(item.aliases), item.role, item.notes, item.rev, item.updatedAt]));
    insertRows(db, 'INSERT INTO bible_cards (id, project_id, kind, name, aliases_json, summary, details, tags_json, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      data.bibleCards.map((item) => [item.id, item.projectId, item.kind, item.name, JSON.stringify(item.aliases), item.summary, item.details, JSON.stringify(item.tags), item.rev, item.createdAt, item.updatedAt]));
    insertRows(db, 'INSERT INTO timeline_events (id, project_id, chapter_id, scene_id, title, description, story_time, sort, status, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      data.timelineEvents.map((item) => [item.id, item.projectId, item.chapterId, item.sceneId, item.title, item.description, item.storyTime, item.sort, item.status, item.rev, item.createdAt, item.updatedAt]));
    insertRows(db, 'INSERT INTO foreshadows (id, project_id, title, description, planted_chapter_id, resolved_chapter_id, planned_payoff, status, rev, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      data.foreshadows.map((item) => [item.id, item.projectId, item.title, item.description, item.plantedChapterId, item.resolvedChapterId, item.plannedPayoff, item.status, item.rev, item.createdAt, item.updatedAt]));
    insertRows(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', [
      ['active_project_id', data.activeProjectId],
      ['active_scene_id', data.activeSceneId],
      ['schema_version', String(data.schemaVersion)],
    ]);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

async function persistDatabase(): Promise<void> {
  if (!database) throw new Error('SQLite 尚未初始化');
  await writeDatabaseBytes(database.export());
}

export async function initializeWorkspaceRepository(): Promise<WorkspaceData> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const bytes = await readDatabaseBytes();
  database = bytes ? new SQL.Database(bytes) : new SQL.Database();
  database.run(SCHEMA);
  const projectColumns = getRows(database, 'PRAGMA table_info(projects)');
  if (!projectColumns.some((column) => String(column.name) === 'ai_memory_enabled')) {
    database.run('ALTER TABLE projects ADD COLUMN ai_memory_enabled INTEGER NOT NULL DEFAULT 0');
  }
  const count = Number(getScalar(database, 'SELECT COUNT(*) FROM projects') ?? 0);
  if (count === 0) {
    const seed = readStoredWorkspace() ?? createInitialWorkspace();
    writeWorkspaceToDatabase(database, seed);
    await persistDatabase();
    saveLegacyWorkspace(seed);
    return seed;
  }
  const loaded = loadWorkspaceFromDatabase(database);
  saveLegacyWorkspace(loaded);
  return loaded;
}

export async function saveWorkspace(data: WorkspaceData): Promise<void> {
  if (!database) throw new Error('SQLite 尚未初始化');
  writeWorkspaceToDatabase(database, data);
  await persistDatabase();
  saveLegacyWorkspace(data);
}
