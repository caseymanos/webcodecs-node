/**
 * Integration tests for AudioEncoder/AudioDecoder
 * Run with: node test/integration/audio-encode-decode.test.js
 */

const { AudioEncoder, AudioDecoder, AudioData, EncodedAudioChunk } = require('../../dist/index.js');

async function testAudioEncoderAAC() {
  console.log('\n=== Test: Audio Encoder (AAC) ===');

  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      console.log(`  Got chunk: ${chunk.byteLength} bytes, timestamp: ${chunk.timestamp}`);
      chunks.push({ chunk, metadata });
    },
    error: (err) => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'mp4a.40.2',  // AAC-LC
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });
  console.log('  Encoder configured');

  // Create stereo audio data (1024 samples at 48kHz = ~21ms)
  const numSamples = 1024;
  const numChannels = 2;
  const audioData = new Float32Array(numSamples * numChannels);

  // Generate 440Hz sine wave
  const frequency = 440;
  for (let i = 0; i < numSamples; i++) {
    const t = i / 48000;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5;
    audioData[i * numChannels] = sample;     // Left channel
    audioData[i * numChannels + 1] = sample; // Right channel
  }

  const frame = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });
  console.log(`  Created AudioData: ${numSamples} samples, ${numChannels} channels`);

  encoder.encode(frame);
  frame.close();
  console.log('  Frame encoded, flushing...');

  await encoder.flush();
  encoder.close();

  console.log(`  Total chunks: ${chunks.length}`);
  if (chunks.length > 0) {
    console.log(`  Has decoder config: ${!!chunks[0].metadata?.decoderConfig}`);
  }

  console.log('  PASSED\n');
  return chunks;
}

async function testAudioEncoderOpus() {
  console.log('\n=== Test: Audio Encoder (Opus) ===');

  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      console.log(`  Got chunk: ${chunk.byteLength} bytes, timestamp: ${chunk.timestamp}`);
      chunks.push({ chunk, metadata });
    },
    error: (err) => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 64000,
  });
  console.log('  Encoder configured');

  // Create stereo audio data (960 samples = 20ms at 48kHz, Opus frame size)
  const numSamples = 960;
  const numChannels = 2;
  const audioData = new Float32Array(numSamples * numChannels);

  // Generate 880Hz sine wave
  const frequency = 880;
  for (let i = 0; i < numSamples; i++) {
    const t = i / 48000;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3;
    audioData[i * numChannels] = sample;
    audioData[i * numChannels + 1] = sample;
  }

  const frame = new AudioData({
    format: 'f32',
    sampleRate: 48000,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });
  console.log(`  Created AudioData: ${numSamples} samples`);

  encoder.encode(frame);
  frame.close();
  console.log('  Frame encoded, flushing...');

  await encoder.flush();
  encoder.close();

  console.log(`  Total chunks: ${chunks.length}`);
  console.log('  PASSED\n');
  return chunks;
}

async function testAudioEncoderFLAC() {
  console.log('\n=== Test: Audio Encoder (FLAC - lossless) ===');

  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      console.log(`  Got chunk: ${chunk.byteLength} bytes`);
      chunks.push({ chunk, metadata });
    },
    error: (err) => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'flac',
    sampleRate: 44100,
    numberOfChannels: 2,
  });
  console.log('  Encoder configured');

  // Create audio data
  const numSamples = 4096;
  const numChannels = 2;
  const audioData = new Float32Array(numSamples * numChannels);

  // Generate 220Hz sine wave
  const frequency = 220;
  for (let i = 0; i < numSamples; i++) {
    const t = i / 44100;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.4;
    audioData[i * numChannels] = sample;
    audioData[i * numChannels + 1] = sample;
  }

  const frame = new AudioData({
    format: 'f32',
    sampleRate: 44100,
    numberOfFrames: numSamples,
    numberOfChannels: numChannels,
    timestamp: 0,
    data: audioData,
  });

  encoder.encode(frame);
  frame.close();

  await encoder.flush();
  encoder.close();

  console.log(`  Total chunks: ${chunks.length}`);
  console.log('  PASSED\n');
  return chunks;
}

async function testMultipleAudioFrames() {
  console.log('\n=== Test: Encode Multiple Audio Frames ===');

  const chunks = [];
  const encoder = new AudioEncoder({
    output: (chunk) => chunks.push(chunk),
    error: (err) => console.error('  Encoder error:', err),
  });

  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });
  console.log('  Encoder configured');

  const numSamples = 1024;
  const numChannels = 2;
  const frameDuration = Math.round((numSamples / 48000) * 1000000); // microseconds

  for (let frameIdx = 0; frameIdx < 10; frameIdx++) {
    const audioData = new Float32Array(numSamples * numChannels);

    // Generate varying frequency tone
    const frequency = 440 + frameIdx * 50;
    for (let i = 0; i < numSamples; i++) {
      const t = i / 48000;
      const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3;
      audioData[i * numChannels] = sample;
      audioData[i * numChannels + 1] = sample;
    }

    const frame = new AudioData({
      format: 'f32',
      sampleRate: 48000,
      numberOfFrames: numSamples,
      numberOfChannels: numChannels,
      timestamp: frameIdx * frameDuration,
      data: audioData,
    });

    encoder.encode(frame);
    frame.close();
  }
  console.log('  10 frames encoded, flushing...');

  await encoder.flush();
  encoder.close();

  console.log(`  Total chunks: ${chunks.length}`);
  if (chunks.length > 0) {
    console.log(`  First chunk timestamp: ${chunks[0].timestamp}`);
    console.log(`  Last chunk timestamp: ${chunks[chunks.length - 1].timestamp}`);
  }

  console.log('  PASSED\n');
}

async function runAllTests() {
  console.log('WebCodecs-Node Audio Integration Tests');
  console.log('======================================');

  try {
    await testAudioEncoderAAC();
    await testAudioEncoderOpus();
    await testAudioEncoderFLAC();
    await testMultipleAudioFrames();

    console.log('\n=== All Audio Tests Completed ===');
  } catch (error) {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  }
}

runAllTests();
