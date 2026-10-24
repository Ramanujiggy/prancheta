// The mat timer: runs a schedule of rounds and rests, calls out what happens
// next, and sounds a tone at every change so the coach can watch the room
// instead of the screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatClock, type RoundSegment } from '../lib/plan.ts';
import { Tally } from './Tally.tsx';
import { t } from '../lib/i18n.ts';

let audio: AudioContext | null = null;

/** Opens (or wakes) the audio output. Browsers only allow this from a tap, and
 *  iOS suspends it again after a lock, a call or Siri. */
function unlockAudio() {
  try {
    // iOS 17+: play through the ring/silent switch, like a timer app.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    audio ??= new AudioContext();
    if (audio.state !== 'running') void audio.resume();
  } catch {
    // No audio available; the timer still works silently.
  }
}

function tone(freq: number, ms: number, delay = 0) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    if (ctx.state !== 'running') void ctx.resume();
    const start = ctx.currentTime + delay / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + ms / 1000 + 0.05);
  } catch {
    // No audio available; the timer still works silently.
  }
  try {
    navigator.vibrate?.(Math.min(ms, 400));
  } catch {
    // Vibration is a bonus where the device has it.
  }
}

function changeTone(kind: RoundSegment['kind']) {
  if (kind === 'round') {
    tone(880, 420);
  } else {
    tone(520, 300);
    tone(520, 300, 340);
  }
}

function finishTone() {
  tone(660, 260);
  tone(880, 260, 280);
  tone(1100, 500, 560);
}

/** Where a schedule stands a number of seconds after a segment started. */
export function stepThrough(
  segments: RoundSegment[],
  index: number,
  elapsedInSegment: number,
): { index: number; remaining: number; finished: boolean } {
  let i = index;
  let over = elapsedInSegment;
  while (i < segments.length && over >= segments[i].seconds) {
    over -= segments[i].seconds;
    i++;
  }
  if (i >= segments.length) return { index: segments.length - 1, remaining: 0, finished: true };
  return { index: i, remaining: segments[i].seconds - over, finished: false };
}

export function RoundTimer({ segments, title }: { segments: RoundSegment[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(segments[0]?.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  // While running, the wall-clock moment the current segment started. Time is
  // read from the clock on every tick, so a locked phone or a sleeping tab
  // catches up to the right round instead of drifting.
  const startedAt = useRef<number | null>(null);

  const reset = useCallback(() => {
    setIndex(0);
    setRemaining(segments[0]?.seconds ?? 0);
    setRunning(false);
    setFinished(false);
    startedAt.current = null;
  }, [segments]);

  // A new schedule (different section or edited rounds) starts fresh.
  useEffect(reset, [reset]);

  const advance = useCallback(() => {
    const next = index + 1;
    if (next >= segments.length) {
      setRunning(false);
      setFinished(true);
      setRemaining(0);
      startedAt.current = null;
      finishTone();
      return;
    }
    setIndex(next);
    setRemaining(segments[next].seconds);
    if (startedAt.current !== null) startedAt.current = Date.now();
    changeTone(segments[next].kind);
  }, [index, segments]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (startedAt.current === null) return;
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const seg = segments[index];
      if (!seg) return;
      if (elapsed < seg.seconds) {
        setRemaining(seg.seconds - elapsed);
        return;
      }
      const at = stepThrough(segments, index, elapsed);
      if (at.finished) {
        setRunning(false);
        setFinished(true);
        setRemaining(0);
        startedAt.current = null;
        finishTone();
        return;
      }
      startedAt.current = Date.now() - (segments[at.index].seconds - at.remaining) * 1000;
      setIndex(at.index);
      setRemaining(at.remaining);
      changeTone(segments[at.index].kind);
    };
    const id = setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [running, index, segments]);

  // Three short pips over the last three seconds of every segment.
  const whole = Math.ceil(remaining);
  useEffect(() => {
    if (running && whole > 0 && whole <= 3) tone(440, 120);
  }, [whole, running]);

  if (segments.length === 0) {
    return <p className="muted">{t('timerNoRounds')}</p>;
  }

  const seg = segments[index];
  // Tally strokes count rounds only; rests are the gaps between them.
  const rounds = segments.filter((s) => s.kind === 'round').length;
  const roundsDone = finished ? rounds : segments.slice(0, index).filter((s) => s.kind === 'round').length;
  const finishing = !finished && seg.kind === 'round' && remaining <= 10;

  const toggle = () => {
    unlockAudio();
    if (finished) {
      reset();
      return;
    }
    if (running) {
      startedAt.current = null;
      setRunning(false);
      return;
    }
    if (index === 0 && remaining === seg.seconds) tone(880, 420);
    startedAt.current = Date.now() - (seg.seconds - remaining) * 1000;
    setRunning(true);
  };

  return (
    <div className={`timer ${seg.kind === 'rest' && !finished ? 'rest' : ''} ${finishing ? 'finishing' : ''}`}>
      <div className="eyebrow">{title}</div>
      <div className="timer-face">
        {(finished || seg.label !== title) && <span className="sub-label">{finished ? t('timerDone') : seg.label}</span>}
        <span className="timer-clock" aria-live="off">
          {formatClock(finished ? 0 : remaining)}
        </span>
      </div>
      <Tally done={roundsDone} of={rounds} running={!finished && seg.kind === 'round'} struck={finished} />
      <div className="timer-cue">{finished ? t('timerComplete') : seg.cue}</div>
      <div className="timer-controls">
        <button type="button" className="icon-btn" aria-label={t('timerRestart')} onClick={reset}>
          <RotateCcw size={18} />
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={toggle} style={{ minWidth: 132 }}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {finished ? t('timerAgain') : running ? t('timerPause') : index === 0 && remaining === seg.seconds ? t('timerStart') : t('timerResume')}
        </button>
        <button type="button" className="icon-btn" aria-label={t('timerSkip')} onClick={advance} disabled={finished}>
          <SkipForward size={18} />
        </button>
      </div>
      <div className="timer-queue">
        {segments.map((s, i) => (
          <div key={i} className={i === index && !finished ? 'current' : i < index || finished ? 'past' : ''}>
            <span>
              {s.label}
              {s.kind === 'round' ? ` · ${s.cue}` : ''}
            </span>
            <span className="t">{formatClock(s.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
