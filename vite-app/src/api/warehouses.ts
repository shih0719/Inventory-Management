// src/api/warehouses.ts
import { api } from './client';

export interface Warehouse {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export async function listWarehouses(): Promise<Warehouse[]> {
  const res = await api.get<Warehouse[]>('/api/warehouses');
  return res.data;
}

export async function createWarehouse(name: string, description?: string): Promise<Warehouse> {
  const res = await api.post<Warehouse>('/api/warehouses', { name, description });
  return res.data;
}

export async function updateWarehouse(id: number, name: string, description?: string): Promise<Warehouse> {
  const res = await api.put<Warehouse>(`/api/warehouses/${id}`, { name, description });
  return res.data;
}

export async function deleteWarehouse(id: number): Promise<void> {
  await api.del(`/api/warehouses/${id}`);
}
