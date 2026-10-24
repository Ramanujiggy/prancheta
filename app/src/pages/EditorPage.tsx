// The class plan editor. The class is a list of blocks in the order they are
// taught. One block is open at a time; the rest fold to a line that says
// what's in them. Blocks can be added, renamed, duplicated, removed, and
// moved by dragging the handle (or from the block's menu, which is the sure
// way on a phone). The strip at the top keeps the five kinds in view, so the
// coach sees what the class is made of. Every change saves as you type.

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Copy,
  CopyPlus,
  Download,
  FileText,
  Film,
  GripVertical,
  MessagesSquare,
  MoreHorizontal,
  PencilLine,
  Play,
  Plus,
  Printer,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  BLOCK_KINDS,
  blockLabel,
  blockMinutes,
  copyBlock,
  duplicatePlan,
  formatMinutes,
  kindLabel,
  moveBlock,
  move,
  newBlock,
  sectionSummary,
  withBlock,
  type Block,
  type BlockKind,
  type ClassPlan,
  type GameBlock,
} from '../lib/plan.ts';
import { navigate } from '../lib/router.ts';
import type { PlansApi } from '../lib/usePlans.ts';
import { Field, TextInput } from '../components/controls.tsx';
import { BlockFields, MoveCards, type Reveal } from '../components/BlockFields.tsx';
import { ClassStrip, Timeline } from '../components/Timeline.tsx';
import { PrintSheet } from '../components/PrintSheet.tsx';
import { ConfirmDialog } from '../components/feedback.tsx';
import { BlockTraits } from '../components/BlockTraits.tsx';
import { downloadBackup } from './LibraryPage.tsx';
import { fileSlug, saveFile } from '../lib/files.ts';
import { classForAi } from '../lib/aiClass.ts';
import { copyText } from '../components/AiPlanner.tsx';
import { t } from '../lib/i18n.ts';
import { rememberOpened } from '../lib/lastOpened.ts';

/** The first block that still has nothing in it, so a new class opens where the work is.
    A class that's all planned opens folded, as an overview. */
function firstOpen(plan: ClassPlan): string | null {
  return plan.blocks.find((b) => !sectionSummary(b).filled)?.id ?? null;
}

function BlockMenu({
  name,
  index,
  count,
  onAddTechnique,
  onRename,
  onDuplicate,
  onMove,
  onRemove,
}: {
  name: string;
  index: number;
  count: number;
  /** Only for blocks other than Technique, which has its own Add technique button. */
  onAddTechnique?: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
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
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="block-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('blockMenu', { name })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="menu-pop card" role="menu">
          {onAddTechnique && (
            <button type="button" role="menuitem" onClick={act(onAddTechnique)}>
              <Film size={15} /> {t('addTechniqueMenu')}
            </button>
          )}
          <button type="button" role="menuitem" onClick={act(onRename)}>
            <PencilLine size={15} /> {t('rename')}
          </button>
          <button type="button" role="menuitem" onClick={act(onDuplicate)}>
            <CopyPlus size={15} /> {t('duplicate')}
          </button>
          <button type="button" role="menuitem" disabled={index === 0} onClick={act(() => onMove(index - 1))}>
            <ArrowUp size={15} /> {t('moveUp')}
          </button>
          <button type="button" role="menuitem" disabled={index === count - 1} onClick={act(() => onMove(index + 1))}>
            <ArrowDown size={15} /> {t('moveDown')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            disabled={count === 1}
            title={count === 1 ? t('lastBlock') : undefined}
            onClick={act(onRemove)}
          >
            <Trash2 size={15} /> {t('removeBlock')}
          </button>
        </div>
      )}
    </div>
  );
}

function AddBlockSheet({ onPick, onClose }: { onPick: (kind: BlockKind) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet" role="dialog" aria-modal="true" aria-label={t('addBlockTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2 className="card-title">{t('addBlockTitle')}</h2>
            <p className="section-hint" style={{ margin: '4px 0 0' }}>
              {t('addBlockLead')}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="kind-list">
          {BLOCK_KINDS.map((kind, i) => (
            <button type="button" key={kind} className="template" onClick={() => onPick(kind)} autoFocus={i === 0}>
              <span>
                <span className="template-title">{kindLabel(kind)}</span>
                <span className="template-blurb">{t(`hint.${kind}`)}</span>
                <BlockTraits kind={kind} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditorPage({ plan, api, notify }: { plan: ClassPlan; api: PlansApi; notify: (m: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => rememberOpened(plan.id), [plan.id]);
  const [pendingMove, setPendingMove] = useState<{ block: string; move: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [removed, setRemoved] = useState<{ block: Block; index: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const set = (next: ClassPlan) => api.upsert(next);
  const setBlock = (b: Block) => set(withBlock(plan, b));
  const [exporting, setExporting] = useState<'doc' | 'file' | null>(null);
  const [open, setOpen] = useState<string | null>(() => firstOpen(plan));
  const [shown, setShown] = useState<Record<string, boolean>>({});

  // Drags read the latest plan through a ref, since pointer events outlive a render.
  const planRef = useRef(plan);
  planRef.current = plan;

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(timer);
  }, [removed]);

  const exportDocument = async () => {
    setExporting('doc');
    try {
      const { exportClassDocument } = await import('../lib/exportDoc.ts');
      await saveFile(await exportClassDocument(plan), `${fileSlug(plan.title)}.docx`);
    } catch {
      notify(t('docFailed'));
    } finally {
      setExporting(null);
    }
  };

  const sendClassFile = async () => {
    setExporting('file');
    try {
      const { exportClassFile } = await import('../lib/classFile.ts');
      await saveFile(await exportClassFile(plan), `${fileSlug(plan.title)}.html`);
    } catch {
      notify(t('classFileFailed'));
    } finally {
      setExporting(null);
    }
  };

  // The class goes to the coach's AI as text; the answer comes back through New class.
  const changeWithAi = async () => {
    const text = classForAi(plan);
    if (await copyText(text)) notify(t('aiClassCopied'));
    else await saveFile(new Blob([text], { type: 'text/plain' }), `${fileSlug(plan.title)}-ai.txt`).catch(() => notify(t('aiClassFailed')));
  };

  // Opening one block folds the others. If the fold moved it off screen, or it
  // opened low on the page, bring its top into view.
  const openBlock = (id: string, always = false) => {
    setOpen(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`block-${id}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (always || top < 0 || top > window.innerHeight * 0.45) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const toggle = (id: string) => (open === id ? setOpen(null) : openBlock(id));

  const reveal = (blockId: string): Reveal => {
    const k = (key: string) => `${blockId}:${key}`;
    const extraId = (key: string) => `extra-${blockId}-${key}`;
    const isShown = (key: string, has: boolean) => has || !!shown[k(key)];
    return {
      isShown,
      extraId,
      extra: (key, label, has) =>
        isShown(key, has)
          ? []
          : [
              {
                key,
                label,
                onReveal: () => {
                  setShown((s) => ({ ...s, [k(key)]: true }));
                  requestAnimationFrame(() =>
                    document.querySelector<HTMLElement>(`#${CSS.escape(extraId(key))} input, #${CSS.escape(extraId(key))} textarea`)?.focus(),
                  );
                },
              },
            ],
    };
  };

  const addBlock = (kind: BlockKind) => {
    const b = newBlock(kind);
    set({ ...plan, blocks: [...plan.blocks, b] });
    setAdding(false);
    openBlock(b.id, true);
  };

  const rename = (id: string) => {
    setShown((s) => ({ ...s, [`${id}:name`]: true }));
    setOpen(id);
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(`name-${id}`)} input`);
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const duplicate = (index: number) => {
    const copy = copyBlock(plan.blocks[index]);
    const blocks = [...plan.blocks];
    blocks.splice(index + 1, 0, copy);
    set({ ...plan, blocks });
    openBlock(copy.id, true);
  };

  const remove = (index: number) => {
    if (plan.blocks.length < 2) return;
    const block = plan.blocks[index];
    set({ ...plan, blocks: plan.blocks.filter((b) => b.id !== block.id) });
    setRemoved({ block, index });
    if (open === block.id) setOpen(null);
  };

  const undoRemove = () => {
    if (!removed) return;
    const blocks = [...plan.blocks];
    blocks.splice(Math.min(removed.index, blocks.length), 0, removed.block);
    set({ ...plan, blocks });
    setRemoved(null);
  };

  const reorder = (from: number, to: number) => {
    set(moveBlock(plan, from, to));
    const id = plan.blocks[from]?.id;
    if (id) requestAnimationFrame(() => document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  // Dragging by the handle: the block follows the finger past the middle of
  // each neighbour. Everything folds first, so the list is short and even.
  const startDrag = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const pointer = e.pointerId;
    setOpen(null);
    setDragging(id);
    // Listen on the window: reordering moves the handle in the page, which
    // would drop a pointer capture taken on the handle itself.
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      const current = planRef.current;
      const from = current.blocks.findIndex((b) => b.id === id);
      if (from < 0) return;
      let to = from;
      current.blocks.forEach((b, i) => {
        const r = document.getElementById(`block-${b.id}`)?.getBoundingClientRect();
        if (!r || i === from) return;
        const mid = r.top + r.height / 2;
        if (i < from && ev.clientY < mid) to = Math.min(to, i);
        if (i > from && ev.clientY > mid) to = Math.max(to, i);
      });
      if (to !== from) api.upsert(moveBlock(current, from, to));
      // Near the top or bottom edge, scroll so long classes can be dragged end to end.
      if (ev.clientY < 60) window.scrollBy(0, -12);
      else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      setDragging(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const handleKeys = (index: number) => (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      reorder(index, index - 1);
    } else if (e.key === 'ArrowDown' && index < plan.blocks.length - 1) {
      e.preventDefault();
      reorder(index, index + 1);
    }
  };

  /** The nearest positional sparring block above this one, for "Same position as block 03". */
  const earlierGame = (index: number): { n: number; game: GameBlock } | undefined => {
    for (let i = index - 1; i >= 0; i--) {
      const b = plan.blocks[i];
      if (b.kind === 'game' && (b.start.trim() || b.objective.trim())) return { n: i + 1, game: b };
    }
    return undefined;
  };

  const pendingBlock = pendingMove ? plan.blocks.find((b) => b.id === pendingMove.block) : undefined;

  return (
    <>
      <div className="shell no-print">
        <header className="topbar">
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'library' })}>
            <ArrowLeft size={17} /> {t('classes')}
          </button>
          <div className="topbar-actions">
            <span className="save-state hide-sm">
              <span className="save-dot" /> {t('savedHere')}
            </span>
            <button type="button" className="btn btn-primary hide-sm" onClick={() => navigate({ name: 'run', id: plan.id })}>
              <Play size={16} /> {t('teach')}
            </button>
          </div>
        </header>

        <div className="desk">
          <div className="desk-main">
            <div className="card" style={{ padding: 22 }}>
              <div className="title-grid">
                <Field label={t('classTitle')}>
                  {(id) => (
                    <TextInput
                      id={id}
                      className="title-input"
                      value={plan.title}
                      placeholder={t('classTitlePh')}
                      onChange={(title) => set({ ...plan, title })}
                    />
                  )}
                </Field>
                <Field label={t('date')}>
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      className="input"
                      value={plan.date}
                      onChange={(e) => set({ ...plan, date: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <ClassStrip
                plan={plan}
                onAdd={addBlock}
                onJump={(kind) => {
                  const b = plan.blocks.find((x) => x.kind === kind);
                  if (b) openBlock(b.id, true);
                }}
              />
            </div>

            <div className="block-sheet">
              {plan.blocks.map((block, index) => {
                const isOpen = open === block.id;
                const summary = sectionSummary(block);
                const name = blockLabel(block);
                const next = plan.blocks[index + 1];
                const showName = !!block.title.trim() || !!shown[`${block.id}:name`];
                return (
                  <section
                    key={block.id}
                    className={`section${isOpen ? ' open' : ''}${dragging === block.id ? ' dragging' : ''}`}
                    id={`block-${block.id}`}
                  >
                    <div className="section-head">
                      <button
                        type="button"
                        className="drag-handle"
                        aria-label={t('dragBlock', { name })}
                        onPointerDown={startDrag(block.id)}
                        onKeyDown={handleKeys(index)}
                      >
                        <GripVertical size={18} />
                      </button>
                      <button
                        type="button"
                        className="section-toggle"
                        aria-expanded={isOpen}
                        aria-controls={`block-body-${block.id}`}
                        onClick={() => toggle(block.id)}
                      >
                        <span className="section-index">
                          <span className={`section-box${summary.filled ? ' filled' : ''}`} aria-hidden />
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="section-toggle-text">
                          <span className="card-title">{name}</span>
                          {!isOpen && <span className={`section-summary${summary.filled ? '' : ' is-empty'}`}>{summary.text}</span>}
                        </span>
                        <span className="section-time">{formatMinutes(blockMinutes(block))}</span>
                        <ChevronDown size={18} className="section-chevron" aria-hidden />
                      </button>
                      <BlockMenu
                        name={name}
                        index={index}
                        count={plan.blocks.length}
                        onAddTechnique={
                          block.kind === 'gems'
                            ? undefined
                            : () => {
                                setBlock({ ...block, moves: [...(block.moves ?? []), move()] });
                                openBlock(block.id, true);
                              }
                        }
                        onRename={() => rename(block.id)}
                        onDuplicate={() => duplicate(index)}
                        onMove={(to) => reorder(index, to)}
                        onRemove={() => remove(index)}
                      />
                    </div>
                    {isOpen && (
                      <div className="section-stack" id={`block-body-${block.id}`}>
                        <p className="section-hint section-lead">
                          {block.title.trim() ? `${kindLabel(block.kind)}. ` : ''}
                          {t(`hint.${block.kind}`)}
                        </p>
                        <BlockTraits kind={block.kind} />
                        {showName && (
                          <div id={`name-${block.id}`}>
                            <Field label={t('blockName')}>
                              {(id) => (
                                <TextInput
                                  id={id}
                                  value={block.title}
                                  placeholder={t('blockNamePh', { name: kindLabel(block.kind) })}
                                  onChange={(title) => setBlock({ ...block, title })}
                                />
                              )}
                            </Field>
                          </div>
                        )}
                        <BlockFields
                          block={block}
                          set={setBlock}
                          reveal={reveal(block.id)}
                          notify={notify}
                          askRemoveMove={(move) => setPendingMove({ block: block.id, move })}
                          earlierGame={block.kind === 'game' ? earlierGame(index) : undefined}
                        />
                        {block.kind !== 'gems' && !!block.moves?.length && (
                          <div className="borrowed-moves">
                            <div className="eyebrow-strong ruled">{t('techniquesHere')}</div>
                            <MoveCards
                              moves={block.moves}
                              notify={notify}
                              askRemoveMove={(move) => setPendingMove({ block: block.id, move })}
                              onChange={(moves) => setBlock({ ...block, moves })}
                            />
                          </div>
                        )}
                        {next && (
                          <div className="section-next">
                            <button type="button" className="btn btn-secondary" onClick={() => openBlock(next.id, true)}>
                              {t('nextSection', { name: blockLabel(next) })} <ArrowRight size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}

              <button type="button" className="add-block" onClick={() => setAdding(true)}>
                <Plus size={17} /> {t('addBlock')}
              </button>
            </div>
          </div>

          <aside className="desk-margin">
            <Timeline plan={plan} onJump={(id) => openBlock(id, true)} />
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate({ name: 'run', id: plan.id })}>
                <Play size={17} /> {t('teachThisClass')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={sendClassFile}
                disabled={exporting !== null}
                title={t('classFileTitle')}
              >
                <Send size={16} /> {exporting === 'file' ? t('makingClassFile') : t('sendClassFile')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={exportDocument} disabled={exporting !== null}>
                <FileText size={16} /> {exporting === 'doc' ? t('makingDoc') : t('exportDoc')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void changeWithAi()} title={t('aiClassTitle')}>
                <MessagesSquare size={16} /> {t('aiChangeClass')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> {t('printSheet')}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  title={t('backupTitle')}
                  onClick={() => downloadBackup(`${fileSlug(plan.title)}.json`, plan).catch(() => notify(t('backupFailed')))}
                >
                  <Download size={16} /> {t('backup')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const copy = duplicatePlan(plan);
                    api.upsert(copy);
                    navigate({ name: 'edit', id: copy.id });
                    notify(t('planDuplicated'));
                  }}
                >
                  <Copy size={16} /> {t('duplicate')}
                </button>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> {t('deleteClass')}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* On a phone, Teach waits under the thumb; it steps aside while typing. */}
      <div className="thumb-bar no-print">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate({ name: 'run', id: plan.id })}>
          <Play size={17} /> {t('teachThisClass')}
        </button>
      </div>

      <PrintSheet plan={plan} />

      {adding && <AddBlockSheet onPick={addBlock} onClose={() => setAdding(false)} />}

      {removed && (
        <div className="toast update-toast no-print" role="status">
          {t('blockRemoved', { name: blockLabel(removed.block) })}
          <button type="button" className="btn btn-secondary" onClick={undoRemove}>
            {t('undo')}
          </button>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t('deleteClassTitle')}
          body={t('deleteClassBody', { title: plan.title || t('untitledClass') })}
          confirmLabel={t('delete')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            api.remove(plan.id);
            navigate({ name: 'library' });
            notify(t('planDeleted'));
          }}
        />
      )}
      {pendingMove && pendingBlock?.moves && (
        <ConfirmDialog
          title={t('removeMoveTitle')}
          body={t('removeMoveBody')}
          confirmLabel={t('removeMove')}
          onCancel={() => setPendingMove(null)}
          onConfirm={() => {
            setBlock({ ...pendingBlock, moves: pendingBlock.moves!.filter((x) => x.id !== pendingMove.move) });
            setPendingMove(null);
          }}
        />
      )}
    </>
  );
}
