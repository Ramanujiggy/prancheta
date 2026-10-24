// Theme: Auto (follows the phone), Navy, Tan, Light or Dark. A pick shows at
// once behind the sheet, so the coach can try them before closing.

import { useEffect } from 'react';
import { Check, Palette, X } from 'lucide-react';
import { setTheme, THEMES, useTheme, type Look, type Theme } from '../lib/theme.ts';
import { t } from '../lib/i18n.ts';

/** A tiny sheet of paper in a look's own colors: ink lines and the red marker. */
function Swatch({ look }: { look: Look }) {
  return (
    <span className="theme-swatch" data-theme={look} aria-hidden="true">
      <i className="sw-title" />
      <i className="sw-line" />
      <i className="sw-line short" />
      <i className="sw-marker" />
    </span>
  );
}

/** The top-bar button on wider screens. On a phone, Theme is a row in the ⋯ menu. */
export function ThemeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost hide-sm" onClick={onClick}>
      <Palette size={16} /> {t('theme')}
    </button>
  );
}

export function ThemeSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet theme-sheet" role="dialog" aria-modal="true" aria-label={t('theme')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="page-title" style={{ fontSize: 30, margin: 0 }}>
            {t('theme')}
          </h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted" style={{ margin: '6px 0 16px' }}>
          {t('themeLead')}
        </p>

        <div className="theme-list" role="radiogroup" aria-label={t('theme')}>
          {THEMES.map((th: Theme) => (
            <button
              key={th}
              type="button"
              role="radio"
              aria-checked={theme === th}
              className="theme-option"
              onClick={() => setTheme(th)}
            >
              {th === 'auto' ? (
                <span className="theme-swatch-pair">
                  <Swatch look="light" />
                  <Swatch look="navy" />
                </span>
              ) : (
                <Swatch look={th} />
              )}
              <span className="theme-name">
                <strong>{t(`theme.${th}`)}</strong>
                {th === 'auto' && <span className="muted">{t('theme.autoHint')}</span>}
              </span>
              {theme === th && <Check size={18} className="theme-check" />}
            </button>
          ))}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
}
