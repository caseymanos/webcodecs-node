/**
 * Tests for core data types: VideoFrame, AudioData, EncodedVideoChunk, EncodedAudioChunk
 */

import { VideoFrame, VideoFrameBufferInit } from '../src/VideoFrame';
import { AudioData, AudioDataInit } from '../src/AudioData';
import { EncodedVideoChunk, EncodedVideoChunkInit } from '../src/EncodedVideoChunk';
import { EncodedAudioChunk, EncodedAudioChunkInit } from '../src/EncodedAudioChunk';
import { VideoColorSpace } from '../src/VideoColorSpace';

describe('VideoFrame', () => {
  describe('constructor', () => {
    it('should create a VideoFrame from RGBA buffer', () => {
      const width = 320;
      const height = 240;
      const data = new Uint8Array(width * height * 4);
      data.fill(128); // Gray

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.format).toBe('RGBA');
      expect(frame.codedWidth).toBe(width);
      expect(frame.codedHeight).toBe(height);
      expect(frame.timestamp).toBe(0);
      expect(frame.duration).toBeNull();

      frame.close();
    });

    it('should create a VideoFrame from I420 buffer', () => {
      const width = 320;
      const height = 240;
      const ySize = width * height;
      const uvSize = (width / 2) * (height / 2);
      const data = new Uint8Array(ySize + uvSize * 2);
      data.fill(128);

      const frame = new VideoFrame(data, {
        format: 'I420',
        codedWidth: width,
        codedHeight: height,
        timestamp: 1000,
        duration: 33333,
      });

      expect(frame.format).toBe('I420');
      expect(frame.codedWidth).toBe(width);
      expect(frame.codedHeight).toBe(height);
      expect(frame.timestamp).toBe(1000);
      expect(frame.duration).toBe(33333);

      frame.close();
    });

    it('should throw if required parameters are missing', () => {
      const data = new Uint8Array(100);

      expect(() => {
        new VideoFrame(data, {} as VideoFrameBufferInit);
      }).toThrow(TypeError);

      expect(() => {
        new VideoFrame(data, { format: 'RGBA' } as VideoFrameBufferInit);
      }).toThrow(TypeError);
    });
  });

  describe('allocationSize', () => {
    it('should return correct size for RGBA', () => {
      const width = 320;
      const height = 240;
      const data = new Uint8Array(width * height * 4);

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.allocationSize()).toBe(width * height * 4);
      frame.close();
    });

    it('should return correct size for I420', () => {
      const width = 320;
      const height = 240;
      const ySize = width * height;
      const uvSize = (width / 2) * (height / 2);
      const data = new Uint8Array(ySize + uvSize * 2);

      const frame = new VideoFrame(data, {
        format: 'I420',
        codedWidth: width,
        codedHeight: height,
        timestamp: 0,
      });

      expect(frame.allocationSize()).toBe(Math.floor(width * height * 1.5));
      frame.close();
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const width = 320;
      const height = 240;
      const data = new Uint8Array(width * height * 4);
      data.fill(128);

      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: 1000,
      });

      const clone = frame.clone();

      expect(clone.format).toBe(frame.format);
      expect(clone.codedWidth).toBe(frame.codedWidth);
      expect(clone.codedHeight).toBe(frame.codedHeight);
      expect(clone.timestamp).toBe(frame.timestamp);

      // Closing original shouldn't affect clone
      frame.close();
      expect(clone.codedWidth).toBe(width);

      clone.close();
    });
  });

  describe('close', () => {
    it('should prevent further operations', () => {
      const data = new Uint8Array(320 * 240 * 4);
      const frame = new VideoFrame(data, {
        format: 'RGBA',
        codedWidth: 320,
        codedHeight: 240,
        timestamp: 0,
      });

      frame.close();

      expect(() => frame.allocationSize()).toThrow();
      expect(() => frame.clone()).toThrow();
    });
  });
});

describe('AudioData', () => {
  describe('constructor', () => {
    it('should create AudioData from f32 buffer', () => {
      const sampleRate = 48000;
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);
      data.fill(0.5);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      expect(audioData.format).toBe('f32');
      expect(audioData.sampleRate).toBe(sampleRate);
      expect(audioData.numberOfFrames).toBe(numberOfFrames);
      expect(audioData.numberOfChannels).toBe(numberOfChannels);
      expect(audioData.timestamp).toBe(0);

      // Duration should be calculated correctly
      const expectedDuration = Math.floor((numberOfFrames / sampleRate) * 1_000_000);
      expect(audioData.duration).toBe(expectedDuration);

      audioData.close();
    });

    it('should throw if required parameters are missing', () => {
      expect(() => {
        new AudioData({} as AudioDataInit);
      }).toThrow(TypeError);
    });
  });

  describe('allocationSize', () => {
    it('should return correct size for interleaved format', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      expect(audioData.allocationSize({ planeIndex: 0 })).toBe(
        numberOfFrames * numberOfChannels * 4
      );

      audioData.close();
    });

    it('should return correct size for planar format', () => {
      const numberOfFrames = 1024;
      const numberOfChannels = 2;
      const data = new Float32Array(numberOfFrames * numberOfChannels);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames,
        numberOfChannels,
        timestamp: 0,
        data: data.buffer,
      });

      expect(audioData.allocationSize({ planeIndex: 0 })).toBe(
        numberOfFrames * 4
      );

      audioData.close();
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const data = new Float32Array(1024 * 2);
      data.fill(0.5);

      const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfFrames: 1024,
        numberOfChannels: 2,
        timestamp: 1000,
        data: data.buffer,
      });

      const clone = audioData.clone();

      expect(clone.format).toBe(audioData.format);
      expect(clone.sampleRate).toBe(audioData.sampleRate);
      expect(clone.numberOfFrames).toBe(audioData.numberOfFrames);
      expect(clone.numberOfChannels).toBe(audioData.numberOfChannels);
      expect(clone.timestamp).toBe(audioData.timestamp);

      audioData.close();
      expect(clone.sampleRate).toBe(48000);

      clone.close();
    });
  });
});

describe('EncodedVideoChunk', () => {
  describe('constructor', () => {
    it('should create a key chunk', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42]);

      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data,
      });

      expect(chunk.type).toBe('key');
      expect(chunk.timestamp).toBe(0);
      expect(chunk.duration).toBeNull();
      expect(chunk.byteLength).toBe(6);
    });

    it('should create a delta chunk with duration', () => {
      const data = new Uint8Array([0x00, 0x00, 0x01, 0x41]);

      const chunk = new EncodedVideoChunk({
        type: 'delta',
        timestamp: 33333,
        duration: 33333,
        data,
      });

      expect(chunk.type).toBe('delta');
      expect(chunk.timestamp).toBe(33333);
      expect(chunk.duration).toBe(33333);
      expect(chunk.byteLength).toBe(4);
    });

    it('should throw for invalid type', () => {
      expect(() => {
        new EncodedVideoChunk({
          type: 'invalid' as any,
          timestamp: 0,
          data: new Uint8Array(1),
        });
      }).toThrow(TypeError);
    });
  });

  describe('copyTo', () => {
    it('should copy data to destination buffer', () => {
      const srcData = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x42]);
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: srcData,
      });

      const dest = new Uint8Array(10);
      chunk.copyTo(dest);

      expect(dest.slice(0, 6)).toEqual(srcData);
    });

    it('should throw if destination is too small', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array(10),
      });

      expect(() => {
        chunk.copyTo(new Uint8Array(5));
      }).toThrow(TypeError);
    });
  });
});

describe('EncodedAudioChunk', () => {
  describe('constructor', () => {
    it('should create an audio chunk', () => {
      const data = new Uint8Array([0xFF, 0xF1, 0x50, 0x80]);

      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        duration: 21333,
        data,
      });

      expect(chunk.type).toBe('key');
      expect(chunk.timestamp).toBe(0);
      expect(chunk.duration).toBe(21333);
      expect(chunk.byteLength).toBe(4);
    });
  });

  describe('copyTo', () => {
    it('should copy data to destination buffer', () => {
      const srcData = new Uint8Array([0xFF, 0xF1, 0x50, 0x80, 0x00, 0x1F]);
      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: 0,
        data: srcData,
      });

      const dest = new Uint8Array(10);
      chunk.copyTo(dest);

      expect(dest.slice(0, 6)).toEqual(srcData);
    });
  });
});

describe('VideoColorSpace', () => {
  it('should use default values when no init provided', () => {
    const colorSpace = new VideoColorSpace();

    expect(colorSpace.primaries).toBeNull();
    expect(colorSpace.transfer).toBeNull();
    expect(colorSpace.matrix).toBeNull();
    expect(colorSpace.fullRange).toBeNull();
  });

  it('should accept init values', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'bt709',
      matrix: 'bt709',
      fullRange: true,
    });

    expect(colorSpace.primaries).toBe('bt709');
    expect(colorSpace.transfer).toBe('bt709');
    expect(colorSpace.matrix).toBe('bt709');
    expect(colorSpace.fullRange).toBe(true);
  });

  it('should serialize to JSON', () => {
    const colorSpace = new VideoColorSpace({
      primaries: 'bt709',
      transfer: 'smpte170m',
      matrix: 'bt709',
      fullRange: false,
    });

    const json = colorSpace.toJSON();

    expect(json.primaries).toBe('bt709');
    expect(json.transfer).toBe('smpte170m');
    expect(json.matrix).toBe('bt709');
    expect(json.fullRange).toBe(false);
  });
});
