import { BookOpen, Check, ChevronRight, CircleAlert, FileText, Flag, LoaderCircle, ScrollText, Sparkles, Target, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { streamAI } from '../data/aiClient';
import { buildContextPack } from '../data/contextPack';
import { formatAiCost } from '../data/aiUsage';
import { useWriterStore } from '../data/writerStore';
import type { Chapter, OutlineEntityType, OutlineItem, OutlineStatus, Scene, Volume } from '../domain/types';
import { PageGuideBubble } from './PageGuideBubble';

const statusLabel: Record<OutlineStatus, string> = {
  planned: '未开始',
  writing: '进行中',
  done: '已完成',
  deviated: '偏离大纲',
};

const statusOptions = Object.entries(statusLabel) as Array<[OutlineStatus, string]>;

interface Selection { type: OutlineEntityType; id: string; }

function fallbackOutline(selection: Selection): Omit<OutlineItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> {
  return {
    entityType: selection.type,
    entityId: selection.id,
    goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned',
  };
}

export function OutlineView() {
  const data = useWriterStore((state) => state.data);
  const upsertOutlineItem = useWriterStore((state) => state.upsertOutlineItem);
  const updateChapterTitle = useWriterStore((state) => state.updateChapterTitle);
  const updateSceneTitle = useWriterStore((state) => state.updateSceneTitle);
  const selectScene = useWriterStore((state) => state.selectScene);
  const setActiveNav = useWriterStore((state) => state.setActiveNav);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [aiDraft, setAiDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [error, setError] = useState('');

  const project = data.projects.find((item) => item.id === data.activeProjectId);
  const volumes = data.volumes.filter((item) => item.projectId === project?.id).sort((a, b) => a.sort - b.sort);
  const chapters = data.chapters.filter((item) => item.projectId === project?.id).sort((a, b) => a.sort - b.sort);
  const scenes = data.scenes.filter((item) => item.projectId === project?.id).sort((a, b) => a.sort - b.sort);
  const currentSelection = selection ?? (chapters[0] ? { type: 'chapter' as const, id: chapters[0].id } : null);
  const entity = currentSelection?.type === 'volume'
    ? volumes.find((item) => item.id === currentSelection.id)
    : currentSelection?.type === 'chapter'
      ? chapters.find((item) => item.id === currentSelection.id)
      : scenes.find((item) => item.id === currentSelection?.id);
  const outline = currentSelection
    ? data.outlineItems.find((item) => item.projectId === project?.id && item.entityType === currentSelection.type && item.entityId === currentSelection.id)
    : undefined;
  const current = outline ?? (currentSelection ? fallbackOutline(currentSelection) : null);

  const progress = useMemo(() => {
    const chapterIds = new Set(chapters.map((chapter) => chapter.id));
    const items = data.outlineItems.filter((item) => item.projectId === project?.id && (item.entityType === 'chapter' || (item.entityType === 'scene' && scenes.some((scene) => scene.id === item.entityId && chapterIds.has(scene.chapterId)))));
    const withPlan = items.filter((item) => item.goal.trim() || item.conflict.trim() || item.turn.trim() || item.outcome.trim()).length;
    const done = items.filter((item) => item.status === 'done').length;
    return { total: chapters.length + scenes.length, withPlan, done };
  }, [chapters, data.outlineItems, project?.id, scenes]);

  if (!project) return null;

  const update = (patch: Partial<Pick<OutlineItem, 'goal' | 'conflict' | 'turn' | 'outcome' | 'characters' | 'notes' | 'status'>>) => {
    if (!currentSelection) return;
    upsertOutlineItem(currentSelection.type, currentSelection.id, patch);
  };

  const focusScene = (): { scene: Scene; chapter: Chapter } | null => {
    if (!currentSelection) return null;
    if (currentSelection.type === 'scene') {
      const scene = scenes.find((item) => item.id === currentSelection.id);
      const chapter = scene ? chapters.find((item) => item.id === scene.chapterId) : undefined;
      return scene && chapter ? { scene, chapter } : null;
    }
    if (currentSelection.type === 'chapter') {
      const chapter = chapters.find((item) => item.id === currentSelection.id);
      if (!chapter) return null;
      const candidates = scenes.filter((item) => item.chapterId === chapter.id);
      const scene = candidates.find((item) => item.id === chapter.defaultSceneId) ?? candidates[0];
      return scene ? { scene, chapter } : null;
    }
    const volume = volumes.find((item) => item.id === currentSelection.id);
    if (!volume) return null;
    const volumeChapters = chapters.filter((item) => item.volumeId === volume.id);
    const chapter = volumeChapters[0];
    const scene = chapter ? scenes.filter((item) => item.chapterId === chapter.id)[0] : undefined;
    return scene && chapter ? { scene, chapter } : null;
  };

  const generateOutline = async () => {
    const focus = focusScene();
    if (!focus || !currentSelection) {
      setError('当前条目还没有可读取的场景正文。');
      return;
    }
    setAiBusy(true); setError(''); setAiMessage('');
    try {
      const context = buildContextPack(data, focus.scene);
      const result = await streamAI(
        'outline',
        project.id,
        focus.scene.id,
        focus.chapter.id,
        `为${currentSelection.type === 'volume' ? '本卷' : currentSelection.type === 'chapter' ? '本章' : '本场景'}生成可执行大纲，包含目标、冲突、转折和结果。`,
        700,
        context,
      );
      setAiDraft(result.text);
      setAiMessage(result.cost ? `生成完成，参考费用 ${formatAiCost(result.cost.total_cost, result.cost.currency)}` : '生成完成');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI 大纲生成失败');
    } finally { setAiBusy(false); }
  };

  const rowButton = (type: OutlineEntityType, id: string, label: string, depth: number, icon: ReactNode) => {
    const rowOutline = data.outlineItems.find((item) => item.projectId === project.id && item.entityType === type && item.entityId === id);
    const active = currentSelection?.type === type && currentSelection.id === id;
    return (
      <button key={`${type}-${id}`} type="button" className={`outline-row depth-${depth} ${active ? 'is-active' : ''}`} onClick={() => { setSelection({ type, id }); setAiDraft(''); setAiMessage(''); }}>
        {icon}<span>{label}</span>
        <span className={`outline-dot ${rowOutline?.status ?? 'planned'}`} title={statusLabel[rowOutline?.status ?? 'planned']} />
        <ChevronRight size={13} />
      </button>
    );
  };

  const title = entity && 'title' in entity ? entity.title : '大纲';

  return (
    <main className="module-stage outline-stage">
      <header className="module-head">
        <div><p className="eyebrow">OUTLINE</p><h1>大纲</h1><p>规划全书、卷、章节和场景的目标、冲突、转折与结果。AI 只生成候选，不会自动覆盖。</p></div>
        <div className="module-stat"><strong>{progress.withPlan} / {progress.total}</strong><span>已填写大纲</span></div>
      </header>
      {error && <div className="ai-error" role="alert"><CircleAlert size={14} />{error}</div>}

      <div className="outline-layout">
        <aside className="outline-tree" aria-label="大纲结构">
          <div className="outline-tree-head"><strong>{project.name}</strong><span>{progress.done} 项完成</span></div>
          {volumes.map((volume: Volume) => (
            <div key={volume.id} className="outline-volume">
              {rowButton('volume', volume.id, volume.title, 0, <BookOpen size={14} />)}
              {chapters.filter((chapter) => chapter.volumeId === volume.id).map((chapter) => (
                <div key={chapter.id}>
                  {rowButton('chapter', chapter.id, chapter.title, 1, <ScrollText size={13} />)}
                  {scenes.filter((scene) => scene.chapterId === chapter.id).map((scene) => rowButton('scene', scene.id, scene.title, 2, <FileText size={12} />))}
                </div>
              ))}
            </div>
          ))}
          {chapters.length === 0 && <div className="module-empty"><Flag size={20} /><strong>还没有章节</strong><p>先在写作页创建章节，再回来规划大纲。</p></div>}
        </aside>

        <section className="outline-editor" aria-label="大纲编辑器">
          {current && currentSelection ? (
            <>
              <div className="outline-editor-head">
                <div>
                  <span className="outline-kind">{currentSelection.type === 'volume' ? '卷大纲' : currentSelection.type === 'chapter' ? '章大纲' : '场景大纲'}</span>
                  {currentSelection.type === 'chapter' && entity ? <input className="outline-title-input" value={title} onChange={(event) => updateChapterTitle(currentSelection.id, event.target.value)} aria-label="章节标题" /> : currentSelection.type === 'scene' && entity ? <input className="outline-title-input" value={title} onChange={(event) => updateSceneTitle(currentSelection.id, event.target.value)} aria-label="场景标题" /> : <h2>{title}</h2>}
                </div>
                <div className="outline-ai-actions">
                  <button className="secondary-button" type="button" disabled={aiBusy} onClick={() => void generateOutline()}>{aiBusy ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}{aiBusy ? '生成中' : 'AI 生成候选'}</button>
                  {currentSelection.type !== 'volume' && <button className="secondary-button" type="button" onClick={() => { if (currentSelection.type === 'scene') selectScene(currentSelection.id); else { const focus = focusScene(); if (focus) selectScene(focus.scene.id); } setActiveNav('writing'); }}>打开正文</button>}
                </div>
              </div>

              <div className="segmented outline-status-picker" aria-label="大纲状态">
                {statusOptions.map(([value, label]) => <button key={value} type="button" className={current.status === value ? 'is-active' : ''} onClick={() => update({ status: value })}>{label}</button>)}
              </div>

              <div className="outline-fields">
                <label className="field"><span><Target size={13} />{currentSelection.type === 'scene' ? '场景目的' : '写作目标'}</span><textarea value={current.goal} onChange={(event) => update({ goal: event.target.value })} placeholder="这一部分完成后，故事应该推进到哪里？" /></label>
                <label className="field"><span>核心冲突</span><textarea value={current.conflict} onChange={(event) => update({ conflict: event.target.value })} placeholder="谁与谁、或什么力量之间发生冲突？" /></label>
                <label className="field"><span>关键转折</span><textarea value={current.turn} onChange={(event) => update({ turn: event.target.value })} placeholder="原本的计划在哪里发生变化？" /></label>
                <label className="field"><span>结果与遗留问题</span><textarea value={current.outcome} onChange={(event) => update({ outcome: event.target.value })} placeholder="这一部分结束后，人物和局势变成什么样？" /></label>
                <label className="field"><span><Users size={13} />出场人物</span><input value={current.characters.join('、')} onChange={(event) => update({ characters: event.target.value.split(/[，,、]/).map((item) => item.trim()).filter(Boolean) })} placeholder="用顿号或逗号分隔" /></label>
                <label className="field"><span>补充备注</span><textarea value={current.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="伏笔、节奏、视角或不想忘记的细节。" /></label>
              </div>

              {(aiDraft || aiMessage) && <section className="outline-ai-draft">
                <div className="section-title-row"><div><p className="eyebrow">AI CANDIDATE</p><h3>AI 大纲候选</h3></div><Sparkles size={16} /></div>
                {aiMessage && <p className="settings-success">{aiMessage}</p>}
                <pre>{aiDraft}</pre>
                <div className="outline-ai-draft-actions">
                  <button className="primary-button compact" type="button" disabled={!aiDraft} onClick={() => update({ goal: aiDraft })}><Check size={14} />填入“写作目标”</button>
                  <button className="secondary-button" type="button" disabled={!aiDraft} onClick={() => update({ notes: [current.notes, aiDraft].filter(Boolean).join('\n\n') })}>追加到备注</button>
                </div>
              </section>}

              <p className="settings-security-note">大纲会随项目保存；AI 生成内容需要你手动填入，不会自动覆盖已有规划。</p>
            </>
          ) : <div className="module-empty"><Target size={22} /><strong>选择一个大纲条目</strong><p>从左侧选择卷、章或场景开始规划。</p></div>}
        </section>
      </div>

      <PageGuideBubble
        id="outline"
        target=".outline-layout"
        title="大纲怎么用"
        points={['每个卷、章和场景都可以记录目标、冲突、转折和结果。', '用“偏离大纲”标记正文和计划不一致的部分。', 'AI 只生成候选，需要你确认后才会填入。']}
      />
    </main>
  );
}