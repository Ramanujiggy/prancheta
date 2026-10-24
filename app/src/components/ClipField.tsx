// A move's technique clip: add one from a video (or a ready-made GIF),
// see it loop, replace or remove it. And the large version Teach mode shows.
// Clips are short muted MP4s that loop like a GIF; older clips are GIFs.

import { useEffect, useRef, useState } from 'react';
import { Film, Maximize2, RefreshCw, X } from 'lucide-react';
import { uid, type Clip } from '../lib/plan.ts';
import { clipSaveError, putClip, useClip } from '../lib/clips.ts';
import { ConfirmDialog } from './feedback.tsx';
import { imageSize } from '../lib/gif.ts';
import type { MadeClip } from '../lib/video.ts';
import { ClipMaker } from './ClipMaker.tsx';
import { t } from '../lib/i18n.ts';

export function ClipField({
  clip,
  onChange,
  notify,
}: {
  clip: Clip | undefined;
  onChange: (clip: Clip | undefined) => void;
  notify: (m: string) => void;
}) {
  const { url, video: isVideo, missing } = useClip(clip);
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const saving = useRef(false);

  const save = async (made: MadeClip) => {
    // A double tap on "Use" must not store the clip twice.
    if (saving.current) return;
    saving.current = true;
    const id = uid();
    try {
      await putClip(id, made.blob, made.poster);
      onChange({ id, width: made.width, height: made.height });
      setVideo(null);
    } catch (e) {
      console.error(e);
      notify(await clipSaveError(e, made.blob.size));
    } finally {
      saving.current = false;
    }
  };

  const onFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (file.type === 'image/gif' || (!file.type && name.endsWith('.gif'))) {
      try {
        await save({ blob: file, ...(await imageSize(file)) });
      } catch {
        notify(t('gifUnreadable'));
      }
      return;
    }
    // Some pickers leave the type blank, so the extension counts too.
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|3gp)$/.test(name)) {
      notify(t('pickVideo'));
      return;
    }
    setVideo(file);
  };

  return (
    <>
      {clip && url ? (
        <div className="clip-field">
          <ClipMedia url={url} video={isVideo} label={t('clipImgAlt')} width={clip.width} height={clip.height} />
          <div className="clip-field-actions">
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              <RefreshCw size={14} /> {t('replace')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmRemove(true)}>
              <X size={14} /> {t('remove')}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="clip-add" onClick={() => fileRef.current?.click()}>
          <Film size={16} />
          <span>
            <strong>{missing ? t('clipMissing') : t('clipAdd')}</strong>
            <span className="muted">
              {missing ? t('clipMissingHint') : t('clipAddHint')}
            </span>
          </span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
      {video && <ClipMaker file={video} onUse={save} onClose={() => setVideo(null)} />}
      {confirmRemove && (
        <ConfirmDialog
          title={t('removeClipTitle')}
          body={t('removeClipBody')}
          confirmLabel={t('removeClip')}
          onConfirm={() => {
            setConfirmRemove(false);
            onChange(undefined);
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </>
  );
}

/** Teach mode: the clip as large as the screen allows; tap to fill the screen. */
export function ClipView({ clip, label }: { clip: Clip; label: string }) {
  const { url, video } = useClip(clip);
  const [big, setBig] = useState(false);
  if (!url) return null;
  return (
    <>
      <button type="button" className="clip-view" onClick={() => setBig(true)} aria-label={t('enlargeClip', { label })}>
        <ClipMedia url={url} video={video} label={label} width={clip.width} height={clip.height} />
        <span className="clip-view-hint">
          <Maximize2 size={14} />
        </span>
      </button>
      {big && <Lightbox url={url} video={video} label={label} onClose={() => setBig(false)} />}
    </>
  );
}

// React sets `muted` as a property but not as an attribute, and iPhone Safari
// only autoplays a video it sees as muted, so it's set here and play is asked for.
function startMuted(v: HTMLVideoElement | null) {
  if (!v) return;
  v.defaultMuted = true;
  v.muted = true;
  void v.play().catch(() => {});
}

/** A clip that loops on its own, silent, like a GIF, whether it's a video or a GIF. */
export function ClipMedia({ url, video, label, width, height }: { url: string; video: boolean; label: string; width?: number; height?: number }) {
  return video ? (
    <video ref={startMuted} src={url} width={width} height={height} autoPlay loop muted playsInline disablePictureInPicture aria-label={label} />
  ) : (
    <img src={url} alt={label} width={width} height={height} />
  );
}

function Lightbox({ url, video, label, onClose }: { url: string; video: boolean; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop clip-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={label}>
      <ClipMedia url={url} video={video} label={label} />
      <button type="button" className="icon-btn clip-lightbox-close" aria-label={t('close')} onClick={onClose} autoFocus>
        <X size={20} />
      </button>
    </div>
  );
}
