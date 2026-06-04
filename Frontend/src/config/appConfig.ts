/**
 * API configuration for dev, production builds, and Railway testing.
 *
 * Production Railway URLs (set in .env.production):
 * - VITE_PROD_BACKEND_URL
 * - VITE_PROD_AI_SERVICE_URL
 * - VITE_PROD_WS_URL
 *
 * Test production from dev server: VITE_USE_PRODUCTION_URLS=true in .env.local
 */

const trimSlash = (url: string) => url.replace(/\/$/, '');

/** Railway production defaults (used if env vars omitted when production mode is on). */
export const PRODUCTION_DEFAULTS = {
  backend: 'https://wesign-backend-production-7f55.up.railway.app',
  signAi: 'https://testingfinal-production.up.railway.app',
  signaling: 'wss://signaling-server-production-6bfc.up.railway.app',
} as const;

export const isProductionBuild = import.meta.env.PROD;

/** True for release builds OR when forcing Railway URLs in dev (.env.local). */
export const useProductionServices = (): boolean =>
  isProductionBuild || import.meta.env.VITE_USE_PRODUCTION_URLS === 'true';

const requireSecureUrl = (url: string, label: string) => {
  if (!useProductionServices()) return;
  if (!/^https:\/\//i.test(url) && !/^wss:\/\//i.test(url)) {
    throw new Error(`${label} must use HTTPS or WSS: ${url}`);
  }
};

const prodBackend = () =>
  (import.meta.env.VITE_PROD_BACKEND_URL as string | undefined) || PRODUCTION_DEFAULTS.backend;

const prodSignAi = () =>
  (import.meta.env.VITE_PROD_AI_SERVICE_URL as string | undefined) || PRODUCTION_DEFAULTS.signAi;

const prodWs = () =>
  (import.meta.env.VITE_PROD_WS_URL as string | undefined) || PRODUCTION_DEFAULTS.signaling;

export const getBackendBaseUrl = (): string => {
  if (useProductionServices()) {
    const url = trimSlash(prodBackend());
    requireSecureUrl(url, 'VITE_PROD_BACKEND_URL');
    return url;
  }

  const dev = import.meta.env.VITE_DEV_BACKEND_URL as string | undefined;
  if (dev) {
    return trimSlash(dev);
  }

  return '';
};

export const getApiBaseUrl = (): string => {
  const backend = getBackendBaseUrl();
  return backend ? `${backend}/api` : '/api';
};

export const getAiServiceUrl = (): string => {
  if (useProductionServices()) {
    const url = trimSlash(prodSignAi());
    requireSecureUrl(url, 'VITE_PROD_AI_SERVICE_URL');
    return url;
  }

  const dev =
    (import.meta.env.VITE_DEV_AI_SERVICE_URL as string | undefined) ||
    'http://127.0.0.1:8001';

  return trimSlash(dev);
};

export const getWebSocketUrl = (): string | undefined => {
  if (useProductionServices()) {
    const url = trimSlash(prodWs());
    requireSecureUrl(url, 'VITE_PROD_WS_URL');
    return url;
  }

  const dev = import.meta.env.VITE_DEV_WS_URL as string | undefined;
  return dev ? trimSlash(dev) : undefined;
};

export const createSignSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
