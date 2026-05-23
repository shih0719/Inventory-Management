// src/api/products.ts
import { api } from './client';
import type { Product } from '../types';

export interface ListProductsParams {
  page?: number;
  limit?: number;
  sku?: string;
  name?: string;
  model?: string;
  tag?: number;
  low_stock?: boolean;
}

/** Fetch a single page of products. */
export async function listProducts(params: ListProductsParams = {}) {
  return api.get<Product[]>('/api/products', {
    limit: 100,
    ...params,
  });
}

/**
 * Fetch ALL products by walking pagination. The dashboard needs the full list
 * (low-stock filter, combobox, KPIs) — so we drain pages here on initial load.
 */
export async function listAllProducts(extra: Omit<ListProductsParams, 'page' | 'limit'> = {}): Promise<Product[]> {
  const limit = 100;
  let page = 1;
  const all: Product[] = [];
  // safety cap so a broken backend can't loop forever
  for (let i = 0; i < 50; i++) {
    const res = await listProducts({ ...extra, page, limit });
    all.push(...res.data);
    if (!res.pagination || page >= res.pagination.totalPages) break;
    page++;
  }
  return all;
}

export async function getProduct(id: number) {
  const res = await api.get<Product>(`/api/products/${id}`);
  return res.data;
}

export async function createProduct(input: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'ap_in_stock_count'>) {
  const res = await api.post<Product>('/api/products', input);
  return res.data;
}

export async function updateProduct(id: number, patch: Partial<Product>) {
  const res = await api.put<Product>(`/api/products/${id}`, patch);
  return res.data;
}

export async function deleteProduct(id: number) {
  await api.del(`/api/products/${id}`);
}
