// src/api/csv.ts — server-side CSV operations.
// (We also keep a pure client-side parser in src/lib/csv.ts for the
//  prototype's instant-feedback CSV preview; the server endpoints below are
//  the authoritative way to mutate inventory in bulk.)

import { ApiError, fetchWithAuth } from './client';
import type { Product } from '../types';

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface CsvImportResult {
  success: true;
  imported: number;
  message?: string;
}

/** POST /api/csv/import (multipart/form-data, field name "file"). */
export async function importProductsCsv(file: File): Promise<CsvImportResult> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetchWithAuth(`${BASE}/api/csv/import`, { method: 'POST', body: fd });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok || !json || json.success === false) {
    const message = (json && (json.error || json.details || json.message)) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), json);
  }
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

// Convenience type re-export for callers
export type { Product };
