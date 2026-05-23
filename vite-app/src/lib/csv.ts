// src/lib/csv.ts — pure client-side CSV utilities (parse, build, download).
// The expected header order matches the backend's /api/csv/* endpoints.

import type { Product } from '../types';

export const CSV_HEADERS = [
  'sku',
  'name',
  'type',
  'model',
  'accountable_quantity',
  'non_accountable_quantity',
  'min_stock',
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

export function buildCSV(products: Product[]): string {
  const esc = (v: unknown) => {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [CSV_HEADERS.join(',')];
  for (const p of products) {
    lines.push(CSV_HEADERS.map((h) => esc((p as any)[h])).join(','));
  }
  return lines.join('\n');
}

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function parseCSV(text: string): ParsedCsv {
  // Strip BOM
  text = String(text || '').replace(/^\uFEFF/, '');
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
  if (rawLines.length === 0) return { headers: [], rows: [] };

  const parseRow = (s: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"' && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else {
        if (c === ',') {
          out.push(cur);
          cur = '';
        } else if (c === '"') {
          inQ = true;
        } else {
          cur += c;
        }
      }
    }
    out.push(cur);
    return out;
  };

  const headers = parseRow(rawLines[0]).map((h) => h.trim());
  const rows = rawLines.slice(1).map((l) => {
    const cells = parseRow(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] !== undefined ? cells[i] : '';
    });
    return obj;
  });
  return { headers, rows };
}

export function downloadBlob(text: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

export function csvFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `inventory-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
}
