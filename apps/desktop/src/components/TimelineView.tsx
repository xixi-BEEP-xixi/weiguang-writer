import { useEffect, useMemo, useState } from 'react';
import { Clock3, GitBranch, Plus, Trash2 } from 'lucide-react';
import { useWriterStore } from '../data/writerStore';
import { PageGuideBubble } from './PageGuideBubble';
import { useConfirm } from './ConfirmDialog';
import type { TimelineEvent } from '../domain/types';

const statusLabel: Record<TimelineEvent['status'], string> = {
  planned: '计划',
  canonical: '已确认',
  changed: '已变更',
};

function EventEditor({ event }: { event: TimelineEvent }) {
  const data = useWriterStore((state) => state.data);
  const updateTimelineEvent = useWriterStore((state) => state.updateTimelineEvent);
  const deleteTimelineEvent = useWriterStore((state) => state.deleteTimelineEvent);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(event);

  useEffect(() => setDraft(event), [event]);

  const chapters = data.chapters.filter((chapter) => chapter.projectId === data.activeProjectId).sort((a, b) => a.sort - b.sort);
  const scenes = data.scenes.filter((scene) => scene.chapterId === draft.chapterId);
  const commit = (patch: Partial<TimelineEvent>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    updateTimelineEvent(event.id, {
      title: next.title,
      description: next.description,
      storyTime: next.storyTime,
      chapterId: next.chapterId,
      sceneId: next.sceneId,
      status: next.status,
    });
  };

  return (
    <section className="timeline-editor" aria-label={`${event.title} 时间线事件`} data-context-menu="timeline-event" data-context-label={`事件：${event.title}`} data-context-delete-target={`#delete-timeline-${event.id}`} data-context-delete-label="删除时间线事件">
      <div className="timeline-editor-head">
        <div>
          <p className="eyebrow">TIMELINE EVENT</p>
          <input
            className="module-title-input"
            aria-label="事件标题"
            value={draft.title}
            onChange={(change) => setDraft({ ...draft, title: change.target.value })}
            onBlur={() => commit({ title: draft.title })}
          />
        </div>
        <button id={`delete-timeline-${event.id}`} className="icon-button danger" type="button" aria-label="删除事件" title="删除事件" onClick={() => {
          void confirm({ title: `删除事件「${event.title}」？`, description: '时间线事件会从当前作品中移除。', confirmLabel: '删除事件', tone: 'danger' }).then((ok) => { if (ok) deleteTimelineEvent(event.id); });
        }}><Trash2 size={15} /></button>
      </div>

      <div className="form-grid two">
        <label className="field">
          <span>故事时间</span>
          <input value={draft.storyTime} placeholder="例如：第一日 · 黄昏" onChange={(change) => setDraft({ ...draft, storyTime: change.target.value })} onBlur={() => commit({ storyTime: draft.storyTime })} />
        </label>
        <label className="field">
          <span>确认状态</span>
          <select value={draft.status} onChange={(change) => commit({ status: change.target.value as TimelineEvent['status'] })}>
            {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="form-grid two">
        <label className="field">
          <span>关联章节</span>
          <select value={draft.chapterId ?? ''} onChange={(change) => {
            const chapterId = change.target.value || null;
            commit({ chapterId, sceneId: null });
          }}>
            <option value="">未关联</option>
            {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
          </select>
        </label>
        <label className="field">
          <span>关联场景</span>
          <select value={draft.sceneId ?? ''} disabled={!draft.chapterId} onChange={(change) => commit({ sceneId: change.target.value || null })}>
            <option value="">未关联</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title}</option>)}
          </select>
        </label>
      </div>

      <label className="field field-grow">
        <span>事件内容</span>
        <textarea value={draft.description} placeholder="发生了什么、谁在场、改变了什么……" onChange={(change) => setDraft({ ...draft, description: change.target.value })} onBlur={() => commit({ description: draft.description })} />
      </label>
    </section>
  );
}

export function TimelineView() {
  const data = useWriterStore((state) => state.data);
  const addTimelineEvent = useWriterStore((state) => state.addTimelineEvent);
  const [selectedId, setSelectedId] = useState('');

  const events = useMemo(
    () => data.timelineEvents.filter((event) => event.projectId === data.activeProjectId).sort((a, b) => a.sort - b.sort),
    [data.activeProjectId, data.timelineEvents],
  );
  const selected = events.find((event) => event.id === selectedId) ?? events[0] ?? null;
  const chapterName = (id: string | null) => data.chapters.find((chapter) => chapter.id === id)?.title ?? '未关联章节';

  return (
    <main className="module-stage">
      <header className="module-head">
        <div>
          <p className="eyebrow">STORY TIMELINE</p>
          <h1>时间线</h1>
          <p>按故事内时间记录不可逆事件，并与章节、场景保持稳定引用。</p>
        </div>
        <button className="primary-button" type="button" onClick={addTimelineEvent}><Plus size={16} />新增事件</button>
      </header>
      <PageGuideBubble
        id="timeline"
        target='[data-tour="timeline-workspace"]'
        title="时间线怎么用"
        points={[
          '新建事件并写清发生了什么。',
          '关联章节或场景，补充故事内部时间。',
          '按顺序检查因果、人物位置和多线冲突。',
        ]}
      />
            <div className="module-split timeline-split" data-tour="timeline-workspace">
        <section className="timeline-list-panel" aria-label="时间线事件列表">
          <div className="timeline-axis">
            {events.map((event, index) => (
              <button key={event.id} type="button" className={`timeline-item ${selected?.id === event.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(event.id)}>
                <span className="timeline-marker"><span>{String(index + 1).padStart(2, '0')}</span></span>
                <span className="timeline-item-copy">
                  <span className="timeline-meta"><Clock3 size={13} />{event.storyTime || '时间待定'}<em className={`timeline-status ${event.status}`}>{statusLabel[event.status]}</em></span>
                  <strong>{event.title}</strong>
                  <small>{chapterName(event.chapterId)}{event.description ? ` · ${event.description}` : ''}</small>
                </span>
              </button>
            ))}
            {events.length === 0 && (
              <div className="module-empty">
                <GitBranch size={20} />
                <strong>时间线还是空的</strong>
                <p>新增第一个事件，再把事件锚定到章节或场景。</p>
              </div>
            )}
          </div>
        </section>
        {selected ? <EventEditor event={selected} /> : (
          <section className="timeline-editor timeline-editor-empty">
            <GitBranch size={24} />
            <h2>从关键转折开始</h2>
            <p>事件不必等正文完成后再补录。先记录因果节点，写作时就能看到前后矛盾。</p>
          </section>
        )}
      </div>
    </main>
  );
}
