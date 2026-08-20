// src/api/csv.ts — server-side CSV operations.

import { ApiError, fetchWithAuth } from './client';

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
