// src/api/transactions.ts
import { api } from './client';
import type { CreateTransactionInput, Transaction } from '../types';

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  quantity_type?: 'accountable' | 'non_accountable' | string;
  direction?: 'in' | 'out';
  sku?: string;
  tag_id?: number;
  product_id?: number;
  batch_id?: number;
  created_by_user?: string;
  [key: string]: string | number | boolean | undefined;
}

export async function listTransactions(params: ListTransactionsParams = {}) {
  return api.get<Transaction[]>('/api/transactions', {
    limit: 50,
    ...params,
  });
}

export async function getTransaction(id: number): Promise<Transaction> {
  const res = await api.get<Transaction>(`/api/transactions/${id}`);
  return res.data;
}

/**
 * Create a single transaction.
 *   Inbound:  quantity_change > 0
 *   Outbound: quantity_change < 0
 * Backend validates accountable stock cannot go negative.
 */
export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await api.post<Transaction>('/api/transactions', input);
  return res.data;
}
