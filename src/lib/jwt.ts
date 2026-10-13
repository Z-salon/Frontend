/**
 * Reads JWT `exp` (seconds since epoch) without verifying the signature.
 * Used only to schedule proactive access-token refresh on the client.
 */
export function getJwtExpiryMs(token: string): number | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** True when the token is expired or within `skewMs` of expiring. */
export function isJwtExpiredOrNear(
  token: string,
  skewMs = 0,
): boolean {
  const expMs = getJwtExpiryMs(token);
  if (expMs === null) return false;
  return Date.now() >= expMs - skewMs;
}
