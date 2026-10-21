import { http } from './http'
import type {
  FinanceCollectionReport,
  FinanceExpenseReport,
  FinanceOutstandingQuery,
  FinanceOutstandingReport,
  FinanceRefundReport,
  FinanceReportQuery,
  FinanceRevenueReport,
  FinanceSummaryReport,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Finance reporting                                                  */
/*                                                                     */
/*  The six read-only reporting endpoints behind Finance → Overview,   */
/*  Reports and Outstanding. Every value is the backend's; nothing is  */
/*  derived on the client. `branchId` is a UUID and is omitted for     */
/*  "all branches". `from`/`to` are ISO date or datetime, and a        */
/*  date-only value spans the whole day in the business timezone.      */
/*                                                                     */
/*  Deliberately absent: payments, payment methods, transactions and   */
/*  any payment-method CRUD — those pages are out of scope.            */
/* ------------------------------------------------------------------ */

function path(businessId: string): string {
  return `/businesses/${businessId}/finance`
}

export const financeApi = {
  /** `GET /businesses/{businessId}/finance/summary` */
  summary: (businessId: string, query?: FinanceReportQuery) =>
    http.get<FinanceSummaryReport>(`${path(businessId)}/summary`, { query }),

  /** `GET /businesses/{businessId}/finance/revenue` */
  revenue: (businessId: string, query?: FinanceReportQuery) =>
    http.get<FinanceRevenueReport>(`${path(businessId)}/revenue`, { query }),

  /** `GET /businesses/{businessId}/finance/collections` */
  collections: (businessId: string, query?: FinanceReportQuery) =>
    http.get<FinanceCollectionReport>(`${path(businessId)}/collections`, { query }),

  /** `GET /businesses/{businessId}/finance/refunds` */
  refunds: (businessId: string, query?: FinanceReportQuery) =>
    http.get<FinanceRefundReport>(`${path(businessId)}/refunds`, { query }),

  /** `GET /businesses/{businessId}/finance/expenses` */
  expenses: (businessId: string, query?: FinanceReportQuery) =>
    http.get<FinanceExpenseReport>(`${path(businessId)}/expenses`, { query }),

  /**
   * `GET /businesses/{businessId}/finance/outstanding`
   *
   * Pagination `meta` is documented inside `data`, but the standard list
   * envelope can also place it beside `data`. The envelope-aware GET plus
   * the merge below tolerate both.
   */
  outstanding: async (
    businessId: string,
    query?: FinanceOutstandingQuery,
  ): Promise<FinanceOutstandingReport> => {
    const envelope = await http.getEnvelope<FinanceOutstandingReport>(
      `${path(businessId)}/outstanding`,
      { query },
    )

    const data =
      (envelope?.data as FinanceOutstandingReport | undefined) ??
      (envelope as unknown as FinanceOutstandingReport)

    return {
      ...(data ?? {}),
      meta: data?.meta ?? envelope?.meta ?? null,
    } as FinanceOutstandingReport
  },
}