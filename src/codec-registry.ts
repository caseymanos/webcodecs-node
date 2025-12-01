/**
 * Codec Registry - Maps WebCodecs codec strings to FFmpeg codec IDs
 */

export interface CodecInfo {
  ffmpegCodec: string;
  type: 'video' | 'audio';
  profiles?: Record<string, number>;
}

/**
 * Parse H.264/AVC codec string format: avc1.PPCCLL
 * PP = profile_idc, CC = constraint_set flags, LL = level_idc
 */
export function parseAvcCodecString(codec: string): { profile: number; level: number } | null {
  const match = codec.match(/^avc1\.([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!match) return null;

  const profile = parseInt(match[1], 16);
  const level = parseInt(match[3], 16);

  return { profile, level };
}

/**
 * Parse AAC codec string format: mp4a.40.X
 * X = audio object type (2 = AAC-LC, 5 = HE-AAC, 29 = HE-AACv2)
 */
export function parseAacCodecString(codec: string): { objectType: number } | null {
  const match = codec.match(/^mp4a\.40\.(\d+)$/);
  if (!match) return null;

  return { objectType: parseInt(match[1], 10) };
}

/**
 * Parse VP9 codec string format: vp09.PP.LL.DD.CC.CP.TC.MC.FF
 * PP = profile, LL = level, DD = bit depth, etc.
 */
export function parseVp9CodecString(codec: string): {
  profile: number;
  level: number;
  bitDepth: number;
} | null {
  // Simple VP9 string
  if (codec === 'vp9' || codec === 'vp09') {
    return { profile: 0, level: 10, bitDepth: 8 };
  }

  // Full VP9 string: vp09.PP.LL.DD...
  const match = codec.match(/^vp09\.(\d{2})\.(\d{2})\.(\d{2})/);
  if (!match) return null;

  return {
    profile: parseInt(match[1], 10),
    level: parseInt(match[2], 10),
    bitDepth: parseInt(match[3], 10),
  };
}

/**
 * Video codec registry
 */
export const VIDEO_CODECS: Record<string, CodecInfo> = {
  // H.264/AVC
  'avc1': {
    ffmpegCodec: 'libx264',
    type: 'video',
    profiles: {
      '42': 66,  // Baseline
      '4d': 77,  // Main
      '58': 88,  // Extended
      '64': 100, // High
    },
  },
  // VP8
  'vp8': {
    ffmpegCodec: 'libvpx',
    type: 'video',
  },
  // VP9
  'vp09': {
    ffmpegCodec: 'libvpx-vp9',
    type: 'video',
  },
  'vp9': {
    ffmpegCodec: 'libvpx-vp9',
    type: 'video',
  },
  // H.265/HEVC
  'hvc1': {
    ffmpegCodec: 'libx265',
    type: 'video',
  },
  'hev1': {
    ffmpegCodec: 'libx265',
    type: 'video',
  },
  // AV1
  'av01': {
    ffmpegCodec: 'libaom-av1',
    type: 'video',
  },
};

/**
 * Audio codec registry
 */
export const AUDIO_CODECS: Record<string, CodecInfo> = {
  // AAC
  'mp4a.40': {
    ffmpegCodec: 'aac',
    type: 'audio',
  },
  // Opus
  'opus': {
    ffmpegCodec: 'libopus',
    type: 'audio',
  },
  // MP3
  'mp3': {
    ffmpegCodec: 'libmp3lame',
    type: 'audio',
  },
  // FLAC
  'flac': {
    ffmpegCodec: 'flac',
    type: 'audio',
  },
  // Vorbis
  'vorbis': {
    ffmpegCodec: 'libvorbis',
    type: 'audio',
  },
  // PCM
  'pcm': {
    ffmpegCodec: 'pcm_f32le',
    type: 'audio',
  },
};

/**
 * Check if a video codec is supported
 */
export function isVideoCodecSupported(codec: string): boolean {
  // Check for H.264 (avc1.XXXXXX)
  if (codec.startsWith('avc1.')) {
    return parseAvcCodecString(codec) !== null;
  }

  // Check for VP9 (vp09.XX.XX.XX...)
  if (codec.startsWith('vp09.')) {
    return parseVp9CodecString(codec) !== null;
  }

  // Check for HEVC (hvc1.X... or hev1.X...)
  if (codec.startsWith('hvc1.') || codec.startsWith('hev1.')) {
    return true;  // Accept any HEVC string for now
  }

  // Check for AV1 (av01.X...)
  if (codec.startsWith('av01.')) {
    return true;  // Accept any AV1 string for now
  }

  // Check simple codec names
  return codec in VIDEO_CODECS;
}

/**
 * Check if an audio codec is supported
 */
export function isAudioCodecSupported(codec: string): boolean {
  // Check for AAC (mp4a.40.X)
  if (codec.startsWith('mp4a.40.')) {
    return parseAacCodecString(codec) !== null;
  }

  // Check simple codec names
  return codec in AUDIO_CODECS;
}

/**
 * Get the FFmpeg encoder name for a video codec string
 */
export function getFFmpegVideoCodec(codec: string): string | null {
  if (codec.startsWith('avc1.')) {
    return 'libx264';
  }
  if (codec.startsWith('vp09.') || codec === 'vp9') {
    return 'libvpx-vp9';
  }
  if (codec === 'vp8') {
    return 'libvpx';
  }
  if (codec.startsWith('hvc1.') || codec.startsWith('hev1.')) {
    return 'libx265';
  }
  if (codec.startsWith('av01.')) {
    return 'libaom-av1';
  }

  const info = VIDEO_CODECS[codec];
  return info?.ffmpegCodec ?? null;
}

/**
 * Get the FFmpeg decoder name for a video codec string
 */
export function getFFmpegVideoDecoder(codec: string): string | null {
  if (codec.startsWith('avc1.')) {
    return 'h264';
  }
  if (codec.startsWith('vp09.') || codec === 'vp9') {
    return 'vp9';
  }
  if (codec === 'vp8') {
    return 'vp8';
  }
  if (codec.startsWith('hvc1.') || codec.startsWith('hev1.')) {
    return 'hevc';
  }
  if (codec.startsWith('av01.')) {
    return 'av1';
  }

  // Map encoder names to decoder names
  const encoderToDecoder: Record<string, string> = {
    'libx264': 'h264',
    'libvpx': 'vp8',
    'libvpx-vp9': 'vp9',
    'libx265': 'hevc',
    'libaom-av1': 'av1',
  };

  const info = VIDEO_CODECS[codec];
  if (info) {
    return encoderToDecoder[info.ffmpegCodec] ?? info.ffmpegCodec;
  }

  return null;
}

/**
 * Get the FFmpeg encoder name for an audio codec string
 */
export function getFFmpegAudioCodec(codec: string): string | null {
  if (codec.startsWith('mp4a.40.')) {
    return 'aac';
  }

  const info = AUDIO_CODECS[codec];
  return info?.ffmpegCodec ?? null;
}

/**
 * Get the FFmpeg decoder name for an audio codec string
 */
export function getFFmpegAudioDecoder(codec: string): string | null {
  if (codec.startsWith('mp4a.40.')) {
    return 'aac';
  }

  // Most audio decoders have the same name as encoders
  const encoderToDecoder: Record<string, string> = {
    'libopus': 'opus',
    'libmp3lame': 'mp3',
    'libvorbis': 'vorbis',
  };

  const info = AUDIO_CODECS[codec];
  if (info) {
    return encoderToDecoder[info.ffmpegCodec] ?? info.ffmpegCodec;
  }

  return null;
}
