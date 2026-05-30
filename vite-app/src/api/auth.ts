// src/api/auth.ts
import { api } from './client';
import { setToken, clearToken } from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'manager' | 'view';
  created_at: string;
  provider: 'local' | 'microsoft';
  warehouses: number[];
}

export async function getProvider(): Promise<'local' | 'microsoft'> {
  const res = await fetch('/api/auth/provider');
  const data = await res.json();
  return data.provider;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  };
}

export async function login(req: LoginRequest): Promise<User> {
  const { data } = await api.post<{
    token: string;
    user: User;
  }>('/api/auth/login', req);
  setToken(data.token);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await api.post<{ message: string }>('/api/auth/logout');
  } finally {
    clearToken();
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/api/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/api/auth/me');
  return data;
}
