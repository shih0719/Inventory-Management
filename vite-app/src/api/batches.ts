// src/api/batches.ts
import { api } from './client';
import type { Batch, CreateBatchInput, CreateBatchResult } from '../types';

export async function listBatches(params: { page?: number; limit?: number } = {}) {
  return api.get<Batch[]>('/api/batches', { limit: 20, ...params });
}

export async function getBatch(id: number): Promise<Batch> {
  const res = await api.get<Batch>(`/api/batches/${id}`);
  return res.data;
}

/**
 * Create a batch and execute all transactions atomically (mostly — the API
 * documents a partial-failure shape, see ApiError.body when status===400).
 */
export async function createBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
  const res = await api.post<CreateBatchResult>('/api/batches', input);
  return res.data;
}
