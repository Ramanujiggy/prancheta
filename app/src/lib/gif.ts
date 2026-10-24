// Video → GIF, entirely on the device. A technique clip is short and loops,
// so a GIF plays everywhere a coach might open it: in Teach mode, in a Word
// document, in a chat. The video is drawn frame by frame onto a canvas and
// encoded with gifenc against one palette shared by the whole clip, which
// keeps colours steady from frame to frame and the file small.

import { GIFEncoder, applyPalette, quantize } from 'gifenc';

export const GIF_FPS = 10;
/** Longest side of the GIF, in pixels. Big enough to read a grip, small enough to keep files around 1–3 MB. */
export const GIF_MAX_SIDE = 400;
export const CLIP_MIN_SECONDS = 1;
export const CLIP_MAX_SECONDS = 8;

export interface ClipSettings {
  /** Where the clip starts in the source video, in seconds. */
  start: number;
  /** Clip length in seconds of source video. */
  length: number;
  /** Play back at half speed, so the class can see the detail. */
  slowMotion: boolean;
}

export interface MadeGif {
  blob: Blob;
  width: number;
  height: number;
}

/** Scales a frame to fit within maxSide on its longest edge, keeping even dimensions. */
export function fitSize(width: number, height: number, maxSide = GIF_MAX_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxSide, height: maxSide };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** The source-video timestamps to capture, clamped to the video's duration. */
export function frameTimes(start: number, length: number, duration: number, fps = GIF_FPS): number[] {
  const from = Math.max(0, Math.min(start, Math.max(0, duration - 0.05)));
  const to = Math.min(duration, from + length);
  const count = Math.max(1, Math.round((to - from) * fps));
  return Array.from({ length: count }, (_, i) => Math.min(to - 0.01, from + i / fps));
}

/** Milliseconds each frame stays on screen. */
export function frameDelay(slowMotion: boolean, fps = GIF_FPS): number {
  return Math.round((1000 / fps) * (slowMotion ? 2 : 1));
}

export function clampClip(settings: ClipSettings, duration: number): ClipSettings {
  const length = Math.min(CLIP_MAX_SECONDS, Math.max(CLIP_MIN_SECONDS, settings.length), Math.max(duration, 0.1));
  const start = Math.max(0, Math.min(settings.start, Math.max(0, duration - length)));
  return { ...settings, start, length };
}

export function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      resolve();
    };
    // Some browsers never fire `seeked` for a seek to the current time.
    const timer = setTimeout(done, 2500);
    video.addEventListener('seeked', done);
    video.currentTime = t;
  });
}

const nextTick = () => new Promise((r) => setTimeout(r, 0));

/** Encodes a section of an already-loaded video element into an animated GIF. */
export async function videoToGif(
  video: HTMLVideoElement,
  settings: ClipSettings,
  onProgress: (fraction: number) => void = () => {},
  signal?: AbortSignal,
): Promise<MadeGif> {
  const { width, height } = fitSize(video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot draw video frames.');

  const wasPaused = video.paused;
  video.pause();
  const times = frameTimes(settings.start, settings.length, video.duration);
  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < times.length; i++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    await seek(video, times[i]);
    ctx.drawImage(video, 0, 0, width, height);
    frames.push(ctx.getImageData(0, 0, width, height).data);
    onProgress((0.7 * (i + 1)) / times.length);
  }

  // One palette for the whole clip, learned from a spread of its frames.
  const sampleCount = Math.min(frames.length, 6);
  const sample = new Uint8ClampedArray(frames[0].length * sampleCount);
  for (let s = 0; s < sampleCount; s++) {
    const f = frames[Math.floor((s * frames.length) / sampleCount)];
    sample.set(f, s * f.length);
  }
  const palette = quantize(sample, 256);
  const delay = frameDelay(settings.slowMotion);

  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const index = applyPalette(frames[i], palette);
    gif.writeFrame(index, width, height, i === 0 ? { palette, delay, repeat: 0 } : { delay });
    onProgress(0.7 + (0.3 * (i + 1)) / frames.length);
    if (i % 4 === 3) await nextTick();
  }
  gif.finish();
  if (!wasPaused) void video.play().catch(() => {});
  return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), width, height };
}

/** Reads the pixel size of a GIF the coach uploads directly. */
export function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be read.'));
    };
    img.src = url;
  });
}
