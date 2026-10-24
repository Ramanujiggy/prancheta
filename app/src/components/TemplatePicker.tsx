// "New class" sheet: plan it with AI, start blank, or from one of the ready-made classes.

import { useEffect } from 'react';
import { FilePlus2, MessagesSquare, X } from 'lucide-react';
import { templates, type Template } from '../lib/samples.ts';
import { FORMATS, FORMAT_ORDER, type FormatKey } from '../lib/plan.ts';
import { t } from '../lib/i18n.ts';

export function TemplatePicker({
  onBlank,
  onTemplate,
  onAi,
  onClose,
}: {
  onBlank: (format: FormatKey) => void;
  onTemplate: (t: Template) => void;
  onAi: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="card sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('newClass')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <div className="eyebrow-strong">{t('newClass')}</div>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              {t('howStart')}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button type="button" className="template ai-start" onClick={onAi}>
          <MessagesSquare size={20} color="var(--marker)" />
          <span>
            <span className="template-title">{t('aiStart')}</span>
            <span className="template-blurb">{t('aiStartBlurb')}</span>
          </span>
        </button>

        <div className="eyebrow ruled" style={{ margin: '20px 0 4px' }}>
          {t('pickLayout')}
        </div>
        <p className="section-hint" style={{ margin: '0 0 10px' }}>
          {t('pickLayoutLead')}
        </p>
        <div className="format-list">
          {FORMAT_ORDER.map((f, i) => (
            <button type="button" key={f} className="template blank" onClick={() => onBlank(f)} autoFocus={i === 0}>
              <FilePlus2 size={20} color="var(--ink)" />
              <span>
                <span className="template-title">{t(`format.${f}`)}</span>
                <span className="template-blurb">{t(`formatBlurb.${f}`)}</span>
                <span className="format-blocks" aria-hidden>
                  {FORMATS[f].map((k, j) => (
                    <span key={j}>{t(`short.${k}`)}</span>
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="eyebrow ruled" style={{ margin: '22px 0 10px' }}>
          {t('orExample')}
        </div>
        <div className="template-grid">
          {templates().map((tpl) => (
            <button type="button" key={tpl.key} className="template" onClick={() => onTemplate(tpl)}>
              <span>
                <span className="pill" style={{ marginBottom: 8 }}>
                  {t(`level.${tpl.level}`)}
                </span>
                <span className="template-title serif">{tpl.title}</span>
                <span className="template-blurb">{tpl.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
