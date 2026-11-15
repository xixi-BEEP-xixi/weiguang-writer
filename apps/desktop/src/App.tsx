import { useEffect, useState } from 'react';
import { AISettingsView } from './components/AISettingsView';
import { AppContextMenu } from './components/AppContextMenu';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { BookshelfView } from './components/BookshelfView';
import { AnalysisView } from './components/AnalysisView';
import { DataSettingsView } from './components/DataSettingsView';
import { ForeshadowView } from './components/ForeshadowView';
import { InspectorPanel } from './components/InspectorPanel';
import { MemoryView } from './components/MemoryView';
import { OutlineView } from './components/OutlineView';
import { ONBOARDING_STORAGE_KEY, OPEN_ONBOARDING_EVENT, OnboardingGuide } from './components/OnboardingGuide';
import { SceneEditor } from './components/SceneEditor';
import { Sidebar } from './components/Sidebar';
import { SettingsView } from './components/SettingsView';
import { StoryBibleView } from './components/StoryBibleView';
import { TimelineView } from './components/TimelineView';
import { TitleBar } from './components/TitleBar';
import { WorkspaceTree } from './components/WorkspaceTree';
import { saveWorkspace } from './data/workspaceRepository';
import { useWriterStore } from './data/writerStore';
import { createLocalDatabaseBackup } from './data/localArtifactStore';

export default function App() {
  const data = useWriterStore((state) => state.data);
  const activeNav = useWriterStore((state) => state.activeNav);
  const markSaved = useWriterStore((state) => state.markSaved);
  const markError = useWriterStore((state) => state.markError);
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'done'; } catch { return true; }
  });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveWorkspace(data)
        .then(() => markSaved())
        .catch((error: unknown) => markError(error instanceof Error ? error.message : 'SQLite 保存失败'));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [data, markError, markSaved]);
  useEffect(() => {
    void createLocalDatabaseBackup().catch(() => undefined);
  }, []);
  useEffect(() => {
    const openGuide = () => setOnboardingOpen(true);
    window.addEventListener(OPEN_ONBOARDING_EVENT, openGuide);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, openGuide);
  }, []);
  const closeOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_STORAGE_KEY, 'done'); } catch { /* Session-only dismissal. */ }
    setOnboardingOpen(false);
  };

  const scene = data.scenes.find((item) => item.id === data.activeSceneId);
  const chapter = data.chapters.find((item) => item.id === scene?.chapterId);
  const project = data.projects.find((item) => item.id === data.activeProjectId);

  const renderStage = () => {
    if (activeNav === 'shelf') return <BookshelfView />;
    if (activeNav === 'outline') return <OutlineView />;
    if (activeNav === 'bible') return <StoryBibleView />;
    if (activeNav === 'memory') return <MemoryView />;
    if (activeNav === 'timeline') return <TimelineView />;
    if (activeNav === 'foreshadow') return <ForeshadowView />;
    if (activeNav === 'checks') return <AnalysisView kind="book_scan" />;
    if (activeNav === 'analysis') return <AnalysisView kind="book_analysis" />;
    if (activeNav === 'aiSettings') return <AISettingsView />;
    if (activeNav === 'data') return <DataSettingsView />;
    if (activeNav === 'settings') return <SettingsView />;
    if (scene && chapter && project) return <SceneEditor scene={scene} chapterTitle={chapter.title} projectName={project.name} />;
    return <main className="placeholder-stage"><div className="placeholder-card"><h2>还没有可编辑的场景</h2><p>请从左侧新建章节或场景。</p></div></main>;
  };

  return (
    <ConfirmDialogProvider>
    <div className="desktop-window">
      <TitleBar />
      <div className={`app-shell ${activeNav === 'writing' ? 'is-writing' : 'is-module'}`}>
        <Sidebar />
        {activeNav === 'writing' && <WorkspaceTree />}
        {renderStage()}
        {activeNav === 'writing' && <InspectorPanel />}
      </div>
      {onboardingOpen && <OnboardingGuide onClose={closeOnboarding} />}
      <AppContextMenu />
    </div>
    </ConfirmDialogProvider>
  );
}
