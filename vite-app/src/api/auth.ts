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
  created_at: string;
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
