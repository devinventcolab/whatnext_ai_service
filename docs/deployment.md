# Deployment

Required services:

- Node.js 22
- MongoDB
- Redis
- OpenAI API key
- Deepgram API key
- Firebase service account for push notifications

Local development:

```bash
cp .env.example .env
docker compose up mongo redis
npm run dev
```

Production:

```bash
docker build -t whatnext-backend .
docker run --env-file .env -p 3000:3000 whatnext-backend
```

CI runs lint, tests, and TypeScript build through GitHub Actions.
