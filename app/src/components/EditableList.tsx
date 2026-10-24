// A list of short lines a coach edits in place: type and press Enter to add,
// edit any row directly, reorder or remove with the row's controls.

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { item, type ListItem } from '../lib/plan.ts';
import { t } from '../lib/i18n.ts';
import { LineInput } from './controls.tsx';

export function EditableList({
  items,
  onChange,
  placeholder,
  emptyText,
  addLabel = t('add'),
}: {
  items: ListItem[];
  onChange: (items: ListItem[]) => void;
  placeholder: string;
  emptyText?: string;
  addLabel?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const add = (refocus = true) => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, item(text)]);
    setDraft('');
    if (refocus) inputRef.current?.focus();
  };

  const update = (id: string, text: string) => onChange(items.map((x) => (x.id === id ? { ...x, text } : x)));
  const remove = (id: string) => onChange(items.filter((x) => x.id !== id));
  const shift = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {items.length === 0 && emptyText && <div className="list-empty">{emptyText}</div>}
      <ul className="list">
        {items.map((x, i) => (
          <li className="list-row" key={x.id}>
            <span className="list-bullet" aria-hidden />
            <LineInput
              value={x.text}
              aria-label={t('itemN', { n: i + 1 })}
              onChange={(v) => update(x.id, v)}
              onBlur={(e) => {
                if (!e.target.value.trim()) remove(x.id);
              }}
            />
            <span className="list-row-actions">
              <button type="button" className="icon-btn move" aria-label={t('moveUp')} disabled={i === 0} onClick={() => shift(i, -1)}>
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="icon-btn move"
                aria-label={t('moveDown')}
                disabled={i === items.length - 1}
                onClick={() => shift(i, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button type="button" className="icon-btn danger" aria-label={t('remove')} onClick={() => remove(x.id)}>
                <X size={15} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="list-add">
        <LineInput
          inputRef={inputRef}
          className="input"
          value={draft}
          placeholder={placeholder}
          onChange={setDraft}
          // A typed line is kept even if the coach never presses Add.
          onBlur={() => add(false)}
          onEnter={() => add()}
        />
        <button type="button" className="btn btn-secondary" aria-label={addLabel} onClick={() => add()} disabled={!draft.trim()}>
          <Plus size={15} /> <span className="list-add-label">{addLabel}</span>
        </button>
      </div>
    </div>
  );
}
