export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'BRANCH_NOT_IN_BUSINESS'
  | 'INVALID_REFERENCE'
  | 'UNAUTHORIZED'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'FORBIDDEN'
  | 'NOT_BUSINESS_MEMBER'
  | 'BUSINESS_SUSPENDED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'USER_SUSPENDED'
  | 'MEMBER_STATUS_INVALID'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE_ENTRY'
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_MAX_ATTEMPTS'
  | 'OTP_RATE_LIMITED'
  | 'INVALID_CREDENTIALS'
  | 'PHONE_NOT_VERIFIED'
  | 'USER_ALREADY_EXISTS'
  | 'INVALID_SCOPE_CONFIGURATION'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;
  readonly fieldErrors?: FieldError[];

  constructor(init: {
    status: number;
    message: string;
    code?: ApiErrorCode;
    details?: Record<string, unknown>;
    fieldErrors?: FieldError[];
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code ?? 'UNKNOWN';
    this.details = init.details;
    this.fieldErrors = init.fieldErrors;

    // Restore prototype chain (TS target < ES2015 fix)
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  get isAuthError() {
    return this.status === 401;
  }
  get isPermissionError() {
    return this.status === 403;
  }
  get isValidationError() {
    return this.status === 400;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isConflict() {
    return this.status === 409;
  }
}

/**
 * Normalizes BOTH error shapes described in the guide §1:
 *
 *  1. bodyValidator (runs before controllers) — HTTP 400, no envelope:
 *     { errors: ["name: Category name is required", "branchIds: At least one branch is required"] }
 *
 *  2. Zod / service errors — HTTP 400+, standard envelope:
 *     { success: false, message: "Validation failed", code: "VALIDATION_ERROR",
 *       details: [{ field: "price", message: "Price must be greater than or equal to 0" }] }
 *
 * Always returns an ApiError with a consistent shape so components can branch
 * on `err.fieldErrors` without caring which shape arrived.
 */
export function normalizeError(status: number, body: unknown): ApiError {
  // ── Shape 1: bare bodyValidator errors array ────────────────────────────
  if (
    body &&
    typeof body === 'object' &&
    Array.isArray((body as { errors?: unknown }).errors)
  ) {
    const fieldErrors: FieldError[] = (
      body as { errors: unknown[] }
    ).errors.map((entry) => {
      const s = String(entry);
      const idx = s.indexOf(':');
      return idx > -1
        ? { field: s.slice(0, idx).trim(), message: s.slice(idx + 1).trim() }
        : { field: '', message: s };
    });

    return new ApiError({
      status,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      fieldErrors,
    });
  }

  // ── Shape 2: standard envelope ──────────────────────────────────────────
  if (body && typeof body === 'object') {
    const b = body as {
      message?: string;
      code?: string;
      details?: unknown;
    };

    let fieldErrors: FieldError[] | undefined;
    if (Array.isArray(b.details)) {
      const filtered = (b.details as unknown[])
        .filter(
          (d): d is { field: unknown; message: unknown } =>
            !!d &&
            typeof d === 'object' &&
            'field' in d &&
            'message' in d,
        )
        .map((d) => ({ field: String(d.field), message: String(d.message) }));

      if (filtered.length > 0) fieldErrors = filtered;
    }

    return new ApiError({
      status,
      message: b.message ?? `Request failed (${status})`,
      code: (b.code as ApiErrorCode) ?? 'UNKNOWN',
      details:
        b.details && !Array.isArray(b.details)
          ? (b.details as Record<string, unknown>)
          : undefined,
      fieldErrors,
    });
  }

  // ── Fallback: no parseable body ─────────────────────────────────────────
  return new ApiError({
    status,
    message: `Request failed (${status})`,
    code: 'UNKNOWN',
  });
}

/**
 * Gateway/upstream statuses that — from the client's perspective — mean the
 * backend is unreachable. A reverse proxy (nginx etc.) returns these when it
 * can't reach the upstream service (bad gateway, unavailable, timeout), which
 * the user experiences exactly like a dropped network connection.
 */
const NETWORK_ERROR_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

export function isNetworkStatus(status: number): boolean {
  return NETWORK_ERROR_STATUSES.has(status);
}

/**
 * True when the error is a transport-level failure (server unreachable, DNS,
 * dropped connection, gateway/upstream down) rather than a normal HTTP/API
 * error.
 *
 * Detects the raw `TypeError`/`NetworkError` thrown by `fetch`, plus the
 * `ApiError` that http.ts produces for status 0 (transport) and the
 * `NETWORK_ERROR` code (which now also covers 502/503/504 gateway statuses).
 */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ApiError) {
    return (
      err.status === 0 ||
      isNetworkStatus(err.status) ||
      err.code === 'NETWORK_ERROR'
    );
  }
  if (err instanceof TypeError) {
    // A user-initiated abort (AbortController) is not a network failure.
    return err.name !== 'AbortError';
  }
  return err instanceof Error && err.name === 'NetworkError';
}