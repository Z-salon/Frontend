import { http } from './http'
import type {
  FeedbackCategory,
  FeedbackCategoryInput,
  FeedbackCategoryUpdateInput,
  FeedbackFormResponse,
  FeedbackSubmission,
  FeedbackSubmitInput,
  FeedbackSubmitResponse,
  FeedbackListQuery,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  §12 — Feedback                                                     */
/*                                                                     */
/*  Admin endpoints (list, detail, category management) require        */
/*  Bearer + business membership + OWNER/ADMIN.                        */
/*                                                                     */
/*  Customer-facing endpoints (`get`, `submit`) are public — the       */
/*  token in the URL/body is the authorization mechanism.              */
/* ------------------------------------------------------------------ */

export const feedbackApi = {
  /* ---------------------------------------------------------------- */
  /*  §12.2 Customer — fetch the form (no auth)                       */
  /* ---------------------------------------------------------------- */

  /**
   * `GET /feedback/{token}` — the token is the authorization mechanism.
   * Returns the enabled categories + business summary for the form.
   * Errors:
   *   404 FEEDBACK_REQUEST_NOT_FOUND — unknown token
   *   410 FEEDBACK_REQUEST_EXPIRED   — expired; request marked EXPIRED
   *   409 FEEDBACK_ALREADY_SUBMITTED
   *   409 FEEDBACK_NOT_AVAILABLE     — appointment no longer COMPLETED
   */
  get: (token: string) =>
    http.get<FeedbackFormResponse>(`/feedback/${token}`, { auth: false }),

  /* ---------------------------------------------------------------- */
  /*  §12.3 Customer — submit (no auth)                               */
  /* ---------------------------------------------------------------- */

  /**
   * `POST /feedback/submit` — writes submission + responses + status
   * transition in one transaction. Concurrent submits yield one
   * success and one 409.
   */
  submit: (input: FeedbackSubmitInput) =>
    http.post<FeedbackSubmitResponse>(`/feedback/submit`, input, {
      auth: false,
    }),

  /* ---------------------------------------------------------------- */
  /*  §12.4 Admin — list submissions                                  */
  /* ---------------------------------------------------------------- */

  list: (businessId: string, query?: FeedbackListQuery) => {
    const qs = new URLSearchParams()
    if (query?.page != null) qs.set('page', String(query.page))
    if (query?.limit != null) qs.set('limit', String(query.limit))
    if (query?.from_date) qs.set('from_date', query.from_date)
    if (query?.to_date) qs.set('to_date', query.to_date)
    if (query?.branch_id) qs.set('branch_id', query.branch_id)
    if (query?.category_id) qs.set('category_id', query.category_id)
    if (query?.is_anonymous != null)
      qs.set('is_anonymous', String(query.is_anonymous))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return http.get<FeedbackSubmission[]>(
      `/businesses/${businessId}/feedback${suffix}`,
    )
  },

  /* ---------------------------------------------------------------- */
  /*  §12.5 Admin — one submission                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Records a `FEEDBACK_VIEWED` audit event. Same privacy rules as
   * the list — anonymous submissions return `customer: null` and
   * `appointment: null`.
   */
  detail: (businessId: string, submissionId: string) =>
    http.get<FeedbackSubmission>(
      `/businesses/${businessId}/feedback/${submissionId}`,
    ),

  /* ---------------------------------------------------------------- */
  /*  §12.6 Admin — category management                               */
  /* ---------------------------------------------------------------- */

  categories: {
    /**
     * `GET /businesses/{businessId}/feedback-categories`
     * Lists ALL categories (enabled + disabled). Each item includes
     * `response_count`.
     */
    list: (businessId: string) =>
      http.get<FeedbackCategory[]>(
        `/businesses/${businessId}/feedback-categories`,
      ),

    /**
     * `POST /businesses/{businessId}/feedback-categories`
     * RATING requires integer `ratingScaleMin < ratingScaleMax` in 0..10.
     * TEXT/BOOLEAN require the scale to be `null`.
     */
    create: (businessId: string, input: FeedbackCategoryInput) =>
      http.post<FeedbackCategory>(
        `/businesses/${businessId}/feedback-categories`,
        input,
      ),

    /**
     * `PATCH /feedback-categories/{categoryId}`
     * Update or disable via `isEnabled: false`. No delete.
     *
     * Once a category has responses, `type` and its scale are immutable
     * (409 FEEDBACK_CATEGORY_IMMUTABLE).
     */
    update: (categoryId: string, patch: FeedbackCategoryUpdateInput) =>
      http.patch<FeedbackCategory>(
        `/feedback-categories/${categoryId}`,
        patch,
      ),
  },
}

export default feedbackApi