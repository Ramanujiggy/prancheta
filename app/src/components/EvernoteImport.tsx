// The sheet shown while an Evernote export comes in: which note, which clip,
// and a Stop that keeps every class already brought in.

import type { EnexProgress } from '../lib/enexImport.ts';
import { t } from '../lib/i18n.ts';

export function EvernoteImport({ progress, onStop }: { progress: EnexProgress | null; onStop: () => void }) {
  const done = progress ? (progress.note - 1 + (progress.clips ? (progress.clip - 1) / progress.clips : 0)) / progress.notes : 0;
  return (
    <div className="backdrop">
      <div className="card dialog" role="dialog" aria-modal="true" aria-label={t('enTitle')}>
        <h2 className="card-title">{t('enTitle')}</h2>
        <p className="muted" style={{ margin: '10px 0 16px' }}>
          {t('enBody')}
        </p>
        {progress && (
          <p className="enex-now">
            <strong>{t('enNote', { i: progress.note, n: progress.notes })}</strong>
            {progress.title && <span> · {progress.title}</span>}
          </p>
        )}
        <div className="clip-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)}>
          <span style={{ width: `${Math.round(done * 100)}%` }} />
          <em>{progress?.clips ? t('enClip', { i: progress.clip, n: progress.clips }) : t('enReading')}</em>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onStop}>
            {t('enStop')}
          </button>
        </div>
      </div>
    </div>
  );
}
