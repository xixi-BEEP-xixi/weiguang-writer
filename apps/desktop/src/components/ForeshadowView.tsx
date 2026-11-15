import { useEffect, useMemo, useState } from 'react';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { useWriterStore } from '../data/writerStore';
import { PageGuideBubble } from './PageGuideBubble';
import { useConfirm } from './ConfirmDialog';
import type { Foreshadow, ForeshadowStatus } from '../domain/types';

const columns: Array<{ key: ForeshadowStatus; label: string; hint: string }> = [
  { key: 'planted', label: '已埋', hint: '等待推进' },
  { key: 'active', label: '进行中', hint: '正在制造影响' },
  { key: 'resolved', label: '已回收', hint: '完成因果闭环' },
  { key: 'overdue', label: '超期', hint: '需要优先处理' },
];
const statusLabel = Object.fromEntries(columns.map((column) => [column.key, column.label])) as Record<ForeshadowStatus, string>;

function ForeshadowEditor({ item }: { item: Foreshadow }) {
  const data = useWriterStore((state) => state.data);
  const updateForeshadow = useWriterStore((state) => state.updateForeshadow);
  const deleteForeshadow = useWriterStore((state) => state.deleteForeshadow);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(item);

  useEffect(() => setDraft(item), [item]);
  const chapters = data.chapters.filter((chapter) => chapter.projectId === data.activeProjectId).sort((a, b) => a.sort - b.sort);
  const commit = (patch: Partial<Foreshadow>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    updateForeshadow(item.id, {
      title: next.title,
      description: next.description,
      plannedPayoff: next.plannedPayoff,
      plantedChapterId: next.plantedChapterId,
      resolvedChapterId: next.resolvedChapterId,
      status: next.status,
    });
  };

  return (
    <section className="foreshadow-editor" aria-label={`${item.title} 伏笔详情`} data-context-menu="foreshadow" data-context-label={`伏笔：${item.title}`} data-context-delete-target={`#delete-foreshadow-${item.id}`} data-context-delete-label="删除伏笔">
      <div className="foreshadow-editor-head">
        <div>
          <p className="eyebrow">FORESHADOW / {statusLabel[item.status]}</p>
          <input className="module-title-input" aria-label="伏笔标题" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} onBlur={() => commit({ title: draft.title })} />
        </div>
        <button id={`delete-foreshadow-${item.id}`} className="icon-button danger" type="button" aria-label="删除伏笔" title="删除伏笔" onClick={() => {
          void confirm({ title: `删除伏笔「${item.title}」？`, description: '该伏笔的埋设与回收记录会被移除。', confirmLabel: '删除伏笔', tone: 'danger' }).then((ok) => { if (ok) deleteForeshadow(item.id); });
        }}><Trash2 size={15} /></button>
      </div>

      <div className="status-picker" role="group" aria-label="伏笔状态">
        {columns.map((column) => (
          <button key={column.key} type="button" className={`${column.key} ${draft.status === column.key ? 'is-active' : ''}`} onClick={() => commit({ status: column.key })}>
            {column.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>埋设章节</span>
        <select value={draft.plantedChapterId ?? ''} onChange={(event) => commit({ plantedChapterId: event.target.value || null })}>
          <option value="">未指定</option>
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
        </select>
      </label>

      <label className="field">
        <span>回收章节</span>
        <select value={draft.resolvedChapterId ?? ''} onChange={(event) => commit({ resolvedChapterId: event.target.value || null })}>
          <option value="">未指定</option>
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
        </select>
      </label>

      <label className="field">
        <span>伏笔内容</span>
        <textarea value={draft.description} placeholder="读者此刻看到了什么异常、对白或细节？" onChange={(event) => setDraft({ ...draft, description: event.target.value })} onBlur={() => commit({ description: draft.description })} />
      </label>

      <label className="field field-grow">
        <span>预期回收</span>
        <textarea value={draft.plannedPayoff} placeholder="计划如何兑现，兑现时会改变哪个认知？" onChange={(event) => setDraft({ ...draft, plannedPayoff: event.target.value })} onBlur={() => commit({ plannedPayoff: draft.plannedPayoff })} />
      </label>
    </section>
  );
}

export function ForeshadowView() {
  const data = useWriterStore((state) => state.data);
  const addForeshadow = useWriterStore((state) => state.addForeshadow);
  const [title, setTitle] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const items = useMemo(() => data.foreshadows.filter((item) => item.projectId === data.activeProjectId), [data.activeProjectId, data.foreshadows]);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const chapterName = (id: string | null) => data.chapters.find((chapter) => chapter.id === id)?.title ?? '未关联';

  const createItem = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    addForeshadow(trimmed);
    setTitle('');
  };

  return (
    <main className="module-stage">
      <header className="module-head">
        <div>
          <p className="eyebrow">FORESHADOWING BOARD</p>
          <h1>伏笔看板</h1>
          <p>从埋设到回收追踪每一条承诺，避免只有悬念没有兑现。</p>
        </div>
        <div className="module-stat"><strong>{items.filter((item) => item.status !== 'resolved').length}</strong><span>待回收</span></div>
      </header>
      <PageGuideBubble
        id="foreshadow"
        target='[data-tour="foreshadow-workspace"]'
        title="伏笔看板怎么用"
        points={[
          '先新建一个容易识别的伏笔标题。',
          '填写异常细节、埋设章节和预期回收方式。',
          '剧情兑现后把状态移动到“已回收”。',
        ]}
      />
            <form className="quick-create board-create" data-tour="foreshadow-workspace" onSubmit={(event) => { event.preventDefault(); createItem(); }}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="新增伏笔，例如：母亲留下的旧钥匙" aria-label="新增伏笔标题" />
        <button className="primary-button compact" type="submit"><Plus size={15} />新建伏笔</button>
      </form>

      <div className="module-split foreshadow-split">
        <section className="foreshadow-board" aria-label="伏笔看板">
          {columns.map((column) => {
            const columnItems = items.filter((item) => item.status === column.key);
            return (
              <div className={`foreshadow-column ${column.key}`} key={column.key}>
                <div className="foreshadow-column-head"><strong>{column.label}</strong><span>{columnItems.length}</span></div>
                <small>{column.hint}</small>
                <div className="foreshadow-stack">
                  {columnItems.map((item) => (
                    <button key={item.id} type="button" className={`foreshadow-card ${selected?.id === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}>
                      <Flag size={14} />
                      <strong>{item.title}</strong>
                      <span>{chapterName(item.plantedChapterId)} → {chapterName(item.resolvedChapterId)}</span>
                    </button>
                  ))}
                  {columnItems.length === 0 && <div className="column-empty">暂无</div>}
                </div>
              </div>
            );
          })}
        </section>
        {selected ? <ForeshadowEditor item={selected} /> : (
          <section className="foreshadow-editor foreshadow-editor-empty">
            <Flag size={24} />
            <h2>先埋下一枚钩子</h2>
            <p>记录它出现的位置、预期回收方式和状态。看板内容会随项目保存在本机。</p>
          </section>
        )}
      </div>
    </main>
  );
}
