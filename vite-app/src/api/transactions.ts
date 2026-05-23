// src/api/transactions.ts
import { api } from './client';
import type { CreateTransactionInput, Transaction } from '../types';

export interface ListTransactionsParams {
  page?: number;
  limit?: number;
}

export async function listTransactions(params: ListTransactionsParams = {}) {
  return api.get<Transaction[]>('/api/transactions', {
    limit: 50,
    ...params,
  });
}

export async function listProductTransactions(productId: number, params: ListTransactionsParams = {}) {
  return api.get<Transaction[]>(`/api/transactions/product/${productId}`, params);
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
