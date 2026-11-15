import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  defaultValue: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function NameDialog({ open, title, label, defaultValue, confirmLabel, onConfirm, onClose }: NameDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [defaultValue, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="name-dialog" role="dialog" aria-modal="true" aria-labelledby="name-dialog-title" onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (!next) return;
        onConfirm(next);
        onClose();
      }}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">NEW</p>
            <h2 id="name-dialog-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <label className="field-label" htmlFor="name-dialog-input">{label}</label>
        <input
          ref={inputRef}
          id="name-dialog-input"
          className="text-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          maxLength={80}
        />
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit" disabled={!value.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}