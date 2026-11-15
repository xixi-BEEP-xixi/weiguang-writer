import { CircleHelp, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';

const GLOBAL_TOUR_KEY = 'weiguang.ui-tour.v2';
const OPEN_PAGE_GUIDE_EVENT = 'weiguang:open-page-guide';

export function openPageGuide(id: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_PAGE_GUIDE_EVENT, { detail: id }));
}

export function PageGuideButton({ guideId }: { guideId: string }) {
  return <button className="page-guide-button" type="button" onClick={() => openPageGuide(guideId)}><CircleHelp size={14} />操作提示</button>;
}

export function PageGuideBubble({ id, target, title, points }: {
  id: string;
  target: string;
  title: string;
  points: string[];
}) {
  const storageKey = `weiguang.page-guide.${id}.v1`;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 120, left: 120 });

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey) === 'done';
      const globalTourDone = localStorage.getItem(GLOBAL_TOUR_KEY) === 'done';
      if (!seen && globalTourDone) {
        const timer = window.setTimeout(() => setOpen(true), 450);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Ignore unavailable storage and keep the page unobstructed.
    }
  }, [storageKey]);

  useEffect(() => {
    const openThisGuide = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id) setOpen(true);
    };
    window.addEventListener(OPEN_PAGE_GUIDE_EVENT, openThisGuide);
    return () => window.removeEventListener(OPEN_PAGE_GUIDE_EVENT, openThisGuide);
  }, [id]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const element = document.querySelector<HTMLElement>(target);
      if (!element) {
        setPosition({ top: Math.max(90, window.innerHeight / 2 - 100), left: Math.max(20, window.innerWidth / 2 - 180) });
        return;
      }
      const rect = element.getBoundingClientRect();
      setPosition({
        top: Math.max(72, rect.top + 18),
        left: Math.min(window.innerWidth - 380, Math.max(18, rect.left + 26)),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, target]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(storageKey, 'done'); } catch { /* Ignore storage failure. */ }
  };

  return (
    <>
      {!open && <button className="page-guide-trigger" type="button" aria-label="打开操作提示" title="操作提示" onClick={() => setOpen(true)}><CircleHelp size={15} />提示</button>}
      {open && <aside className="page-guide-bubble" style={{ top: position.top, left: position.left }} role="note" aria-label={title}>
        <header><strong>{title}</strong><button className="icon-button" type="button" aria-label="关闭提示" onClick={close}><X size={14} /></button></header>
        <ol>{points.map((point) => <li key={point}>{point}</li>)}</ol>
        <button className="page-guide-dismiss" type="button" onClick={close}>知道了</button>
      </aside>}
    </>
  );
}