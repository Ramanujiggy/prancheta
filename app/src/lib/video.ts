// Video → short MP4 clip, entirely on the device. The phone's own video
// hardware decodes the chosen seconds and encodes them again, smaller, through
// WebCodecs (via Mediabunny). That takes about as long as the clip itself, and
// a 4 s clip comes out around half a megabyte, where the same clip as a GIF
// took minutes and several megabytes. Slow motion is baked into the file, so
// the clip plays the same anywhere it's sent.
//
// Two ways to get there, best first:
//   1. Decode the file directly and re-encode the trimmed section.
//   2. If this browser can't decode the file (an unusual codec), play the
//      section on screen in real time and encode what's drawn.
// A browser with no video encoder at all gets null back, and the caller makes
// a GIF instead.

import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  getFirstEncodableVideoCodec,
  type VideoCodec,
} from 'mediabunny';
import { fitSize, seek, type ClipSettings } from './gif.ts';

/** Longest side of a clip, in pixels. Sharp enough to read a grip on a laptop screen. */
export const CLIP_MAX_SIDE = 640;
/** Bits per second. Grappling on a mat is mostly still background, so this stays crisp. */
const BITRATE = 1_200_000;
const FPS = 30;

export interface MadeClip {
  blob: Blob;
  width: number;
  height: number;
  /** A still frame, for paper and Word, which can't play video. */
  poster?: Blob;
}

const cancelled = () => new DOMException('Cancelled', 'AbortError');

/** The codec to encode with, or null when this browser can't encode video. H.264 plays everywhere, so it comes first. */
async function pickCodec(width: number, height: number): Promise<VideoCodec | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  return getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height, bitrate: BITRATE }).catch(() => null);
}

function mp4Output() {
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  return { output, target };
}

/** Way 1: straight from the file, as fast as the hardware decodes. */
async function convert(
  file: Blob,
  settings: ClipSettings,
  size: { width: number; height: number },
  codec: VideoCodec,
  onProgress: (f: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const { output, target } = mp4Output();
    const stretch = settings.slowMotion ? 2 : 1;
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      trim: { start: settings.start, end: settings.start + settings.length },
      video: {
        width: size.width,
        height: size.height,
        fit: 'contain',
        codec,
        bitrate: BITRATE,
        frameRate: FPS,
        keyFrameInterval: 2,
        forceTranscode: true,
        allowTransformationMetadata: false,
        process:
          stretch === 1
            ? undefined
            : (sample) => {
                sample.setTimestamp(sample.timestamp * stretch);
                sample.setDuration(sample.duration * stretch);
                return sample;
              },
      },
      audio: { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('This browser cannot decode that video.');
    conversion.onProgress = (p) => onProgress(Math.min(1, p));
    const abort = () => void conversion.cancel();
    signal?.addEventListener('abort', abort);
    try {
      await conversion.execute();
    } finally {
      signal?.removeEventListener('abort', abort);
    }
    if (signal?.aborted) throw cancelled();
    return new Blob([target.buffer!], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}

/** Waits for the next frame the video element shows. */
function nextFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => resolve());
    else requestAnimationFrame(() => resolve());
  });
}

/** Way 2: play the section and encode what the screen shows. Takes as long as the clip. */
async function capture(
  video: HTMLVideoElement,
  settings: ClipSettings,
  size: { width: number; height: number },
  codec: VideoCodec,
  onProgress: (f: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw video frames.');
  const { output, target } = mp4Output();
  const source = new CanvasSource(canvas, { codec, bitrate: BITRATE, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const stretch = settings.slowMotion ? 2 : 1;
  const rate = video.playbackRate;
  video.pause();
  video.playbackRate = 1;
  video.muted = true; // only a muted video may play without a tap on iPhone
  await seek(video, settings.start);
  // ClipMaker stops looping its preview while a clip is being made, so nothing jumps the video back.
  await video.play();
  let last = -1;
  try {
    for (;;) {
      if (signal?.aborted) throw cancelled();
      await nextFrame(video);
      const t = video.currentTime - settings.start;
      if (t >= settings.length || video.ended) break;
      if (t <= last) continue;
      ctx.drawImage(video, 0, 0, size.width, size.height);
      await source.add(Math.max(0, t) * stretch, (1 / FPS) * stretch);
      last = t;
      onProgress(Math.min(1, t / settings.length));
    }
  } catch (e) {
    await output.cancel();
    throw e;
  } finally {
    video.pause();
    video.playbackRate = rate;
  }
  if (last < 0) throw new Error('No frames were captured.');
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

/** A JPEG of the frame a third of the way into the clip: usually the technique, not the setup. */
export async function posterFrame(video: HTMLVideoElement, settings: ClipSettings, size: { width: number; height: number }): Promise<Blob | undefined> {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  video.pause();
  await seek(video, settings.start + settings.length / 3);
  ctx.drawImage(video, 0, 0, size.width, size.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/jpeg', 0.82));
}

/**
 * Makes the clip from the chosen section of `file`, which is already loaded
 * in `video` (the preview). Returns null when this browser can't encode video.
 */
export async function videoToClip(
  file: Blob,
  video: HTMLVideoElement,
  settings: ClipSettings,
  onProgress: (fraction: number) => void = () => {},
  signal?: AbortSignal,
): Promise<MadeClip | null> {
  const size = fitSize(video.videoWidth, video.videoHeight, CLIP_MAX_SIDE);
  const codec = await pickCodec(size.width, size.height);
  if (!codec) return null;

  let blob: Blob;
  try {
    blob = await convert(file, settings, size, codec, onProgress, signal);
  } catch (e) {
    if (signal?.aborted) throw cancelled();
    console.warn('Direct conversion failed; recording the clip in real time instead.', e);
    onProgress(0);
    blob = await capture(video, settings, size, codec, onProgress, signal);
  }
  const poster = await posterFrame(video, settings, size).catch(() => undefined);
  return { blob, ...size, poster };
}
