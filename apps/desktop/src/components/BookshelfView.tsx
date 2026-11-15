import { BookOpen, BrainCircuit, ChevronRight, Clock3, FileText, LibraryBig, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { clearAiOperations } from '../data/aiMemoryStore';
import { useWriterStore } from '../data/writerStore';
import { NewProjectDialog } from './ProjectDialog';
import { useConfirm } from './ConfirmDialog';

const typeLabel = {
  webnovel: '连载小说',
  screenplay: '剧本',
  book: '长篇 / 短篇集',
  other: '其他项目',
} as const;

export function BookshelfView() {
  const data = useWriterStore((state) => state.data);
  const addProject = useWriterStore((state) => state.addProject);
  const deleteProject = useWriterStore((state) => state.deleteProject);
  const selectProject = useWriterStore((state) => state.selectProject);
  const setActiveNav = useWriterStore((state) => state.setActiveNav);
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const projects = [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const totalWords = data.scenes.reduce((sum, scene) => sum + scene.wordCount, 0);

  const removeProject = async (projectId: string, name: string) => {
    const chapters = data.chapters.filter((chapter) => chapter.projectId === projectId).length;
    const scenes = data.scenes.filter((scene) => scene.projectId === projectId).length;
    const confirmed = await confirm({
      title: `删除《${name}》？`,
      description: '这本书及其关联内容会从工作区中移除。',
      details: [`${chapters} 个章节`, `${scenes} 个场景`, '故事圣经、时间线、伏笔和长期记忆', '此操作无法恢复'],
      confirmLabel: '删除书籍',
      tone: 'danger',
    });
    if (!confirmed) return;
    await clearAiOperations(projectId).catch(() => undefined);
    deleteProject(projectId);
  };

  return (
    <main className="module-stage bookshelf-stage">
      <header className="module-head bookshelf-head">
        <div>
          <p className="eyebrow">LIBRARY</p>
          <h1>我的书架</h1>
          <p>选择一本书继续写作，或创建新的故事项目。每本书的章节、设定、长期记忆和恢复点彼此独立。</p>
        </div>
        <button className="primary-button bookshelf-create" type="button" onClick={() => setDialogOpen(true)}><Plus size={16} />新建书籍</button>
      </header>

      <div className="bookshelf-stats">
        <div><LibraryBig size={17} /><span>书籍</span><strong>{projects.length}</strong></div>
        <div><FileText size={17} /><span>总字数</span><strong>{totalWords.toLocaleString()}</strong></div>
        <div><BrainCircuit size={17} /><span>长期记忆</span><strong>{projects.filter((project) => project.aiMemoryEnabled).length} 本开启</strong></div>
      </div>

      <section className="bookshelf-grid" data-tour="shelf-grid" aria-label="书籍列表">
        {projects.map((project, index) => {
          const chapters = data.chapters.filter((chapter) => chapter.projectId === project.id);
          const scenes = data.scenes.filter((scene) => scene.projectId === project.id);
          const words = scenes.reduce((sum, scene) => sum + scene.wordCount, 0);
          return (
            <div
              key={project.id}
              className="book-card-shell"
              data-context-menu="book"
              data-context-label={`书籍：${project.name}`}
              data-context-delete-target={`#delete-book-${project.id}`}
              data-context-delete-label="删除这本书"
            >
              <button
                type="button"
                className={`book-card palette-${index % 5} ${project.id === data.activeProjectId ? 'is-current' : ''}`}
                onClick={() => { selectProject(project.id); setActiveNav('writing'); }}
              >
                <span className="book-spine"><span>{project.name.slice(0, 1)}</span></span>
                <span className="book-card-body">
                  <span className="book-card-topline"><span>{typeLabel[project.type]}</span>{project.id === data.activeProjectId && <em>当前</em>}</span>
                  <strong>{project.name}</strong>
                  <span className="book-card-metrics">
                    <span>{chapters.length} 章</span>
                    <span>{words.toLocaleString()} 字</span>
                    {project.aiMemoryEnabled && <span className="book-memory-on"><BrainCircuit size={11} />记忆开启</span>}
                  </span>
                  <span className="book-card-updated"><Clock3 size={11} />更新于 {new Date(project.updatedAt).toLocaleDateString()}</span>
                </span>
                <ChevronRight className="book-card-arrow" size={17} />
              </button>
              <button id={`delete-book-${project.id}`} className="book-card-delete" type="button" title="删除这本书" aria-label={`删除《${project.name}》`} onClick={() => void removeProject(project.id, project.name)}><Trash2 size={14} /></button>
            </div>
          );
        })}
        <button type="button" className="book-card book-card-new" onClick={() => setDialogOpen(true)}>
          <span className="book-new-icon"><Plus size={22} /></span>
          <strong>创建新书</strong>
          <span>从一个新的故事世界开始</span>
        </button>
      </section>

      {projects.length === 0 && <section className="bookshelf-empty"><BookOpen size={26} /><strong>书架还是空的</strong><p>创建第一本书，开始整理人物、章节与故事线。</p><button className="primary-button" type="button" onClick={() => setDialogOpen(true)}>创建第一本书</button></section>}

      <NewProjectDialog open={dialogOpen} onConfirm={(name, memoryEnabled) => { addProject(name, memoryEnabled); setActiveNav('writing'); }} onClose={() => setDialogOpen(false)} />
    </main>
  );
}