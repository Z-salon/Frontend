import { http } from './http';
import type {
  CategoryBranchAssignment,
  CreateServiceCategoryInput,
  SampleWork,
  SampleWorkInput,
  ServiceCategory,
  ServiceStatus,
  UpdateSampleWorkInput,
  UpdateServiceCategoryInput,
} from '../types/api';

export const serviceCategoriesApi = {
  /**
   * §8.1 — Bearer + membership + Owner/Admin.
   * `branchIds` required, ≥ 1 UUIDs, no duplicates, all active + in-business.
   */
  create: (businessId: string, input: CreateServiceCategoryInput) =>
    http.post<ServiceCategory>(
      `/businesses/${businessId}/service-categories`,
      input,
    ),

  /**
   * §8.2 — Bearer. Branch-scoped users see only categories assigned to
   * their branches. `includeInactive` is ignored for non-Owner/Admin.
   */
  list: (
    businessId: string,
    q?: {
      branchId?: string;
      status?: ServiceStatus;
      includeInactive?: boolean;
    },
  ) =>
    http.get<ServiceCategory[]>(
      `/businesses/${businessId}/service-categories`,
      { query: q },
    ),

  /** §8.3 — Bearer. 403 if the category belongs to an inaccessible business. */
  get: (categoryId: string) =>
    http.get<ServiceCategory>(`/service-categories/${categoryId}`),

  /** §8.4 — Bearer + Owner/Admin. All fields optional. */
  update: (categoryId: string, patch: UpdateServiceCategoryInput) =>
    http.patch<ServiceCategory>(
      `/service-categories/${categoryId}`,
      patch,
    ),

  // ── §8.5 Category ↔ branch assignment ─────────────────────────────────
  branches: {
    list: (categoryId: string) =>
      http.get<CategoryBranchAssignment[]>(
        `/service-categories/${categoryId}/branches`,
      ),

    assign: (categoryId: string, branchId: string) =>
      http.post<CategoryBranchAssignment>(
        `/service-categories/${categoryId}/branches`,
        { branchId },
      ),

    /** `isActive` is REQUIRED here (not optional). */
    setActive: (categoryId: string, branchId: string, isActive: boolean) =>
      http.patch<CategoryBranchAssignment>(
        `/service-categories/${categoryId}/branches/${branchId}`,
        { isActive },
      ),
  },

  // ── §8.6 Sample works ─────────────────────────────────────────────────
  //
  // Writes are OWNER/ADMIN only (enforced by verifyOwnerOrAdmin in the
  // service). Reads allow any active member, but a BRANCH_MANAGER is scoped
  // to categories active in one of their own branches — that surfaces as a
  // 403 on `list`, so callers should show it as "no access" rather than
  // "empty".
  sampleWorks: {
    /** §8.6 — 201 returns the created row, not just its id. */
    create: (categoryId: string, input: SampleWorkInput) =>
      http.post<SampleWork>(
        `/service-categories/${categoryId}/sample-works`,
        input,
      ),

    /** Newest first (server orders by createdAt desc). */
    list: (categoryId: string) =>
      http.get<SampleWork[]>(
        `/service-categories/${categoryId}/sample-works`,
      ),

    get: (sampleWorkId: string) =>
      http.get<SampleWork>(`/sample-works/${sampleWorkId}`),

    /**
     * Replacing `publicId` does NOT delete the previous asset server-side —
     * only `remove` does that. The old image is orphaned unless the client
     * cleans it up.
     */
    update: (sampleWorkId: string, patch: UpdateSampleWorkInput) =>
      http.patch<SampleWork>(`/sample-works/${sampleWorkId}`, patch),

    /** Also best-effort deletes the stored image by `publicId`. */
    remove: (sampleWorkId: string) =>
      http.delete<void>(`/sample-works/${sampleWorkId}`),
  },
};