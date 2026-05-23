import { apiClient } from './client';
import type { Product } from '../types';

export const productsAPI = {
  // 获取所有产品
  async list(): Promise<Product[]> {
    try {
      const response = await apiClient.get<{ data: Product[] }>('/api/products');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return [];
    }
  },

  // 获取单个产品
  async get(id: number): Promise<Product | null> {
    try {
      return await apiClient.get<Product>(`/api/products/${id}`);
    } catch (error) {
      console.error(`Failed to fetch product ${id}:`, error);
      return null;
    }
  },

  // 创建产品
  async create(product: Omit<Product, 'id'>): Promise<Product | null> {
    try {
      return await apiClient.post<Product>('/api/products', product);
    } catch (error) {
      console.error('Failed to create product:', error);
      return null;
    }
  },

  // 更新产品
  async update(id: number, product: Partial<Product>): Promise<Product | null> {
    try {
      return await apiClient.put<Product>(`/api/products/${id}`, product);
    } catch (error) {
      console.error(`Failed to update product ${id}:`, error);
      return null;
    }
  },

  // 删除产品
  async delete(id: number): Promise<boolean> {
    try {
      await apiClient.delete(`/api/products/${id}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete product ${id}:`, error);
      return false;
    }
  },

  // 批量导入产品（从 CSV）
  async importCSV(file: File): Promise<{ added: number; updated: number } | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`Import failed: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('Failed to import products:', error);
      return null;
    }
  },

  // 导出产品为 CSV
  async exportCSV(): Promise<Blob | null> {
    try {
      const response = await fetch('/api/products/export');
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      return response.blob();
    } catch (error) {
      console.error('Failed to export products:', error);
      return null;
    }
  },
};
