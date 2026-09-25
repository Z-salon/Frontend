import { http } from './http';
import type {
  CreateServiceInput,
  EffectiveServiceConfig,
  Service,
  ServiceBranchAssignment,
  ServiceBranchConfigInput,
  ServiceStatus,
  UpdateServiceInput,
} from '../types/api';

export const servicesApi = {
  /**
   * §9.1 — Bearer + membership + Owner/Admin.
   * Deposit rules enforced server-side (see §9.1).
   */
  create: (businessId: string, input: CreateServiceInput) =>
    http.post<Service>(`/businesses/${businessId}/services`, input),

  /**
   * §9.2 — Bearer. Defaults to ACTIVE for non-Owner/Admin. Branch-scoped
   * users see only services whose assignment AND category assignment are
   * both active in their branches.
   */
  list: (
    businessId: string,
    q?: {
      branchId?: string;
      categoryId?: string;
      status?: ServiceStatus;
    },
  ) =>
    http.get<Service[]>(`/businesses/${businessId}/services`, {
      query: q,
    }),

  /** §9.3 — Bearer. 403 if not accessible, 404 if missing. */
  get: (serviceId: string) => http.get<Service>(`/services/${serviceId}`),

  /** §9.4 — Bearer + Owner/Admin. All fields optional. */
  update: (serviceId: string, patch: UpdateServiceInput) =>
    http.patch<Service>(`/services/${serviceId}`, patch),

  // ── §9.5 Service ↔ branch assignment ──────────────────────────────────
  branches: {
    list: (serviceId: string) =>
      http.get<ServiceBranchAssignment[]>(
        `/services/${serviceId}/branches`,
      ),

    assign: (serviceId: string, branchId: string) =>
      http.post<ServiceBranchAssignment>(
        `/services/${serviceId}/branches`,
        { branchId },
      ),

    setActive: (serviceId: string, branchId: string, isActive: boolean) =>
      http.patch<ServiceBranchAssignment>(
        `/services/${serviceId}/branches/${branchId}`,
        { isActive },
      ),

    /**
     * PATCH .../config.
     *
     * `isActive` is REQUIRED here — Swagger says optional; it is not (§11.2).
     * `durationMinutes` / `price` accept null to inherit the service value.
     */
    updateConfig: (
      serviceId: string,
      branchId: string,
      input: ServiceBranchConfigInput,
    ) =>
      http.patch<ServiceBranchAssignment>(
        `/services/${serviceId}/branches/${branchId}/config`,
        input,
      ),

    /** Resolved duration/price (branch override, else service value). */
    effectiveConfig: (serviceId: string, branchId: string) =>
      http.get<EffectiveServiceConfig>(
        `/services/${serviceId}/branches/${branchId}/effective-config`,
      ),
  },
};