import type { JSONContent } from '@tiptap/core';
import { createId } from './ids';
import type { Chapter, Project, Scene, Volume, WorkspaceData } from './types';

export function createEmptyDoc(): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', attrs: { blockId: createId() } }],
  };
}

export function createProjectBundle(name: string, aiMemoryEnabled = false, now = new Date()): { project: Project; volume: Volume; chapter: Chapter; scene: Scene } {
  const stamp = now.toISOString();
  const project: Project = {
    id: createId(), name, type: 'webnovel', goalWords: 1_000_000, status: 'writing', aiMemoryEnabled,
    rev: 1, createdAt: stamp, updatedAt: stamp,
  };
  const volume: Volume = {
    id: createId(), projectId: project.id, title: '第一卷', sort: 1, goalWords: 300_000,
    rev: 1, createdAt: stamp, updatedAt: stamp,
  };
  const chapter: Chapter = {
    id: createId(), projectId: project.id, volumeId: volume.id, title: '第一章', sort: 1,
    status: 'draft', defaultSceneId: '', rev: 1, createdAt: stamp, updatedAt: stamp,
  };
  const scene: Scene = {
    id: createId(), projectId: project.id, chapterId: chapter.id, title: '正文', sort: 1,
    status: 'draft', doc: createEmptyDoc(), wordCount: 0, rev: 1, createdAt: stamp, updatedAt: stamp,
  };
  chapter.defaultSceneId = scene.id;
  return { project, volume, chapter, scene };
}

export function createInitialWorkspace(): WorkspaceData {
  const bundle = createProjectBundle('未命名长篇');
  return {
    schemaVersion: 3,
    projects: [bundle.project],
    volumes: [bundle.volume],
    chapters: [bundle.chapter],
    scenes: [bundle.scene],
    characters: [],
    bibleCards: [],
    timelineEvents: [],
    foreshadows: [],
    outlineItems: [],
    activeProjectId: bundle.project.id,
    activeSceneId: bundle.scene.id,
  };
}

export function createScene(projectId: string, chapterId: string, title: string, sort: number): Scene {
  const stamp = new Date().toISOString();
  return {
    id: createId(), projectId, chapterId, title, sort, status: 'draft',
    doc: createEmptyDoc(), wordCount: 0, rev: 1, createdAt: stamp, updatedAt: stamp,
  };
}