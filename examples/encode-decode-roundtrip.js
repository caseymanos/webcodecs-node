/**
 * Video Encode/Decode Roundtrip Example
 *
 * This example demonstrates encoding video frames and then decoding them back.
 */

const { VideoEncoder, VideoDecoder, VideoFrame } = require('../dist/index.js');

async function roundtripVideo() {
  console.log('WebCodecs-Node Encode/Decode Roundtrip Example');
  console.log('==============================================\n');

  // Storage for encoded chunks and decoded frames
  const encodedChunks = [];
  const decodedFrames = [];
  let decoderConfig = null;

  // Create encoder
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      encodedChunks.push(chunk);
      if (metadata?.decoderConfig) {
        decoderConfig = metadata.decoderConfig;
      }
    },
    error: (error) => console.error('Encoder error:', error),
  });

  encoder.configure({
    codec: 'avc1.42E01E',
    width: 320,
    height: 240,
    bitrate: 500000,
  });

  console.log('1. Encoding frames...');

  // Create and encode 5 frames with different colors
  const colors = [
    { r: 255, g: 0, b: 0 },     // Red
    { r: 0, g: 255, b: 0 },     // Green
    { r: 0, g: 0, b: 255 },     // Blue
    { r: 255, g: 255, b: 0 },   // Yellow
    { r: 255, g: 0, b: 255 },   // Magenta
  ];

  for (let i = 0; i < colors.length; i++) {
    const data = new Uint8Array(320 * 240 * 4);
    const { r, g, b } = colors[i];

    for (let j = 0; j < data.length; j += 4) {
      data[j] = r;
      data[j + 1] = g;
      data[j + 2] = b;
      data[j + 3] = 255;
    }

    const frame = new VideoFrame(data, {
      format: 'RGBA',
      codedWidth: 320,
      codedHeight: 240,
      timestamp: i * 33333,
    });

    encoder.encode(frame, { keyFrame: i === 0 });
    frame.close();
    console.log(`   Encoded frame ${i + 1}/${colors.length}`);
  }

  await encoder.flush();
  encoder.close();

  console.log(`   Total encoded: ${encodedChunks.length} chunks\n`);

  // Decode the encoded chunks
  console.log('2. Decoding chunks...');

  const decoder = new VideoDecoder({
    output: (frame) => {
      decodedFrames.push(frame);
      console.log(`   Decoded frame: ${frame.codedWidth}x${frame.codedHeight} @ timestamp ${frame.timestamp}`);
    },
    error: (error) => console.error('Decoder error:', error),
  });

  decoder.configure({
    codec: 'avc1.42E01E',
    codedWidth: 320,
    codedHeight: 240,
    description: decoderConfig?.description,
  });

  for (const chunk of encodedChunks) {
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();

  // Summary
  console.log('\n--- Roundtrip Summary ---');
  console.log(`Input frames: ${colors.length}`);
  console.log(`Encoded chunks: ${encodedChunks.length}`);
  console.log(`Decoded frames: ${decodedFrames.length}`);

  const totalEncodedSize = encodedChunks.reduce((sum, c) => sum + c.byteLength, 0);
  const originalSize = 320 * 240 * 4 * colors.length;
  console.log(`Original size: ${originalSize} bytes`);
  console.log(`Encoded size: ${totalEncodedSize} bytes`);
  console.log(`Compression: ${((1 - totalEncodedSize / originalSize) * 100).toFixed(1)}% reduction`);

  // Clean up
  decodedFrames.forEach(f => f.close());

  console.log('\nRoundtrip complete!');
}

roundtripVideo().catch(console.error);
