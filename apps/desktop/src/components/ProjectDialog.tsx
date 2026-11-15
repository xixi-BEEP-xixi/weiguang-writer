import { BrainCircuit, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
