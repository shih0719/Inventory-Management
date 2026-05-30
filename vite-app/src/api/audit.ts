// src/api/audit.ts
import { api } from './client';
import type { Pagination } from '../types';

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  resource_type: string;
  resource_id: number;
  warehouse_id?: number;
  event_category: 'system' | 'transaction';
  metadata?: string;
  ip_address?: string;
  timestamp: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  pagination: Pagination;
}

export async function listAuditLogs(
  resourceType?: string,
  resourceId?: number,
  userId?: number,
  limit: number = 50,
  offset: number = 0,
  eventCategory?: 'system' | 'transaction'
): Promise<AuditLogsResponse> {
  const { data, pagination } = await api.get<AuditLog[]>('/api/audit-logs', {
    resource_type: resourceType,
    resource_id: resourceId,
    user_id: userId,
    event_category: eventCategory,
    limit,
    offset,
  });

  return { data, pagination: pagination || { total: 0, page: 1, limit, totalPages: 0 } };
}
