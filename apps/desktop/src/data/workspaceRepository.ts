import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceData } from '../domain/types';
import { initializeNativeWorkspaceRepository, saveNativeWorkspace } from './nativeRepository';
import { initializeWorkspaceRepository as initializeWebWorkspaceRepository, saveWorkspace as saveWebWorkspace } from './sqliteRepository';

type Backend = 'native' | 'web';
let backend: Backend | null = null;
let backendError: string | null = null;

function writeDiagnostic(message: string): void {
  void invoke('write_diagnostic_log', { message }).catch(() => undefined);
}

export async function initializeWorkspaceRepository(): Promise<WorkspaceData> {
  try {
    const data = await initializeNativeWorkspaceRepository();
    backend = 'native';
    backendError = null;
    writeDiagnostic('backend=native');
    return data;
  } catch (error) {
    backendError = error instanceof Error ? error.message : String(error);
    console.info('Native SQLite unavailable, falling back to sql.js', backendError);
    writeDiagnostic(`backend=web error=${backendError}`);
  }
  backend = 'web';
  return initializeWebWorkspaceRepository();
}

export async function saveWorkspace(data: WorkspaceData): Promise<void> {
  if (backend === 'native') return saveNativeWorkspace(data);
  return saveWebWorkspace(data);
}

export function currentBackend(): Backend | null {
  return backend;
}

export function currentBackendError(): string | null {
  return backendError;
}