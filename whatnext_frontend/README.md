# WhatNext Standalone Frontend

This frontend is completely separate from the backend process.

## Run

1. Start backend first in the project root:

```bash
npm.cmd run start:dev
```

2. In a new terminal, start this frontend:

```bash
cd whatnext_frontend
npm.cmd start
```

3. Open:

`http://localhost:5173`

## What you can test

- Register/login/refresh/logout
- Realtime voice session over Socket.IO
- `voice:start`, mic stream (`voice:audio`), `voice:commit`, `voice:stop`
- Task CRUD: fetch/create/update/delete

## Fast frontend smoke test

1. Start backend and confirm it logs the port, for example `8980`.
2. Start this frontend and open `http://localhost:5173`.
3. Click `Use Backend Port 8980`.
4. Click `Check Health`.
5. Click `Run Frontend Smoke Test`.

The smoke test will:

- Call backend `/health`.
- Register `test@example.com` or log in if it already exists.
- Connect Socket.IO with the JWT access token.
- Emit `voice:ping` and wait for `voice:pong`.
- Emit `voice:start` and wait for `voice:ready`.

If the smoke test completes, frontend REST auth and Socket.IO are working.

## Notes

- Set backend `APP_ORIGIN` in `.env` to allow this frontend origin, for example:
  `APP_ORIGIN=http://localhost:5173`
- Voice requires valid `OPENAI_API_KEY` and `DEEPGRAM_API_KEY` in backend `.env`.
