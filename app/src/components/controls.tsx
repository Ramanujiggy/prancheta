// Small form controls shared by the editor.

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { t } from '../lib/i18n.ts';

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <span className="section-hint">{hint}</span>}
    </div>
  );
}

/** Grows a one-line field to fit its text, so a long line wraps instead of hiding off the edge. */
export function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
}

/** A one-line field that wraps on narrow screens. Enter never adds a line break. */
export function LineInput({
  value,
  onChange,
  onEnter,
  className = '',
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  className?: string;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const { inputRef, ...props } = rest;
  useLayoutEffect(() => fitHeight(ref.current), [value]);
  useEffect(() => {
    const refit = () => fitHeight(ref.current);
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
  }, []);
  return (
    <textarea
      {...props}
      ref={(el) => {
        ref.current = el;
        if (typeof inputRef === 'function') inputRef(el);
        else if (inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }}
      rows={1}
      className={`line-input ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\s*\n+\s*/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (onEnter) onEnter();
          else e.currentTarget.blur();
        }
      }}
    />
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  className = '',
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  return <LineInput id={id} className={`input ${className}`} value={value} placeholder={placeholder} aria-label={ariaLabel} onChange={onChange} />;
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  // Grows with what's typed, so notes never hide behind a scroll on a phone.
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => fitHeight(ref.current), [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      className="textarea"
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper" role="group" aria-label={label}>
        <button type="button" aria-label={t('decrease', { label })} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
          <Minus size={15} />
        </button>
        <span className="stepper-value" aria-live="polite">
          {format(value)}
        </span>
        <button type="button" aria-label={t('increase', { label })} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="toggle" onClick={() => onChange(!checked)}>
      <span className="toggle-track" />
      {label}
    </button>
  );
}

export function formatRest(seconds: number): string {
  if (seconds === 0) return t('none');
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m} min`;
}
