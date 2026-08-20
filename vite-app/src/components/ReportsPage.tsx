import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getInventoryReport, type InventoryProduct, type InventoryReportData } from '../api/reports';
import type { Lang } from '../lib/i18n';

interface ReportsPageProps {
  lang: Lang;
  canWrite: boolean;
  onImportClick: () => void;
  onExport: (skus?: string[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const texts = {
  en: {
    title: 'Inventory Report',
    total: 'Total Products',
    lowStock: 'Low Stock',
    sku: 'SKU',
    name: 'Name',
    type: 'Type',
    accountable: 'Accountable',
    nonAccountable: 'Non-Accountable',
    minStock: 'Min Stock',
    noProducts: 'No products in this warehouse',
    loading: 'Loading...',
    error: 'Failed to load report',
    back: '← Back',
    lowStockAlert: 'Low Stock Alert',
    allNormal: 'All stock levels are normal',
  },
  zh: {
    title: '庫存報表',
    total: '產品總數',
    lowStock: '低庫存',
    sku: 'SKU',
    name: '名稱',
    type: '類型',
    accountable: '有帳數量',
    nonAccountable: '無帳數量',
    minStock: '最低庫存',
    noProducts: '此倉庫尚無產品',
    loading: '載入中...',
    error: '無法載入報表',
    back: '← 返回',
    lowStockAlert: '低庫存警示',
    allNormal: '所有庫存水位正常',
  },
  ja: {
    title: '在庫レポート',
    total: '総製品数',
    lowStock: '在庫不足',
    sku: 'SKU',
    name: '名前',
    type: 'タイプ',
    accountable: '有帳数量',
    nonAccountable: '無帳数量',
    minStock: '最低在庫',
    noProducts: 'この倉庫に製品はありません',
    loading: '読み込み中...',
    error: 'レポートを読み込めません',
    back: '← 戻る',
    lowStockAlert: '在庫不足アラート',
    allNormal: 'すべての在庫は正常です',
  },
};

export function ReportsPage({ lang, canWrite, onImportClick, onExport, fileInputRef, onImportFile }: ReportsPageProps) {
  const [report, setReport] = useState<InventoryReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const t = texts[lang];

  const storageKey = useMemo(() => {
    let wh = 'default';
    try { wh = localStorage.getItem('inv.warehouseId') || 'default'; } catch { /* ignore */ }
    return `inv.reportOrder.${wh}`;
  }, []);

  const loadSavedOrder = useCallback((): string[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const saveOrder = useCallback((skus: string[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(skus)); } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    getInventoryReport()
      .then((rep) => {
        setReport(rep);
        // Initialize order from saved preference if present; otherwise use server order.
        const saved = loadSavedOrder();
        const serverSkus = rep.products.map((p) => p.sku);
        const merged = saved.length > 0
          ? [...saved.filter((s) => serverSkus.includes(s)), ...serverSkus.filter((s) => !saved.includes(s))]
          : serverSkus;
        setOrder(merged);
      })
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [t.error, loadSavedOrder]);

  // Products ordered by the user's saved preference.
  const orderedProducts = useMemo(() => {
    if (!report) return [];
    const bySku = new Map(report.products.map((p) => [p.sku, p]));
    const ordered = order.map((sku) => bySku.get(sku)).filter((p): p is InventoryProduct => !!p);
    // Append any products missing from the saved order (e.g. newly imported).
    const seen = new Set(order);
    for (const p of report.products) if (!seen.has(p.sku)) ordered.push(p);
    return ordered;
  }, [report, order]);

  // Move the item currently at `from` to the position of `to` (drag & drop).
  const reorder = useCallback((from: number, to: number) => {
    setOrder((prev) => {
      if (from === to || from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveOrder(next);
      return next;
    });
  }, [saveOrder]);

  const totalQty = (p: InventoryProduct) => p.accountable_quantity + p.non_accountable_quantity;
  const isLow = (p: InventoryProduct) => p.min_stock > 0 && totalQty(p) < p.min_stock;

  return (
    <div className="locations-page">
      <div className="flow-head">
        <h2 style={{ margin: 0, flex: 1 }}>{t.title}</h2>
        {canWrite && (
          <button className="btn ghost" onClick={onImportClick} title={t.importCsv ?? 'Import CSV'}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>⤴</span>
            <span>CSV</span>
          </button>
        )}
        <button className="btn ghost" onClick={() => onExport(orderedProducts.map((p) => p.sku))} title={t.exportCsv ?? 'Export CSV'}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>⤵</span>
          <span>CSV</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={onImportFile}
        />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-2)', fontSize: 13 }}>{t.loading}</div>
      )}

      {error && (
        <div className="card alert" style={{ fontSize: 13 }}>{error}</div>
      )}

      {report && (
        <>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="card kpi">
              <span className="lbl">{t.total}</span>
              <div className="v">{report.summary.total}</div>
            </div>
            <div className={'card kpi' + (report.summary.low_stock_count > 0 ? ' alert' : '')}>
              <span className="lbl" style={report.summary.low_stock_count > 0 ? { color: 'var(--accent)' } : undefined}>
                {t.lowStock}
              </span>
              <div className={'v' + (report.summary.low_stock_count > 0 ? ' alert' : '')}>
                {report.summary.low_stock_count}
              </div>
            </div>
          </div>

          {report.summary.low_stock_count > 0 ? (
            <div className="card alert" style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠ {t.lowStockAlert}</div>
              {report.summary.low_stock_items.map(p => (
                <div key={p.sku} style={{ display: 'flex', gap: 12, padding: '4px 0' }}>
                  <span className="sku" style={{ minWidth: 100 }}>{p.sku}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span>{totalQty(p)} / {p.min_stock}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ fontSize: 13, color: 'var(--ok)', borderColor: 'var(--ok)', background: 'var(--ok-soft)' }}>
              ✓ {t.allNormal}
            </div>
          )}

          {report.products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 12 }}>{t.noProducts}</div>
          ) : (
            <div className="card panel" style={{ flex: 1, minHeight: 0, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', flex: 1 }}>
                <table className="picker-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      {canWrite && <th style={{ width: 64 }}></th>}
                      {[t.sku, t.name, t.type, t.accountable, t.nonAccountable, t.minStock].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orderedProducts.map((p, idx) => {
                      const isDragging = dragIndex === idx;
                      const isOver = dragOverIndex === idx;
                      const rowStyle = isLow(p)
                        ? { background: 'var(--accent-soft)', opacity: isDragging ? 0.5 : undefined }
                        : isDragging
                        ? { background: 'var(--surface-2)', opacity: 0.5 }
                        : isOver
                        ? { background: 'var(--border-2)' }
                        : undefined;
                      return (
                      <tr
                        key={p.sku}
                        draggable={canWrite}
                        onDragStart={(e) => { setDragIndex(idx); setDragOverIndex(null); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(idx); }}
                        onDragLeave={() => { if (dragOverIndex === idx) setDragOverIndex(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) reorder(dragIndex, idx);
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                        style={rowStyle}
                      >
                        {canWrite && (
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'center', cursor: 'grab' }} title={lang === 'en' ? 'Drag to reorder' : '拖曳調整順序'}>
                            <span style={{ color: 'var(--ink-3)', fontSize: 16 }}>⠿</span>
                          </td>
                        )}
                        <td className="sku">{p.sku}</td>
                        <td>{p.name}</td>
                        <td style={{ color: 'var(--ink-2)' }}>{p.type}</td>
                        <td className="num">{p.accountable_quantity}</td>
                        <td className="num">{p.non_accountable_quantity}</td>
                        <td className={'num' + (isLow(p) ? ' alert' : '')} style={{ color: isLow(p) ? 'var(--accent)' : 'var(--ink-2)' }}>
                          {p.min_stock > 0 ? p.min_stock : '—'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
