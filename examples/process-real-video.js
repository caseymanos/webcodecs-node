/**
 * Process Real Video Demo - Big Buck Bunny
 *
 * This demonstrates webcodecs-node processing a real video file:
 * 1. Extract frames from MP4 using ffmpeg
 * 2. Re-encode to different codecs (VP9, HEVC)
 * 3. Compare compression and quality
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  isNativeAvailable,
} = require('../dist/index.js');

const INPUT_VIDEO = path.join(__dirname, 'big_buck_bunny.mp4');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDuration(ms) {
  if (ms < 1000) return ms.toFixed(0) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

/**
 * Extract raw frames from video using ffmpeg
 */
function extractFrames(inputPath, maxFrames = 150) {
  console.log('\n  Extracting frames with ffmpeg...');

  const startTime = Date.now();

  // Get video info
  const probeOutput = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 "${inputPath}"`).toString().trim();
  const [width, height, frameRate] = probeOutput.split(',');
  const [fpsNum, fpsDen] = frameRate.split('/');
  const fps = parseInt(fpsNum) / parseInt(fpsDen);

  console.log(`  Video: ${width}x${height} @ ${fps.toFixed(2)} fps`);

  // Extract frames as raw RGBA using ffmpeg
  const ffmpegArgs = [
    '-i', inputPath,
    '-vf', `scale=${width}:${height}`,
    '-pix_fmt', 'rgba',
    '-f', 'rawvideo',
    '-frames:v', maxFrames.toString(),
    '-'
  ];

  const ffmpeg = execSync(`ffmpeg ${ffmpegArgs.map(a => `"${a}"`).join(' ')} 2>/dev/null`, {
    maxBuffer: 500 * 1024 * 1024, // 500MB buffer
  });

  const frameSize = parseInt(width) * parseInt(height) * 4; // RGBA
  const frameCount = Math.floor(ffmpeg.length / frameSize);

  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      data: new Uint8Array(ffmpeg.slice(i * frameSize, (i + 1) * frameSize)),
      width: parseInt(width),
      height: parseInt(height),
      timestamp: Math.floor((i / fps) * 1_000_000), // microseconds
    });
  }

  const extractTime = Date.now() - startTime;
  console.log(`  Extracted ${frames.length} frames in ${formatDuration(extractTime)}`);

  return { frames, width: parseInt(width), height: parseInt(height), fps };
}

/**
 * Encode frames with a specific codec
 */
async function encodeWithCodec(frames, width, height, fps, codecConfig) {
  const { name, codec, bitrate } = codecConfig;

  console.log(`\n  Encoding with ${name}...`);
  const startTime = Date.now();

  const chunks = [];
  let decoderConfig = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      chunks.push(chunk);
      if (metadata?.decoderConfig) {
        decoderConfig = metadata.decoderConfig;
      }
    },
    error: (err) => console.error(`  ${name} error:`, err.message),
  });

  try {
    encoder.configure({
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
    });
  } catch (err) {
    console.log(`  ${name} not available: ${err.message}`);
    return null;
  }

  for (let i = 0; i < frames.length; i++) {
    const { data, timestamp } = frames[i];

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: width,
      codedHeight: height,
      timestamp,
    });

    encoder.encode(frame, { keyFrame: i % Math.floor(fps) === 0 }); // Keyframe every ~1 sec
    frame.close();

    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r  Encoding ${name}: ${i + 1}/${frames.length} frames...`);
    }
  }

  await encoder.flush();
  encoder.close();

  const encodeTime = Date.now() - startTime;
  const totalSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const encodeFps = frames.length / (encodeTime / 1000);

  console.log(`\r  ${name}: ${chunks.length} chunks, ${formatBytes(totalSize)}, ${formatDuration(encodeTime)} (${encodeFps.toFixed(1)} fps)`);

  return {
    name,
    codec,
    chunks,
    decoderConfig,
    size: totalSize,
    time: encodeTime,
    fps: encodeFps,
  };
}

/**
 * Save encoded video to file
 */
function saveEncodedVideo(result, outputPath) {
  const stream = fs.createWriteStream(outputPath);

  // Write extradata/description if available
  if (result.decoderConfig?.description) {
    stream.write(Buffer.from(result.decoderConfig.description));
  }

  for (const chunk of result.chunks) {
    const buffer = new Uint8Array(chunk.byteLength);
    chunk.copyTo(buffer);
    stream.write(Buffer.from(buffer));
  }

  stream.end();
  console.log(`  Saved: ${outputPath}`);
}

/**
 * Wrap raw bitstream in MP4 container for proper playback
 */
function wrapInMp4(inputPath, outputPath, codec, fps) {
  try {
    const codecMap = {
      'avc1.42E01E': 'h264',
      'avc1.640028': 'h264',
      'vp9': 'vp9',
      'vp8': 'vp8',
      'hvc1': 'hevc',
    };

    const ffmpegCodec = codecMap[codec] || 'h264';

    execSync(`ffmpeg -y -framerate ${fps} -i "${inputPath}" -c copy "${outputPath}" 2>/dev/null`);
    console.log(`  Wrapped in MP4: ${outputPath}`);
    return true;
  } catch (err) {
    console.log(`  Could not wrap in MP4: ${err.message}`);
    return false;
  }
}

/**
 * Main demo
 */
async function main() {
  console.log('='.repeat(60));
  console.log('WebCodecs-Node - Real Video Processing Demo');
  console.log('='.repeat(60));

  // Check prerequisites
  if (!fs.existsSync(INPUT_VIDEO)) {
    console.error(`\nInput video not found: ${INPUT_VIDEO}`);
    console.log('Please run: curl -L -o examples/big_buck_bunny.mp4 "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"');
    process.exit(1);
  }

  console.log(`\nInput: ${INPUT_VIDEO}`);
  console.log(`Native module: ${isNativeAvailable() ? 'Available' : 'Not available'}`);

  // Get original file size
  const originalSize = fs.statSync(INPUT_VIDEO).size;
  console.log(`Original file size: ${formatBytes(originalSize)}`);

  // Extract frames (first 5 seconds = ~150 frames at 30fps)
  console.log('\n' + '-'.repeat(60));
  console.log('STEP 1: Extract Frames from MP4');
  console.log('-'.repeat(60));

  const { frames, width, height, fps } = extractFrames(INPUT_VIDEO, 150);
  const rawSize = frames.length * width * height * 4;
  console.log(`  Raw frame data: ${formatBytes(rawSize)}`);

  // Define codecs to test
  const codecs = [
    { name: 'H.264 (High)', codec: 'avc1.640028', bitrate: 800_000, ext: 'h264' },
    { name: 'VP9', codec: 'vp9', bitrate: 600_000, ext: 'vp9' },
    { name: 'VP8', codec: 'vp8', bitrate: 800_000, ext: 'vp8' },
    { name: 'HEVC/H.265', codec: 'hvc1', bitrate: 500_000, ext: 'hevc' },
  ];

  // Encode with each codec
  console.log('\n' + '-'.repeat(60));
  console.log('STEP 2: Re-encode with Different Codecs');
  console.log('-'.repeat(60));

  const results = [];

  for (const codecConfig of codecs) {
    const result = await encodeWithCodec(frames, width, height, fps, codecConfig);
    if (result) {
      results.push({ ...result, ext: codecConfig.ext });

      // Save raw bitstream
      const rawPath = path.join(OUTPUT_DIR, `bbb_reencoded.${codecConfig.ext}`);
      saveEncodedVideo(result, rawPath);

      // Try to wrap in MP4 for easier playback
      const mp4Path = path.join(OUTPUT_DIR, `bbb_reencoded_${codecConfig.ext}.mp4`);
      wrapInMp4(rawPath, mp4Path, codecConfig.codec, fps);
    }
  }

  // Summary
  console.log('\n' + '-'.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('-'.repeat(60));

  console.log(`\nSource: Big Buck Bunny, ${width}x${height}, ${frames.length} frames (~${(frames.length / fps).toFixed(1)}s)`);
  console.log(`Original MP4: ${formatBytes(originalSize)}`);
  console.log(`Raw frames: ${formatBytes(rawSize)}`);

  console.log('\n  Codec          Size        Ratio    Encode Time   Speed');
  console.log('  ' + '-'.repeat(55));

  for (const r of results) {
    const ratio = ((r.size / originalSize) * 100).toFixed(0) + '%';
    const speed = r.fps.toFixed(1) + ' fps';
    const realtime = (r.fps / fps).toFixed(1) + 'x';
    console.log(`  ${r.name.padEnd(14)} ${formatBytes(r.size).padEnd(11)} ${ratio.padStart(5)}    ${formatDuration(r.time).padEnd(12)}  ${speed} (${realtime} RT)`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('OUTPUT FILES');
  console.log('-'.repeat(60));

  const outputFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('bbb_'));
  for (const file of outputFiles) {
    const filePath = path.join(OUTPUT_DIR, file);
    const size = fs.statSync(filePath).size;
    console.log(`  ${file.padEnd(35)} ${formatBytes(size)}`);
  }

  console.log('\nTo play the output:');
  console.log(`  ffplay ${path.join(OUTPUT_DIR, 'bbb_reencoded_h264.mp4')}`);
  console.log(`  ffplay ${path.join(OUTPUT_DIR, 'bbb_reencoded_vp9.mp4')}`);

  console.log('\n' + '='.repeat(60));
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
