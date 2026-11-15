import type { JSONContent } from '@tiptap/core';

export type NavKey = 'shelf' | 'writing' | 'outline' | 'bible' | 'memory' | 'timeline' | 'foreshadow' | 'checks' | 'analysis' | 'aiSettings' | 'data' | 'settings';
export type SceneStatus = 'draft' | 'revising' | 'done';
export type SaveState = 'saved' | 'saving' | 'error';

export interface Project {
  id: string;
  name: string;
  type: 'webnovel' | 'screenplay' | 'book' | 'other';
  goalWords: number;
  status: string;
  aiMemoryEnabled: boolean;
  rev: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Volume {
  id: string;
  projectId: string;
  title: string;
  sort: number;
  goalWords: number;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  projectId: string;
  volumeId: string;
  title: string;
  sort: number;
  status: SceneStatus;
  defaultSceneId: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  projectId: string;
  chapterId: string;
  title: string;
  sort: number;
  status: SceneStatus;
  doc: JSONContent;
  wordCount: number;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  role: string;
  notes: string;
  rev: number;
  updatedAt: string;
}

export type BibleCardKind = 'character' | 'location' | 'item' | 'organization' | 'concept';

export interface BibleCard {
  id: string;
  projectId: string;
  kind: BibleCardKind;
  name: string;
  aliases: string[];
  summary: string;
  details: string;
  tags: string[];
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export type TimelineEventStatus = 'planned' | 'canonical' | 'changed';

export interface TimelineEvent {
  id: string;
  projectId: string;
  chapterId: string | null;
  sceneId: string | null;
  title: string;
  description: string;
  storyTime: string;
  sort: number;
  status: TimelineEventStatus;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export type ForeshadowStatus = 'planted' | 'active' | 'resolved' | 'overdue';

export interface Foreshadow {
  id: string;
  projectId: string;
  title: string;
  description: string;
  plantedChapterId: string | null;
  resolvedChapterId: string | null;
  plannedPayoff: string;
  status: ForeshadowStatus;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export type OutlineEntityType = 'volume' | 'chapter' | 'scene';
export type OutlineStatus = 'planned' | 'writing' | 'done' | 'deviated';

export interface OutlineItem {
  id: string;
  projectId: string;
  entityType: OutlineEntityType;
  entityId: string;
  goal: string;
  conflict: string;
  turn: string;
  outcome: string;
  characters: string[];
  notes: string;
  status: OutlineStatus;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceData {
  schemaVersion: 3;
  projects: Project[];
  volumes: Volume[];
  chapters: Chapter[];
  scenes: Scene[];
  characters: Character[];
  bibleCards: BibleCard[];
  timelineEvents: TimelineEvent[];
  foreshadows: Foreshadow[];
  outlineItems: OutlineItem[];
  activeProjectId: string;
  activeSceneId: string;
}

export interface WorkspaceSnapshot {
  data: WorkspaceData;
  saveState: SaveState;
  lastSavedAt: string | null;
  error: string | null;
}
