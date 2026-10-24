declare module 'omggif' {
  export interface GifFrame {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Hundredths of a second. */
    delay: number;
    /** 0/1 keep, 2 clear to background, 3 restore what was there before. */
    disposal: number;
  }
  export class GifReader {
    constructor(buf: Uint8Array);
    width: number;
    height: number;
    numFrames(): number;
    frameInfo(i: number): GifFrame;
    decodeAndBlitFrameRGBA(i: number, pixels: Uint8Array | Uint8ClampedArray): void;
  }
}
