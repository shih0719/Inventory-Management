// src/api/users.ts
import { api } from './client';

export interface WarehouseUser {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'view';
  provider: 'local' | 'microsoft';
  email: string | null;
  warehouses: number[];
  created_at: string;
}

export async function listUsers(): Promise<WarehouseUser[]> {
  const res = await api.get<WarehouseUser[]>('/api/users');
  return res.data;
}

export async function createUser(
  username: string,
  password: string,
  role: string,
  warehouse_ids: number[],
): Promise<WarehouseUser> {
  const res = await api.post<WarehouseUser>('/api/users', { username, password, role, warehouse_ids });
  return res.data;
}

export async function updateUser(
  id: number,
  role: string,
  warehouse_ids: number[],
): Promise<WarehouseUser> {
  const res = await api.put<WarehouseUser>(`/api/users/${id}`, { role, warehouse_ids });
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.del(`/api/users/${id}`);
}
