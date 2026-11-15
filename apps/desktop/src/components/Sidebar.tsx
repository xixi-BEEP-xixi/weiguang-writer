import { Bot, BookOpen, BrainCircuit, DatabaseBackup, Flag, GitBranch, LibraryBig, PenLine, ScanText, Settings2, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWriterStore } from '../data/writerStore';
import type { NavKey } from '../domain/types';

const navItems: Array<{ key: NavKey; label: string; icon: LucideIcon }> = [
  { key: 'shelf', label: '书架', icon: LibraryBig },
  { key: 'writing', label: '写作', icon: PenLine },
  { key: 'bible', label: '故事圣经', icon: BookOpen },
  { key: 'memory', label: '长期记忆', icon: BrainCircuit },
  { key: 'timeline', label: '时间线', icon: GitBranch },
  { key: 'foreshadow', label: '伏笔', icon: Flag },
  { key: 'checks', label: '体检', icon: ShieldCheck },
  { key: 'analysis', label: '整书分析', icon: ScanText },
];

export function Sidebar() {
  const activeNav = useWriterStore((state) => state.activeNav);
  const setActiveNav = useWriterStore((state) => state.setActiveNav);

  return (
    <aside className="nav-rail" aria-label="主导航">
      <div className="brand-mark" aria-label="微光写作台">
        <span>微</span>
      </div>
      <nav className="nav-list">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-button ${activeNav === key ? 'is-active' : ''}`}
            data-tour={key}
            onClick={() => setActiveNav(key)}
            type="button"
            aria-label={label}
            title={label}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="nav-bottom">
        <button className={`nav-button ${activeNav === 'aiSettings' ? 'is-active' : ''}`} data-tour="ai-settings" onClick={() => setActiveNav('aiSettings')} type="button" aria-label="AI 设置" title="AI 设置">
          <Bot size={18} strokeWidth={1.8} />
          <span>AI</span>
        </button>
        <button className={`nav-button ${activeNav === 'data' ? 'is-active' : ''}`} data-tour="data" onClick={() => setActiveNav('data')} type="button" aria-label="数据与备份" title="数据与备份">
          <DatabaseBackup size={18} strokeWidth={1.8} />
          <span>数据</span>
        </button>
        <button
          data-tour="settings"
          className={`nav-button ${activeNav === 'settings' ? 'is-active' : ''}`}
          onClick={() => setActiveNav('settings')}
          type="button"
          aria-label="设置"
          title="设置"
        >
          <Settings2 size={18} strokeWidth={1.8} />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
