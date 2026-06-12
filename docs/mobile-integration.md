# React Native Integration Guide — WhatNext Voice Assistant

This is a complete, end-to-end guide for a **React Native** developer to integrate
the WhatNext voice assistant microservice into a mobile app (bare React Native
or Expo dev build).

The service is a real-time, bidirectional voice pipeline:

```
 mic (PCM 16kHz) ── Socket.IO ──► backend ──► Deepgram STT ──► OpenAI (+ tools) ──► Deepgram TTS
                                     │                                                   │
 speaker  ◄──── assistant:audio ◄────┴──── assistant:text / transcript:* ◄──────────────┘
```

You talk → it transcribes → it reasons and (optionally) performs productivity
actions against the .NET backend → it replies in **text and spoken audio**.

---

## 1. Transport & contract at a glance

| What | Value |
| --- | --- |
| Protocol | **Socket.IO** (not raw WebSocket — use a Socket.IO client) |
| Base URL | `http://<host>:8980` (default `PORT=8980`) |
| Auth | JWT passed in the Socket.IO handshake: `auth: { token }` |
| Mic audio format | **Raw PCM `linear16`, 16 kHz, mono** (16-bit signed little-endian) |
| Assistant audio format | Binary **MP3** bytes (`audio/mpeg`) via `assistant:audio` |
| Max single message | 2 MB (`maxHttpBufferSize`) — individual audio chunks are tiny |
| CORS | Native apps send no `Origin` header, so they are accepted by default |

> **Important:** Use a real Socket.IO client (`socket.io-client`). A plain
> `WebSocket` will **not** work — Socket.IO has its own framing/handshake.

---

## 2. Required packages

```bash
# Networking
npm install socket.io-client
npm install buffer            # base64 <-> binary conversions in RN

# Microphone -> raw PCM streaming (choose ONE)
npm install react-native-live-audio-stream
# (alternative: @fugood/react-native-audio-pcm-stream)

# Assistant audio playback (MP3) + temp file storage
npm install react-native-fs
npm install react-native-sound
# (Expo alternative: expo-av + expo-file-system)
```

After installing native modules in a bare project:

```bash
cd ios && pod install && cd ..
```

> Expo: these native modules require a **development build** (`npx expo prebuild`
> / EAS). They do **not** run in Expo Go. The Expo equivalents are noted inline.

---

## 3. Permissions

### iOS — `ios/<App>/Info.plist`

```xml
<key>NSMicrophoneUsageDescription</key>
<string>WhatNext uses the microphone so you can talk to the assistant.</string>
```

If you connect to a plaintext `http://` host during development, also allow it
via App Transport Security (development only):

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

Android also requires a **runtime** permission request (see the hook below).
For plaintext `http://` in dev, set `android:usesCleartextTraffic="true"` on the
`<application>` tag (development only).

---

## 4. Authentication

The voice service does **not** issue tokens. You authenticate against your
existing .NET backend, then hand the resulting **JWT access token** to the voice
service in the Socket.IO handshake.

```ts
// Pseudocode: get a token from YOUR auth backend
const { accessToken } = await loginToDotNetBackend(email, password);
// Store it securely (e.g. react-native-keychain / expo-secure-store)
```

The voice service validates the token in one of two ways (configured on the
server, transparent to you):

- If `JWT_SHARED_SECRET` is set, it verifies the JWT signature locally.
- Otherwise it calls the .NET backend's `/auth/me` to validate the token.

If the token is missing/invalid, the connection is rejected with a
`connect_error` carrying the message.

---

## 5. Event reference (exact payloads)

### Client → Server

| Event | Payload | When to send |
| --- | --- | --- |
| `voice:start` | _(none)_ | Once after `connect`, to open a voice session |
| `voice:audio` | binary chunk (`ArrayBuffer`/`Buffer`/`Uint8Array`) | Continuously while recording — raw PCM linear16 16 kHz mono |
| `voice:commit` | _(none)_ | When the user finishes an utterance (end of turn) |
| `voice:stop` | _(none)_ | To end the session (also fired on disconnect) |
| `voice:cancel` | _(none)_ | Same effect as `voice:stop` |
| `voice:ping` | _(none)_ | Liveness check; server replies `voice:pong` |

> `voice:start` currently takes no payload — any object you pass is ignored by
> the server. You must call it **after** the socket connects.

### Server → Client

| Event | Payload | Meaning |
| --- | --- | --- |
| `voice:ready` | `{ userId: string, encoding: 'linear16', sampleRate: 16000 }` | Session is live; start streaming audio |
| `transcript:partial` | `{ text: string }` | Live (interim) transcription — overwrite, don't append |
| `transcript:final` | `{ text: string }` | Finalized user utterance — this is one user message |
| `assistant:text` | `{ text: string, toolResults: { toolName: string, result: unknown }[] }` | Assistant's textual reply + any actions performed |
| `assistant:audio` | binary `ArrayBuffer` (MP3) | Spoken reply audio — play it |
| `voice:warning` | `{ message: string }` | Non-fatal (e.g. a provider key not configured) |
| `voice:error` | `{ message: string }` | Error during processing |
| `voice:committed` | `{ timestamp: string }` | Ack of your `voice:commit` |
| `voice:closed` | _(none)_ | Session closed by server |
| `voice:pong` | `{ timestamp: string }` | Reply to `voice:ping` |

**Typical message flow for one turn:**

```
connect ─► (emit) voice:start ─► voice:ready
(emit) voice:audio … voice:audio … ─► transcript:partial (repeated)
(emit) voice:commit ─► voice:committed
                       transcript:final   { text: "create a task to call mom" }
                       assistant:text     { text: "I'll create a task...", toolResults: [...] }
                       assistant:audio    <mp3 bytes>
```

---

## 6. Streaming microphone audio (the key part)

Unlike browsers (which record at 44.1/48 kHz and must downsample), the RN audio
libraries can record **directly at 16 kHz PCM**, so no resampling is needed.

`react-native-live-audio-stream` emits **base64-encoded PCM16** chunks. Convert
each chunk to binary and emit it as `voice:audio`.

```ts
import LiveAudioStream from 'react-native-live-audio-stream';
import { Buffer } from 'buffer';

const audioOptions = {
  sampleRate: 16000,   // MUST be 16000 to match the backend
  channels: 1,         // mono
  bitsPerSample: 16,   // linear16
  audioSource: 6,      // Android: VOICE_RECOGNITION
  bufferSize: 4096,
};

LiveAudioStream.init(audioOptions);

LiveAudioStream.on('data', (base64Chunk: string) => {
  const pcm = Buffer.from(base64Chunk, 'base64'); // raw 16-bit LE PCM
  socket.emit('voice:audio', pcm); // Socket.IO sends it as binary
});

// start/stop
LiveAudioStream.start();
LiveAudioStream.stop();
```

---

## 7. Playing the assistant's spoken reply

`assistant:audio` arrives as binary MP3. In RN you generally can't play an
in-memory buffer directly, so write it to a temp file and play that. Queue clips
so they don't overlap.

```ts
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';
import { Buffer } from 'buffer';

Sound.setCategory('Playback');

let clipCounter = 0;

async function playAssistantAudio(data: ArrayBuffer) {
  const bytes = Buffer.from(new Uint8Array(data));
  const path = `${RNFS.CachesDirectoryPath}/reply-${clipCounter++}.mp3`;
  await RNFS.writeFile(path, bytes.toString('base64'), 'base64');

  const sound = new Sound(path, '', (err) => {
    if (err) return;
    sound.play(() => {
      sound.release();
      RNFS.unlink(path).catch(() => {});
    });
  });
}
```

> Expo equivalent: write the file with `expo-file-system` and play it with
> `expo-av`'s `Audio.Sound.createAsync({ uri })`.

---

## 8. Complete reusable hook (`useVoiceAssistant`)

Drop this into your app. It manages connection, permissions, recording,
playback, transcripts, and the conversation list.

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import LiveAudioStream from 'react-native-live-audio-stream';
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';
import { Buffer } from 'buffer';

Sound.setCategory('Playback');

const VOICE_API_URL = 'http://10.0.2.2:8980'; // Android emulator -> host machine
// iOS simulator: http://localhost:8980 ; real device: http://<your-LAN-IP>:8980

type Role = 'user' | 'assistant';
export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  toolResults?: { toolName: string; result: unknown }[];
}
type Status = 'idle' | 'connecting' | 'ready' | 'error' | 'disconnected';
type Recording = 'inactive' | 'listening' | 'thinking' | 'speaking';

const audioOptions = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6,
  bufferSize: 4096,
};

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS handled by Info.plist + OS prompt
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone permission',
      message: 'WhatNext needs the microphone to hear you.',
      buttonPositive: 'OK',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useVoiceAssistant() {
  const [status, setStatus] = useState<Status>('idle');
  const [recording, setRecording] = useState<Recording>('inactive');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const recordingRef = useRef(false);
  const clipRef = useRef(0);
  const initedRef = useRef(false);

  const playAudio = useCallback(async (data: ArrayBuffer) => {
    try {
      const bytes = Buffer.from(new Uint8Array(data));
      const path = `${RNFS.CachesDirectoryPath}/reply-${clipRef.current++}.mp3`;
      await RNFS.writeFile(path, bytes.toString('base64'), 'base64');
      setRecording('speaking');
      const sound = new Sound(path, '', (err) => {
        if (err) { setRecording('inactive'); return; }
        sound.play(() => {
          sound.release();
          RNFS.unlink(path).catch(() => {});
          setRecording('inactive');
        });
      });
    } catch {
      setRecording('inactive');
    }
  }, []);

  const connect = useCallback((token: string) => {
    if (!token) { setError('A JWT token is required.'); return; }
    setError(null);
    setStatus('connecting');

    const socket = io(VOICE_API_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('voice:start'));
    socket.on('connect_error', (e) => { setError(e.message); setStatus('error'); });
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('voice:ready', () => setStatus('ready'));
    socket.on('voice:warning', (p: { message: string }) => setError(p.message));
    socket.on('voice:error', (p: { message: string }) => setError(p.message));

    socket.on('transcript:partial', (p: { text: string }) => setPartial(p.text));
    socket.on('transcript:final', (p: { text: string }) => {
      setPartial('');
      if (!p.text.trim()) return;
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: p.text }]);
      setRecording('thinking');
    });
    socket.on('assistant:text', (p: { text: string; toolResults: any[] }) => {
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: 'assistant', text: p.text, toolResults: p.toolResults },
      ]);
    });
    socket.on('assistant:audio', (data: ArrayBuffer) => { void playAudio(data); });
  }, [playAudio]);

  const disconnect = useCallback(() => {
    if (recordingRef.current) { LiveAudioStream.stop(); recordingRef.current = false; }
    const s = socketRef.current;
    if (s) { s.emit('voice:stop'); s.removeAllListeners(); s.disconnect(); socketRef.current = null; }
    setStatus('disconnected');
    setRecording('inactive');
  }, []);

  const startListening = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket?.connected) { setError('Not connected.'); return; }
    if (!(await ensureMicPermission())) { setError('Microphone permission denied.'); return; }

    if (!initedRef.current) { LiveAudioStream.init(audioOptions); initedRef.current = true; }

    LiveAudioStream.on('data', (chunk: string) => {
      if (!recordingRef.current) return;
      socket.emit('voice:audio', Buffer.from(chunk, 'base64'));
    });

    recordingRef.current = true;
    LiveAudioStream.start();
    setRecording('listening');
  }, []);

  const stopListening = useCallback(() => {
    if (recordingRef.current) { LiveAudioStream.stop(); recordingRef.current = false; }
    socketRef.current?.emit('voice:commit');
    setRecording('thinking');
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    status, recording, messages, partial, error,
    connect, disconnect, startListening, stopListening,
  };
}
```

### Minimal UI

```tsx
import { Button, FlatList, Text, View } from 'react-native';
import { useVoiceAssistant } from './useVoiceAssistant';

export default function VoiceScreen({ token }: { token: string }) {
  const va = useVoiceAssistant();
  const connected = va.status === 'ready';

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text>Status: {va.status}</Text>
      {va.error ? <Text style={{ color: 'red' }}>{va.error}</Text> : null}

      <Button
        title={connected ? 'Disconnect' : 'Connect'}
        onPress={() => (connected ? va.disconnect() : va.connect(token))}
      />

      <FlatList
        style={{ flex: 1 }}
        data={va.messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Text style={{ textAlign: item.role === 'user' ? 'right' : 'left', marginVertical: 4 }}>
            {item.role === 'user' ? '🧑 ' : '🤖 '}{item.text}
          </Text>
        )}
      />
      {va.partial ? <Text style={{ fontStyle: 'italic' }}>{va.partial}</Text> : null}

      <Button
        title={va.recording === 'listening' ? 'Stop & send' : 'Talk'}
        disabled={!connected}
        onPress={() => (va.recording === 'listening' ? va.stopListening() : va.startListening())}
      />
    </View>
  );
}
```

---

## 9. Choosing the right host URL

The dev backend listens on `http://localhost:8980`, but "localhost" means
different things on a device:

| Where the app runs | Use this `VOICE_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:8980` |
| iOS simulator | `http://localhost:8980` |
| Physical device (same Wi-Fi) | `http://<your-computer-LAN-IP>:8980` |
| Production | `https://<your-domain>` (use TLS) |

---

## 10. What the assistant can do (tools)

The assistant is **productivity-only**. It can create/update/delete these
entities in the .NET backend, and will **ask you to confirm** before performing
any mutation (it sets `confirmed=true` only after you verbally agree).

| Entity | Actions | Key fields |
| --- | --- | --- |
| Task | create / update / delete | `title`, `description?`, `priority(low/medium/high/urgent)`, `status(todo/in_progress/done/cancelled)`, `dueDate?`, `reminders?` |
| Event | create / update / delete | `title`, `startTime`, `endTime`, `location?`, `participants?`, `reminder?` |
| Note | create / update / delete | `title`, `content`, `tags?` |
| Worklog | create / update / delete | `title`, `duration`, `date`, `category`, `description?` |

When an action runs, you receive it in `assistant:text` → `toolResults`, e.g.:

```json
{
  "text": "Done. I created a task to call mom.",
  "toolResults": [{ "toolName": "createTask", "result": { "id": "...", "title": "Call mom" } }]
}
```

> **UX tip:** because mutations require spoken confirmation, expect a two-turn
> flow: (1) user asks → assistant summarizes and asks "should I create this?",
> (2) user says "yes" → assistant performs it and reports the result.

---

## 11. REST endpoints (optional helpers)

Besides the socket, a few HTTP endpoints exist (send `Authorization: Bearer <jwt>`):

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | no | Liveness/diagnostics |
| GET | `/api/voice/me` | yes | Returns the authenticated user (good for token validation) |
| POST | `/api/voice/test-task` | yes | Creates a task via the .NET backend (debug helper) |

```ts
const res = await fetch(`${VOICE_API_URL}/api/voice/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
const user = await res.json(); // { id, email?, name?, roles? }
```

---

## 12. Error handling & reconnection

- **`connect_error`**: usually a bad/expired token or unreachable host. Refresh
  the token and reconnect; don't retry blindly on auth failures.
- **`voice:warning`**: non-fatal. Most common is "Deepgram/OpenAI API key is not
  configured" on the server — transcription/voice won't work until keys are set.
- **`voice:error`**: surface the message; stop recording on fatal errors.
- **Network drops**: `socket.io-client` auto-reconnects. After a reconnect you
  must emit `voice:start` again (the `connect` handler above already does this).
- **Backoff**: configure `reconnectionAttempts` / `reconnectionDelay` on `io()`
  for production.

---

## 13. Integration checklist

- [ ] `socket.io-client` (not raw WebSocket) installed and used
- [ ] Mic recorded as **PCM linear16, 16 kHz, mono**
- [ ] `voice:start` emitted **after** `connect`
- [ ] Audio chunks emitted as **binary** `voice:audio`
- [ ] `voice:commit` sent at end of each utterance
- [ ] `assistant:audio` written to a temp file and played (MP3)
- [ ] Mic permission requested at runtime (Android) + Info.plist (iOS)
- [ ] Correct host URL for emulator/simulator/device
- [ ] Valid JWT obtained from the .NET auth backend and passed via `auth.token`
- [ ] Backend has `OPENAI_API_KEY` and `DEEPGRAM_API_KEY` configured

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `connect_error: Missing auth token` | Token not passed in `auth: { token }` |
| `connect_error: jwt expired` / 401 | Refresh the token before connecting |
| Connects but no transcripts | Not emitting `voice:start`, or audio not 16 kHz linear16, or `DEEPGRAM_API_KEY` missing (look for `voice:warning`) |
| Gets transcripts but no spoken reply | `assistant:audio` not played, or `DEEPGRAM_API_KEY` missing |
| `assistant:text` says "OpenAI API key is not configured" | Set `OPENAI_API_KEY` on the server |
| Works on simulator, not on device | Wrong host URL (use LAN IP) or cleartext `http` blocked (use HTTPS or dev ATS/cleartext flag) |
| Binary chunk rejected | Chunk exceeds 2 MB `maxHttpBufferSize` (shouldn't happen with 4 KB buffers) |

---

## See also

- `docs/websocket-events.md` — terse event list
- `docs/rest-api.md` — REST surface
- `docs/microservice-architecture.md` — how the service fits the system
- `../whatnext_front` — a working React (web) reference client using the same protocol
```
