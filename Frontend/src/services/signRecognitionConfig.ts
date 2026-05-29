import { getAiServiceUrl, isProductionBuild } from '../config/appConfig';

export const SIGN_RECOGNITION_SERVICE_URL = getAiServiceUrl();
export const SIGN_SERVICE_STARTUP_GRACE_MS = isProductionBuild ? 60_000 : 45_000;
export const SIGN_HEALTH_POLL_INTERVAL_MS = 1_000;

export const isTauriApp = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

export const signServiceUnavailableMessage = (): string => {
  if (isProductionBuild) {
    return (
      'Sign recognition is unavailable. Check your network connection and verify ' +
      'VITE_PROD_AI_SERVICE_URL points to the deployed Railway AI service.'
    );
  }

  if (isTauriApp()) {
    return (
      'Sign recognition is not responding. Restart the desktop app or run ' +
      'TestingFinal/sign_server.py for development.'
    );
  }

  return (
    'Sign recognition service is not running. For web dev, run: ' +
    'cd TestingFinal && pip install -r requirements.txt && python sign_server.py'
  );
};

export const signServiceStartingMessage = (): string =>
  isProductionBuild
    ? 'Connecting to sign recognition cloud service...'
    : isTauriApp()
      ? 'Starting sign recognition service...'
      : 'Connecting to sign recognition service...';

export type SignHealthResponse = {
  status: string;
  model_loaded?: boolean;
  active_sessions?: number;
};

export const fetchSignServiceHealth = async (
  serviceUrl: string = SIGN_RECOGNITION_SERVICE_URL
): Promise<SignHealthResponse> => {
  const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/health`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return (await response.json()) as SignHealthResponse;
};
