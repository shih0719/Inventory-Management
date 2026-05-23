import { apiClient } from './client';
import type { Location } from '../types';

export const locationsAPI = {
  // 获取所有位置
  async list(): Promise<Location[]> {
    try {
      const response = await apiClient.get<{ data: Location[] }>('/api/locations');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      return [];
    }
  },

  // 获取单个位置
  async get(id: number): Promise<Location | null> {
    try {
      return await apiClient.get<Location>(`/api/locations/${id}`);
    } catch (error) {
      console.error(`Failed to fetch location ${id}:`, error);
      return null;
    }
  },
};
