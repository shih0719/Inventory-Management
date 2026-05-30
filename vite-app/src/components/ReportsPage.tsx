import { useEffect, useState } from 'react';
import { getInventoryReport, type InventoryProduct, type InventoryReportData } from '../api/reports';
import type { Lang } from '../lib/i18n';

interface ReportsPageProps {
  lang: Lang;
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

export function ReportsPage({ lang }: ReportsPageProps) {
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
    <div className="locations-page">
      <div className="flow-head">
        <h2 style={{ margin: 0, flex: 1 }}>{t.title}</h2>
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
                      {[t.sku, t.name, t.type, t.accountable, t.nonAccountable, t.minStock].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.products.map(p => (
                      <tr key={p.sku} style={isLow(p) ? { background: 'var(--accent-soft)' } : undefined}>
                        <td className="sku">{p.sku}</td>
                        <td>{p.name}</td>
                        <td style={{ color: 'var(--ink-2)' }}>{p.type}</td>
                        <td className="num">{p.accountable_quantity}</td>
                        <td className="num">{p.non_accountable_quantity}</td>
                        <td className={'num' + (isLow(p) ? ' alert' : '')} style={{ color: isLow(p) ? 'var(--accent)' : 'var(--ink-2)' }}>
                          {p.min_stock > 0 ? p.min_stock : '—'}
                        </td>
                      </tr>
                    ))}
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
