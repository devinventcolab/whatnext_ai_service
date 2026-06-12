# WebSocket Events

Connect to the Socket.IO endpoint with `auth.token=<JWT access token>`.

## Client to Server

- `voice:start`: `{ deviceId? }`
- `voice:audio`: binary PCM chunk, `linear16`, 16 kHz, mono
- `voice:commit`: marks the current utterance boundary
- `voice:stop`: closes the conversation
- `voice:cancel`: cancels the session
- `voice:ping`: health check

## Server to Client

- `voice:ready`: conversation id and audio format
- `transcript:partial`
- `transcript:final`
- `assistant:text`
- `assistant:audio`
- `voice:error`
- `voice:closed`
- `voice:pong`
