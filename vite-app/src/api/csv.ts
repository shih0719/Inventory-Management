// src/api/csv.ts — server-side CSV operations.
// (We also keep a pure client-side parser in src/lib/csv.ts for the
//  prototype's instant-feedback CSV preview; the server endpoints below are
//  the authoritative way to mutate inventory in bulk.)

import { ApiError, fetchWithAuth } from './client';
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
  const res = await fetchWithAuth(`${BASE}/api/csv/import`, { method: 'POST', body: fd });
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

/** GET /api/csv/export — downloads CSV with authentication. */
export async function exportProductsCsv(filename = 'inventory-export.csv'): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/api/csv/export`);
  if (!res.ok) {
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    const message = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), json);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

/** GET /api/csv/template — downloads empty CSV scaffold with authentication. */
export async function downloadCsvTemplate(filename = 'inventory-template.csv'): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/api/csv/template`);
  if (!res.ok) {
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    const message = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), json);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
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
