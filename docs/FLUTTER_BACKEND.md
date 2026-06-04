# Flutter → Railway backend

Production URLs (copy into Flutter — see `mobile/lib/app_config.dart`):

| Service | URL |
|---------|-----|
| REST | `https://wesign-backend-production-7f55.up.railway.app` |
| Signaling | `wss://signaling-server-production-6bfc.up.railway.app` |
| Sign AI | `https://testingfinal-production.up.railway.app` |

REST API base (no trailing slash):

```text
https://wesign-backend-production-7f55.up.railway.app
```

All REST routes are under `/api`, for example:

```text
https://wesign-backend-production-7f55.up.railway.app/api/users/login-username
```

## Quick test

- Health: `GET /health`
- Swagger: `GET /api-docs` (if `ENABLE_SWAGGER=true` on Railway)

## Flutter example

```dart
class ApiConfig {
  static const String baseUrl =
      'https://wesign-backend-production-7f55.up.railway.app';

  static String get apiBaseUrl => '$baseUrl/api';
}
```

Login (same as the React app):

```dart
final response = await http.post(
  Uri.parse('${ApiConfig.apiBaseUrl}/users/login-username'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'username': username,
    'password': password,
    'isDeaf': isDeaf,
  }),
);
```

Authenticated requests:

```dart
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer $accessToken',
},
```

Refresh token:

```dart
POST ${ApiConfig.apiBaseUrl}/users/refresh
// body: { "refreshToken": "..." }  OR  Authorization: Bearer <refreshToken>
```

## Dev vs prod

Use `--dart-define` or flavors:

```dart
static const String baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000', // Android emulator → host machine
);
```

| Environment | `API_BASE_URL` |
|-------------|----------------|
| Local backend | `http://10.0.2.2:3000` (Android emulator) or `http://localhost:3000` (iOS sim) |
| Production | `https://wesign-backend-production-7f55.up.railway.app` |

Run:

```bash
flutter run --dart-define=API_BASE_URL=https://wesign-backend-production-7f55.up.railway.app
```

## Not on this backend URL

- **Sign AI** — separate Railway service → `/frame`, `/health` on `VITE_PROD_AI_SERVICE_URL`
- **WebRTC signaling** — deploy `signaling-server/` → `wss://your-signaling.up.railway.app` (see `signaling-server/README.md`)

## Railway CORS

Native Flutter (iOS/Android) HTTP calls are **not** blocked by browser CORS.

**Flutter Web** only: add your web origin to backend `CLIENT_ORIGIN` on Railway.
