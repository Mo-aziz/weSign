# Flutter production setup

Copy `lib/app_config.dart` into your Flutter app.

## Production URLs (Railway)

| Service | URL |
|---------|-----|
| REST API | `https://wesign-backend-production-7f55.up.railway.app/api` |
| Signaling | `wss://signaling-server-production-6bfc.up.railway.app` |
| Sign AI | `https://testingfinal-production.up.railway.app` |

`AppConfig.isProduction` defaults to `true` — suitable for store builds.

## Bundle & test

```bash
# Release APK (production URLs)
flutter build apk --release --dart-define=PRODUCTION=true

# iOS
flutter build ipa --release --dart-define=PRODUCTION=true

# Local dev against your PC
flutter run --dart-define=PRODUCTION=false
```

## Health checks before release

```text
https://wesign-backend-production-7f55.up.railway.app/health
https://testingfinal-production.up.railway.app/health
https://signaling-server-production-6bfc.up.railway.app/health
```

## Sign AI usage

```dart
import 'package:uuid/uuid.dart';

final sessionId = const Uuid().v4();

// POST ${AppConfig.signAiUrl}/frame
// { "sessionId": sessionId, "image": "<base64 jpeg>" }
```
