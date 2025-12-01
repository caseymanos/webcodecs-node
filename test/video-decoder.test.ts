/**
 * Tests for VideoDecoder
 */

import { VideoDecoder, VideoDecoderConfig } from '../src/VideoDecoder';
import { VideoFrame } from '../src/VideoFrame';
import { EncodedVideoChunk } from '../src/EncodedVideoChunk';

describe('VideoDecoder', () => {
  describe('isConfigSupported', () => {
    it('should support H.264 baseline profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.42E01E',
      });
      expect(result.supported).toBe(true);
      expect(result.config.codec).toBe('avc1.42E01E');
    });

    it('should support H.264 main profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.4D401F',
      });
      expect(result.supported).toBe(true);
    });

    it('should support H.264 high profile', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'avc1.640028',
      });
      expect(result.supported).toBe(true);
    });

    it('should support VP8', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp8',
      });
      expect(result.supported).toBe(true);
    });

    it('should support VP9', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'vp9',
      });
      expect(result.supported).toBe(true);
    });

    it('should not support unknown codecs', async () => {
      const result = await VideoDecoder.isConfigSupported({
        codec: 'unknown-codec',
      });
      expect(result.supported).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should require output callback', () => {
      expect(() => {
        new VideoDecoder({} as any);
      }).toThrow(TypeError);
    });

    it('should require error callback', () => {
      expect(() => {
        new VideoDecoder({
          output: () => {},
        } as any);
      }).toThrow(TypeError);
    });

    it('should create decoder with valid callbacks', () => {
      const decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
      expect(decoder.state).toBe('unconfigured');
      expect(decoder.decodeQueueSize).toBe(0);
      decoder.close();
    });
  });

  describe('state management', () => {
    let decoder: VideoDecoder;

    beforeEach(() => {
      decoder = new VideoDecoder({
        output: () => {},
        error: () => {},
      });
    });

    afterEach(() => {
      if (decoder.state !== 'closed') {
        decoder.close();
      }
    });

    it('should start in unconfigured state', () => {
      expect(decoder.state).toBe('unconfigured');
    });

    it('should throw if decode called when unconfigured', () => {
      const chunk = new EncodedVideoChunk({
        type: 'key',
        timestamp: 0,
        data: new Uint8Array([0, 0, 0, 1]),
      });

      expect(() => decoder.decode(chunk)).toThrow();
    });

    it('should throw if flush called when unconfigured', async () => {
      await expect(decoder.flush()).rejects.toThrow();
    });

    it('should throw if decode called after close', () => {
      decoder.close();

      expect(() => {
        decoder.configure({ codec: 'avc1.42E01E' });
      }).toThrow();
    });
  });
});
