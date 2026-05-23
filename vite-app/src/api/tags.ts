// src/api/tags.ts
import { api } from './client';
import type { Tag } from '../types';

export async function listTags(): Promise<Tag[]> {
  const res = await api.get<Tag[]>('/api/tags');
  return res.data;
}
