/**
 * Basic Video Encoding Example
 *
 * This example demonstrates how to encode video frames using the WebCodecs API.
 */

const { VideoEncoder, VideoFrame } = require('../dist/index.js');

async function encodeVideo() {
  console.log('WebCodecs-Node Video Encoding Example');
  console.log('=====================================\n');

  const encodedChunks = [];
  let decoderConfig = null;

  // Create encoder with callbacks
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      console.log(`Encoded chunk: ${chunk.byteLength} bytes, type: ${chunk.type}`);
      encodedChunks.push(chunk);
      if (metadata?.decoderConfig) {
        decoderConfig = metadata.decoderConfig;
      }
    },
    error: (error) => {
      console.error('Encoder error:', error);
    },
  });

  // Configure encoder for H.264
  encoder.configure({
    codec: 'avc1.42E01E',  // H.264 Baseline Profile
    width: 640,
    height: 480,
    bitrate: 1_000_000,   // 1 Mbps
    framerate: 30,
  });

  console.log('Encoder configured for H.264 @ 640x480\n');

  // Encode 10 frames
  const frameDuration = 33333;  // ~30fps in microseconds

  for (let i = 0; i < 10; i++) {
    // Create frame data (RGBA)
    const data = new Uint8Array(640 * 480 * 4);
    const brightness = 50 + i * 20;  // Gradually increasing brightness

    for (let j = 0; j < data.length; j += 4) {
      data[j] = brightness;      // R
      data[j + 1] = brightness;  // G
      data[j + 2] = brightness;  // B
      data[j + 3] = 255;         // A
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 640,
      codedHeight: 480,
      timestamp: i * frameDuration,
    });

    // First frame is always a keyframe
    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
  }

  console.log('10 frames sent for encoding...\n');

  // Flush encoder to get remaining frames
  await encoder.flush();
  encoder.close();

  // Summary
  console.log('\n--- Encoding Summary ---');
  console.log(`Total chunks produced: ${encodedChunks.length}`);
  console.log(`First chunk type: ${encodedChunks[0]?.type}`);

  const totalBytes = encodedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  console.log(`Total encoded size: ${totalBytes} bytes`);

  if (decoderConfig) {
    console.log(`Decoder config codec: ${decoderConfig.codec}`);
  }

  console.log('\nEncoding complete!');
}

encodeVideo().catch(console.error);
