// The last line of defence: if a screen ever fails to draw, show a way out
// instead of a blank page, and let the coach save their data first.

import { Component, type ReactNode } from 'react';
import { PLANS_KEY } from '../lib/storage.ts';
import { t } from '../lib/i18n.ts';

function rawPlans(): string {
  try {
    return localStorage.getItem(PLANS_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const saveRaw = () => {
      const url = URL.createObjectURL(new Blob([rawPlans()], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prancheta-plans.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    return (
      <div className="shell">
        <div className="card empty">
          <h1 className="card-title">{t('errorTitle')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('errorBody')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                window.location.hash = '#/';
                window.location.reload();
              }}
            >
              {t('backToClasses')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={saveRaw}>
              {t('errorSaveCopy')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
