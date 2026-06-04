import { getAiServiceUrl } from '../config/appConfig';

export const SIGN_RECOGNITION_SERVICE_URL = getAiServiceUrl();
export const SIGN_SERVICE_STARTUP_GRACE_MS = 60_000;
export const SIGN_HEALTH_POLL_INTERVAL_MS = 1_000;

export const isTauriApp = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

export const signServiceUnavailableMessage = (): string =>
  'Sign recognition is unavailable. Check your network connection and verify the Railway AI service is running.';

export const signServiceStartingMessage = (): string =>
  'Connecting to sign recognition cloud service...';

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
