# Testing the Voice Socket in Postman

The WhatNext voice service uses **Socket.IO v4** (Engine.IO v4), not plain
WebSocket. Postman's dedicated **Socket.IO** request type currently **cannot
send the `auth` object**, which is how the server receives your JWT
(`socket.handshake.auth.token`). So we test with a **raw WebSocket request** and
send the Socket.IO protocol frames manually — including auth in the connect
frame.

> Heads-up: Postman does not reliably import/export WebSocket requests
> ([postman issue #11252](https://github.com/postmanlabs/postman-app-support/issues/11252)).
> Import the collection for the variables and reference, but if the request does
> not open as a WebSocket, just create one manually (Step 2 below).

## 1. Import the collection (optional, for variables)

Import `WhatNext-Voice.postman_collection.json`. It provides:

| Variable | Value |
| --- | --- |
| `ws_url` | `ws://localhost:8980/socket.io/?EIO=4&transport=websocket` |
| `jwt` | _your JWT access token_ (paste it here) |
| `frame_connect` | `40{"token":"{{jwt}}"}` |
| `frame_voice_start` | `42["voice:start"]` |
| `frame_voice_ping` | `42["voice:ping"]` |
| `frame_voice_commit` | `42["voice:commit"]` |
| `frame_voice_stop` | `42["voice:stop"]` |
| `frame_engineio_pong` | `3` |

Set the `jwt` variable (collection > Variables tab).

### Getting a JWT

- **Easiest (dev):** the server runs with `NODE_ENV=development` and no
  `JWT_SHARED_SECRET`, so it falls back to `jwt.decode` — **any decodable JWT
  with a `sub` (or `id`/`userId`/`nameid`) claim works**. Create one at
  [jwt.io](https://jwt.io): set the payload to `{ "sub": "postman-test-user" }`,
  copy the encoded token (the signature value is ignored in dev).
- **Real token:** log in through your .NET/auth backend and use that access
  token.

## 2. Create the WebSocket request

1. In Postman: **New → WebSocket Request**.
2. URL: `ws://localhost:8980/socket.io/?EIO=4&transport=websocket`
   (or `{{ws_url}}` if you imported the collection).
3. Make sure the message type is **Raw / Text**.
4. Click **Connect**.

On connect, the server immediately sends an Engine.IO **OPEN** frame, e.g.:

```
0{"sid":"abc123","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}
```

## 3. Send the frames (in order)

Type each of these into the message box and **Send**. (Socket.IO framing:
`40` = connect, `42` = event, `2`/`3` = engine.io ping/pong.)

### a) Authenticate + connect the namespace

```
40{"token":"{{jwt}}"}
```

- Success → server replies:
  ```
  40{"sid":"xxxxxxxx"}
  ```
- Auth failure → server replies:
  ```
  44{"message":"Missing auth token"}
  ```

### b) Start a voice session

```
42["voice:start"]
```

Server replies:

```
42["voice:ready",{"userId":"postman-test-user","encoding":"linear16","sampleRate":16000}]
```

If Deepgram is not configured you'll also see:

```
42["voice:warning",{"message":"Deepgram API key is not configured"}]
```

### c) Ping / pong (app-level)

```
42["voice:ping"]
```

Server replies:

```
42["voice:pong",{"timestamp":"2026-06-12T12:00:00.000Z"}]
```

### d) Commit (manually finalize an utterance)

```
42["voice:commit"]
```

Server replies:

```
42["voice:committed",{"timestamp":"2026-06-12T12:00:00.000Z"}]
```

### e) Stop the session

```
42["voice:stop"]
```

Server replies:

```
42["voice:closed"]
```

## 4. Keep the connection alive

The server periodically sends an Engine.IO **ping**:

```
2
```

Reply with a **pong** so it doesn't disconnect (~20s timeout):

```
3
```

## Event reference

**You send (client → server)** — Socket.IO EVENT = `42["<event>", <args?>]`:

| Frame | Meaning |
| --- | --- |
| `40{"token":"..."}` | Connect namespace with auth (do this first) |
| `42["voice:start"]` | Open a voice session |
| `42["voice:ping"]` | Liveness check |
| `42["voice:commit"]` | Finalize current utterance |
| `42["voice:stop"]` / `42["voice:cancel"]` | End session |
| `3` | Engine.IO pong (reply to server's `2`) |

**You receive (server → client):**

| Frame prefix | Event |
| --- | --- |
| `40{"sid":...}` | Namespace connected (auth OK) |
| `44{...}` | Connect error (auth failed) |
| `42["voice:ready",{...}]` | Session ready |
| `42["voice:warning",{...}]` | Non-fatal (e.g. missing API key) |
| `42["transcript:partial",{...}]` / `42["transcript:final",{...}]` | Transcription |
| `42["assistant:text",{...}]` | Assistant reply text + tool results |
| `45...` (binary) | `assistant:audio` (MP3 bytes) |
| `42["voice:committed",{...}]` / `42["voice:closed"]` | Acks |
| `42["voice:error",{...}]` | Error |
| `2` | Engine.IO ping (reply with `3`) |

## Limitation: audio can't be tested here

`voice:audio` is a **binary** event (Socket.IO BINARY_EVENT, packet `45` plus a
separate binary frame carrying raw PCM linear16/16 kHz). Hand-crafting these in
Postman is impractical, so you **cannot exercise real transcription** from
Postman. Postman is great for verifying **connection, auth, session lifecycle,
ping/pong, and event wiring**.

For full end-to-end audio (STT → assistant → TTS), use:

- The **web client** in `whatnext_front` (real microphone), or
- `npm run voice:file` (`tools/send-audio-file.mjs`) to stream a PCM file.
```
