// src/api/client.ts
// Thin fetch wrapper. Unwraps the API's { success, data, pagination } envelope
// and throws a typed ApiError on failure.

import type { ApiResponse, Pagination } from '../types';

export class ApiError extends Error {
  status: number;
  /** Raw response body, useful for batch endpoints that return partial-failure detail. */
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = 'ApiError';
  }
}

/**
 * Base URL resolution:
 *   1. If VITE_API_BASE_URL is set at build time → use it (production cross-origin).
 *   2. Otherwise use '' (same-origin) → in dev, vite.config.ts proxies /api/* to the backend.
 */
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Token storage
const TOKEN_KEY = 'inv.token';

// Token change listeners
const tokenListeners = new Set<(token: string | null) => void>();

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    notifyTokenListeners(token);
  } catch {
    /* storage error — ignored */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    notifyTokenListeners(null);
  } catch {
    /* storage error — ignored */
  }
}

function notifyTokenListeners(token: string | null): void {
  tokenListeners.forEach((listener) => listener(token));
}

export function onTokenChange(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener);
  // Listen to storage events from other tabs
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === TOKEN_KEY) {
      listener(e.newValue);
    }
  };
  window.addEventListener('storage', handleStorageChange);
  // Return unsubscribe function
  return () => {
    tokenListeners.delete(listener);
    window.removeEventListener('storage', handleStorageChange);
  };
}

interface RequestOpts extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOpts['query']): string {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<{ data: T; pagination?: Pagination }> {
  const { body, query, headers, ...rest } = opts;
  const token = getToken();
  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), init);
  } catch (err) {
    throw new ApiError(0, `Network error: ${(err as Error).message}`, null);
  }

  // Try to parse JSON regardless of status — backend uses envelope on errors too.
  let payload: ApiResponse<T> | null = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // not JSON; fall through to status-only error
    }
  }

  if (!res.ok) {
    const message =
      (payload && 'error' in payload && payload.error) ||
      (payload && 'message' in payload && payload.message) ||
      `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), payload);
  }

  if (!payload || !('success' in payload)) {
    // Some endpoints (CSV export, health) don't use envelope. Return raw.
    return { data: text as unknown as T };
  }

  if (payload.success === false) {
    const message = payload.error || payload.message || 'Request failed';
    throw new ApiError(res.status, message, payload);
  }

  return { data: payload.data, pagination: payload.pagination };
}

// ---- Convenience verbs ----------------------------------------------------

export const api = {
  get: <T>(path: string, query?: RequestOpts['query']) =>
    request<T>(path, { method: 'GET', query }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),

  del: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
