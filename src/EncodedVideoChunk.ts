/**
 * EncodedVideoChunk - Represents a chunk of encoded video data
 * Implements the W3C WebCodecs EncodedVideoChunk interface
 */

import { BufferSource } from './types';

export type EncodedVideoChunkType = 'key' | 'delta';

export interface EncodedVideoChunkInit {
  type: EncodedVideoChunkType;
  timestamp: number;  // microseconds
  duration?: number;  // microseconds
  data: BufferSource;
}

export class EncodedVideoChunk {
  private _data: Uint8Array;

  readonly type: EncodedVideoChunkType;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;

  constructor(init: EncodedVideoChunkInit) {
    if (!init.type) {
      throw new TypeError('type is required');
    }
    if (init.type !== 'key' && init.type !== 'delta') {
      throw new TypeError('type must be "key" or "delta"');
    }
    if (init.timestamp === undefined) {
      throw new TypeError('timestamp is required');
    }
    if (!init.data) {
      throw new TypeError('data is required');
    }

    this.type = init.type;
    this.timestamp = init.timestamp;
    this.duration = init.duration ?? null;

    // Copy the data
    let source: Uint8Array;
    if (init.data instanceof ArrayBuffer) {
      source = new Uint8Array(init.data);
    } else {
      source = new Uint8Array(
        (init.data as ArrayBufferView).buffer,
        (init.data as ArrayBufferView).byteOffset,
        (init.data as ArrayBufferView).byteLength
      );
    }

    this._data = new Uint8Array(source);
    this.byteLength = this._data.byteLength;
  }

  /**
   * Copy the encoded data to a destination buffer
   */
  copyTo(destination: BufferSource): void {
    let dest: Uint8Array;
    if (destination instanceof ArrayBuffer) {
      dest = new Uint8Array(destination);
    } else {
      dest = new Uint8Array(
        (destination as ArrayBufferView).buffer,
        (destination as ArrayBufferView).byteOffset,
        (destination as ArrayBufferView).byteLength
      );
    }

    if (dest.byteLength < this._data.byteLength) {
      throw new TypeError('Destination buffer is too small');
    }

    dest.set(this._data);
  }
}
