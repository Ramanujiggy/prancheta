// Turns a technique video into a short looping clip: pick the moment, pick
// the length, optionally slow it down, and the clip is made on this device.
// The original video is never kept or uploaded anywhere; only the clip is
// saved. Browsers that can't encode video get a GIF instead.

import { useEffect, useRef, useState } from 'react';
import { Film, X } from 'lucide-react';
import { Stepper, Toggle } from './controls.tsx';
import { CLIP_MAX_SECONDS, CLIP_MIN_SECONDS, clampClip, videoToGif, type ClipSettings } from '../lib/gif.ts';
import type { MadeClip } from '../lib/video.ts';
import { ClipMedia } from './ClipField.tsx';
import { t } from '../lib/i18n.ts';

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function ClipMaker({ file, onUse, onClose }: { file: File; onUse: (clip: MadeClip) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<ClipSettings>({ start: 0, length: 4, slowMotion: false });
  const [progress, setProgress] = useState<number | null>(null);
  const [made, setMade] = useState<{ clip: MadeClip; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => void (made && URL.revokeObjectURL(made.url)), [made]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clip = clampClip(settings, duration);
  const end = clip.start + clip.length;

  // The preview loops the chosen section at the chosen speed.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !duration || progress !== null) return;
    v.playbackRate = clip.slowMotion ? 0.5 : 1;
    if (v.currentTime < clip.start || v.currentTime > end) v.currentTime = clip.start;
    const loop = () => {
      if (v.currentTime >= end) v.currentTime = clip.start;
    };
    v.addEventListener('timeupdate', loop);
    void v.play().catch(() => {});
    return () => v.removeEventListener('timeupdate', loop);
  }, [clip.start, end, clip.slowMotion, duration, progress]);

  const make = async () => {
    const v = videoRef.current;
    if (!v) return;
    setError(null);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const signal = abort.current.signal;
      // The video encoder is loaded only when a clip is made, so it never slows down opening the app.
      const { videoToClip } = await import('../lib/video.ts');
      const result = (await videoToClip(file, v, clip, setProgress, signal)) ?? (await videoToGif(v, clip, setProgress, signal));
      setMade({ clip: result, url: URL.createObjectURL(result.blob) });
    } catch (e) {
      console.error(e);
      if ((e as Error).name !== 'AbortError') setError(t('clipFailed'));
    } finally {
      setProgress(null);
    }
  };

  const mb = made ? (made.clip.blob.size / 1024 / 1024).toFixed(1) : '';
  const isVideo = !!made?.clip.blob.type.startsWith('video/');

  return (
    <div className="backdrop" onClick={progress === null ? onClose : undefined}>
      <div className="card sheet clip-maker" role="dialog" aria-modal="true" aria-label={t('clipMakerLabel')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="eyebrow-strong">{t('techniqueClip')}</div>
            <h2 className="card-title" style={{ marginTop: 4 }}>
              {made ? t('yourClip') : t('pickMoment')}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {made ? (
          <>
            <div className="clip-stage">
              <ClipMedia url={made.url} video={isVideo} label={t('finishedClipAlt')} width={made.clip.width} height={made.clip.height} />
            </div>
            <p className="section-hint">
              {t('gifInfo', {
                len: clip.length.toFixed(1),
                speed: clip.slowMotion ? t('halfSpeed') : '',
                w: made.clip.width,
                h: made.clip.height,
                mb,
              })}
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setMade(null)}>
                {t('changeIt')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => onUse(made.clip)}>
                {t('useClip')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="clip-stage">
              <video
                ref={videoRef}
                src={src}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  setDuration(Number.isFinite(d) ? d : 0);
                  setSettings((s) => ({ ...s, length: Math.min(s.length, Math.max(CLIP_MIN_SECONDS, Math.floor(d))) }));
                }}
                onError={() => setError(t('videoUnreadable'))}
              />
            </div>

            {error && <p className="clip-error">{error}</p>}

            {duration > 0 && (
              <div className="clip-controls">
                <div className="field">
                  <label className="field-label" htmlFor="clip-start">
                    {t('startsAt')} <span className="mono">{clock(clip.start)}</span>
                    <span className="muted">
                      {' '}
                      · {t('endsAt')} {clock(end)}
                    </span>
                  </label>
                  <input
                    id="clip-start"
                    className="range"
                    type="range"
                    min={0}
                    max={Math.max(0, duration - clip.length)}
                    step={0.1}
                    value={clip.start}
                    disabled={progress !== null}
                    onChange={(e) => setSettings({ ...settings, start: Number(e.target.value) })}
                  />
                </div>
                <div className="stepper-row" style={{ alignItems: 'flex-end' }}>
                  <Stepper
                    label={t('length')}
                    value={clip.length}
                    min={CLIP_MIN_SECONDS}
                    max={Math.min(CLIP_MAX_SECONDS, Math.max(CLIP_MIN_SECONDS, Math.floor(duration)))}
                    onChange={(length) => setSettings({ ...settings, length })}
                    format={(v) => `${v} s`}
                  />
                  <Toggle label={t('slowMotion')} checked={settings.slowMotion} onChange={(slowMotion) => setSettings({ ...settings, slowMotion })} />
                </div>
              </div>
            )}

            {progress !== null ? (
              <div className="clip-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
                <em>{t('makingClip')}</em>
              </div>
            ) : (
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn btn-primary" onClick={make} disabled={!duration}>
                  <Film size={16} /> {t('makeClip')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
