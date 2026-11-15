import type { WorkspaceData } from '../domain/types';

const STORAGE_KEY = 'changye.workspace.v1';

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Omit<WorkspaceData, 'schemaVersion'>> & { schemaVersion?: number };
  return (candidate.schemaVersion === 1 || candidate.schemaVersion === 2 || candidate.schemaVersion === 3) && Array.isArray(candidate.projects) && Array.isArray(candidate.scenes);
}

export function readStoredWorkspace(): WorkspaceData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isWorkspaceData(parsed)) return null;
    return {
      ...parsed,
      schemaVersion: 3,
      bibleCards: parsed.bibleCards ?? [],
      timelineEvents: parsed.timelineEvents ?? [],
      foreshadows: parsed.foreshadows ?? [],
      outlineItems: parsed.outlineItems ?? [],
    };
  } catch {
    return null;
  }
}

export function saveLegacyWorkspace(data: WorkspaceData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearLegacyWorkspace(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function workspaceStorageKey(): string {
  return STORAGE_KEY;
}