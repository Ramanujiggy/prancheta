import { useEffect, type ReactNode } from 'react';
import { t } from '../lib/i18n.ts';

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="backdrop" onClick={onCancel}>
      <div className="card dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">{title}</h2>
        <p className="muted" style={{ margin: '10px 0 0' }}>
          {body}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    // Long enough to read: a longer message stays up longer.
    const t = setTimeout(onDone, Math.max(2600, message.length * 60));
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
