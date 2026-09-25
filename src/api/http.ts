import { ApiError, isNetworkError, isNetworkStatus, normalizeError } from './errors';

/**
 * Base path. The server mounts everything under `/api/v1` (API_PREFIX env value).
 * If your Vite dev server proxies `/api` to the backend, this just works.
 */
const API_PREFIX = '/api/v1';

type TokenProvider = () => string | null;
type RefreshFn = () => Promise<string | null>;
type UnauthorizedFn = () => void;

let getAccessToken: TokenProvider = () => null;
let refreshAccessToken: RefreshFn = async () => null;
let onUnauthorized: UnauthorizedFn = () => {};

/**
 * Called once by AuthProvider on mount. Wires the token/refresh lifecycle
 * into this module without creating a circular import.
 */
export function configureHttp(opts: {
  getAccessToken: TokenProvider;
  refreshAccessToken: RefreshFn;
  onUnauthorized: UnauthorizedFn;
}): void {
  getAccessToken = opts.getAccessToken;
  refreshAccessToken = opts.refreshAccessToken;
  onUnauthorized = opts.onUnauthorized;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Send `Authorization: Bearer <token>`. Default `true`. */
  auth?: boolean;
  /** Internal: set on the retry after refresh to avoid infinite recursion. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

export interface ApiEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

/**
 * Single-flight refresh.
 *
 * Guide §2.12 — `/auth/refresh` rotates the refreshToken cookie. If several
 * requests 401 at the same time, firing N refreshes would invalidate all but
 * the first. So we share one promise across callers.
 */
let refreshPromise: Promise<string | null> | null = null;

async function runRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export { runRefresh };

function buildUrl(
  path: string,
  query?: RequestOptions['query'],
): string {
  const url = new URL(API_PREFIX + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function raw(
  path: string,
  opts: RequestOptions,
): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });

  if (opts.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (opts.auth !== false) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    // REQUIRED: refreshToken is an httpOnly cookie (§1). Without this, silent
    // refresh never works.
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Fetch + parse with network-failure normalization. A transport-level failure
 * (`fetch` rejecting with a TypeError — DNS, refused connection, dropped
 * socket) is rewritten to a consistent `ApiError` with message "Network Error"
 * so every caller surfaces the same message instead of a browser-specific
 * "Failed to fetch".
 */
async function perform(
  path: string,
  opts: RequestOptions,
): Promise<{ res: Response; body: unknown }> {
  try {
    const res = await raw(path, opts);
    const body = await parse(res);
    return { res, body };
  } catch (err) {
    if (isNetworkError(err)) {
      throw new ApiError({
        status: 0,
        message: 'Network Error',
        code: 'NETWORK_ERROR',
      });
    }
    throw err;
  }
}

/**
 * Core request. Returns the unwrapped `data` payload on success; throws
 * `ApiError` on failure.
 *
 * On 401 with a valid refresh cookie:
 *   - one shared refresh runs
 *   - the original request is retried once
 *   - if refresh fails, `onUnauthorized` fires and the 401 is thrown
 */
export async function request<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  let { res, body } = await perform(path, opts);

  if (res.status === 401 && !opts.skipRefresh && opts.auth !== false) {
    const newToken = await runRefresh();

    if (newToken) {
      ({ res, body } = await perform(path, { ...opts, skipRefresh: true }));
    } else {
      onUnauthorized();
    }
  }

  if (!res.ok) {
    // Gateway statuses (502/503/504) mean the upstream/backend is down —
    // treated as a network failure, not an API error.
    if (isNetworkStatus(res.status)) {
      throw new ApiError({
        status: res.status,
        message: 'Network Error',
        code: 'NETWORK_ERROR',
      });
    }
    throw normalizeError(res.status, body);
  }

  console.log('[http]', (opts.method ?? 'GET'), path, body);
  
  // Unwrap the success envelope when present (§1). A few controllers bypass
  // the envelope; in those cases we return the raw body.
  if (body && typeof body === 'object' && (body as { success?: unknown }).success === true) {
    return (body as ApiEnvelope<T>).data;
  }

  return body as T;
}

export const http = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),

  post: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...opts, method: 'POST', body }),

  patch: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...opts, method: 'PATCH', body }),

  put: <T>(
    path: string,
    body?: unknown,
    opts?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...opts, method: 'PUT', body }),

  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

export { ApiError };