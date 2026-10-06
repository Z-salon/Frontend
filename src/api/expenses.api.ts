import { http } from './http';
import type {
  CreateExpenseRequest,
  Expense,
  ExpenseListQuery,
  PaginationMeta,
  RecordExpensePaymentRequest,
  UpdateExpenseRequest,
  VoidExpenseRequest,
} from '../types/api';

/* ------------------------------------------------------------------ */
/*  Expense ledger                                                     */
/*                                                                     */
/*  Finance → Expenses is the only caller. Every record comes off the  */
/*  endpoint; no row ids or amounts are minted client-side.            */
/*                                                                     */
/*  `list` uses the envelope-aware GET so the server's pagination      */
/*  `meta` survives — the plain client unwraps `data` and drops it.    */
/* ------------------------------------------------------------------ */

export interface ExpenseListResult {
  data: Expense[]
  /** `null` when the backend answered without the standard envelope. */
  meta: PaginationMeta | null
}

export const expensesApi = {
  /** `GET /businesses/{businessId}/expenses` (server-side pagination). */
  list: async (
    businessId: string,
    query?: ExpenseListQuery,
  ): Promise<ExpenseListResult> => {
    const res = await http.getEnvelope<Expense[]>(
      `/businesses/${businessId}/expenses`,
      { query },
    );

    // Tolerate a bare array (a controller that skips the envelope) so the
    // ledger still renders; pagination is simply unavailable in that case.
    if (Array.isArray(res)) return { data: res as unknown as Expense[], meta: null };

    return {
      data: Array.isArray(res?.data) ? res.data : [],
      meta: res?.meta ?? null,
    };
  },

  /** `GET /businesses/{businessId}/expenses/:expenseId` — details source of truth. */
  get: (businessId: string, expenseId: string) =>
    http.get<Expense>(`/businesses/${businessId}/expenses/${expenseId}`),

  /** `POST /businesses/{businessId}/expenses` */
  create: (businessId: string, input: CreateExpenseRequest) =>
    http.post<Expense>(`/businesses/${businessId}/expenses`, input),

  /** `PATCH /businesses/{businessId}/expenses/:expenseId` */
  update: (businessId: string, expenseId: string, input: UpdateExpenseRequest) =>
    http.patch<Expense>(
      `/businesses/${businessId}/expenses/${expenseId}`,
      input,
    ),

  /** `POST /businesses/{businessId}/expenses/:expenseId/payments` */
  recordPayment: (
    businessId: string,
    expenseId: string,
    input: RecordExpensePaymentRequest,
  ) =>
    http.post<Expense>(
      `/businesses/${businessId}/expenses/${expenseId}/payments`,
      input,
    ),

  /** `POST /businesses/{businessId}/expenses/:expenseId/void` */
  void: (businessId: string, expenseId: string, input: VoidExpenseRequest) =>
    http.post<Expense>(
      `/businesses/${businessId}/expenses/${expenseId}/void`,
      input,
    ),
};

export default expensesApi;