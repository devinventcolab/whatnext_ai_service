# Mobile Integration

1. Register or log in through the REST auth endpoints.
2. Store the access token and refresh token securely.
3. Register the device with platform and push token using `POST /users/me/devices`.
4. Open a Socket.IO connection with `auth.token`.
5. Emit `voice:start`, then stream `voice:audio` binary chunks.
6. Listen for transcript, assistant text, and assistant audio events.
7. On disconnect, reconnect with the same JWT if valid or refresh first.

Audio input should be PCM `linear16`, 16 kHz, mono. The backend forwards audio to Deepgram STT, sends final transcripts to OpenAI Realtime, executes approved productivity tools, converts the response to speech with Deepgram TTS, and streams audio back.

Errors are emitted as `voice:error` with a human-readable `message`. Clients should stop recording for fatal errors and retry with exponential backoff for network drops.
