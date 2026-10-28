// src/api/csv.ts — server-side CSV operations.

import { ApiError, fetchWithAuth, localizeErrors } from './client';
import type { ServerError } from '../lib/i18n';

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** A per-row error or warning; `row` is the data row number, or "Header". */
export interface CsvErrorDetail extends ServerError {
  row: string | number;
}

export interface CsvImportResult {
  success: boolean;
  imported: number;
  updated?: number;
  import_id?: number;
  message?: string;
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
    // Like api/client.ts: the message and each row error in the UI language.
    const message = localizeErrors(json) || (json && json.error) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), json);
  }

  // Return response even if success is false (partial import)
  return json as CsvImportResult;
}

/** GET /api/csv/export — downloads CSV with authentication.
 *  Optional `skus` provides an explicit ordering (comma-joined) so the export
 *  follows the user's manual row order. */
export async function exportProductsCsv(opts: { filename?: string; skus?: string[] } = {}): Promise<void> {
  const { filename = 'inventory-export.csv', skus } = opts;
  const query = skus && skus.length > 0 ? `?skus=${encodeURIComponent(skus.join(','))}` : '';
  const res = await fetchWithAuth(`${BASE}/api/csv/export${query}`);
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
