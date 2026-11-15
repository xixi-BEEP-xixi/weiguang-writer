import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, FileDown, FileText, FolderOpen, Plus, ScrollText, Search, Trash2, X } from 'lucide-react';
import { NewProjectDialog } from './ProjectDialog';
import { useConfirm } from './ConfirmDialog';
import { downloadBlob, downloadTextFile, projectToDocx, projectToEpub, projectToMarkdown, projectToTxt } from '../domain/export';
import { useWriterStore } from '../data/writerStore';
import { searchWorkspaceScenes } from '../domain/search';

export function WorkspaceTree() {
  const data = useWriterStore((state) => state.data);
  const selectScene = useWriterStore((state) => state.selectScene);
  const setActiveNav = useWriterStore((state) => state.setActiveNav);
  const addChapter = useWriterStore((state) => state.addChapter);
  const addScene = useWriterStore((state) => state.addScene);
  const addProject = useWriterStore((state) => state.addProject);
  const deleteChapter = useWriterStore((state) => state.deleteChapter);
  const deleteScene = useWriterStore((state) => state.deleteScene);
  const updateChapterTitle = useWriterStore((state) => state.updateChapterTitle);
  const cycleChapterStatus = useWriterStore((state) => state.cycleChapterStatus);
  const confirm = useConfirm();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChapterId, setEditingChapterId] = useState('');
  const [chapterTitleDraft, setChapterTitleDraft] = useState('');
  const chapterStatusLabel = { draft: '草稿', revising: '修订', done: '完成' } as const;
  const commitChapterTitle = () => {
    if (editingChapterId) updateChapterTitle(editingChapterId, chapterTitleDraft);
    setEditingChapterId('');
  };

  const project = data.projects.find((item) => item.id === data.activeProjectId);
  const volumes = data.volumes.filter((item) => item.projectId === project?.id).sort((a, b) => a.sort - b.sort);
  const chapters = data.chapters.filter((item) => item.projectId === project?.id).sort((a, b) => a.sort - b.sort);
  const activeScene = data.scenes.find((item) => item.id === data.activeSceneId);
  const activeChapter = chapters.find((item) => item.id === activeScene?.chapterId);

  const searchResults = useMemo(
    () => searchWorkspaceScenes(data, searchQuery, 60),
    [data, searchQuery],
  );

  if (!project) return null;

  return (
    <aside className="tree-panel" aria-label="项目结构">
      <div className="tree-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>{project.name}</h1>
        </div>
        <div className="tree-heading-actions">
          <button className="icon-button" type="button" aria-label="搜索所有项目正文" title="搜索所有项目正文" onClick={() => setSearchOpen((open) => !open)}><Search size={15} /></button>
          <button className="icon-button" type="button" aria-label="导出 TXT" title="导出 TXT" onClick={() => {
            downloadTextFile(`${project.name}.txt`, projectToTxt(data, project.id));
          }}>
            <FileDown size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="导出 Markdown" title="导出 Markdown" onClick={() => {
            downloadTextFile(`${project.name}.md`, projectToMarkdown(data, project.id));
          }}>
            <FileText size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="导出 DOCX" title="导出 DOCX" onClick={() => {
            void projectToDocx(data, project.id).then((blob) => downloadBlob(`${project.name}.docx`, blob)).catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'DOCX 导出失败'));
          }}>
            <FileDown size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="导出 EPUB" title="导出 EPUB" onClick={() => {
            void projectToEpub(data, project.id).then((blob) => downloadBlob(`${project.name}.epub`, blob)).catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'EPUB 导出失败'));
          }}>
            <BookOpen size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="新建项目" title="新建项目" onClick={() => setProjectDialogOpen(true)}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {searchOpen && <div className="workspace-search">
        <div className="workspace-search-row">
          <Search size={14} />
          <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索所有项目正文" aria-label="搜索所有项目正文" />
          <button className="icon-button" type="button" aria-label="关闭搜索" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}><X size={14} /></button>
        </div>
        {searchQuery.trim() && <div className="workspace-search-results">
          {searchResults.map(({ scene, project: resultProject, chapter, snippet }) => (
            <button type="button" className="workspace-search-result" key={scene.id} onClick={() => { selectScene(scene.id); setActiveNav('writing'); setSearchOpen(false); }}>
              <em>{resultProject.name}</em>
              <strong>{chapter?.title ?? '未分章'} / {scene.title}</strong>
              <span>{snippet}</span>
            </button>
          ))}
          {searchResults.length === 0 && <p>没有匹配内容</p>}
        </div>}
      </div>}

      <div className="tree-scroll">
        {volumes.map((volume) => {
          const volumeChapters = chapters.filter((chapter) => chapter.volumeId === volume.id);
          return (
            <section key={volume.id} className="tree-section">
              <div className="tree-row tree-row-volume">
                <ChevronDown size={14} />
                <FolderOpen size={15} />
                <span>{volume.title}</span>
                <span className="tree-meta">{volumeChapters.length} 章</span>
              </div>
              {volumeChapters.map((chapter) => {
                const chapterScenes = data.scenes.filter((scene) => scene.chapterId === chapter.id).sort((a, b) => a.sort - b.sort);
                const chapterWords = chapterScenes.reduce((sum, scene) => sum + scene.wordCount, 0);
                return (
                  <div key={chapter.id} className="chapter-group">
                    <div className={`tree-row tree-row-chapter ${activeChapter?.id === chapter.id ? 'is-current' : ''}`} data-context-menu="chapter" data-context-label={`章节：${chapter.title}`} data-context-delete-target={`#delete-chapter-${chapter.id}`} data-context-delete-label="删除章节">
                      <ScrollText size={14} />
                      {editingChapterId === chapter.id ? (
                        <input
                          className="chapter-title-input"
                          value={chapterTitleDraft}
                          autoFocus
                          onChange={(event) => setChapterTitleDraft(event.target.value)}
                          onBlur={commitChapterTitle}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitChapterTitle();
                            if (event.key === 'Escape') setEditingChapterId('');
                          }}
                        />
                      ) : (
                        <button className="chapter-title-button" type="button" title="双击重命名章节" onDoubleClick={() => { setEditingChapterId(chapter.id); setChapterTitleDraft(chapter.title); }}>
                          {chapter.title}
                        </button>
                      )}
                      <span className="tree-meta">{chapterWords}</span>
                      <button className={`chapter-status-button ${chapter.status}`} type="button" title="切换章节状态" onClick={() => cycleChapterStatus(chapter.id)}>{chapterStatusLabel[chapter.status]}</button>
                      <button id={`delete-chapter-${chapter.id}`} className="tree-delete" type="button" title="删除章节" aria-label={`删除${chapter.title}`} onClick={() => { void confirm({ title: `删除「${chapter.title}」？`, description: `该章节下的 ${chapterScenes.length} 个场景和正文会一并删除。`, confirmLabel: '删除章节', tone: 'danger' }).then((ok) => { if (ok) deleteChapter(chapter.id); }); }}><Trash2 size={12} /></button>
                      <button className="tree-add" type="button" aria-label={`在 ${chapter.title} 新增场景`} title="新增场景" onClick={() => {
                        if (activeChapter?.id !== chapter.id) {
                          const firstScene = chapterScenes[0];
                          if (firstScene) selectScene(firstScene.id);
                        }
                        window.setTimeout(() => addScene(), 0);
                      }}><Plus size={13} /></button>
                    </div>
                    {chapterScenes.map((scene) => (                     <div key={scene.id} className={`tree-row tree-row-scene ${data.activeSceneId === scene.id ? 'is-active' : ''}`} data-context-menu="scene" data-context-label={`场景：${scene.title}`} data-context-delete-target={`#delete-scene-${scene.id}`} data-context-delete-label="删除场景">
                        <button type="button" className="tree-scene-select" onClick={() => selectScene(scene.id)}>
                          <FileText size={13} />
                          <span>{scene.title}</span>
                          <span className="tree-meta">{scene.wordCount}</span>
                        </button>
                        <button id={`delete-scene-${scene.id}`} className="tree-delete" type="button" title="删除场景" aria-label={`删除${scene.title}`} onClick={() => { void confirm({ title: `删除场景「${scene.title}」？`, description: '场景正文会一并删除，此操作无法恢复。', confirmLabel: '删除场景', tone: 'danger' }).then((ok) => { if (ok) deleteScene(scene.id); }); }}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                );
              })}
              <button className="tree-action" type="button" onClick={addChapter}>
                <Plus size={14} /> 新增章节
              </button>
            </section>
          );
        })}
      </div>

      <div className="tree-footer">
        <span className="status-dot" />
        <span>已自动保存</span>
        <span className="tree-footer-note">全项目搜索</span>
      </div>
      <NewProjectDialog
        open={projectDialogOpen}
        onConfirm={(name, memoryEnabled) => addProject(name, memoryEnabled)}
        onClose={() => setProjectDialogOpen(false)}
      />
    </aside>
  );
}
