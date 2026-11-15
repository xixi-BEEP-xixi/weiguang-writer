import { BrainCircuit, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AiMemoryStats } from '../data/aiMemoryStore';

function MemoryExplanation() {
  return (
    <div className="memory-explanation">
      <div className="memory-benefits">
        <strong><Sparkles size={14} />开启后会更好</strong>
        <ul>
          <li>AI 从正文提取事实，作为候选供你确认</li>
          <li>已确认记忆才会进入后续 AI 上下文</li>
          <li>记忆保存原文证据，可随时撤回或删除</li>
        </ul>
      </div>
      <div className="memory-tradeoffs">
        <strong><TriangleAlert size={14} />需要注意</strong>
        <ul>
          <li>提取记忆会调用你配置的 API，并产生 Token 用量</li>
          <li>未确认的候选不会参与后续生成</li>
          <li>可随时关闭；关闭后已确认记忆仍保存在本机</li>
        </ul>
      </div>
    </div>
  );
}

export function NewProjectDialog({ open, onConfirm, onClose }: {
  open: boolean;
  onConfirm: (name: string, memoryEnabled: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('未命名长篇');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('未命名长篇');
    setMemoryEnabled(true);
    window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="name-dialog project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onConfirm(name.trim(), memoryEnabled);
        onClose();
      }}>
        <div className="dialog-heading">
          <div><p className="eyebrow">NEW BOOK</p><h2 id="new-project-title">创建一本新书</h2></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={15} /></button>
        </div>
        <label className="field-label" htmlFor="new-project-name">书名</label>
        <input ref={inputRef} id="new-project-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        <label className="memory-toggle-row">
          <span className="memory-toggle-icon"><BrainCircuit size={17} /></span>
          <span><strong>启用长期记忆</strong><small>AI 提取事实后先进入待确认区</small></span>
          <input type="checkbox" checked={memoryEnabled} onChange={(event) => setMemoryEnabled(event.target.checked)} />
        </label>
        <MemoryExplanation />
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit" disabled={!name.trim()}>创建书籍</button>
        </div>
      </form>
    </div>
  );
}

export function ProjectMemoryDialog({ open, projectName, enabled, stats, onSetEnabled, onClear, onClose }: {
  open: boolean;
  projectName: string;
  enabled: boolean;
  stats: AiMemoryStats | null;
  onSetEnabled: (enabled: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="name-dialog project-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-dialog-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">AI MEMORY</p><h2 id="memory-dialog-title">长期记忆</h2><p className="memory-project-name">{projectName}</p></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={15} /></button>
        </div>
        <div className={`memory-state ${enabled ? 'is-on' : ''}`}>
          <BrainCircuit size={18} />
          <div><strong>{enabled ? '已开启' : '未开启'}</strong><span>{stats ? `已记录 ${stats.total} 次操作，其中 ${stats.inserted} 次已插入正文` : '暂无操作记录'}</span></div>
        </div>
        <MemoryExplanation />
        <div className="settings-actions">
          <button className={enabled ? 'secondary-button' : 'primary-button'} type="button" onClick={() => onSetEnabled(!enabled)}>{enabled ? '关闭长期记忆' : '开启长期记忆'}</button>
          {stats && stats.total > 0 && <button className="secondary-button danger-button" type="button" onClick={onClear}><Trash2 size={14} />清除本书记忆</button>}
        </div>
        <p className="settings-security-note">AI 操作记录只用于这本书。关闭记忆不会删除历史记录；清除后无法恢复。</p>
      </section>
    </div>
  );
}