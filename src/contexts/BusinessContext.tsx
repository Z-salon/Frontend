import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Membership, SystemRoleKey } from '../types/api';

const STORAGE_KEY = 'zsalon.activeBusinessId';

export interface BranchScope {
  /** True if any active role is BUSINESS-scoped → user can reach any branch. */
  businessWide: boolean;
  /** Explicit branch ids when restricted to BRANCH-scoped roles. */
  branchIds: string[];
}

export interface BusinessContextValue {
  memberships: Membership[];
  activeMembership: Membership | null;
  activeBusinessId: string | null;
  branchScope: BranchScope;
  systemRoles: Set<SystemRoleKey | string>;
  setActiveBusinessId: (id: string) => void;
  isOwner: boolean;
  isAdminOrOwner: boolean;
  hasRole: (key: SystemRoleKey | string) => boolean;
}

export const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();

  const memberships = useMemo(
    () => (user?.memberships ?? []).filter((m) => m.status === 'ACTIVE'),
    [user],
  );

  const [activeBusinessId, setActiveId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  );

  // Reconcile active id whenever memberships change.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const ids = memberships.map((m) => m.businessId);

    if (ids.length === 0) {
      setActiveId(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    if (!activeBusinessId || !ids.includes(activeBusinessId)) {
      const first = ids[0];
      setActiveId(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [memberships, activeBusinessId, status]);

  const setActiveBusinessId = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.businessId === activeBusinessId) ?? null,
    [memberships, activeBusinessId],
  );

  const { systemRoles, branchScope } = useMemo(() => {
    const roles = new Set<string>();
    let businessWide = false;
    const branchIds = new Set<string>();

    // Be tolerant of the different shapes the backend / API layer may
    // produce. Known variants:
    //
    //   A) activeMembership.userRoles[].role.systemKey      (canonical)
    //   B) activeMembership.userRoles[].systemKey           (flat)
    //   C) activeMembership.roles[].systemKey               (alternate field)
    //   D) activeMembership.role.systemKey                  (singular)
    //   E) activeMembership.roleKeys / systemRoleKeys       (precomputed list)
    //
    // The role *scope* also varies: sometimes on the userRole, sometimes
    // inside the nested role object.
    const membershipAny = activeMembership as any;

    const userRoles: any[] =
      membershipAny?.userRoles ??
      membershipAny?.roles ??
      []

    for (const ur of userRoles) {
      const key: string | undefined =
        ur?.role?.systemKey ??
        ur?.systemKey ??
        ur?.key

      if (key) roles.add(key)

      const scope: string | undefined =
        ur?.scopeType ??
        ur?.role?.scopeType

      if (scope === 'BUSINESS') {
        businessWide = true
      } else {
        const branches: any[] =
          ur?.branches ??
          ur?.role?.branches ??
          []
        for (const b of branches) {
          if (b?.id) branchIds.add(b.id)
        }
      }
    }

    // Singular role object (variant D)
    if (membershipAny?.role?.systemKey) {
      roles.add(membershipAny.role.systemKey)
      if (membershipAny.role.scopeType === 'BUSINESS') businessWide = true
    }

    // Precomputed role keys (variant E)
    const precomputed: string[] | undefined =
      membershipAny?.roleKeys ??
      membershipAny?.systemRoleKeys
    if (Array.isArray(precomputed)) {
      for (const k of precomputed) if (k) roles.add(k)
    }

    // ── Debug logging ──────────────────────────────────────────────
    // Remove once the roles shape is confirmed to work end-to-end.
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[business] activeMembership', activeMembership)
      // eslint-disable-next-line no-console
      console.log('[business] userRoles', userRoles)
      // eslint-disable-next-line no-console
      console.log('[business] systemRoles', Array.from(roles))
    }
    // ───────────────────────────────────────────────────────────────

    return {
      systemRoles: roles,
      branchScope: {
        businessWide,
        branchIds: businessWide ? [] : Array.from(branchIds),
      } as BranchScope,
    };
  }, [activeMembership]);

  const hasRole = useCallback((key: string) => systemRoles.has(key), [systemRoles]);

  const value = useMemo<BusinessContextValue>(
    () => ({
      memberships,
      activeMembership,
      activeBusinessId,
      branchScope,
      systemRoles,
      setActiveBusinessId,
      isOwner: systemRoles.has('OWNER'),
      isAdminOrOwner: systemRoles.has('OWNER') || systemRoles.has('ADMIN'),
      hasRole,
    }),
    [
      memberships,
      activeMembership,
      activeBusinessId,
      branchScope,
      systemRoles,
      setActiveBusinessId,
      hasRole,
    ],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  useBusiness                                                        */
/* ------------------------------------------------------------------ */

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error('useBusiness() must be used inside a <BusinessProvider>');
  }
  return ctx;
}