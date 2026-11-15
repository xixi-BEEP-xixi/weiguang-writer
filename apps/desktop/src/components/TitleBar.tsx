import { getCurrentWindow } from '@tauri-apps/api/window';
import { BookOpen, ChevronDown, Maximize2, Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isTauriRuntime } from '../data/aiSettings';
import { useWriterStore } from '../data/writerStore';


export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const projects = useWriterStore((state) => state.data.projects);
  const activeProjectId = useWriterStore((state) => state.data.activeProjectId);
  const selectProject = useWriterStore((state) => state.selectProject);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void appWindow.isMaximized().then(setMaximized).catch(() => undefined);
    void appWindow.onResized(async () => {
      setMaximized(await appWindow.isMaximized().catch(() => false));
    }).then((dispose) => { unlisten = dispose; }).catch(() => undefined);
    return () => unlisten?.();
  }, []);

  const minimize = () => { if (isTauriRuntime()) void getCurrentWindow().minimize(); };
  const toggleMaximize = () => { if (isTauriRuntime()) void getCurrentWindow().toggleMaximize(); };
  const close = () => { if (isTauriRuntime()) void getCurrentWindow().close(); };

  return (
    <header className="window-titlebar" onDoubleClick={toggleMaximize}>
      <div className="window-titlebar-brand" data-tauri-drag-region>
        <span className="window-titlebar-mark" aria-hidden="true">微</span>
        <strong data-tauri-drag-region>微光写作台</strong>
        <span className="window-titlebar-caption" data-tauri-drag-region>长篇写作工作台</span>
      </div>
      <div className="window-project-switcher" onDoubleClick={(event) => event.stopPropagation()}>
        <BookOpen size={14} />
        <select value={activeProjectId} onChange={(event) => selectProject(event.target.value)} aria-label="切换正在写的书">
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <ChevronDown size={12} />
      </div>
      <div className="window-titlebar-drag" data-tauri-drag-region />
      <div className="window-controls" onDoubleClick={(event) => event.stopPropagation()}>
        <button className="window-control" type="button" aria-label="最小化" title="最小化" onClick={minimize}><Minus size={15} /></button>
        <button className="window-control" type="button" aria-label={maximized ? '还原窗口' : '最大化'} title={maximized ? '还原窗口' : '最大化'} onClick={toggleMaximize}>{maximized ? <Square size={12} /> : <Maximize2 size={13} />}</button>
        <button className="window-control window-control-close" type="button" aria-label="关闭" title="关闭" onClick={close}><X size={16} /></button>
      </div>
    </header>
  );
}