import { invoke } from '@tauri-apps/api/core';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { readStoredWorkspace } from './data/localRepository';
import { initializeWorkspaceRepository } from './data/workspaceRepository';
import { useWriterStore } from './data/writerStore';
import { createInitialWorkspace } from './domain/defaults';
import { applyAppearance, loadAppearance } from './data/appearance';

applyAppearance(loadAppearance());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
const root = createRoot(rootElement);

root.render(
  <div className="boot-screen">
    <div className="boot-mark">微</div>
    <p className="eyebrow">WEIGUANG WRITER</p>
    <h1>正在打开工作区</h1>
    <p>正在准备编辑器与场景索引…</p>
    <span className="boot-progress" />
  </div>,
);

async function bootstrap(): Promise<void> {
  try {
    const data = await initializeWorkspaceRepository();
    useWriterStore.getState().hydrate(data);
  } catch (error) {
    console.error('SQLite initialization failed', error);
    const fallback = readStoredWorkspace() ?? createInitialWorkspace();
    useWriterStore.getState().hydrate(fallback);
    useWriterStore.getState().markError('数据存储初始化失败，已切换到备用存储');
  }
  root.render(<App />);
}

void bootstrap();
void invoke('write_diagnostic_log', { message: 'frontend-loaded' }).catch(() => undefined);
