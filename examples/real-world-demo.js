/**
 * Real-World WebCodecs Demo
 *
 * This demonstrates practical use cases:
 * 1. Generate a test video with animated content
 * 2. Transcode between codecs (H.264 → VP9)
 * 3. Extract frames and create thumbnails
 * 4. Measure encoding/decoding performance
 * 5. Write output to actual files
 */

const fs = require('fs');
const path = require('path');
const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  AudioEncoder,
  AudioData,
  isNativeAvailable,
  getFFmpegVersion
} = require('../dist/index.js');

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================================
// Utility Functions
// ============================================================

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDuration(ms) {
  if (ms < 1000) return ms.toFixed(0) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

// Generate animated frame with bouncing ball
function generateAnimatedFrame(width, height, frameIndex, totalFrames) {
  const data = new Uint8Array(width * height * 4);

  // Background gradient (changes over time)
  const bgHue = (frameIndex / totalFrames) * 360;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Gradient background
      const gradientValue = Math.floor((y / height) * 100) + 50;
      data[idx] = gradientValue;     // R
      data[idx + 1] = gradientValue; // G
      data[idx + 2] = Math.floor(150 + (bgHue / 360) * 100); // B
      data[idx + 3] = 255;           // A
    }
  }

  // Bouncing ball
  const ballRadius = 30;
  const t = frameIndex / totalFrames;
  const ballX = Math.floor(width * 0.2 + (width * 0.6) * t);
  const ballY = Math.floor(height * 0.5 + Math.sin(t * Math.PI * 4) * (height * 0.3));

  // Draw ball
  for (let dy = -ballRadius; dy <= ballRadius; dy++) {
    for (let dx = -ballRadius; dx <= ballRadius; dx++) {
      if (dx * dx + dy * dy <= ballRadius * ballRadius) {
        const x = ballX + dx;
        const y = ballY + dy;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          data[idx] = 255;     // R
          data[idx + 1] = 100; // G
          data[idx + 2] = 100; // B
        }
      }
    }
  }

  // Frame counter text area (simplified rectangle)
  const textY = 20;
  const textHeight = 30;
  for (let y = textY; y < textY + textHeight && y < height; y++) {
    for (let x = 10; x < 150 && x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 200;
    }
  }

  return data;
}

// Generate sine wave audio
function generateSineWave(sampleRate, durationSec, frequency, channels = 2) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(numSamples * channels);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Frequency sweep for more interesting audio
    const freq = frequency + Math.sin(t * 2) * 100;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.3;

    // Fade in/out to avoid clicks
    let envelope = 1.0;
    const fadeTime = 0.05;
    if (t < fadeTime) envelope = t / fadeTime;
    if (t > durationSec - fadeTime) envelope = (durationSec - t) / fadeTime;

    const finalSample = sample * envelope;

    for (let c = 0; c < channels; c++) {
      data[i * channels + c] = finalSample;
    }
  }

  return data;
}

// ============================================================
// Demo 1: Generate and Encode Video
// ============================================================

async function demo1_GenerateVideo() {
  console.log('\n' + '='.repeat(60));
  console.log('DEMO 1: Generate Animated Video');
  console.log('='.repeat(60));

  const WIDTH = 640;
  const HEIGHT = 480;
  const FPS = 30;
  const DURATION_SEC = 3;
  const TOTAL_FRAMES = FPS * DURATION_SEC;

  console.log(`\nGenerating ${DURATION_SEC}s video @ ${WIDTH}x${HEIGHT}, ${FPS}fps (${TOTAL_FRAMES} frames)`);

  const chunks = [];
  let decoderConfig = null;
  const startTime = Date.now();

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push(chunk);
      if (metadata?.decoderConfig) {
        decoderConfig = metadata.decoderConfig;
      }
    },
    error: (err) => console.error('Encoder error:', err),
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 2_000_000,
    framerate: FPS,
  });

  const frameDuration = Math.floor(1_000_000 / FPS);

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const frameData = generateAnimatedFrame(WIDTH, HEIGHT, i, TOTAL_FRAMES);

    const frame = new VideoFrame(frameData, {
      format: 'RGBA',
      codedWidth: WIDTH,
      codedHeight: HEIGHT,
      timestamp: i * frameDuration,
      duration: frameDuration,
    });

    encoder.encode(frame, { keyFrame: i % FPS === 0 }); // Keyframe every second
    frame.close();

    if ((i + 1) % 30 === 0) {
      process.stdout.write(`\r  Encoding: ${i + 1}/${TOTAL_FRAMES} frames...`);
    }
  }

  await encoder.flush();
  encoder.close();

  const encodingTime = Date.now() - startTime;
  const totalBytes = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const rawSize = WIDTH * HEIGHT * 4 * TOTAL_FRAMES;

  console.log(`\n\n  Results:`);
  console.log(`  - Frames encoded: ${TOTAL_FRAMES}`);
  console.log(`  - Chunks produced: ${chunks.length}`);
  console.log(`  - Raw size: ${formatBytes(rawSize)}`);
  console.log(`  - Encoded size: ${formatBytes(totalBytes)}`);
  console.log(`  - Compression: ${((1 - totalBytes / rawSize) * 100).toFixed(1)}%`);
  console.log(`  - Encoding time: ${formatDuration(encodingTime)}`);
  console.log(`  - Speed: ${(TOTAL_FRAMES / (encodingTime / 1000)).toFixed(1)} fps`);

  // Save raw H.264 bitstream
  const h264File = path.join(OUTPUT_DIR, 'demo_video.h264');
  const h264Stream = fs.createWriteStream(h264File);

  // Write SPS/PPS from decoder config if available
  if (decoderConfig?.description) {
    h264Stream.write(Buffer.from(decoderConfig.description));
  }

  for (const chunk of chunks) {
    const buffer = new Uint8Array(chunk.byteLength);
    chunk.copyTo(buffer);
    h264Stream.write(Buffer.from(buffer));
  }
  h264Stream.end();

  console.log(`\n  Saved to: ${h264File}`);

  return { chunks, decoderConfig, width: WIDTH, height: HEIGHT };
}

// ============================================================
// Demo 2: Transcode Video (H.264 → VP9)
// ============================================================

async function demo2_TranscodeVideo(h264Data) {
  console.log('\n' + '='.repeat(60));
  console.log('DEMO 2: Transcode H.264 → VP9');
  console.log('='.repeat(60));

  const { chunks: h264Chunks, decoderConfig, width, height } = h264Data;

  console.log(`\nInput: ${h264Chunks.length} H.264 chunks`);

  const decodedFrames = [];
  const vp9Chunks = [];
  const startTime = Date.now();

  // Step 1: Decode H.264
  console.log('\n  Step 1: Decoding H.264...');

  const decoder = new VideoDecoder({
    output: (frame) => {
      decodedFrames.push(frame);
    },
    error: (err) => console.error('Decoder error:', err),
  });

  decoder.configure({
    codec: 'avc1.42E01E',
    codedWidth: width,
    codedHeight: height,
    description: decoderConfig?.description,
  });

  for (const chunk of h264Chunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  const decodeTime = Date.now() - startTime;
  console.log(`  Decoded ${decodedFrames.length} frames in ${formatDuration(decodeTime)}`);

  // Step 2: Encode to VP9
  console.log('\n  Step 2: Encoding to VP9...');
  const encodeStart = Date.now();

  const vp9Encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      vp9Chunks.push(chunk);
    },
    error: (err) => console.error('VP9 Encoder error:', err),
  });

  vp9Encoder.configure({
    codec: 'vp9',
    width: width,
    height: height,
    bitrate: 1_500_000,
    framerate: 30,
  });

  for (let i = 0; i < decodedFrames.length; i++) {
    const frame = decodedFrames[i];
    vp9Encoder.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();
  }

  await vp9Encoder.flush();
  vp9Encoder.close();

  const encodeTime = Date.now() - encodeStart;
  const totalTime = Date.now() - startTime;

  const h264Size = h264Chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const vp9Size = vp9Chunks.reduce((sum, c) => sum + c.byteLength, 0);

  console.log(`\n  Results:`);
  console.log(`  - H.264 size: ${formatBytes(h264Size)}`);
  console.log(`  - VP9 size: ${formatBytes(vp9Size)}`);
  console.log(`  - Size change: ${((vp9Size / h264Size - 1) * 100).toFixed(1)}%`);
  console.log(`  - Decode time: ${formatDuration(decodeTime)}`);
  console.log(`  - Encode time: ${formatDuration(encodeTime)}`);
  console.log(`  - Total transcode: ${formatDuration(totalTime)}`);

  // Save VP9 bitstream
  const vp9File = path.join(OUTPUT_DIR, 'demo_video.vp9');
  const vp9Stream = fs.createWriteStream(vp9File);

  for (const chunk of vp9Chunks) {
    const buffer = new Uint8Array(chunk.byteLength);
    chunk.copyTo(buffer);
    vp9Stream.write(Buffer.from(buffer));
  }
  vp9Stream.end();

  console.log(`\n  Saved to: ${vp9File}`);

  return { vp9Chunks };
}

// ============================================================
// Demo 3: Audio Encoding with Multiple Codecs
// ============================================================

async function demo3_AudioEncoding() {
  console.log('\n' + '='.repeat(60));
  console.log('DEMO 3: Audio Encoding Comparison');
  console.log('='.repeat(60));

  const SAMPLE_RATE = 48000;
  const CHANNELS = 2;
  const DURATION_SEC = 2;

  console.log(`\nGenerating ${DURATION_SEC}s of audio @ ${SAMPLE_RATE}Hz stereo`);

  const audioSamples = generateSineWave(SAMPLE_RATE, DURATION_SEC, 440, CHANNELS);
  const rawSize = audioSamples.byteLength;

  console.log(`Raw audio size: ${formatBytes(rawSize)}`);

  const codecs = [
    { name: 'AAC', codec: 'mp4a.40.2', bitrate: 128000, ext: 'aac' },
    { name: 'Opus', codec: 'opus', bitrate: 96000, ext: 'opus' },
    { name: 'FLAC', codec: 'flac', bitrate: 0, ext: 'flac' },
  ];

  const results = [];

  for (const { name, codec, bitrate, ext } of codecs) {
    console.log(`\n  Encoding ${name}...`);

    const chunks = [];
    const startTime = Date.now();

    const encoder = new AudioEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (err) => console.error(`${name} error:`, err),
    });

    try {
      const config = {
        codec,
        sampleRate: SAMPLE_RATE,
        numberOfChannels: CHANNELS,
      };
      if (bitrate > 0) config.bitrate = bitrate;

      encoder.configure(config);

      // Encode in chunks
      const frameSize = codec === 'opus' ? 960 : 1024;
      const totalFrames = Math.floor((SAMPLE_RATE * DURATION_SEC) / frameSize);

      for (let i = 0; i < totalFrames; i++) {
        const startSample = i * frameSize;
        const frameData = new Float32Array(frameSize * CHANNELS);

        for (let j = 0; j < frameSize * CHANNELS; j++) {
          frameData[j] = audioSamples[startSample * CHANNELS + j] || 0;
        }

        const audio = new AudioData({
          format: 'f32',
          sampleRate: SAMPLE_RATE,
          numberOfFrames: frameSize,
          numberOfChannels: CHANNELS,
          timestamp: Math.floor((startSample / SAMPLE_RATE) * 1_000_000),
          data: frameData,
        });

        encoder.encode(audio);
        audio.close();
      }

      await encoder.flush();
      encoder.close();

      const encodingTime = Date.now() - startTime;
      const encodedSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);

      results.push({
        name,
        size: encodedSize,
        time: encodingTime,
        ratio: encodedSize / rawSize,
      });

      // Save audio file
      const audioFile = path.join(OUTPUT_DIR, `demo_audio.${ext}`);
      const audioStream = fs.createWriteStream(audioFile);
      for (const chunk of chunks) {
        const buffer = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buffer);
        audioStream.write(Buffer.from(buffer));
      }
      audioStream.end();

      console.log(`    Size: ${formatBytes(encodedSize)} (${(encodedSize / rawSize * 100).toFixed(1)}% of raw)`);
      console.log(`    Time: ${formatDuration(encodingTime)}`);
      console.log(`    Saved: ${audioFile}`);

    } catch (err) {
      console.log(`    Skipped: ${err.message}`);
    }
  }

  console.log('\n  Comparison:');
  console.log('  ' + '-'.repeat(50));
  console.log('  Codec    Size        Ratio    Time');
  console.log('  ' + '-'.repeat(50));
  for (const r of results) {
    console.log(`  ${r.name.padEnd(8)} ${formatBytes(r.size).padEnd(11)} ${(r.ratio * 100).toFixed(1).padStart(5)}%   ${formatDuration(r.time)}`);
  }
}

// ============================================================
// Demo 4: Performance Benchmark
// ============================================================

async function demo4_Benchmark() {
  console.log('\n' + '='.repeat(60));
  console.log('DEMO 4: Encoding Performance Benchmark');
  console.log('='.repeat(60));

  const resolutions = [
    { name: '480p', width: 854, height: 480 },
    { name: '720p', width: 1280, height: 720 },
    { name: '1080p', width: 1920, height: 1080 },
  ];

  const FRAMES = 30; // 1 second
  const results = [];

  for (const { name, width, height } of resolutions) {
    console.log(`\n  Testing ${name} (${width}x${height})...`);

    const chunks = [];
    const startTime = Date.now();

    const encoder = new VideoEncoder({
      output: (chunk) => chunks.push(chunk),
      error: (err) => console.error('Error:', err),
    });

    encoder.configure({
      codec: 'avc1.42E01E',
      width,
      height,
      bitrate: width * height * 3, // ~3 bits per pixel
      framerate: 30,
    });

    // Pre-generate frame data
    const frameData = new Uint8Array(width * height * 4);
    for (let i = 0; i < frameData.length; i += 4) {
      frameData[i] = Math.random() * 255;
      frameData[i + 1] = Math.random() * 255;
      frameData[i + 2] = Math.random() * 255;
      frameData[i + 3] = 255;
    }

    const encodeStart = Date.now();

    for (let i = 0; i < FRAMES; i++) {
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: width,
        codedHeight: height,
        timestamp: i * 33333,
      });

      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }

    await encoder.flush();
    encoder.close();

    const totalTime = Date.now() - encodeStart;
    const fps = FRAMES / (totalTime / 1000);
    const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const megapixelsPerSec = (width * height * fps) / 1_000_000;

    results.push({
      name,
      width,
      height,
      fps: fps.toFixed(1),
      mpps: megapixelsPerSec.toFixed(2),
      size: totalSize,
      time: totalTime,
    });

    console.log(`    FPS: ${fps.toFixed(1)}, MP/s: ${megapixelsPerSec.toFixed(2)}, Size: ${formatBytes(totalSize)}`);
  }

  console.log('\n  Summary:');
  console.log('  ' + '-'.repeat(60));
  console.log('  Resolution   Pixels      FPS      MP/s     Encoded Size');
  console.log('  ' + '-'.repeat(60));
  for (const r of results) {
    const pixels = (r.width * r.height / 1_000_000).toFixed(2) + 'M';
    console.log(`  ${r.name.padEnd(12)} ${pixels.padEnd(10)} ${r.fps.padStart(6)}   ${r.mpps.padStart(6)}   ${formatBytes(r.size)}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('WebCodecs-Node Real-World Demo');
  console.log('='.repeat(60));

  // Check native module
  console.log('\nNative module available:', isNativeAvailable());

  const ffmpegVersion = getFFmpegVersion();
  if (ffmpegVersion) {
    console.log('FFmpeg libavcodec:', ffmpegVersion.avcodec);
  }

  console.log('Output directory:', OUTPUT_DIR);

  try {
    // Run all demos
    const h264Data = await demo1_GenerateVideo();
    await demo2_TranscodeVideo(h264Data);
    await demo3_AudioEncoding();
    await demo4_Benchmark();

    console.log('\n' + '='.repeat(60));
    console.log('All demos completed successfully!');
    console.log('='.repeat(60));
    console.log(`\nOutput files saved to: ${OUTPUT_DIR}`);
    console.log('\nTo play the files:');
    console.log(`  ffplay ${path.join(OUTPUT_DIR, 'demo_video.h264')}`);
    console.log(`  ffplay ${path.join(OUTPUT_DIR, 'demo_video.vp9')}`);
    console.log(`  ffplay ${path.join(OUTPUT_DIR, 'demo_audio.aac')}`);

  } catch (err) {
    console.error('\nDemo failed:', err);
    process.exit(1);
  }
}

main();
