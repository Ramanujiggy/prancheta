// "Plan with AI" sheet. Two steps: take the class format into the AI chat
// where the class is already being talked through (copy it, or save it as a
// file to upload), then bring the filled-in answer back, pasted or as a file.
// The class opens in the editor like any other, ready for clips and sending.

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ClipboardPaste, Copy, Download, Eraser, Upload, X } from 'lucide-react';
import { classFormat, readAiReply, type ReadError } from '../lib/aiClass.ts';
import { saveFile } from '../lib/files.ts';
import { readBackup } from '../lib/carry.ts';
import type { ClassPlan } from '../lib/plan.ts';
import { t, type Key } from '../lib/i18n.ts';

const ERRORS: Record<ReadError, Key> = {
  empty: 'aiErrEmpty',
  noJson: 'aiErrNoJson',
  cutOff: 'aiErrCutOff',
  badJson: 'aiErrBadJson',
  noBlocks: 'aiErrNoBlocks',
};

/** Copies text, falling back to a hidden field where the Clipboard API is missing or refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some in-app web views: copy through a hidden field.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function AiPlanner({
  onBack,
  onClose,
  onPlan,
  onClasses,
}: {
  onBack: () => void;
  onClose: () => void;
  onPlan: (plan: ClassPlan, skipped: number) => void;
  /** All classes copied from another Prancheta, pasted here by mistake. */
  onClasses: (raw: unknown[]) => void;
}) {
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const [error, setError] = useState<ReadError | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2400);
    return () => clearTimeout(timer);
  }, [copied]);

  const format = classFormat();
  const copy = async () => setCopied((await copyText(format)) ? 'ok' : 'failed');
  const saveFormat = () => void saveFile(new Blob([format], { type: 'text/plain' }), t('aiFormatFile')).catch(() => {});
  const fileRef = useRef<HTMLInputElement>(null);
  const clear = () => {
    setReply('');
    setError(null);
    replyRef.current?.focus();
  };
  const openFile = async (file: File) => {
    try {
      const text = await file.text();
      setReply(text);
      setError(null);
      submit(text);
    } catch {
      setError('noJson');
    }
  };

  // Back from the AI chat with its answer copied, one tap reads the
  // clipboard and builds the class. If the browser says no, the coach
  // pastes into the box by hand.
  const canPaste = 'clipboard' in navigator && 'readText' in navigator.clipboard;
  const pasteAndBuild = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError('empty');
        return;
      }
      setReply(text);
      setError(null);
      submit(text);
    } catch {
      replyRef.current?.focus();
    }
  };

  // Coming back to the app after copying the format, step 2 is next: bring it
  // into view so a phone doesn't start the coach at the top of the sheet.
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const handedOff = useRef(false);
  useEffect(() => {
    if (copied === 'ok') handedOff.current = true;
  }, [copied]);
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible' && handedOff.current) {
        replyRef.current?.closest('li')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);

  const submit = (text: string) => {
    const classes = readBackup(text);
    if (classes) return onClasses(classes);
    const result = readAiReply(text);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    onPlan(result.plan, result.skipped);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="card sheet ai-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('aiTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <button type="button" className="link ai-back" onClick={onBack}>
              <ArrowLeft size={14} /> {t('newClass')}
            </button>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              {t('aiTitle')}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="section-hint" style={{ margin: '4px 0 0' }}>
          {t('aiLead')}
        </p>

        <ol className="ai-steps">
          <li>
            <span className="ai-step-n">1</span>
            <div className="ai-step-body">
              <span className="field-label">{t('aiFormatLabel')}</span>
              <p className="section-hint" style={{ margin: 0 }}>
                {t('aiFormatHint')}
              </p>
              <p className="section-hint" style={{ margin: 0 }}>
                {t('aiNotesHint')}
              </p>
              <p className="section-hint" style={{ margin: 0 }}>
                {t('enHint')}
              </p>
              <div className="ai-actions">
                <button type="button" className="btn btn-primary" onClick={() => void copy()}>
                  {copied === 'ok' ? <Check size={16} /> : <Copy size={16} />}{' '}
                  {copied === 'ok' ? t('aiCopied') : t('aiCopyFormat')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={saveFormat}>
                  <Download size={16} /> {t('aiSaveFormat')}
                </button>
              </div>
              {copied === 'failed' && (
                <>
                  <p className="section-hint" style={{ margin: 0 }} role="alert">
                    {t('aiCopyFailed')}
                  </p>
                  <textarea className="textarea ai-prompt" readOnly value={format} onFocus={(e) => e.target.select()} />
                </>
              )}
            </div>
          </li>
          <li>
            <span className="ai-step-n">2</span>
            <div className="ai-step-body">
              <label className="field">
                <span className="field-label">{t('aiReplyLabel')}</span>
                <textarea
                  ref={replyRef}
                  className="textarea ai-reply"
                  rows={5}
                  value={reply}
                  placeholder={t('aiReplyPlaceholder')}
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setReply(e.target.value);
                    setError(null);
                  }}
                />
              </label>
              {error && (
                <p className="ai-error" role="alert">
                  {t(ERRORS[error])}
                </p>
              )}
              <div className="ai-actions">
                {canPaste && !reply.trim() ? (
                  <button type="button" className="btn btn-primary" onClick={() => void pasteAndBuild()}>
                    <ClipboardPaste size={16} /> {t('aiPasteBuild')}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={() => submit(reply)} disabled={!reply.trim()}>
                    {t('aiBuild')}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> {t('aiOpenFile')}
                </button>
                {reply && (
                  <button type="button" className="btn btn-ghost" onClick={clear}>
                    <Eraser size={16} /> {t('aiClear')}
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json,text/plain,.txt,.md"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void openFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
