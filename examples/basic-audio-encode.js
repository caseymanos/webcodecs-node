/**
 * Basic Audio Encoding Example
 *
 * This example demonstrates how to encode audio using the WebCodecs API.
 */

const { AudioEncoder, AudioData } = require('../dist/index.js');

async function encodeAudio() {
  console.log('WebCodecs-Node Audio Encoding Example');
  console.log('=====================================\n');

  const encodedChunks = [];

  // Create encoder with callbacks
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      console.log(`Encoded chunk: ${chunk.byteLength} bytes`);
      encodedChunks.push(chunk);
    },
    error: (error) => {
      console.error('Encoder error:', error);
    },
  });

  // Configure encoder for AAC
  encoder.configure({
    codec: 'mp4a.40.2',    // AAC-LC
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,       // 128 kbps
  });

  console.log('Encoder configured for AAC @ 48kHz stereo\n');

  // Create a 440 Hz sine wave (A note)
  const sampleRate = 48000;
  const frequency = 440;
  const duration = 0.5;  // 0.5 seconds
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 2;

  // Create interleaved audio data
  const audioData = new Float32Array(numSamples * numChannels);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;

    // Interleaved: L, R, L, R, ...
    audioData[i * 2] = sample;      // Left channel
    audioData[i * 2 + 1] = sample;  // Right channel
  }

  const audio = new AudioData({
    format: 'f32',
    sampleRate: sampleRate,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });

  console.log(`Created AudioData: ${numSamples} samples, ${duration}s of 440Hz tone\n`);

  encoder.encode(audio);
  audio.close();

  // Flush encoder
  await encoder.flush();
  encoder.close();

  // Summary
  console.log('\n--- Encoding Summary ---');
  console.log(`Total chunks produced: ${encodedChunks.length}`);

  const totalBytes = encodedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  console.log(`Total encoded size: ${totalBytes} bytes`);
  console.log(`Compression ratio: ${((audioData.byteLength / totalBytes) * 100).toFixed(1)}%`);

  console.log('\nEncoding complete!');
}

encodeAudio().catch(console.error);
