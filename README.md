# Lensiq Backend

NestJS backend for authenticated AI endpoints.

## Authentication

The mobile app signs users in with Firebase Auth. Backend routes that need AI access use `FirebaseAuthGuard`, which verifies the mobile app's Firebase ID token with Firebase Admin.

Protected endpoints added now:

- `GET /auth/me`
- `GET /ai/status`
- `POST /ai/live-token`

Both require:

```http
Authorization: Bearer <firebase-id-token>
```

## Firebase Admin Setup

Configuration is read from a `.env` file in this directory (see `.env.example`).

Required:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='<service-account-json>'
```

Optional:

```bash
CORS_ORIGIN=http://localhost:3000
PORT=3000
```

Do not commit `.env` or service account JSON files.

## Gemini Live Ephemeral Tokens

The mobile app asks the backend for a short-lived Gemini Live token, then uses that token to connect directly to Gemini Live. The Gemini API key stays on the backend.

Required:

```bash
export GEMINI_API_KEY=<gemini-api-key>
```

Optional:

```bash
export GEMINI_LIVE_MODEL=gemini-live-2.5-flash-native-audio
export GEMINI_LIVE_TOKEN_SECONDS=1800
export GEMINI_LIVE_GUEST_TOKEN_SECONDS=900
export GEMINI_LIVE_NEW_SESSION_SECONDS=60
export GEMINI_LIVE_TOKEN_USES=1
```

If your Google project has access to another Live model, set `GEMINI_LIVE_MODEL` without changing code.

## Run

```bash
npm install
npm run start:dev
```

## Verify

```bash
npm run build
npm test
npm run test:e2e
```
