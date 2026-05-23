import { apiClient } from './client';
import type { Tag } from '../types';

export const tagsAPI = {
  // 获取所有标签
  async list(): Promise<Tag[]> {
    try {
      const response = await apiClient.get<{ data: Tag[] }>('/api/tags');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      return [];
    }
  },

  // 获取单个标签
  async get(id: number): Promise<Tag | null> {
    try {
      return await apiClient.get<Tag>(`/api/tags/${id}`);
    } catch (error) {
      console.error(`Failed to fetch tag ${id}:`, error);
      return null;
    }
  },
};
