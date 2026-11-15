import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, ChevronLeft, ChevronRight, Heading2, History, Italic, List, ListOrdered, Maximize2, Minimize2, Quote, Redo2, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createSceneVersion } from '../data/versionClient';
import { useWriterStore } from '../data/writerStore';
import { BlockIdExtension } from '../domain/blockIdExtension';
import type { Scene } from '../domain/types';
import { AIAssistantPanel } from './AIAssistantPanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';

interface SceneEditorProps {
  scene: Scene;
  chapterTitle: string;
  projectName: string;
}

const createBaseExtensions = () => [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Placeholder.configure({ placeholder: '先写下第一章吧——哪怕只有一句话。' }),
  CharacterCount.configure({ limit: 200_000 }),
  BlockIdExtension,
];

export function SceneEditor({ scene, chapterTitle, projectName }: SceneEditorProps) {
  const updateSceneDoc = useWriterStore((state) => state.updateSceneDoc);
  const updateSceneTitle = useWriterStore((state) => state.updateSceneTitle);
  const data = useWriterStore((state) => state.data);
  const selectScene = useWriterStore((state) => state.selectScene);
  const sceneIdRef = useRef(scene.id);
  const [aiOpen, setAiOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [saveHint, setSaveHint] = useState('自动保存 · 2s');
  const [, setSelectionRevision] = useState(0);

  useEffect(() => { sceneIdRef.current = scene.id; }, [scene.id]);
  useEffect(() => {
    document.documentElement.dataset.focusMode = focusMode ? 'true' : 'false';
    return () => { delete document.documentElement.dataset.focusMode; };
  }, [focusMode]);

  useEffect(() => {
    const openAssistant = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        setAiOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setVersionsOpen(true);
        setAiOpen(false);
      }
      if (event.key === 'Escape') { setAiOpen(false); setVersionsOpen(false); }
    };
    window.addEventListener('keydown', openAssistant);
    return () => window.removeEventListener('keydown', openAssistant);
  }, []);

  const editor = useEditor({
    extensions: createBaseExtensions(),
    content: scene.doc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'novel-prose',
        'aria-label': '场景正文编辑器',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      updateSceneDoc(sceneIdRef.current, currentEditor.getJSON());
    },
    onSelectionUpdate: () => setSelectionRevision((value) => value + 1),
  }, [scene.id]);

  useEffect(() => {
    if (!editor) return;
    const timer = window.setInterval(() => {
      if (editor.getText().trim().length < 20) return;
      void createSceneVersion(scene.projectId, scene.id, editor.getJSON(), '自动快照').catch(() => undefined);
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [editor, scene.id, scene.projectId]);

  if (!editor) return <main className="editor-stage"><div className="editor-paper editor-loading">正在打开场景…</div></main>;

  const chapters = data.chapters.filter((item) => item.projectId === scene.projectId).sort((a, b) => a.sort - b.sort);
  const chapterIndex = chapters.findIndex((item) => item.id === scene.chapterId);
  const navigateChapter = (delta: number) => {
    const target = chapters[chapterIndex + delta];
    if (!target) return;
    const targetScene = data.scenes.find((item) => item.id === target.defaultSceneId)
      ?? data.scenes.filter((item) => item.chapterId === target.id).sort((a, b) => a.sort - b.sort)[0];
    if (targetScene) selectScene(targetScene.id);
  };
  const statusLabel = { draft: '草稿', revising: '修订中', done: '已完成' }[scene.status];
  const tool = (label: string, icon: ReactNode, active: boolean, action: () => void, tour?: string) => (
    <button className={`tool-button ${active ? 'is-active' : ''}`} type="button" title={label} aria-label={label} data-tour={tour} onClick={action}>{icon}</button>
  );

  return (
    <main className="editor-stage">
      <div className="editor-heading">
        <div className="breadcrumb"><span>{projectName}</span><span className="breadcrumb-sep">/</span><span>{chapterTitle}</span><span className="breadcrumb-sep">/</span><span className="breadcrumb-current">{scene.title}</span></div>
        <div className="scene-title-row"><input className="scene-title-input" value={scene.title} onChange={(event) => updateSceneTitle(scene.id, event.target.value)} aria-label="场景标题" /><span className={`scene-state ${scene.status}`}>{statusLabel}</span></div>
      </div>
      <div className="editor-toolbar" data-tour="editor-toolbar" aria-label="编辑工具栏">
        {tool('加粗', <Bold size={15} />, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
        {tool('斜体', <Italic size={15} />, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
        {tool('二级标题', <Heading2 size={15} />, editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        {tool('引用', <Quote size={15} />, editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
        {tool('无序列表', <List size={15} />, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
        {tool('有序列表', <ListOrdered size={15} />, editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
        <span className="toolbar-divider" />
        {tool('撤销', <Undo2 size={15} />, false, () => editor.chain().focus().undo().run())}
        {tool('重做', <Redo2 size={15} />, false, () => editor.chain().focus().redo().run())}
        <span className="toolbar-spacer" />
        {tool('版本历史', <History size={15} />, versionsOpen, () => { setVersionsOpen((open) => !open); setAiOpen(false); })}
        {tool('AI 写作助手', <Sparkles size={15} />, aiOpen, () => { setAiOpen((open) => !open); setVersionsOpen(false); }, 'ai-assistant')}
        {tool(focusMode ? '退出专注模式' : '专注模式', focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />, focusMode, () => setFocusMode((value) => !value))}
        <span className="toolbar-hint">Ctrl + Enter · AI 助手</span>
      </div>
      <div className="editor-scroll"><div className="editor-paper"><EditorContent editor={editor} /></div></div>
      {aiOpen && <AIAssistantPanel editor={editor} scene={scene} chapterId={scene.chapterId} onClose={() => setAiOpen(false)} />}
      {versionsOpen && <VersionHistoryPanel editor={editor} scene={scene} onClose={() => setVersionsOpen(false)} />}
      <div className="editor-footer">
        <span>{scene.wordCount} 字</span>
        <span>{saveHint}</span>
        <div className="chapter-nav">
          <button type="button" disabled={chapterIndex <= 0} onClick={() => navigateChapter(-1)}><ChevronLeft size={14} />上一章</button>
          <span>{Math.max(1, chapterIndex + 1)} / {chapters.length}</span>
          <button type="button" disabled={chapterIndex < 0 || chapterIndex >= chapters.length - 1} onClick={() => navigateChapter(1)}>下一章<ChevronRight size={14} /></button>
        </div>
      </div>
    </main>
  );
}