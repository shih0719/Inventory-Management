import type { Product } from '../types';

const CSV_HEADERS = [
  'sku',
  'name',
  'type',
  'model',
  'accountable_quantity',
  'non_accountable_quantity',
  'min_stock',
];

// CSV 值转义
function escapeCSV(value: unknown): string {
  const s = String(value == null ? '' : value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// 构建 CSV 文本
export function buildCSV(products: Product[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const p of products) {
    lines.push(CSV_HEADERS.map(h => escapeCSV(p[h as keyof Product])).join(','));
  }
  return lines.join('\n');
}

// 解析 CSV 文本
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // 移除 BOM
  text = String(text || '').replace(/^﻿/, '');
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.length > 0);

  if (rawLines.length === 0) {
    return { headers: [], rows: [] };
  }

  // 解析单行 CSV
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

  const headers = parseRow(rawLines[0]).map(h => h.trim());
  const rows = rawLines.slice(1).map(l => {
    const cells = parseRow(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] !== undefined ? cells[i] : '';
    });
    return obj;
  });

  return { headers, rows };
}

// 下载 Blob 文件
export function downloadBlob(text: string, filename: string, mime: string = 'text/csv;charset=utf-8'): void {
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

// 生成 CSV 文件名
export function generateCSVFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `inventory-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
}

// 导出产品为 CSV
export function exportProductsAsCSV(products: Product[]): void {
  const csv = buildCSV(products);
  downloadBlob(csv, generateCSVFilename());
}
