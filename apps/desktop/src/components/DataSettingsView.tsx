import { CheckCircle2, DatabaseBackup, Download, HardDrive, Upload } from 'lucide-react';
import { useState } from 'react';
import { createLocalDatabaseBackup, listAllAnalysisReports, listAllSceneVersionRows, replaceAnalysisReports, replaceProjectSceneVersions, type SceneVersionRow, type StoredAnalysisReport } from '../data/localArtifactStore';
import { clearProjectMemory, listMemoryItems, replaceProjectMemory, type MemoryItem } from '../data/memoryStore';
import { currentBackend, currentBackendError, saveWorkspace } from '../data/workspaceRepository';
import { useWriterStore } from '../data/writerStore';
import { downloadTextFile } from '../domain/export';
import { docxToManuscriptText, importManuscript } from '../domain/importers';
import type { WorkspaceData } from '../domain/types';

interface ProjectBackupFile {
  format: 'weiguang-project-backup';
  version: 2;
  exported_at: string;
  workspace: WorkspaceData;
  memories: Record<string, MemoryItem[]>;
  sceneVersions: Record<string, SceneVersionRow[]>;
  analysisReports: StoredAnalysisReport[];
}
import { useConfirm } from './ConfirmDialog';

export function DataSettingsView() {
  const data = useWriterStore((state) => state.data);
  const hydrate = useWriterStore((state) => state.hydrate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const backend = currentBackend();
  const backendError = currentBackendError();
  const confirm = useConfirm();

  const backupNow = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const path = await createLocalDatabaseBackup(true);
      setMessage(path ? `数据库备份完成：${path}` : '当前环境不支持数据库备份，请使用完整项目备份');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '数据库备份失败');
    } finally { setBusy(false); }
  };

  const exportBackup = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const memories: Record<string, MemoryItem[]> = {};
      const sceneVersions: Record<string, SceneVersionRow[]> = {};
      await Promise.all(data.projects.map(async (project) => {
        memories[project.id] = await listMemoryItems(project.id);
        sceneVersions[project.id] = await listAllSceneVersionRows(project.id);
      }));
      const analysisReports = await listAllAnalysisReports();
      const backup: ProjectBackupFile = {
        format: 'weiguang-project-backup',
        version: 2,
        exported_at: new Date().toISOString(),
        workspace: data,
        memories,
        sceneVersions,
        analysisReports,
      };
      downloadTextFile(`微光写作台备份-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
      setMessage('完整项目备份已导出，包含正文、故事设定、长期记忆、恢复点和分析报告');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '完整项目备份导出失败');
    } finally { setBusy(false); }
  };

  const importBackup = async (selected: File | null) => {
    if (!selected) return;
    const isJson = selected.name.toLowerCase().endsWith('.json');
    if (!(await confirm(isJson ? { title: '导入完整项目备份？', description: '当前工作区会被备份文件替换。', confirmLabel: '继续导入', tone: 'danger' } : { title: '导入本地稿件？', description: '文件会作为新项目加入书架，不会覆盖现有项目。', confirmLabel: '导入稿件', tone: 'default' }))) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const text = selected.name.toLowerCase().endsWith('.docx') ? await docxToManuscriptText(selected) : await selected.text();
      if (isJson) {
        const parsed = JSON.parse(text) as WorkspaceData | ProjectBackupFile;
        const isEnvelope = (parsed as ProjectBackupFile).format === 'weiguang-project-backup';
        const workspace = isEnvelope ? (parsed as ProjectBackupFile).workspace : parsed as WorkspaceData;
        if (!workspace || workspace.schemaVersion !== 3 || !Array.isArray(workspace.projects) || !Array.isArray(workspace.scenes)) {
          throw new Error('不是有效的微光写作台备份文件');
        }
        const memories = isEnvelope ? (parsed as ProjectBackupFile).memories ?? {} : {};
        const sceneVersions = isEnvelope ? (parsed as ProjectBackupFile).sceneVersions ?? {} : {};
        const analysisReports = isEnvelope ? (parsed as ProjectBackupFile).analysisReports ?? [] : [];
        const previousProjects = data.projects.map((project) => project.id);
        for (const projectId of new Set([...previousProjects, ...workspace.projects.map((project) => project.id)])) {
          await clearProjectMemory(projectId);
        }
        for (const project of workspace.projects) {
          await replaceProjectMemory(project.id, memories[project.id] ?? []);
          await replaceProjectSceneVersions(project.id, sceneVersions[project.id] ?? []);
        }
        await replaceAnalysisReports(analysisReports);
        hydrate(workspace);
        await saveWorkspace(useWriterStore.getState().data);
        setMessage(isEnvelope ? '项目备份已导入，长期记忆、恢复点和分析报告已恢复' : '项目备份已导入');
      } else {
        const imported = importManuscript(data, selected.name, text);
        hydrate(imported);
        await saveWorkspace(useWriterStore.getState().data);
        setMessage('稿件已按章节导入为新项目');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : typeof caught === 'string' ? caught : '文件导入失败');
    } finally { setBusy(false); }
  };

  return (
    <main className="module-stage">
      <header className="module-head">
        <div><p className="eyebrow">DATA</p><h1>数据与备份</h1><p>管理数据库备份、项目导入和完整项目导出。</p></div>
        <div className="module-stat"><strong>{data.projects.length}</strong><span>个项目</span></div>
      </header>
      {error && <div className="ai-error" role="alert">{error}</div>}
      {message && <div className="settings-success" role="status"><CheckCircle2 size={15} />{message}</div>}
      <section className="content-card local-data-card">
        <div className="section-title-row"><div><p className="eyebrow">STORAGE</p><h2>存储状态</h2></div><HardDrive size={18} /></div>
        <div className="local-data-grid">
          <div><span>存储方式</span><strong>{backend === 'native' ? 'SQLite 数据库' : backend === 'web' ? '浏览器存储' : '初始化中'}</strong></div>
          <div><span>项目数量</span><strong>{data.projects.length} 个</strong></div>
          <div><span>自动备份</span><strong>每日一次</strong></div>
          <div><span>备份保留</span><strong>最近 14 份</strong></div>
        </div>
        {backendError && <div className="ai-error" role="alert">{backendError}</div>}
        <div className="settings-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void backupNow()}><DatabaseBackup size={15} />立即备份数据库</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void exportBackup()}><Download size={15} />导出完整项目备份</button>
          <label className="secondary-button file-picker"><Upload size={15} />导入项目/备份<input type="file" accept=".json,.txt,.md,.markdown,.docx,application/json,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={(event) => void importBackup(event.target.files?.[0] ?? null)} /></label>
        </div>
        <p className="settings-security-note">完整项目备份包含正文、故事设定、长期记忆、恢复点和分析报告；API Key 不会写入备份。请妥善保管。</p>
      </section>
    </main>
  );
}