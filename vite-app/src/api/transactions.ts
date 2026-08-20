// src/api/transactions.ts
import { api, fetchWithAuth } from './client';
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
  sort?: 'created_at' | 'quantity_change' | 'sku' | 'product_name' | 'tag_name' | 'quantity_type' | 'created_by_user';
  order?: 'asc' | 'desc';
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

/** Download the current filtered transaction history as a CSV file. */
export async function exportTransactionsCsv(
  params: Omit<ListTransactionsParams, 'page' | 'limit'> = {},
): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.append(k, String(v));
  }
  const query = qs.toString();
  const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const url = `${BASE}/api/transactions/export${query ? `?${query}` : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    const message = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(objUrl);
    a.remove();
  }, 100);
}
