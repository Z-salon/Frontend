import { http } from './http';
import type {
  CreateExpenseCategoryRequest,
  ExpenseCategory,
  UpdateExpenseCategoryRequest,
} from '../types/api';

export type ExpenseCategoryListQuery = {
  /**
   * The endpoint answers with active categories only. Inactive rows are never
   * reachable by filtering a page the client already has, so "show inactive"
   * has to re-request with `?includeInactive=true`.
   */
  includeInactive?: boolean;
};

/**
 * `GET/POST /businesses/{businessId}/expense-categories`
 * `PATCH    /businesses/{businessId}/expense-categories/{categoryId}`
 *
 * The id is minted by the server — never build one client-side.
 * There is no DELETE endpoint: activate/deactivate via PATCH.
 */
export const expenseCategoriesApi = {
  list: (businessId: string, query?: ExpenseCategoryListQuery) =>
    http.get<ExpenseCategory[]>(
      `/businesses/${businessId}/expense-categories`,
      { query },
    ),

  create: (businessId: string, input: CreateExpenseCategoryRequest) =>
    http.post<ExpenseCategory>(
      `/businesses/${businessId}/expense-categories`,
      input,
    ),

  update: (
    businessId: string,
    id: string,
    patch: UpdateExpenseCategoryRequest,
  ) =>
    http.patch<ExpenseCategory>(
      `/businesses/${businessId}/expense-categories/${id}`,
      patch,
    ),
};

export default expenseCategoriesApi;