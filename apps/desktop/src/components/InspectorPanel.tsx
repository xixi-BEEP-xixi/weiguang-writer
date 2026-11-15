import { Plus, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useWriterStore } from '../data/writerStore';
import { NameDialog } from './NameDialog';
import { useConfirm } from './ConfirmDialog';

export function InspectorPanel() {
  const data = useWriterStore((state) => state.data);
  const addCharacter = useWriterStore((state) => state.addCharacter);
  const deleteCharacter = useWriterStore((state) => state.deleteCharacter);
  const confirm = useConfirm();
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const project = data.projects.find((item) => item.id === data.activeProjectId);
  const activeScene = data.scenes.find((item) => item.id === data.activeSceneId);
  const activeChapter = data.chapters.find((item) => item.id === activeScene?.chapterId);
  const characters = data.characters.filter((item) => item.projectId === data.activeProjectId);
  const projectWords = data.scenes.filter((scene) => scene.projectId === data.activeProjectId).reduce((sum, scene) => sum + scene.wordCount, 0);
  const chapterWords = data.scenes.filter((scene) => scene.chapterId === activeChapter?.id).reduce((sum, scene) => sum + scene.wordCount, 0);
  const progress = Math.min(100, Math.round((projectWords / Math.max(project?.goalWords ?? 1, 1)) * 100));

  return (
    <aside className="inspector-panel" aria-label="资料与状态">
      <section className="inspector-section">
        <div className="section-title-row"><div><p className="eyebrow">SCENE</p><h2>当前场景</h2></div><span className="pill">草稿</span></div>
        <div className="stat-grid">
          <div className="stat-card"><span className="stat-label">场景字数</span><strong>{activeScene?.wordCount ?? 0}</strong></div>
          <div className="stat-card"><span className="stat-label">本章字数</span><strong>{chapterWords}</strong></div>
          <div className="stat-card"><span className="stat-label">全书字数</span><strong>{projectWords}</strong></div>
          <div className="stat-card"><span className="stat-label">目标进度</span><strong>{progress}%</strong></div>
        </div>
        <div className="progress-track" aria-label={`全书目标进度 ${progress}%`}><span style={{ width: `${Math.max(progress, 2)}%` }} /></div>
      </section>

      <section className="inspector-section">
        <div className="section-title-row"><div><p className="eyebrow">STORY BIBLE</p><h2>人物卡</h2></div><button className="icon-button" type="button" aria-label="添加人物" title="添加人物" onClick={() => setCharacterDialogOpen(true)}><Plus size={15} /></button></div>
        {characters.length === 0 ? <div className="empty-card"><UserRound size={18} /><p>按 Ctrl+B 创建人物，或在正文里 @ 一个名字。</p></div> : <div className="character-list">{characters.map((character) => <div key={character.id} className="character-row" data-context-menu="character" data-context-label={`人物：${character.name}`} data-context-delete-target={`#delete-character-${character.id}`} data-context-delete-label="删除人物"><span className="character-avatar">{character.name.slice(0, 1)}</span><div><strong>{character.name}</strong><span>{character.role}</span></div><button id={`delete-character-${character.id}`} className="character-delete" type="button" title="删除人物" aria-label={`删除${character.name}`} onClick={() => { void confirm({ title: `删除人物「${character.name}」？`, description: '人物卡会从当前作品中移除。', confirmLabel: '删除人物', tone: 'danger' }).then((ok) => { if (ok) deleteCharacter(character.id); }); }}><Trash2 size={13} /></button></div>)}</div>}
      </section>



      <div className="inspector-footer"><span className="status-dot" /><span>{project?.name ?? '未命名项目'}</span><span>v0.2.0</span></div>
      <NameDialog open={characterDialogOpen} title="新增人物" label="人物姓名" defaultValue="" confirmLabel="创建人物" onConfirm={addCharacter} onClose={() => setCharacterDialogOpen(false)} />
    </aside>
  );
}