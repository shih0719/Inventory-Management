import { apiClient } from './client';
import type { Transaction } from '../types';

export interface CreateTransactionPayload {
  product_id: number;
  sku: string;
  quantity_change: number;
  quantity_type: 'accountable' | 'non_accountable';
  tag_id: number;
  location_tag?: string;
  remarks?: string;
}

export const transactionsAPI = {
  // 获取所有异动
  async list(limit?: number): Promise<Transaction[]> {
    try {
      const response = await apiClient.get<{ data: Transaction[] }>('/api/transactions', {
        params: limit ? { limit } : undefined,
      });
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  },

  // 创建异动（单笔）
  async create(payload: CreateTransactionPayload): Promise<Transaction | null> {
    try {
      return await apiClient.post<Transaction>('/api/transactions', payload);
    } catch (error) {
      console.error('Failed to create transaction:', error);
      return null;
    }
  },

  // 获取今日异动
  async getToday(): Promise<Transaction[]> {
    try {
      const response = await apiClient.get<{ data: Transaction[] }>('/api/transactions/today');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch today transactions:', error);
      return [];
    }
  },
};
