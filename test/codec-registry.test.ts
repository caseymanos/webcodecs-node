/**
 * Tests for codec registry
 */

import {
  parseAvcCodecString,
  parseAacCodecString,
  parseVp9CodecString,
  isVideoCodecSupported,
  isAudioCodecSupported,
  getFFmpegVideoCodec,
  getFFmpegAudioCodec,
  getFFmpegVideoDecoder,
  getFFmpegAudioDecoder,
} from '../src/codec-registry';

describe('Codec Registry', () => {
  describe('parseAvcCodecString', () => {
    it('should parse valid H.264 baseline profile codec string', () => {
      const result = parseAvcCodecString('avc1.42E01E');
      expect(result).not.toBeNull();
      expect(result!.profile).toBe(0x42); // Baseline
      expect(result!.level).toBe(0x1E);   // Level 3.0
    });

    it('should parse valid H.264 main profile codec string', () => {
      const result = parseAvcCodecString('avc1.4D4029');
      expect(result).not.toBeNull();
      expect(result!.profile).toBe(0x4D); // Main
      expect(result!.level).toBe(0x29);   // Level 4.1
    });

    it('should parse valid H.264 high profile codec string', () => {
      const result = parseAvcCodecString('avc1.640028');
      expect(result).not.toBeNull();
      expect(result!.profile).toBe(0x64); // High
      expect(result!.level).toBe(0x28);   // Level 4.0
    });

    it('should return null for invalid codec strings', () => {
      expect(parseAvcCodecString('avc1')).toBeNull();
      expect(parseAvcCodecString('avc1.42')).toBeNull();
      expect(parseAvcCodecString('avc1.GGGGGG')).toBeNull();
      expect(parseAvcCodecString('vp8')).toBeNull();
    });
  });

  describe('parseAacCodecString', () => {
    it('should parse AAC-LC codec string', () => {
      const result = parseAacCodecString('mp4a.40.2');
      expect(result).not.toBeNull();
      expect(result!.objectType).toBe(2);
    });

    it('should parse HE-AAC codec string', () => {
      const result = parseAacCodecString('mp4a.40.5');
      expect(result).not.toBeNull();
      expect(result!.objectType).toBe(5);
    });

    it('should parse HE-AACv2 codec string', () => {
      const result = parseAacCodecString('mp4a.40.29');
      expect(result).not.toBeNull();
      expect(result!.objectType).toBe(29);
    });

    it('should return null for invalid codec strings', () => {
      expect(parseAacCodecString('mp4a')).toBeNull();
      expect(parseAacCodecString('mp4a.40')).toBeNull();
      expect(parseAacCodecString('mp4a.41.2')).toBeNull();
      expect(parseAacCodecString('opus')).toBeNull();
    });
  });

  describe('parseVp9CodecString', () => {
    it('should parse simple vp9 string', () => {
      const result = parseVp9CodecString('vp9');
      expect(result).not.toBeNull();
      expect(result!.profile).toBe(0);
      expect(result!.level).toBe(10);
      expect(result!.bitDepth).toBe(8);
    });

    it('should parse full VP9 codec string', () => {
      const result = parseVp9CodecString('vp09.00.10.08');
      expect(result).not.toBeNull();
      expect(result!.profile).toBe(0);
      expect(result!.level).toBe(10);
      expect(result!.bitDepth).toBe(8);
    });

    it('should return null for invalid codec strings', () => {
      expect(parseVp9CodecString('vp09')).not.toBeNull(); // vp09 alone is valid
      expect(parseVp9CodecString('vp8')).toBeNull();
    });
  });

  describe('isVideoCodecSupported', () => {
    it('should support H.264 codecs', () => {
      expect(isVideoCodecSupported('avc1.42E01E')).toBe(true);
      expect(isVideoCodecSupported('avc1.4D401F')).toBe(true);
      expect(isVideoCodecSupported('avc1.640028')).toBe(true);
    });

    it('should support VP8', () => {
      expect(isVideoCodecSupported('vp8')).toBe(true);
    });

    it('should support VP9', () => {
      expect(isVideoCodecSupported('vp9')).toBe(true);
      expect(isVideoCodecSupported('vp09.00.10.08')).toBe(true);
    });

    it('should not support unknown codecs', () => {
      expect(isVideoCodecSupported('unknown')).toBe(false);
      expect(isVideoCodecSupported('avc1.invalid')).toBe(false);
    });
  });

  describe('isAudioCodecSupported', () => {
    it('should support AAC codecs', () => {
      expect(isAudioCodecSupported('mp4a.40.2')).toBe(true);
      expect(isAudioCodecSupported('mp4a.40.5')).toBe(true);
    });

    it('should support Opus', () => {
      expect(isAudioCodecSupported('opus')).toBe(true);
    });

    it('should support MP3', () => {
      expect(isAudioCodecSupported('mp3')).toBe(true);
    });

    it('should support FLAC', () => {
      expect(isAudioCodecSupported('flac')).toBe(true);
    });

    it('should not support unknown codecs', () => {
      expect(isAudioCodecSupported('unknown')).toBe(false);
      expect(isAudioCodecSupported('mp4a.41.2')).toBe(false);
    });
  });

  describe('getFFmpegVideoCodec', () => {
    it('should return correct encoder for H.264', () => {
      expect(getFFmpegVideoCodec('avc1.42E01E')).toBe('libx264');
      expect(getFFmpegVideoCodec('avc1.640028')).toBe('libx264');
    });

    it('should return correct encoder for VP8', () => {
      expect(getFFmpegVideoCodec('vp8')).toBe('libvpx');
    });

    it('should return correct encoder for VP9', () => {
      expect(getFFmpegVideoCodec('vp9')).toBe('libvpx-vp9');
      expect(getFFmpegVideoCodec('vp09.00.10.08')).toBe('libvpx-vp9');
    });

    it('should return null for unknown codecs', () => {
      expect(getFFmpegVideoCodec('unknown')).toBeNull();
    });
  });

  describe('getFFmpegVideoDecoder', () => {
    it('should return correct decoder for H.264', () => {
      expect(getFFmpegVideoDecoder('avc1.42E01E')).toBe('h264');
    });

    it('should return correct decoder for VP8', () => {
      expect(getFFmpegVideoDecoder('vp8')).toBe('vp8');
    });

    it('should return correct decoder for VP9', () => {
      expect(getFFmpegVideoDecoder('vp9')).toBe('vp9');
    });
  });

  describe('getFFmpegAudioCodec', () => {
    it('should return correct encoder for AAC', () => {
      expect(getFFmpegAudioCodec('mp4a.40.2')).toBe('aac');
      expect(getFFmpegAudioCodec('mp4a.40.5')).toBe('aac');
    });

    it('should return correct encoder for Opus', () => {
      expect(getFFmpegAudioCodec('opus')).toBe('libopus');
    });

    it('should return correct encoder for MP3', () => {
      expect(getFFmpegAudioCodec('mp3')).toBe('libmp3lame');
    });

    it('should return correct encoder for FLAC', () => {
      expect(getFFmpegAudioCodec('flac')).toBe('flac');
    });
  });

  describe('getFFmpegAudioDecoder', () => {
    it('should return correct decoder for AAC', () => {
      expect(getFFmpegAudioDecoder('mp4a.40.2')).toBe('aac');
    });

    it('should return correct decoder for Opus', () => {
      expect(getFFmpegAudioDecoder('opus')).toBe('opus');
    });

    it('should return correct decoder for MP3', () => {
      expect(getFFmpegAudioDecoder('mp3')).toBe('mp3');
    });
  });
});
