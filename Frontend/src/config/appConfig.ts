/**
 * Mobile/cloud API configuration.
 * Vite exposes variables prefixed with VITE_ at build time.
 *
 * Required for production mobile builds:
 * - VITE_PROD_BACKEND_URL
 * - VITE_PROD_AI_SERVICE_URL
 * Optional:
 * - VITE_PROD_WS_URL (WebSocket signaling)
 */

const DEFAULT_PROD_BACKEND_URL = 'https://wesign-backend-production-7f55.up.railway.app';

const trimSlash = (url: string) => url.replace(/\/$/, '');

const requireSecureUrlInProduction = (url: string, label: string) => {
  if (!import.meta.env.PROD) return;
  if (!/^https:\/\//i.test(url) && !/^wss:\/\//i.test(url)) {
    throw new Error(`${label} must use HTTPS or WSS in production builds: ${url}`);
  }
};

export const isProductionBuild = import.meta.env.PROD;

export const getBackendBaseUrl = (): string => {
  const prod = import.meta.env.VITE_PROD_BACKEND_URL as string | undefined;
  const dev = import.meta.env.VITE_DEV_BACKEND_URL as string | undefined;

  if (isProductionBuild) {
    if (!prod) {
      return trimSlash(DEFAULT_PROD_BACKEND_URL);
    }
    requireSecureUrlInProduction(prod, 'VITE_PROD_BACKEND_URL');
    return trimSlash(prod);
  }

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
  const prod = import.meta.env.VITE_PROD_AI_SERVICE_URL as string | undefined;
  const dev =
    (import.meta.env.VITE_DEV_AI_SERVICE_URL as string | undefined) ||
    'http://127.0.0.1:8001';

  if (isProductionBuild) {
    if (!prod) {
      throw new Error('VITE_PROD_AI_SERVICE_URL is required for production mobile builds.');
    }
    requireSecureUrlInProduction(prod, 'VITE_PROD_AI_SERVICE_URL');
    return trimSlash(prod);
  }

  return trimSlash(dev);
};

export const getWebSocketUrl = (): string | undefined => {
  const prod = import.meta.env.VITE_PROD_WS_URL as string | undefined;
  const dev = import.meta.env.VITE_DEV_WS_URL as string | undefined;

  if (isProductionBuild) {
    if (!prod) {
      return undefined;
    }
    requireSecureUrlInProduction(prod, 'VITE_PROD_WS_URL');
    return trimSlash(prod);
  }

  return dev ? trimSlash(dev) : undefined;
};

export const createSignSessionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
