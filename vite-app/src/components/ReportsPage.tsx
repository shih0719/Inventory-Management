import { useEffect, useState } from 'react';
import { getInventoryReport, type InventoryProduct, type InventoryReportData } from '../api/reports';
import type { Lang } from '../lib/i18n';

interface ReportsPageProps {
  lang: Lang;
  onBack: () => void;
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

export function ReportsPage({ lang, onBack }: ReportsPageProps) {
  const [report, setReport] = useState<InventoryReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = texts[lang];

  useEffect(() => {
    getInventoryReport()
      .then(setReport)
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [t.error]);

  const totalQty = (p: InventoryProduct) => p.accountable_quantity + p.non_accountable_quantity;
  const isLow = (p: InventoryProduct) => p.min_stock > 0 && totalQty(p) < p.min_stock;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn ghost" onClick={onBack}>{t.back}</button>
        <h1 style={{ margin: 0, flex: 1 }}>{t.title}</h1>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-2)' }}>{t.loading}</div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ flex: 1, textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)' }}>{report.summary.total}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{t.total}</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: 'center', padding: '20px 16px', borderColor: report.summary.low_stock_count > 0 ? '#fca5a5' : undefined }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: report.summary.low_stock_count > 0 ? '#ef4444' : 'var(--ok)' }}>
                {report.summary.low_stock_count}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{t.lowStock}</div>
            </div>
          </div>

          {/* Low stock alert */}
          {report.summary.low_stock_count > 0 ? (
            <div style={{ marginBottom: 24, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>⚠ {t.lowStockAlert}</div>
              {report.summary.low_stock_items.map(p => (
                <div key={p.sku} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '4px 0', color: '#7f1d1d' }}>
                  <span style={{ fontWeight: 600, minWidth: 100 }}>{p.sku}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span>{totalQty(p)} / {p.min_stock}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: 24, padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#15803d' }}>
              ✓ {t.allNormal}
            </div>
          )}

          {/* Product table */}
          {report.products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-2)' }}>{t.noProducts}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {[t.sku, t.name, t.type, t.accountable, t.nonAccountable, t.minStock].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.products.map(p => (
                    <tr key={p.sku} style={{ borderBottom: '1px solid var(--border)', background: isLow(p) ? '#fff5f5' : undefined }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ok)' }}>{p.sku}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{p.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-2)' }}>{p.type}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right' }}>{p.accountable_quantity}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right' }}>{p.non_accountable_quantity}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, textAlign: 'right', color: isLow(p) ? '#ef4444' : 'var(--ink-2)' }}>
                        {p.min_stock > 0 ? p.min_stock : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
