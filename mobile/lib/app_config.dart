/// WeSign production configuration for Flutter.
/// Copy this file into your Flutter project (e.g. lib/core/app_config.dart).
library;

class AppConfig {
  AppConfig._();

  /// Set true for release/TestFlight/Play Store builds.
  static const bool isProduction = bool.fromEnvironment(
    'PRODUCTION',
    defaultValue: true,
  );

  static const String _prodBackend =
      'https://wesign-backend-production-7f55.up.railway.app';
  static const String _prodSignaling =
      'wss://signaling-server-production-6bfc.up.railway.app';
  static const String _prodSignAi =
      'https://testingfinal-production.up.railway.app';

  // Local dev overrides (--dart-define)
  static const String _devBackend = String.fromEnvironment(
    'DEV_BACKEND_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
  static const String _devSignaling = String.fromEnvironment(
    'DEV_SIGNALING_URL',
    defaultValue: 'ws://10.0.2.2:3001',
  );
  static const String _devSignAi = String.fromEnvironment(
    'DEV_SIGN_AI_URL',
    defaultValue: 'http://10.0.2.2:8001',
  );

  static String get backendBaseUrl =>
      isProduction ? _prodBackend : _devBackend;

  static String get apiBaseUrl => '$backendBaseUrl/api';

  static String get signalingUrl =>
      isProduction ? _prodSignaling : _devSignaling;

  static String get signAiUrl => isProduction ? _prodSignAi : _devSignAi;
}
