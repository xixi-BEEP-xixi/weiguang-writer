import type { Editor } from '@tiptap/core';
import { History, LoaderCircle, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from './ConfirmDialog';
import {
  createSceneVersion, deleteSceneVersion, getSceneVersion, listSceneVersions,
  type SceneVersionDetail, type SceneVersionSummary,
} from '../data/versionClient';
import { collectPlainText } from '../domain/blocks';
import type { Scene } from '../domain/types';

function paragraphsOf(doc: unknown): string[] {
  const node = doc as { content?: Array<Record<string, unknown>> };
  return (node.content ?? []).map((child) => collectPlainText(child as never).trim()).filter(Boolean);
}

function diffParagraphs(previous: string[], current: string[]): Array<{ kind: 'same' | 'added' | 'removed'; text: string }> {
  const rows = Math.min(previous.length, 1200);
  const columns = Math.min(current.length, 1200);
  const previousSlice = previous.slice(0, rows);
  const currentSlice = current.slice(0, columns);
  const table = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      table[i][j] = previousSlice[i] === currentSlice[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result: Array<{ kind: 'same' | 'added' | 'removed'; text: string }> = [];
  let i = 0; let j = 0;
  while (i < rows && j < columns) {
    if (previousSlice[i] === currentSlice[j]) { result.push({ kind: 'same', text: currentSlice[j] }); i += 1; j += 1; }
    else if (table[i + 1][j] >= table[i][j + 1]) { result.push({ kind: 'removed', text: previousSlice[i] }); i += 1; }
    else { result.push({ kind: 'added', text: currentSlice[j] }); j += 1; }
  }
  while (i < rows) { result.push({ kind: 'removed', text: previousSlice[i] }); i += 1; }
  while (j < columns) { result.push({ kind: 'added', text: currentSlice[j] }); j += 1; }
  return result;
}

export function VersionHistoryPanel({ editor, scene, onClose }: { editor: Editor; scene: Scene; onClose: () => void }) {
  const [versions, setVersions] = useState<SceneVersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SceneVersionDetail | null>(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diffMode, setDiffMode] = useState(false);
  const confirm = useConfirm();

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await listSceneVersions(scene.projectId, scene.id);
      setVersions(next);
      if (!selectedId && next[0]) setSelectedId(next[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '版本列表加载失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [scene.id]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    void getSceneVersion(scene.projectId, scene.id, selectedId).then(setDetail).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '版本内容加载失败');
    });
  }, [selectedId, scene.id, scene.projectId]);
  const saveCurrent = async () => {
    setBusy(true); setError('');
    try {
      await createSceneVersion(scene.projectId, scene.id, editor.getJSON(), label.trim() || `手动版本 ${new Date().toLocaleString()}`);
      setLabel('');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '版本保存失败'); }
    finally { setBusy(false); }
  };

  const restore = async (version: SceneVersionDetail) => {
    if (!(await confirm({ title: `恢复到「${version.label}」？`, description: '系统会先自动保存当前正文，再应用该版本。', confirmLabel: '恢复版本', tone: 'default' }))) return;
    setBusy(true); setError('');
    try {
      await createSceneVersion(scene.projectId, scene.id, editor.getJSON(), '恢复前自动备份', version.id);
      editor.commands.setContent(version.doc_json, { emitUpdate: true });
      await createSceneVersion(scene.projectId, scene.id, version.doc_json, `恢复自：${version.label}`, version.id);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '版本恢复失败'); }
    finally { setBusy(false); }
  };

  const remove = async (version: SceneVersionSummary) => {
    if (!(await confirm({ title: `删除版本「${version.label}」？`, description: '只会删除这个版本记录，不会修改当前正文。', confirmLabel: '删除版本', tone: 'danger' }))) return;
    try {
      await deleteSceneVersion(scene.projectId, scene.id, version.id);
      setSelectedId('');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '版本删除失败'); }
  };
  const currentParagraphs = useMemo(() => paragraphsOf(editor.getJSON()), [editor.state.doc, detail]);
  const diffLines = useMemo(() => detail ? diffParagraphs(paragraphsOf(detail.doc_json), currentParagraphs) : [], [detail, currentParagraphs]);

  return (
    <aside className="version-panel" aria-label="版本历史">
      <header className="version-panel-head">
        <div><p className="eyebrow">VERSION HISTORY</p><h2>版本历史</h2></div>
        <button className="icon-button" type="button" aria-label="关闭版本历史" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="version-save-row">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="版本说明，例如：第二幕定稿" aria-label="版本说明" />
        <button className="primary-button compact" type="button" disabled={busy} onClick={() => void saveCurrent()}>
          {busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}保存当前
        </button>
      </div>
      {error && <div className="ai-error" role="alert">{error}</div>}
      <div className="version-layout">
        <div className="version-list">
          {versions.map((version) => (
            <div key={version.id} role="button" tabIndex={0} className={`version-item ${selectedId === version.id ? 'is-selected' : ''}`}
                 onClick={() => setSelectedId(version.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedId(version.id); }}>
              <div><strong>{version.label}</strong><span>{new Date(version.created_at).toLocaleString()}</span></div>
              <small>{version.word_count.toLocaleString()} 字{version.restored_from ? ' · 恢复记录' : ''}</small>
              <p>{version.preview || '空场景'}</p>
              <button className="version-delete" type="button" aria-label="删除版本" title="删除版本" onClick={(event) => { event.stopPropagation(); void remove(version); }}><Trash2 size={11} /></button>
            </div>
          ))}
          {!loading && versions.length === 0 && <div className="module-empty"><History size={20} /><strong>还没有版本</strong><p>保存一个手动版本作为恢复点。</p></div>}
          {loading && <div className="version-loading"><LoaderCircle size={16} className="spin" />加载版本…</div>}
        </div>
        <section className="version-preview">
          {detail ? (
            <>
              <div className="version-preview-head">
                <div><strong>{detail.label}</strong><span>{detail.word_count.toLocaleString()} 字 · {new Date(detail.created_at).toLocaleString()}</span></div>
                <div className="version-mode-actions">
                  <button type="button" className={!diffMode ? 'is-active' : ''} onClick={() => setDiffMode(false)}>版本预览</button>
                  <button type="button" className={diffMode ? 'is-active' : ''} onClick={() => setDiffMode(true)}>与当前对比</button>
                  <button className="primary-button compact" type="button" disabled={busy} onClick={() => void restore(detail)}><RotateCcw size={14} />恢复此版本</button>
                </div>
              </div>
              {diffMode ? <div className="version-diff">{diffLines.map((line, index) => <p key={`${line.kind}-${index}`} className={`version-diff-${line.kind}`}><span>{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>{line.text}</p>)}</div> : <div className="version-preview-text">{detail.preview}{detail.preview.length >= 160 ? '…' : ''}</div>}
              <p className="version-safety-note">恢复前会自动创建“恢复前自动备份”，不会无提示覆盖当前正文。</p>
            </>
          ) : <div className="analysis-report-empty"><History size={22} /><h2>选择版本查看预览</h2><p>版本列表不返回完整正文，选中后才读取具体快照。</p></div>}
        </section>
      </div>
    </aside>
  );
}
