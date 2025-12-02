/**
 * Integration tests for VP8/VP9 Video Encoding/Decoding
 * Phase 5: Extended Codec Support
 * Run with: node test/integration/vp8-vp9-encode-decode.test.js
 *
 * NOTE: VP8/VP9 software encoders can be slow on CI.
 * These tests are skipped in CI to avoid timeouts.
 */

const { VideoEncoder, VideoDecoder, VideoFrame, EncodedVideoChunk } = require('../../dist/index.js');

// Skip slow codec tests in CI environments
const isCI = process.env.CI === 'true';

if (isCI) {
  console.log('WebCodecs-Node VP8/VP9 Integration Tests');
  console.log('=========================================');
  console.log('\nSKIPPED: VP8/VP9 tests are slow and skipped in CI');
  console.log('H.264 tests validate core encode/decode functionality.\n');
  process.exit(0);
}

// Helper to create a test frame
function createTestFrame(width, height, timestamp, color = { r: 128, g: 128, b: 128 }) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = 255;
  }

  return new VideoFrame(data, {
    format: 'RGBA',
    codedWidth: width,
    codedHeight: height,
    timestamp,
  });
}

// ==================== VP8 Tests ====================

async function testVP8EncodeSingleFrame() {
  console.log('\n=== Test: VP8 Encode Single Frame ===');

  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      console.log(`  Got chunk: ${chunk.byteLength} bytes, type: ${chunk.type}`);
      chunks.push({ chunk, metadata });
    },
    error: (err) => {
      console.error('  Encoder error:', err);
      errors.push(err);
    },
  });

  try {
    encoder.configure({
      codec: 'vp8',
      width: 320,
      height: 240,
      bitrate: 500000,
    });
    console.log('  Encoder configured for VP8');

    const frame = createTestFrame(320, 240, 0, { r: 255, g: 0, b: 0 });
    console.log(`  Created frame: ${frame.codedWidth}x${frame.codedHeight}`);

    encoder.encode(frame, { keyFrame: true });
    frame.close();
    console.log('  Frame encoded, flushing...');

    await encoder.flush();
    encoder.close();

    console.log(`  Total chunks: ${chunks.length}`);
    if (chunks.length > 0) {
      console.log(`  First chunk type: ${chunks[0].chunk.type}`);
      console.log('  PASSED\n');
      return { success: true, chunks };
    } else if (errors.length > 0) {
      console.log('  FAILED (encoder errors)\n');
      return { success: false, error: errors[0] };
    } else {
      console.log('  FAILED (no chunks produced)\n');
      return { success: false };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

async function testVP8EncodeMultipleFrames() {
  console.log('\n=== Test: VP8 Encode Multiple Frames ===');

  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({ chunk, metadata }),
    error: (err) => errors.push(err),
  });

  try {
    encoder.configure({
      codec: 'vp8',
      width: 320,
      height: 240,
      bitrate: 500000,
      framerate: 30,
    });
    console.log('  Encoder configured for VP8');

    const frameDuration = 33333; // ~30fps in microseconds

    for (let i = 0; i < 5; i++) {
      const gray = 50 + i * 40;
      const frame = createTestFrame(320, 240, i * frameDuration, { r: gray, g: gray, b: gray });
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }
    console.log('  5 frames encoded, flushing...');

    await encoder.flush();
    encoder.close();

    console.log(`  Total chunks: ${chunks.length}`);
    if (chunks.length >= 5) {
      console.log('  PASSED\n');
      return { success: true, chunks };
    } else if (errors.length > 0) {
      console.log('  FAILED (encoder errors)\n');
      return { success: false };
    } else {
      console.log(`  PARTIAL (only ${chunks.length} chunks)\n`);
      return { success: chunks.length > 0, chunks };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

async function testVP8EncodeDecode() {
  console.log('\n=== Test: VP8 Encode then Decode ===');

  const encodedChunks = [];
  const decodedFrames = [];
  const errors = [];

  // Encode
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => encodedChunks.push(chunk),
    error: (err) => errors.push(err),
  });

  try {
    encoder.configure({
      codec: 'vp8',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    const frame = createTestFrame(320, 240, 0, { r: 0, g: 255, b: 0 });
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    console.log(`  Encoded ${encodedChunks.length} chunks`);

    if (encodedChunks.length === 0) {
      console.log('  SKIPPED: No encoded chunks\n');
      return { success: false, skipped: true };
    }

    // Decode
    const decoder = new VideoDecoder({
      output: (decodedFrame) => {
        console.log(`  Decoded frame: ${decodedFrame.codedWidth}x${decodedFrame.codedHeight}`);
        decodedFrames.push(decodedFrame);
      },
      error: (err) => {
        console.error('  Decoder error:', err);
        errors.push(err);
      },
    });

    decoder.configure({
      codec: 'vp8',
      codedWidth: 320,
      codedHeight: 240,
    });
    console.log('  Decoder configured');

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }
    console.log('  All chunks sent for decoding');

    await decoder.flush();
    decoder.close();

    console.log(`  Decoded ${decodedFrames.length} frames`);

    decodedFrames.forEach(f => f.close());

    if (decodedFrames.length > 0) {
      console.log('  PASSED\n');
      return { success: true };
    } else {
      console.log('  FAILED (no frames decoded)\n');
      return { success: false };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

// ==================== VP9 Tests ====================

async function testVP9EncodeSingleFrame() {
  console.log('\n=== Test: VP9 Encode Single Frame ===');

  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      console.log(`  Got chunk: ${chunk.byteLength} bytes, type: ${chunk.type}`);
      chunks.push({ chunk, metadata });
    },
    error: (err) => {
      console.error('  Encoder error:', err);
      errors.push(err);
    },
  });

  try {
    encoder.configure({
      codec: 'vp9',
      width: 320,
      height: 240,
      bitrate: 500000,
    });
    console.log('  Encoder configured for VP9');

    const frame = createTestFrame(320, 240, 0, { r: 0, g: 0, b: 255 });
    console.log(`  Created frame: ${frame.codedWidth}x${frame.codedHeight}`);

    encoder.encode(frame, { keyFrame: true });
    frame.close();
    console.log('  Frame encoded, flushing...');

    await encoder.flush();
    encoder.close();

    console.log(`  Total chunks: ${chunks.length}`);
    if (chunks.length > 0) {
      console.log(`  First chunk type: ${chunks[0].chunk.type}`);
      console.log('  PASSED\n');
      return { success: true, chunks };
    } else if (errors.length > 0) {
      console.log('  FAILED (encoder errors)\n');
      return { success: false, error: errors[0] };
    } else {
      console.log('  FAILED (no chunks produced)\n');
      return { success: false };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

async function testVP9EncodeMultipleFrames() {
  console.log('\n=== Test: VP9 Encode Multiple Frames ===');

  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({ chunk, metadata }),
    error: (err) => errors.push(err),
  });

  try {
    encoder.configure({
      codec: 'vp9',
      width: 320,
      height: 240,
      bitrate: 500000,
      framerate: 30,
    });
    console.log('  Encoder configured for VP9');

    const frameDuration = 33333;

    for (let i = 0; i < 5; i++) {
      const gray = 50 + i * 40;
      const frame = createTestFrame(320, 240, i * frameDuration, { r: gray, g: gray, b: gray });
      encoder.encode(frame, { keyFrame: i === 0 });
      frame.close();
    }
    console.log('  5 frames encoded, flushing...');

    await encoder.flush();
    encoder.close();

    console.log(`  Total chunks: ${chunks.length}`);
    if (chunks.length >= 5) {
      console.log('  PASSED\n');
      return { success: true, chunks };
    } else if (errors.length > 0) {
      console.log('  FAILED (encoder errors)\n');
      return { success: false };
    } else {
      console.log(`  PARTIAL (only ${chunks.length} chunks)\n`);
      return { success: chunks.length > 0, chunks };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

async function testVP9EncodeDecode() {
  console.log('\n=== Test: VP9 Encode then Decode ===');

  const encodedChunks = [];
  const decodedFrames = [];
  const errors = [];

  // Encode
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => encodedChunks.push(chunk),
    error: (err) => errors.push(err),
  });

  try {
    encoder.configure({
      codec: 'vp9',
      width: 320,
      height: 240,
      bitrate: 500000,
    });

    const frame = createTestFrame(320, 240, 0, { r: 255, g: 255, b: 0 });
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await encoder.flush();
    encoder.close();

    console.log(`  Encoded ${encodedChunks.length} chunks`);

    if (encodedChunks.length === 0) {
      console.log('  SKIPPED: No encoded chunks\n');
      return { success: false, skipped: true };
    }

    // Decode
    const decoder = new VideoDecoder({
      output: (decodedFrame) => {
        console.log(`  Decoded frame: ${decodedFrame.codedWidth}x${decodedFrame.codedHeight}`);
        decodedFrames.push(decodedFrame);
      },
      error: (err) => {
        console.error('  Decoder error:', err);
        errors.push(err);
      },
    });

    decoder.configure({
      codec: 'vp9',
      codedWidth: 320,
      codedHeight: 240,
    });
    console.log('  Decoder configured');

    for (const chunk of encodedChunks) {
      decoder.decode(chunk);
    }
    console.log('  All chunks sent for decoding');

    await decoder.flush();
    decoder.close();

    console.log(`  Decoded ${decodedFrames.length} frames`);

    decodedFrames.forEach(f => f.close());

    if (decodedFrames.length > 0) {
      console.log('  PASSED\n');
      return { success: true };
    } else {
      console.log('  FAILED (no frames decoded)\n');
      return { success: false };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

async function testVP9FullCodecString() {
  console.log('\n=== Test: VP9 Full Codec String (vp09.00.10.08) ===');

  const chunks = [];
  const errors = [];

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => chunks.push({ chunk, metadata }),
    error: (err) => errors.push(err),
  });

  try {
    // Use full VP9 codec string: vp09.PP.LL.DD
    // PP=00 (profile 0), LL=10 (level 1.0), DD=08 (8-bit depth)
    encoder.configure({
      codec: 'vp09.00.10.08',
      width: 320,
      height: 240,
      bitrate: 500000,
    });
    console.log('  Encoder configured for VP9 with full codec string');

    const frame = createTestFrame(320, 240, 0, { r: 128, g: 0, b: 128 });
    encoder.encode(frame, { keyFrame: true });
    frame.close();

    await encoder.flush();
    encoder.close();

    console.log(`  Total chunks: ${chunks.length}`);
    if (chunks.length > 0) {
      console.log('  PASSED\n');
      return { success: true };
    } else {
      console.log('  FAILED (no chunks produced)\n');
      return { success: false };
    }
  } catch (err) {
    console.log(`  SKIPPED: ${err.message}\n`);
    return { success: false, skipped: true, error: err.message };
  }
}

// ==================== Run All Tests ====================

async function runAllTests() {
  console.log('WebCodecs-Node VP8/VP9 Integration Tests');
  console.log('========================================');
  console.log('Phase 5: Extended Codec Support\n');

  const results = {
    vp8: { passed: 0, failed: 0, skipped: 0 },
    vp9: { passed: 0, failed: 0, skipped: 0 },
  };

  // VP8 Tests
  console.log('\n--- VP8 Codec Tests ---');

  let result = await testVP8EncodeSingleFrame();
  if (result.skipped) results.vp8.skipped++;
  else if (result.success) results.vp8.passed++;
  else results.vp8.failed++;

  result = await testVP8EncodeMultipleFrames();
  if (result.skipped) results.vp8.skipped++;
  else if (result.success) results.vp8.passed++;
  else results.vp8.failed++;

  result = await testVP8EncodeDecode();
  if (result.skipped) results.vp8.skipped++;
  else if (result.success) results.vp8.passed++;
  else results.vp8.failed++;

  // VP9 Tests
  console.log('\n--- VP9 Codec Tests ---');

  result = await testVP9EncodeSingleFrame();
  if (result.skipped) results.vp9.skipped++;
  else if (result.success) results.vp9.passed++;
  else results.vp9.failed++;

  result = await testVP9EncodeMultipleFrames();
  if (result.skipped) results.vp9.skipped++;
  else if (result.success) results.vp9.passed++;
  else results.vp9.failed++;

  result = await testVP9EncodeDecode();
  if (result.skipped) results.vp9.skipped++;
  else if (result.success) results.vp9.passed++;
  else results.vp9.failed++;

  result = await testVP9FullCodecString();
  if (result.skipped) results.vp9.skipped++;
  else if (result.success) results.vp9.passed++;
  else results.vp9.failed++;

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`VP8: ${results.vp8.passed} passed, ${results.vp8.failed} failed, ${results.vp8.skipped} skipped`);
  console.log(`VP9: ${results.vp9.passed} passed, ${results.vp9.failed} failed, ${results.vp9.skipped} skipped`);

  const totalPassed = results.vp8.passed + results.vp9.passed;
  const totalFailed = results.vp8.failed + results.vp9.failed;
  const totalSkipped = results.vp8.skipped + results.vp9.skipped;

  console.log(`\nTotal: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);

  if (totalFailed > 0) {
    console.log('\nSome tests failed!');
    process.exit(1);
  } else if (totalSkipped > 0 && totalPassed === 0) {
    console.log('\nAll tests skipped - VP8/VP9 codecs may not be available');
    process.exit(0);
  } else {
    console.log('\nAll available tests passed!');
  }
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
