import Database from '@tauri-apps/plugin-sql';
import type { JSONContent } from '@tiptap/core';
import { createEmptyDoc, createInitialWorkspace } from '../domain/defaults';
import type {
  BibleCard,
  Character,
  Chapter,
  Foreshadow,
  OutlineItem,
  Project,
  Scene,
  SceneStatus,
  TimelineEvent,
  Volume,
  WorkspaceData,
} from '../domain/types';
import { parseJson } from './json';
import { readStoredWorkspace, saveLegacyWorkspace } from './localRepository';
import { WORKSPACE_SCHEMA_STATEMENTS } from './schema';

const DB_URL = 'sqlite:changye-writer.db';
let database: Database | null = null;


async function getSetting(key: string): Promise<string | null> {
  if (!database) return null;
  const rows = await database.select<Array<{ value: string }>>('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function loadWorkspaceFromDatabase(): Promise<WorkspaceData> {
  if (!database) throw new Error('原生 SQLite 尚未初始化');
  const projectRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM projects ORDER BY created_at ASC');
  const volumeRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM volumes ORDER BY sort ASC');
  const chapterRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM chapters ORDER BY sort ASC');
  const sceneRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM scenes ORDER BY sort ASC');
  const characterRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM characters ORDER BY updated_at DESC');
  const bibleRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM bible_cards ORDER BY updated_at DESC');
  const timelineRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM timeline_events ORDER BY sort ASC');
  const foreshadowRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM foreshadows ORDER BY created_at ASC');
  const outlineRows = await database.select<Array<Record<string, unknown>>>('SELECT * FROM outline_items ORDER BY updated_at DESC');

  const projects: Project[] = projectRows.map((row) => ({
    id: String(row.id), name: String(row.name), type: String(row.type) as Project['type'],
    goalWords: Number(row.goal_words), status: String(row.status), aiMemoryEnabled: Number(row.ai_memory_enabled ?? 0) === 1, rev: Number(row.rev),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  }));
  const volumes: Volume[] = volumeRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), title: String(row.title), sort: Number(row.sort),
    goalWords: Number(row.goal_words), rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const chapters: Chapter[] = chapterRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), volumeId: String(row.volume_id), title: String(row.title),
    sort: Number(row.sort), status: String(row.status) as SceneStatus, defaultSceneId: String(row.default_scene_id),
    rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const scenes: Scene[] = sceneRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), chapterId: String(row.chapter_id), title: String(row.title),
    sort: Number(row.sort), status: String(row.status) as SceneStatus,
    doc: parseJson<JSONContent>(row.doc_json, createEmptyDoc()), wordCount: Number(row.word_count),
    rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const characters: Character[] = characterRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), name: String(row.name),
    aliases: parseJson<string[]>(row.aliases_json, []), role: String(row.role), notes: String(row.notes),
    rev: Number(row.rev), updatedAt: String(row.updated_at),
  }));
  const bibleCards: BibleCard[] = bibleRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), kind: String(row.kind) as BibleCard['kind'],
    name: String(row.name), aliases: parseJson<string[]>(row.aliases_json, []), summary: String(row.summary),
    details: String(row.details), tags: parseJson<string[]>(row.tags_json, []), rev: Number(row.rev),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const timelineEvents: TimelineEvent[] = timelineRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), chapterId: row.chapter_id ? String(row.chapter_id) : null,
    sceneId: row.scene_id ? String(row.scene_id) : null, title: String(row.title), description: String(row.description),
    storyTime: String(row.story_time), sort: Number(row.sort), status: String(row.status) as TimelineEvent['status'],
    rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const foreshadows: Foreshadow[] = foreshadowRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), title: String(row.title), description: String(row.description),
    plantedChapterId: row.planted_chapter_id ? String(row.planted_chapter_id) : null,
    resolvedChapterId: row.resolved_chapter_id ? String(row.resolved_chapter_id) : null,
    plannedPayoff: String(row.planned_payoff), status: String(row.status) as Foreshadow['status'],
    rev: Number(row.rev), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));
  const outlineItems: OutlineItem[] = outlineRows.map((row) => ({
    id: String(row.id), projectId: String(row.project_id), entityType: String(row.entity_type) as OutlineItem['entityType'],
    entityId: String(row.entity_id), goal: String(row.goal), conflict: String(row.conflict), turn: String(row.turn),
    outcome: String(row.outcome), characters: parseJson<string[]>(row.characters_json, []), notes: String(row.notes),
    status: String(row.status) as OutlineItem['status'], createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }));

  const storedProjectId = await getSetting('active_project_id');
  const storedSceneId = await getSetting('active_scene_id');
  const activeProjectId = storedProjectId && projects.some((item) => item.id === storedProjectId)
    ? storedProjectId
    : projects[0]?.id ?? '';
  const activeSceneId = storedSceneId && scenes.some((item) => item.id === storedSceneId)
    ? storedSceneId
    : scenes[0]?.id ?? '';
  return { schemaVersion: 3, projects, volumes, chapters, scenes, characters, bibleCards, timelineEvents, foreshadows, outlineItems, activeProjectId, activeSceneId };
}

async function insertRows(db: Database, sql: string, rows: Array<Array<string | number | null>>): Promise<void> {
  for (const row of rows) await db.execute(sql, row);
}

async function writeWorkspaceToDatabase(data: WorkspaceData): Promise<void> {
  if (!database) throw new Error('原生 SQLite 尚未初始化');
  await database.execute('BEGIN IMMEDIATE');
  let stage = '清理旧数据';
  try {
    await database.execute('DELETE FROM outline_items');
    await database.execute('DELETE FROM foreshadows');
    await database.execute('DELETE FROM timeline_events');
    await database.execute('DELETE FROM bible_cards');
    await database.execute('DELETE FROM characters');
    await database.execute('DELETE FROM scenes');
    await database.execute('DELETE FROM chapters');
    await database.execute('DELETE FROM volumes');
    await database.execute('DELETE FROM projects');
    await database.execute('DELETE FROM settings');
    stage = '写入项目';
    await insertRows(database, 'INSERT INTO projects (id, name, type, goal_words, status, ai_memory_enabled, rev, created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      data.projects.map((item) => [item.id, item.name, item.type, item.goalWords, item.status, item.aiMemoryEnabled ? 1 : 0, item.rev, item.createdAt, item.updatedAt, item.deletedAt ?? null]));
    stage = '写入卷';
    await insertRows(database, 'INSERT INTO volumes (id, project_id, title, sort, goal_words, rev, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      data.volumes.map((item) => [item.id, item.projectId, item.title, item.sort, item.goalWords, item.rev, item.createdAt, item.updatedAt]));
    stage = '写入章节';
    await insertRows(database, 'INSERT INTO chapters (id, project_id, volume_id, title, sort, status, default_scene_id, rev, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      data.chapters.map((item) => [item.id, item.projectId, item.volumeId, item.title, item.sort, item.status, item.defaultSceneId, item.rev, item.createdAt, item.updatedAt]));
    stage = '写入场景';
    await insertRows(database, 'INSERT INTO scenes (id, project_id, chapter_id, title, sort, status, doc_json, word_count, rev, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      data.scenes.map((item) => [item.id, item.projectId, item.chapterId, item.title, item.sort, item.status, JSON.stringify(item.doc), item.wordCount, item.rev, item.createdAt, item.updatedAt]));
    stage = '写入人物';
    await insertRows(database, 'INSERT INTO characters (id, project_id, name, aliases_json, role, notes, rev, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      data.characters.map((item) => [item.id, item.projectId, item.name, JSON.stringify(item.aliases), item.role, item.notes, item.rev, item.updatedAt]));
    stage = '写入故事设定';
    await insertRows(database, 'INSERT INTO bible_cards (id, project_id, kind, name, aliases_json, summary, details, tags_json, rev, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      data.bibleCards.map((item) => [item.id, item.projectId, item.kind, item.name, JSON.stringify(item.aliases), item.summary, item.details, JSON.stringify(item.tags), item.rev, item.createdAt, item.updatedAt]));
    stage = '写入时间线';
    await insertRows(database, 'INSERT INTO timeline_events (id, project_id, chapter_id, scene_id, title, description, story_time, sort, status, rev, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      data.timelineEvents.map((item) => [item.id, item.projectId, item.chapterId, item.sceneId, item.title, item.description, item.storyTime, item.sort, item.status, item.rev, item.createdAt, item.updatedAt]));
    stage = '写入伏笔';
    await insertRows(database, 'INSERT INTO foreshadows (id, project_id, title, description, planted_chapter_id, resolved_chapter_id, planned_payoff, status, rev, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      data.foreshadows.map((item) => [item.id, item.projectId, item.title, item.description, item.plantedChapterId, item.resolvedChapterId, item.plannedPayoff, item.status, item.rev, item.createdAt, item.updatedAt]));
    stage = '写入大纲';
    await insertRows(database, 'INSERT INTO outline_items (id, project_id, entity_type, entity_id, goal, conflict, turn, outcome, characters_json, notes, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
      (data.outlineItems ?? []).map((item) => [item.id, item.projectId, item.entityType, item.entityId, item.goal, item.conflict, item.turn, item.outcome, JSON.stringify(item.characters), item.notes, item.status, item.createdAt, item.updatedAt]));
    stage = '写入设置';
    await insertRows(database, 'INSERT INTO settings (key, value) VALUES ($1, $2)', [
      ['active_project_id', data.activeProjectId],
      ['active_scene_id', data.activeSceneId],
      ['schema_version', String(data.schemaVersion)],
    ]);
    await database.execute('COMMIT');
  } catch (error) {
    await database.execute('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`保存${stage}失败：${message}`);
  }
}

export async function initializeNativeWorkspaceRepository(): Promise<WorkspaceData> {
  database = await Database.load(DB_URL);
  for (const statement of WORKSPACE_SCHEMA_STATEMENTS) await database.execute(statement);
  const projectColumns = await database.select<Array<{ name: string }>>('PRAGMA table_info(projects)');
  if (!projectColumns.some((column) => column.name === 'ai_memory_enabled')) {
    await database.execute('ALTER TABLE projects ADD COLUMN ai_memory_enabled INTEGER NOT NULL DEFAULT 0');
  }
  const rows = await database.select<Array<{ count: number }>>('SELECT COUNT(*) AS count FROM projects');
  if (Number(rows[0]?.count ?? 0) === 0) {
    const seed = readStoredWorkspace() ?? createInitialWorkspace();
    await writeWorkspaceToDatabase(seed);
    saveLegacyWorkspace(seed);
    return seed;
  }
  const loaded = await loadWorkspaceFromDatabase();
  saveLegacyWorkspace(loaded);
  return loaded;
}

export async function saveNativeWorkspace(data: WorkspaceData): Promise<void> {
  await writeWorkspaceToDatabase(data);
  saveLegacyWorkspace(data);
}