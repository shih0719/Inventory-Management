// src/api/csv.ts — server-side CSV operations.
// (We also keep a pure client-side parser in src/lib/csv.ts for the
//  prototype's instant-feedback CSV preview; the server endpoints below are
//  the authoritative way to mutate inventory in bulk.)

import { ApiError } from './client';
import type { Product } from '../types';

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface CsvErrorDetail {
  row: string | number;
  reason: string;
  message: string;
  details?: string;
}

export interface CsvImportResult {
  success: boolean;
  imported: number;
  updated?: number;
  import_id?: number;
  message?: string;
  reason?: string;
  encoding?: string;
  errors?: CsvErrorDetail[];
  warnings?: CsvErrorDetail[];
}

export interface CsvImportRecord {
  id: number;
  created_by_user: string;
  imported_count: number;
  updated_count: number;
  error_count: number;
  file_name: string;
  encoding: string;
  details: {
    total_rows: number;
    new_products: number;
    updated_products: number;
    errors: number;
    warnings: number;
  };
  created_at: string;
}

/** POST /api/csv/import (multipart/form-data, field name "file"). */
export async function importProductsCsv(file: File): Promise<CsvImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/api/csv/import`, { method: 'POST', body: fd });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }

  if (!res.ok) {
    const message = (json && (json.message || json.error || json.details)) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), json);
  }

  // Return response even if success is false (partial import)
  return json as CsvImportResult;
}

/** GET /api/csv/export — downloads CSV through the browser. */
export function exportProductsCsvUrl(): string {
  return `${BASE}/api/csv/export`;
}

/** GET /api/csv/template — empty CSV scaffold. */
export function csvTemplateUrl(): string {
  return `${BASE}/api/csv/template`;
}

/** GET /api/csv/imports — get CSV import history. */
export async function getImportHistory(limit = 50, offset = 0): Promise<{ success: boolean; data: CsvImportRecord[]; pagination: { total: number; offset: number; limit: number } }> {
  const res = await fetch(`${BASE}/api/csv/imports?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to fetch import history: ${res.statusText}`);
  return res.json();
}

/** GET /api/csv/imports/:importId — get single import details. */
export async function getImportDetail(importId: number): Promise<{ success: boolean; data: CsvImportRecord }> {
  const res = await fetch(`${BASE}/api/csv/imports/${importId}`);
  if (!res.ok) throw new Error(`Failed to fetch import detail: ${res.statusText}`);
  return res.json();
}

// Convenience type re-export for callers
export type { Product };
