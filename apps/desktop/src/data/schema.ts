export const WORKSPACE_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, goal_words INTEGER NOT NULL,
  status TEXT NOT NULL, ai_memory_enabled INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deleted_at TEXT NULL
);
CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, sort INTEGER NOT NULL,
  goal_words INTEGER NOT NULL, rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, volume_id TEXT NOT NULL, title TEXT NOT NULL,
  sort INTEGER NOT NULL, status TEXT NOT NULL, default_scene_id TEXT NOT NULL, rev INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NOT NULL, title TEXT NOT NULL,
  sort INTEGER NOT NULL, status TEXT NOT NULL, doc_json TEXT NOT NULL, word_count INTEGER NOT NULL,
  rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, aliases_json TEXT NOT NULL,
  role TEXT NOT NULL, notes TEXT NOT NULL, rev INTEGER NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS bible_cards (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL,
  aliases_json TEXT NOT NULL, summary TEXT NOT NULL, details TEXT NOT NULL, tags_json TEXT NOT NULL,
  rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, chapter_id TEXT NULL, scene_id TEXT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL, story_time TEXT NOT NULL, sort INTEGER NOT NULL,
  status TEXT NOT NULL, rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS foreshadows (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  planted_chapter_id TEXT NULL, resolved_chapter_id TEXT NULL, planned_payoff TEXT NOT NULL,
  status TEXT NOT NULL, rev INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scene_versions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, scene_id TEXT NOT NULL, label TEXT NOT NULL,
  content_hash TEXT NOT NULL, word_count INTEGER NOT NULL, restored_from TEXT NULL,
  created_at TEXT NOT NULL, preview TEXT NOT NULL, doc_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analysis_reports (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, source TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scene_versions_scene_created ON scene_versions(scene_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_reports_kind_created ON analysis_reports(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS scenes_chapter_sort ON scenes(chapter_id, sort);
CREATE INDEX IF NOT EXISTS chapters_volume_sort ON chapters(volume_id, sort);
INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (2, datetime('now'));
CREATE INDEX IF NOT EXISTS bible_cards_project_kind ON bible_cards(project_id, kind, updated_at);
CREATE INDEX IF NOT EXISTS timeline_events_project_sort ON timeline_events(project_id, sort);
CREATE INDEX IF NOT EXISTS foreshadows_project_status ON foreshadows(project_id, status);
`;

export const WORKSPACE_SCHEMA_STATEMENTS = WORKSPACE_SCHEMA
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean);
