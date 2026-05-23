import { apiClient } from './client';
import type { BatchItem, Transaction } from '../types';

export interface CreateBatchPayload {
  name?: string;
  kind: 'inbound' | 'outbound';
  items: BatchItem[];
  tag_id: number;
  location_tag?: string;
}

export interface BatchResponse {
  id: number;
  name?: string;
  created_at: string;
  transactions: Transaction[];
}

export const batchesAPI = {
  // 创建批次
  async create(payload: CreateBatchPayload): Promise<BatchResponse | null> {
    try {
      return await apiClient.post<BatchResponse>('/api/batches', payload);
    } catch (error) {
      console.error('Failed to create batch:', error);
      return null;
    }
  },

  // 获取所有批次
  async list(): Promise<BatchResponse[]> {
    try {
      const response = await apiClient.get<{ data: BatchResponse[] }>('/api/batches');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      return [];
    }
  },

  // 获取单个批次
  async get(id: number): Promise<BatchResponse | null> {
    try {
      return await apiClient.get<BatchResponse>(`/api/batches/${id}`);
    } catch (error) {
      console.error(`Failed to fetch batch ${id}:`, error);
      return null;
    }
  },
};
