# REST API

Base URL: `/api/v1`

Authentication uses `Authorization: Bearer <accessToken>`.

## Auth

- `POST /auth/register`: `{ email, password, displayName?, deviceId? }`
- `POST /auth/login`: `{ email, password, deviceId? }`
- `POST /auth/refresh`: `{ refreshToken }`
- `POST /auth/logout`

## User Settings

- `GET /users/me`
- `PATCH /users/me`
- `PATCH /users/me/preferences`
- `POST /users/me/devices`

## Productivity Resources

`/tasks`, `/events`, `/notes`, and `/worklogs` support:

- `POST /`
- `GET /?page=1&limit=20&search=text`
- `GET /:id`
- `PATCH /:id`
- `DELETE /:id`

## Conversations

- `GET /conversations`
- `GET /conversations/:id`
