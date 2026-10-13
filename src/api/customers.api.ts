// src/api/customers.api.ts

import { http } from './http'
import type {
  Customer,
  CustomerPhone,
  CustomerStatus,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Input types                                                        */
/* ------------------------------------------------------------------ */

export interface CreateCustomerInput {
  firstName: string
  lastName: string
  phones?: { phone: string; isPrimary?: boolean }[]
}

export interface UpdateCustomerInput {
  firstName?: string
  lastName?: string
}

export interface ListCustomersQuery {
  /** Free-text search across name / phone. */
  q?: string
  /** Exact phone lookup (server normalizes to E.164). */
  phone?: string
  status?: CustomerStatus
  page?: number
  limit?: number
}

export interface MatchCustomerResult {
  matched: boolean
  customer: Customer | null
}

export interface CreateCustomerPhoneInput {
  phone: string
  isPrimary?: boolean
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

export const customersApi = {
  /* ---------------------------------------------------------------- */
  /*  §3.1 Match by phone (search only — never creates)               */
  /* ---------------------------------------------------------------- */

  match: (businessId: string, phone: string) =>
    http.post<MatchCustomerResult>(
      `/businesses/${businessId}/customers/match`,
      { phone },
    ),

  /* ---------------------------------------------------------------- */
  /*  §3.2 Create                                                     */
  /* ---------------------------------------------------------------- */

  create: (businessId: string, input: CreateCustomerInput) =>
    http.post<Customer>(`/businesses/${businessId}/customers`, input),

  /* ---------------------------------------------------------------- */
  /*  §3.3 List / get / update / archive                              */
  /* ---------------------------------------------------------------- */

  list: (businessId: string, query?: ListCustomersQuery) => {
    const qs = new URLSearchParams()
    if (query?.q)                     qs.set('q', query.q)
    if (query?.phone)                 qs.set('phone', query.phone)
    if (query?.status)                qs.set('status', query.status)
    if (query?.page  != null)         qs.set('page',  String(query.page))
    if (query?.limit != null)         qs.set('limit', String(query.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return http.get<Customer[]>(
      `/businesses/${businessId}/customers${suffix}`,
    )
  },

  /**
   * §3.3 — GET /customers/:customerId
   * Note: this route does NOT take a businessId in the path. The server
   * resolves the business from the customer record itself. Auth-only.
   */
  get: (customerId: string) =>
    http.get<Customer>(`/customers/${customerId}`),

  /**
   * §3.3 — PATCH /customers/:customerId
   * Body accepts firstName and/or lastName. The route is not
   * business-scoped; server resolves membership from the record.
   */
  update: (customerId: string, patch: UpdateCustomerInput) =>
    http.patch<Customer>(`/customers/${customerId}`, patch),

  /**
   * §3.3 — Soft-archive. Sets status → ARCHIVED; archived customers
   * can't book. No body.
   */
  archive: (customerId: string) =>
    http.patch<Customer>(`/customers/${customerId}/archive`),

  /* ---------------------------------------------------------------- */
  /*  §3.4 Phone management                                           */
  /* ---------------------------------------------------------------- */

  phones: {
    /**
     * §3.4 — POST /customers/:customerId/phones
     * `isPrimary` defaults to false server-side. Setting it to true
     * demotes any existing primary (only one per customer).
     */
    add: (customerId: string, input: CreateCustomerPhoneInput) =>
      http.post<CustomerPhone>(
        `/customers/${customerId}/phones`,
        input,
      ),

    remove: (customerId: string, phoneId: string) =>
      http.delete<void>(
        `/customers/${customerId}/phones/${phoneId}`,
      ),

    /**
     * §3.4 — Switches the primary flag. No body.
     */
    setPrimary: (customerId: string, phoneId: string) =>
      http.patch<CustomerPhone>(
        `/customers/${customerId}/phones/${phoneId}/primary`,
      ),
  },
}

export default customersApi