// Home: every class plan, newest first, and the one action that matters —
// start a new class.

import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, CircleHelp, Copy, Download, MoreHorizontal, MonitorDown, Palette, Play, Trash2, Upload, X } from 'lucide-react';
import {
  allMoves,
  blankPlan,
  duplicatePlan,
  firstOf,
  formatMinutes,
  nextClass,
  normalizePlan,
  shelveLibrary,
  storedPlan,
  todayISO,
  totalMinutes,
  type ClassPlan,
  type FormatKey,
} from '../lib/plan.ts';
import { hrefFor, navigate } from '../lib/router.ts';
import type { PlansApi } from '../lib/usePlans.ts';
import { ConfirmDialog } from '../components/feedback.tsx';
import { formatDate } from '../components/PrintSheet.tsx';
import { TemplatePicker } from '../components/TemplatePicker.tsx';
import { AiPlanner } from '../components/AiPlanner.tsx';
import { planFromJson, readAiReply } from '../lib/aiClass.ts';
import { ClipboardIcon, Logo } from '../components/Marks.tsx';
import type { Template } from '../lib/samples.ts';
import { canInstall, isApple, isStandalone, type InstallState } from '../lib/pwa.ts';
import { restoreClipData, withClipData } from '../lib/clips.ts';
import { saveFile } from '../lib/files.ts';
import { carryOfferDone, copyClasses, freshCopy, markCarryDone, readBackup, readClipboard } from '../lib/carry.ts';
import { t, type Key } from '../lib/i18n.ts';
import { lastOpened } from '../lib/lastOpened.ts';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { ThemeButton, ThemeSheet } from '../components/ThemeSheet.tsx';
import { Shelf, useJustFiled } from '../components/Shelf.tsx';
import { EvernoteImport } from '../components/EvernoteImport.tsx';
import { looksLikeEnex } from '../lib/evernote.ts';
import type { EnexProgress } from '../lib/enexImport.ts';

const STRUCTURE: Key[] = ['stripWarmup', 'sec.concept', 'sec.game', 'sec.gems', 'sec.freeRoll'];

/** What a class is about, on its card: the concept, the game, how many moves. */
function PlanCardBody({ plan }: { plan: ClassPlan }) {
  const rule = firstOf(plan, 'concept')?.rule;
  const game = plan.blocks.find((b) => b.kind === 'game' && b.start.trim());
  const moves = allMoves(plan).filter((m) => m.name.trim()).length;
  return (
    <>
      <p className="plan-card-concept">{rule || <span className="muted">{t('noConcept')}</span>}</p>
      <div className="plan-card-meta">
        {game?.kind === 'game' && (
          <span className="pill">
            {game.start}
            {game.objective ? ` → ${game.objective}` : ''}
          </span>
        )}
        {moves > 0 && <span className="pill">{t('gemCount', { n: moves })}</span>}
      </div>
    </>
  );
}

/** On a phone the top bar's rarer actions fold into one menu, so the bar
 *  keeps the language switch and the logo room to breathe. */
function MoreMenu({ items }: { items: { icon: JSX.Element; label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="more-menu show-sm" ref={ref}>
      <button type="button" className="icon-btn" aria-label={t('more')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="more-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Writes plans to a backup file, with their technique clips inside so nothing is lost. */
export async function downloadBackup(filename: string, plans: ClassPlan | ClassPlan[]) {
  const list = Array.isArray(plans) ? plans : [plans];
  const withClips = (await withClipData(list)).map(storedPlan);
  const data = Array.isArray(plans) ? withClips : withClips[0];
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await saveFile(blob, filename);
}

export function LibraryPage({
  api,
  notify,
  install,
  onHelp,
  onInstall,
  pickerOpen,
  setPickerOpen,
}: {
  api: PlansApi;
  notify: (m: string) => void;
  install: InstallState;
  onHelp: () => void;
  onInstall: () => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<ClassPlan | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const today = todayISO();
  const shelf = shelveLibrary(api.plans, today);
  const next = nextClass(api.plans);
  // The Teach button follows the class the coach tapped, else the class opened
  // last, else the next one by date.
  const [selected, setSelected] = useState<string | null>(null);
  const picked = api.plans.find((p) => p.id === selected) ?? api.plans.find((p) => p.id === lastOpened()) ?? next;
  // On a phone a first tap selects a card for the Teach button; a second tap (or its title) opens it.
  const tapCard = (p: ClassPlan) => {
    if (p !== picked && window.matchMedia('(max-width: 620px)').matches) setSelected(p.id);
    else navigate({ name: 'edit', id: p.id });
  };
  const filing = useJustFiled(shelf.months);
  // Just-filed classes keep their card for a beat, then fold into their month.
  const folding = shelf.months.flatMap((m) => m.plans).filter((p) => filing.folding.includes(p.id));
  const cards = [...shelf.cards, ...folding];

  const open = (plan: ClassPlan) => {
    api.upsert(plan);
    setPickerOpen(false);
    setAiOpen(false);
    navigate({ name: 'edit', id: plan.id });
  };
  const create = () => setPickerOpen(true);

  // Classes waiting elsewhere: in Safari, when this is the Home Screen app on
  // Apple, or at an old web address that sent the coach here with ?paste.
  const [carryOffer, setCarryOffer] = useState(
    () => !carryOfferDone() && ((isStandalone() && isApple()) || new URLSearchParams(location.search).has('paste')),
  );
  // iOS can refuse to let a button read the clipboard (the coach misses its
  // little Paste bubble). Then a box takes a normal press-and-hold paste.
  const [pasteBox, setPasteBox] = useState(false);
  const [enex, setEnex] = useState<{ progress: EnexProgress | null } | null>(null);
  const enexStop = useRef(false);
  const closeCarry = () => {
    markCarryDone();
    setCarryOffer(false);
    setPasteBox(false);
  };

  /** Stores backup plans, their clips first. Says how it went. */
  const importBackup = async (raw: unknown[]): Promise<boolean> => {
    const list = raw.map(normalizePlan).filter((p): p is ClassPlan => p !== null);
    if (!list.length) return false;
    try {
      await restoreClipData(raw);
    } catch {
      notify(t('importNoSpace'));
      return true;
    }
    const changed = api.importMany(list);
    notify(changed ? (changed === 1 ? t('importedOne') : t('importedMany', { n: changed })) : t('importNothing'));
    return true;
  };

  /** Classes copied from another Prancheta: from the paste offer, the footer, or the AI box. */
  const pasteClasses = async (raw: unknown[]) => {
    // On a fresh copy, the coach's own classes replace the untouched example
    // rather than sit beside a second one. Anywhere else nothing is removed.
    const examples = freshCopy(api.plans) ? api.plans.map((p) => p.id) : [];
    if (!(await importBackup(raw))) return notify(t('pasteNothing'));
    const pasted = new Set(raw.map((p) => (p as { id?: unknown } | null)?.id));
    examples.filter((id) => !pasted.has(id)).forEach(api.remove);
    closeCarry();
  };

  const paste = async () => {
    const text = await readClipboard();
    if (text === null) {
      setCarryOffer(true);
      setPasteBox(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return notify(t('pasteRefused'));
    }
    const raw = readBackup(text);
    if (raw) await pasteClasses(raw);
    else notify(t('pasteNothing'));
  };

  const copyAll = async () => {
    if (await copyClasses(api.plans)) notify(t('classesCopied'));
    else notify(t('copyFailed'));
  };

  /** An Evernote export: every note a class, every GIF a technique with its clip. */
  const importEvernote = async (text: string) => {
    enexStop.current = false;
    setEnex({ progress: null });
    try {
      const { importEnex } = await import('../lib/enexImport.ts');
      const r = await importEnex(
        text,
        (plan) => api.importMany([plan]),
        (progress) => setEnex({ progress }),
        () => enexStop.current,
      );
      if (r.error) notify(r.error);
      else if (!r.classes && !enexStop.current) notify(t('enEmpty'));
      else
        notify(
          t('enDone', {
            classes: t(r.classes === 1 ? 'planCountOne' : 'planCountMany', { n: r.classes }),
            clips: r.clips === 1 ? t('enClipsOne') : t('enClipsMany', { n: r.clips }),
          }) +
            (r.skipped ? t('enSkipped', { n: r.skipped }) : '') +
            (r.missing ? t('enMissing', { n: r.missing }) : ''),
        );
    } catch (e) {
      console.error(e);
      notify(t('importBad'));
    } finally {
      setEnex(null);
    }
  };

  const onImport = async (file: File) => {
    // The picker takes any file now, so a photo or video is turned away before it's read.
    if (/^(image|video|audio)\//.test(file.type)) return notify(t('importBad'));
    let raw: unknown[];
    try {
      const text = await file.text();
      if (looksLikeEnex(text)) return void (await importEvernote(text));
      const classFile = await import('../lib/classFile.ts');
      if (classFile.looksLikeClassFile(text)) {
        const plan = classFile.readClassFile(text);
        raw = plan ? [plan] : [];
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        // A backup's plans carry createdAt. Anything else is class JSON an AI
        // (or a person) wrote, which becomes a new class.
        const backup = Array.isArray(parsed) || (parsed && typeof parsed === 'object' && 'createdAt' in parsed);
        if (!backup) {
          const result = parsed ? planFromJson(parsed) : readAiReply(text);
          if ('plan' in result) {
            open(result.plan);
            notify(result.skipped ? t('aiBuiltSkipped', { n: result.skipped }) : t('aiBuilt'));
            return;
          }
        }
        raw = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      }
    } catch {
      raw = [];
    }
    if (!(await importBackup(raw))) notify(t('importBad'));
  };

  const exportAll = async () => {
    try {
      await downloadBackup(`prancheta-backup-${todayISO()}.json`, api.plans);
    } catch {
      notify(t('backupFailed'));
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
        </div>
        <div className="topbar-actions">
          <LangSwitch />
          <ThemeButton onClick={() => setThemeOpen(true)} />
          {canInstall(install) && (
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={t('installApp')}
              onClick={install.kind === 'prompt' ? () => void install.install() : onInstall}
            >
              <MonitorDown size={16} /> <span className="hide-sm">{t('installApp')}</span>
            </button>
          )}
          <button type="button" className="btn btn-ghost hide-sm" onClick={onHelp}>
            <CircleHelp size={16} /> {t('howItWorks')}
          </button>
          <button type="button" className="btn btn-ghost hide-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {t('import')}
          </button>
          {api.plans.length > 0 && (
            <button type="button" className="btn btn-ghost hide-sm" onClick={() => void exportAll()}>
              <Download size={16} /> {t('exportAll')}
            </button>
          )}
          <MoreMenu
            items={[
              { icon: <CircleHelp size={16} />, label: t('howItWorks'), onClick: onHelp },
              { icon: <Palette size={16} />, label: t('theme'), onClick: () => setThemeOpen(true) },
              { icon: <Upload size={16} />, label: t('import'), onClick: () => fileRef.current?.click() },
              ...(api.plans.length > 0
                ? [{ icon: <Download size={16} />, label: t('exportAll'), onClick: () => void exportAll() }]
                : []),
            ]}
          />
          {/* No accept list: iPhone greys out any file whose type it doesn't know, such as
              Evernote's .enex. What the file holds decides how it's read. */}
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {carryOffer && (pasteBox || freshCopy(api.plans)) && (
        <div className="subpanel carry-offer" role="region" aria-label={t('carryTitle')}>
          <div>
            <strong>{t('carryTitle')}</strong>
            <span className="muted">{t(isStandalone() && isApple() ? 'carryBodyApple' : 'carryBody')}</span>
            {pasteBox && (
              <textarea
                className="textarea carry-box"
                rows={2}
                autoFocus
                value=""
                placeholder={t('pasteHere')}
                aria-label={t('pasteHere')}
                onChange={(e) => {
                  const raw = readBackup(e.target.value);
                  if (raw) void pasteClasses(raw);
                  else notify(t('pasteNothing'));
                }}
              />
            )}
          </div>
          <div className="carry-actions">
            <button type="button" className="btn btn-primary" onClick={() => void paste()}>
              <ClipboardPaste size={16} /> {t('paste')}
            </button>
            <button type="button" className="icon-btn" aria-label={t('close')} onClick={closeCarry}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <section className={`hero-card${api.plans.length ? ' has-plans' : ''}`}>
        <div className="eyebrow-strong">{t('classPrep')}</div>
        <h1 className="page-title" style={{ margin: '10px 0 8px' }}>
          {t('libraryTitle')}
        </h1>
        <p className="narrative">{t('libraryLead')}</p>
        <ol className="structure-strip">
          {STRUCTURE.map((s, i) => (
            <li key={s}>
              <b>{i + 1}</b>
              <span>{t(s)}</span>
            </li>
          ))}
        </ol>
        <p className="section-hint" style={{ margin: '8px 0 0' }}>
          {t('structureNote')}
        </p>
        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={create}>
            <ClipboardIcon size={18} /> {t('newClassPlan')}
          </button>
        </div>
      </section>

      <div className="library-head">
        <div className="eyebrow">{t('yourClasses')}</div>
        <span className="muted" style={{ fontSize: 13 }}>
          {api.plans.length === 1 ? t('planCountOne') : t('planCountMany', { n: api.plans.length })}
        </span>
      </div>

      {api.plans.length === 0 ? (
        <div className="card empty">
          <h2 className="card-title">{t('noClasses')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('noClassesBody')}
          </p>
          <button type="button" className="btn btn-primary" onClick={create}>
            <ClipboardIcon size={16} /> {t('newClassPlan')}
          </button>
        </div>
      ) : (
        <>
        <div className="plan-grid">
          {cards.map((p) => (
            <article
              key={p.id}
              className={`card plan-card${p === next ? ' is-next' : ''}${p === picked && api.plans.length > 1 ? ' is-picked' : ''}${folding.includes(p) ? ' is-folding' : ''}`}
              onClick={() => tapCard(p)}
              onAnimationEnd={folding.includes(p) ? () => filing.done(p.id) : undefined}
            >
              <div className="plan-card-head">
                <span className="plan-date">
                  {p === next && <span className="next-tag">{p.date === today ? t('today') : t('nextUp')}</span>}
                  {formatDate(p.date)}
                </span>
                <span className="plan-length">{formatMinutes(totalMinutes(p))}</span>
              </div>
              <h2 className="card-title">
                <a href={hrefFor({ name: 'edit', id: p.id })} onClick={(e) => e.stopPropagation()}>
                  {p.title || t('untitledClass')}
                </a>
              </h2>
              <PlanCardBody plan={p} />
              <div className="plan-card-foot" onClick={(e) => e.stopPropagation()}>
                <a className="btn btn-secondary" href={hrefFor({ name: 'run', id: p.id })}>
                  <Play size={15} /> {t('teach')}
                </a>
                <div className="actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('duplicate')}
                    title={t('duplicate')}
                    onClick={() => {
                      api.upsert(duplicatePlan(p));
                      notify(t('planDuplicated'));
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={t('delete')}
                    title={t('delete')}
                    onClick={() => setPendingDelete(p)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Shelf months={shelf.months} ticking={filing.ticking} />
        </>
      )}

      {(install.kind === 'ios' || install.kind === 'ios-inapp') && (
        <div className="subpanel ios-keep">
          <strong>{t('iosKeepTitle')}</strong> {t('iosKeep')}{' '}
          <button type="button" className="link" onClick={onInstall}>
            {t('installShowMe')}
          </button>
        </div>
      )}

      <footer className="library-foot">
        <div className="library-foot-row library-foot-info">
          <span>{t('worksOffline')}</span>
          <span className="sep">·</span>
          <span>{t('plansStayHere')}</span>
        </div>
        <div className="library-foot-row">
          {api.plans.length > 0 && (
            <>
              <button type="button" className="link" onClick={() => void exportAll()}>
                {t('backUpAll')}
              </button>
              <span className="sep">·</span>
              <button type="button" className="link" onClick={() => void copyAll()}>
                {t('copyClasses')}
              </button>
              <span className="sep">·</span>
            </>
          )}
          <button type="button" className="link" onClick={() => void paste()}>
            {t('pasteClasses')}
          </button>
        </div>
      </footer>

      {/* On a phone the two things a coach does here sit under the thumb. */}
      {picked && (
        <div className="thumb-bar">
          <button type="button" className="btn btn-secondary btn-lg" onClick={create}>
            <ClipboardIcon size={17} /> {t('newClassPlan')}
          </button>
          <a className="btn btn-primary btn-lg" href={hrefFor({ name: 'run', id: picked.id })}>
            <Play size={17} />
            <span className="thumb-bar-label">
              {t('teach')}
              <small>{picked.title || t('untitledClass')}</small>
            </span>
          </a>
        </div>
      )}

      {pickerOpen && (
        <TemplatePicker
          onClose={() => setPickerOpen(false)}
          onBlank={(format: FormatKey) => open(blankPlan(new Date(), format))}
          onTemplate={(t: Template) => open(t.build())}
          onAi={() => {
            setPickerOpen(false);
            setAiOpen(true);
          }}
        />
      )}

      {aiOpen && (
        <AiPlanner
          onClose={() => setAiOpen(false)}
          onBack={() => {
            setAiOpen(false);
            setPickerOpen(true);
          }}
          onPlan={(plan, skipped) => {
            open(plan);
            notify(skipped ? t('aiBuiltSkipped', { n: skipped }) : t('aiBuilt'));
          }}
          onClasses={(raw) => {
            setAiOpen(false);
            void pasteClasses(raw);
          }}
        />
      )}

      {themeOpen && <ThemeSheet onClose={() => setThemeOpen(false)} />}

      {enex && <EvernoteImport progress={enex.progress} onStop={() => (enexStop.current = true)} />}

      {pendingDelete && (
        <ConfirmDialog
          title={t('deleteClassTitle')}
          body={t('deleteClassBody', { title: pendingDelete.title || t('untitledClass') })}
          confirmLabel={t('delete')}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            api.remove(pendingDelete.id);
            setPendingDelete(null);
            notify(t('planDeleted'));
          }}
        />
      )}
    </div>
  );
}
