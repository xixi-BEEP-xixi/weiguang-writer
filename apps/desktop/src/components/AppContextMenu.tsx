import { Clipboard, Copy, Scissors, TextSelect, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MenuItem {
  label: string;
  icon: 'cut' | 'copy' | 'paste' | 'select' | 'delete';
  danger?: boolean;
  action: () => void;
}

interface MenuState {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
}

const iconMap = { cut: Scissors, copy: Copy, paste: Clipboard, select: TextSelect, delete: Trash2 };

function editableElement(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest('input, textarea, [contenteditable="true"]');
  return element as HTMLInputElement | HTMLTextAreaElement | HTMLElement | null;
}

async function copySelection(): Promise<void> {
  const selected = window.getSelection()?.toString() ?? '';
  if (!selected) return;
  try { await navigator.clipboard.writeText(selected); } catch { document.execCommand('copy'); }
}

export function AppContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const target = event.target as HTMLElement;
      const editable = editableElement(target);
      const entity = target.closest<HTMLElement>('[data-context-menu]');
      const selectedText = window.getSelection()?.toString() ?? '';
      const items: MenuItem[] = [];
      if (editable) {
        editable.focus();
        items.push(
          { label: '剪切', icon: 'cut', action: () => document.execCommand('cut') },
          { label: '复制', icon: 'copy', action: () => { void copySelection(); } },
          { label: '粘贴', icon: 'paste', action: () => { void navigator.clipboard.readText().then((text) => document.execCommand('insertText', false, text)).catch(() => document.execCommand('paste')); } },
          { label: '全选', icon: 'select', action: () => document.execCommand('selectAll') },
        );
      } else if (selectedText) {
        items.push({ label: '复制所选内容', icon: 'copy', action: () => { void copySelection(); } });
      }
      const deleteTarget = entity?.dataset.contextDeleteTarget;
      if (deleteTarget) {
        items.push({
          label: entity?.dataset.contextDeleteLabel ?? '删除',
          icon: 'delete',
          danger: true,
          action: () => document.querySelector<HTMLButtonElement>(deleteTarget)?.click(),
        });
      }
      if (items.length === 0) {
        items.push({ label: '全选页面文字', icon: 'select', action: () => document.execCommand('selectAll') });
      }
      const width = 190;
      const height = items.length * 38 + 34;
      setMenu({
        x: Math.min(event.clientX, window.innerWidth - width - 10),
        y: Math.min(event.clientY, window.innerHeight - height - 10),
        label: entity?.dataset.contextLabel ?? (editable ? '文本操作' : '微光写作台'),
        items,
      });
    };
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, []);

  if (!menu) return null;
  return (
    <div className="app-context-menu" style={{ left: menu.x, top: menu.y }} role="menu" onMouseDown={(event) => event.stopPropagation()}>
      <span>{menu.label}</span>
      {menu.items.map((item) => {
        const Icon = iconMap[item.icon];
        return <button key={item.label} className={item.danger ? 'danger' : ''} type="button" role="menuitem" onClick={() => { item.action(); setMenu(null); }}><Icon size={14} />{item.label}</button>;
      })}
    </div>
  );
}