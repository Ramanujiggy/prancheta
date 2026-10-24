// Getting Prancheta onto the phone. Where the browser has an install button
// we use it; on Apple devices and a few Android browsers we show the steps,
// with the browser's own icons so the coach knows what to look for.

import { useEffect, useState, type ReactNode } from 'react';
import { Check, ClipboardCopy, Copy, Download, EllipsisVertical, Share, SquarePlus, X } from 'lucide-react';
import { canInstall, iosBrowser, type InstallState } from '../lib/pwa.ts';
import { Logo } from './Marks.tsx';
import { t, type Key } from '../lib/i18n.ts';

type Step = { title: ReactNode; body?: ReactNode; action?: ReactNode };

export function InstallGuide({
  install,
  hasPlans,
  onCarry,
  onClose,
}: {
  install: InstallState;
  hasPlans: boolean;
  /** Copies the classes, or saves a backup file where copying is blocked. */
  onCarry: () => Promise<'copied' | 'saved' | 'failed'>;
  onClose: () => void;
}) {
  const [carried, setCarried] = useState<'copied' | 'saved' | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Installed from this sheet (or elsewhere) while it was open: nothing left to do.
  useEffect(() => {
    if (!canInstall(install)) onClose();
  }, [install, onClose]);

  const kind = install.kind;

  // A home-screen app on Apple starts with empty storage, so classes made in
  // the browser travel over on the clipboard: copy here, paste there.
  const backup: Step = {
    title: t('installCarryTitle'),
    body: t(carried === 'saved' ? 'installBackupBody' : 'installCarryBody'),
    action: (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void onCarry().then((r) => r !== 'failed' && setCarried(r))}
      >
        {carried ? <Check size={16} /> : <ClipboardCopy size={16} />}{' '}
        {t(carried === 'copied' ? 'classesCopied' : carried === 'saved' ? 'installBackedUp' : 'copyClasses')}
      </button>
    ),
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.origin + '/');
      setCopied(true);
    } catch {
      // Clipboard blocked: the coach can still use Open in Safari.
    }
  };

  let steps: Step[] = [];
  if (kind === 'ios') {
    const shareWhere: Key = iosBrowser() === 'chrome' ? 'installIosShareChrome' : 'installIosShareSafari';
    steps = [
      ...(hasPlans ? [backup] : []),
      {
        title: (
          <>
            {t('installIosShare')} <Share size={16} className="install-glyph" />
          </>
        ),
        body: t(shareWhere),
      },
      {
        title: (
          <>
            {t('installIosAdd')} <SquarePlus size={16} className="install-glyph" />
          </>
        ),
        body: t('installIosAddBody'),
      },
      { title: t('installIosOpen'), body: t('installIosOpenBody') },
    ];
  } else if (kind === 'ios-inapp') {
    steps = [
      {
        title: t('installInAppTitle'),
        body: t('installInAppBody'),
        action: (
          <button type="button" className="btn btn-secondary" onClick={() => void copyLink()}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {t(copied ? 'installLinkCopied' : 'installCopyLink')}
          </button>
        ),
      },
      {
        title: (
          <>
            {t('installInAppThen')} <Share size={16} className="install-glyph" />
          </>
        ),
      },
    ];
  } else if (kind === 'mac-safari') {
    steps = [...(hasPlans ? [backup] : []), { title: t('installMacMenu') }, { title: t('installMacAdd'), body: t('installMacAddBody') }];
  } else if (kind === 'android-menu') {
    steps = [
      {
        title: (
          <>
            {t('installAndroidMenu')} <EllipsisVertical size={16} className="install-glyph" />
          </>
        ),
      },
      { title: t('installAndroidAdd') },
      { title: t('installAndroidOpen') },
    ];
  }

  const title: Key = kind === 'mac-safari' ? 'installTitleMac' : kind === 'prompt' ? 'installTitle' : 'installTitleHome';
  const lead: Key = kind === 'ios' || kind === 'ios-inapp' || kind === 'mac-safari' ? 'installLeadApple' : 'installLead';

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet install-guide" role="dialog" aria-modal="true" aria-label={t(title)} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Logo />
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <h2 className="page-title" style={{ fontSize: 30, margin: '14px 0 6px' }}>
          {t(title)}
        </h2>
        <p className="narrative" style={{ fontSize: 17 }}>
          {t(lead)}
        </p>

        {steps.length > 0 && (
          <ol className="install-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="section-index">{i + 1}</span>
                <span>
                  <strong>{s.title}</strong>
                  {s.body && <span className="muted">{s.body}</span>}
                  {s.action && <span className="install-step-action">{s.action}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}

        {kind === 'ios' && <p className="install-foot muted">{t('installIosMissing')}</p>}

        <div className="dialog-actions">
          {install.kind === 'prompt' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('notNow')}
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => void install.install()}>
                <Download size={16} /> {t('installApp')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
              {t('installGotIt')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
