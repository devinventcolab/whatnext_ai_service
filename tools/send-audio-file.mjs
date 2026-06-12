import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { io } from 'socket.io-client';

const args = parseArgs(process.argv.slice(2));

if (!args.token || !args.file) {
  console.error(`
Usage:
  node tools/send-audio-file.mjs --token <JWT> --file <audio.pcm|audio.wav> [--url http://localhost:8980]

Audio format expected by backend/Deepgram:
  linear16 PCM, 16000 Hz, mono

If you have mp3/m4a/wav in another format, convert first:
  ffmpeg -i input.mp3 -ac 1 -ar 16000 -f s16le sample.pcm
`);
  process.exit(1);
}

const url = args.url ?? 'http://localhost:8980';
const chunkMs = Number(args.chunkMs ?? 100);
const sampleRate = 16000;
const bytesPerSample = 2;
const chunkSize = Math.max(
  Math.floor((sampleRate * bytesPerSample * chunkMs) / 1000),
  1024,
);

const original = readFileSync(args.file);
const audio = stripWavHeaderIfPresent(original);

console.log(`Connecting to ${url}`);
console.log(`Streaming ${basename(args.file)} (${audio.length} bytes)`);

const socket = io(url, {
  auth: { token: args.token },
  transports: ['websocket', 'polling'],
  timeout: 10000,
});

socket.on('connect', () => {
  console.log('socket connected:', socket.id);
  socket.emit('voice:start');
});

socket.on('connect_error', (error) => {
  console.error('connect_error:', error.message);
  process.exitCode = 1;
  socket.close();
});

socket.on('voice:ready', async (payload) => {
  console.log('voice:ready:', payload);
  await streamAudio();
  console.log('voice:commit');
  socket.emit('voice:commit');
});

socket.on('voice:warning', (payload) => {
  console.warn('voice:warning:', payload);
});

socket.on('voice:error', (payload) => {
  console.error('voice:error:', payload);
});

socket.on('transcript:partial', (payload) => {
  console.log('transcript:partial:', payload.text);
});

socket.on('transcript:final', (payload) => {
  console.log('transcript:final:', payload.text);
});

socket.on('assistant:text', (payload) => {
  console.log('assistant:text:', payload);
});

socket.on('assistant:audio', (payload) => {
  console.log('assistant:audio bytes:', payload?.byteLength ?? payload?.length ?? 0);
});

socket.on('voice:pong', (payload) => {
  console.log('voice:pong:', payload);
});

socket.on('voice:closed', () => {
  console.log('voice:closed');
  socket.close();
});

setTimeout(() => {
  console.log('voice:stop');
  socket.emit('voice:stop');
}, Number(args.timeoutMs ?? 30000));

async function streamAudio() {
  for (let offset = 0; offset < audio.length; offset += chunkSize) {
    const chunk = audio.subarray(offset, Math.min(offset + chunkSize, audio.length));
    socket.emit('voice:audio', chunk);
    await sleep(chunkMs);
  }
}

function stripWavHeaderIfPresent(buffer) {
  const riff = buffer.subarray(0, 4).toString('ascii');
  const wave = buffer.subarray(8, 12).toString('ascii');
  if (riff !== 'RIFF' || wave !== 'WAVE') return buffer;

  const dataIndex = buffer.indexOf(Buffer.from('data'));
  if (dataIndex === -1) return buffer.subarray(44);
  return buffer.subarray(dataIndex + 8);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith('--')) continue;
    parsed[item.slice(2)] = values[index + 1];
    index += 1;
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
