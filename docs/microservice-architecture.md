# Voice Assistant Microservice Architecture

This Node.js service is only the voice/realtime layer.

Existing ownership stays in the .NET + PostgreSQL backend:

- Users
- Auth
- Tasks
- Events
- Notes
- Worklogs
- Notifications if already implemented there

This service owns:

- Socket.IO connection from frontend/mobile
- Audio streaming protocol
- Deepgram STT/TTS integration
- OpenAI intent/function-calling layer
- Calling .NET APIs with the user's bearer token

## Folder Structure

```text
src/
  main.ts
  config/
  http/
    app.ts
    routes/
  auth/
  realtime/
  ai/
  speech/
  integrations/
    dotnet/
  shared/
```

## Runtime Flow

1. Frontend connects to Socket.IO with .NET JWT access token.
2. This service validates token locally with `JWT_SHARED_SECRET` or by calling `DOTNET_AUTH_ME_PATH`.
3. Frontend streams audio to `voice:audio`.
4. Deepgram converts audio to transcript.
5. OpenAI decides the productivity action.
6. Tool executor calls the existing .NET API.
7. Response text and optional TTS audio are sent back over Socket.IO.
