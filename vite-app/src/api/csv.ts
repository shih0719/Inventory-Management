// src/api/csv.ts — server-side CSV operations.
// (We also keep a pure client-side parser in src/lib/csv.ts for the
//  prototype's instant-feedback CSV preview; the server endpoints below are
//  the authoritative way to mutate inventory in bulk.)

import { ApiError } from './client';
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
  const res = await fetch(`${BASE}/api/csv/import`, { method: 'POST', body: fd });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!res.ok || !json || json.success === false) {
    const message = (json && (json.error || json.details || json.message)) || `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, String(message), json);
  }
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

// Convenience type re-export for callers
export type { Product };
