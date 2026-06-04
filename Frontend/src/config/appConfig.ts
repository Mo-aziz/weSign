/**
 * Remote service URLs (Railway). The frontend may run locally or deployed;
 * backend, signaling, and sign AI always use these cloud endpoints.
 *
 * Override in `.env` (see `.env.example`). Legacy `VITE_PROD_*` names still work.
 */

const trimSlash = (url: string) => url.replace(/\/$/, '');

/** Railway defaults when env vars are omitted. */
export const SERVICE_DEFAULTS = {
  backend: 'https://wesign-backend-production-7f55.up.railway.app',
  signAi: 'https://testingfinal-production.up.railway.app',
  signaling: 'wss://signaling-server-production-6bfc.up.railway.app',
} as const;

/** @deprecated Use SERVICE_DEFAULTS */
export const PRODUCTION_DEFAULTS = SERVICE_DEFAULTS;

const readServiceUrl = (
  primary: string | undefined,
  legacy: string | undefined,
  fallback: string,
  label: string
): string => {
  const url = trimSlash(primary || legacy || fallback);
  if (!/^https:\/\//i.test(url) && !/^wss:\/\//i.test(url)) {
    throw new Error(`${label} must use HTTPS or WSS: ${url}`);
  }
  return url;
};

export const getBackendBaseUrl = (): string =>
  readServiceUrl(
    import.meta.env.VITE_BACKEND_URL as string | undefined,
    import.meta.env.VITE_PROD_BACKEND_URL as string | undefined,
    SERVICE_DEFAULTS.backend,
    'Backend URL'
  );

export const getApiBaseUrl = (): string => `${getBackendBaseUrl()}/api`;

export const getAiServiceUrl = (): string =>
  readServiceUrl(
    import.meta.env.VITE_AI_SERVICE_URL as string | undefined,
    import.meta.env.VITE_PROD_AI_SERVICE_URL as string | undefined,
    SERVICE_DEFAULTS.signAi,
    'AI service URL'
  );

export const getWebSocketUrl = (): string =>
  readServiceUrl(
    import.meta.env.VITE_WS_URL as string | undefined,
    import.meta.env.VITE_PROD_WS_URL as string | undefined,
    SERVICE_DEFAULTS.signaling,
    'WebSocket URL'
  );

export const createSignSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
