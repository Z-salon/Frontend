/** Set after owner signup verify; cleared when the setup wizard finishes. */
export const PENDING_OWNER_ONBOARDING_KEY = 'zsalon.pendingOwnerOnboarding';

export function markPendingOwnerOnboarding(userId: string): void {
  sessionStorage.setItem(PENDING_OWNER_ONBOARDING_KEY, userId);
}

export function isPendingOwnerOnboarding(userId: string): boolean {
  return sessionStorage.getItem(PENDING_OWNER_ONBOARDING_KEY) === userId;
}

export function clearPendingOwnerOnboarding(): void {
  sessionStorage.removeItem(PENDING_OWNER_ONBOARDING_KEY);
}
