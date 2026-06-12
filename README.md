# WhatNext Voice Assistant Microservice

This is a Node.js microservice for voice assistant communication. It is designed to sit beside an existing .NET + PostgreSQL backend.

## What This Service Does

- Accepts frontend/mobile Socket.IO connections.
- Receives voice audio chunks.
- Uses Deepgram for speech-to-text and text-to-speech.
- Uses OpenAI for productivity intent detection and tool calling.
- Calls existing .NET APIs for tasks, events, notes, and worklogs.

## What This Service Does Not Own

- PostgreSQL schema
- User tables
- Task/event/note/worklog persistence
- Main business logic already present in .NET

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Health check:

```text
GET http://localhost:8980/health
```

## Required .env

Set `DOTNET_API_BASE_URL` to your existing .NET API base URL.

If this service can verify the same JWT secret as .NET, set `JWT_SHARED_SECRET`.
Otherwise, keep it empty and implement/point `DOTNET_AUTH_ME_PATH` to an endpoint that returns the current user for a bearer token.

## Postman Testing

Import these files into Postman:

- `postman/WhatNext Voice Microservice.postman_collection.json`
- `postman/WhatNext Voice Microservice.postman_environment.json`

Then select the `WhatNext Voice Microservice Local` environment.

Set:

```text
voice_base_url=http://localhost:8980
dotnet_access_token=<JWT access token from your .NET backend>
```

Test order:

1. Run `Health Check`.
2. Run `Get Current User From .NET Token`.
3. Run `Create Test Task Through .NET Backend`.
4. For Socket.IO, create a Postman Socket.IO request manually using the instructions inside the collection.

Socket.IO URL:

```text
http://localhost:8980
```

Socket.IO auth payload:

```json
{
  "token": "{{dotnet_access_token}}"
}
```

Basic Socket.IO events:

- Emit `voice:ping`, expect `voice:pong`.
- Emit `voice:start`, expect `voice:ready`.
- Emit `voice:stop`, expect `voice:closed`.

## Test Voice With Audio File

Postman can verify Socket.IO connection, but binary audio streaming is easier with the provided Node script.

First convert any audio file to backend-compatible PCM:

```bash
ffmpeg -i input.mp3 -ac 1 -ar 16000 -f s16le sample.pcm
```

Then stream it:

```bash
npm run voice:file -- --token <DOTNET_JWT_TOKEN> --file sample.pcm --url http://localhost:8980
```

Expected event flow:

```text
socket connected
voice:ready
transcript:partial / transcript:final
assistant:text
assistant:audio
voice:closed
```

Requirements for real transcription and AI response:

```env
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
DOTNET_API_BASE_URL=http://your-dotnet-api/api
```
