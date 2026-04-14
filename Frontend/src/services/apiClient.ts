/**
 * API Client for communicating with the backend
 * Handles authentication tokens, error handling, and request/response formatting
 */

const API_BASE_URL = '/api';

// Token storage
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Get stored auth tokens
 */
export const getStoredTokens = (): Partial<AuthTokens> => {
  const accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  return {
    accessToken: accessToken || undefined,
    refreshToken: refreshToken || undefined,
  };
};

/**
 * Store auth tokens in localStorage
 */
export const storeTokens = (tokens: AuthTokens): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
};

/**
 * Clear stored auth tokens
 */
export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Get current access token
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const tokens = getStoredTokens();
    if (!tokens.refreshToken) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/users/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokens.refreshToken}`,
      },
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = await response.json();
    if (data.accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken);
      return data.accessToken;
    }

    return null;
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearTokens();
    return null;
  }
};

/**
 * Generic API request function with automatic token handling
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers instanceof Headers
      ? Object.fromEntries(options.headers)
      : options.headers),
  });

  // Add authorization token if available
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If 401, try to refresh token and retry once
    if (response.status === 401 && token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const newHeaders = new Headers(headers);
        newHeaders.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
      } else {
        // Token refresh failed, clear tokens and redirect to login
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Authentication failed. Please log in again.');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

/**
 * GET request
// eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'GET' });
};

/**
 * POST request
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiPost = async <T = any>(
  endpoint: string,
  body?: any
): Promise<T> => {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * PUT request
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiPut = async <T = any>(
  endpoint: string,
  body?: any
): Promise<T> => {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
};

/**
 * DELETE request
 */
export const apiDelete = async <T = any>(endpoint: string): Promise<T> => {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
};

export default {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  getAccessToken,
  getStoredTokens,
  storeTokens,
  clearTokens,
};
