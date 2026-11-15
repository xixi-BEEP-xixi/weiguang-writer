import { Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

type ConfirmResolver = (value: boolean) => void;
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return useContext(ConfirmContext);
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<ConfirmResolver | null>(null);

  const finish = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish, options]);

  const danger = options?.tone !== 'default';
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(false); }}>
        <section className={`confirm-dialog ${danger ? 'is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <header>
            <span className="confirm-icon">{danger ? <TriangleAlert size={19} /> : <Info size={19} />}</span>
            <button className="icon-button" type="button" aria-label="关闭确认弹窗" onClick={() => finish(false)}><X size={15} /></button>
          </header>
          <h2 id="confirm-title">{options.title}</h2>
          {options.description && <div className="confirm-description">{options.description}</div>}
          {options.details && options.details.length > 0 && <ul className="confirm-details">{options.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
          <footer>
            <button className="secondary-button" type="button" onClick={() => finish(false)}>{options.cancelLabel ?? '取消'}</button>
            <button className={danger ? 'primary-button confirm-danger-button' : 'primary-button'} type="button" autoFocus onClick={() => finish(true)}>{options.confirmLabel ?? '确认'}</button>
          </footer>
        </section>
      </div>}
    </ConfirmContext.Provider>
  );
}