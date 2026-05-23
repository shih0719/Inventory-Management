// src/components/Dashboard.tsx
import { useMemo } from 'react';
import type { Product, Transaction } from '../types';
import { L, tagLabel, type Lang } from '../lib/i18n';
import { fmtTime, isToday } from '../lib/format';

export interface DashboardProps {
  products: Product[];
  transactions: Transaction[];
  lang: Lang;
  onAdjustProduct: (p: Product) => void;
  onManageAPProduct?: (p: Product) => void;
}

export function Dashboard({ products, transactions, lang, onAdjustProduct, onManageAPProduct }: DashboardProps) {
  const t = L[lang];

  const lowItems = useMemo(
    () =>
      products
        .filter((p) => p.accountable_quantity < p.min_stock)
        .sort((a, b) => a.accountable_quantity - b.accountable_quantity),
    [products],
  );

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const apProducts = products.filter((p) => p.type === 'ap').length;
    const lowStockCount = lowItems.length;
    const todayTx = transactions.filter((tx) => isToday(tx.created_at)).length;
    const inToday = transactions
      .filter((tx) => isToday(tx.created_at) && tx.quantity_change > 0)
      .reduce((s, tx) => s + tx.quantity_change, 0);
    const outToday = transactions
      .filter((tx) => isToday(tx.created_at) && tx.quantity_change < 0)
      .reduce((s, tx) => s - tx.quantity_change, 0);
    const apInStock = products
      .filter((p) => p.type === 'ap')
      .reduce((s, p) => s + (p.ap_in_stock_count || 0), 0);
    return { totalProducts, apProducts, lowStockCount, todayTx, inToday, outToday, apInStock };
  }, [products, transactions, lowItems]);

  return (
    <div className="dash">
      <div className="kpis">
        <div className="card kpi">
          <span className="lbl">{t.kProducts}</span>
          <div className="v">{stats.totalProducts}</div>
          <div className="delta">
            {stats.apProducts > 0 && (
              <span>
                {t.apOf} × {stats.apProducts}
              </span>
            )}
          </div>
        </div>

        <div className={'card kpi' + (stats.lowStockCount > 0 ? ' alert' : '')}>
          <span
            className="lbl"
            style={stats.lowStockCount > 0 ? { color: 'var(--accent)' } : undefined}
          >
            {t.kLowStock}
          </span>
          <div className={'v' + (stats.lowStockCount > 0 ? ' alert' : '')}>{stats.lowStockCount}</div>
          <div className="delta">
            {lang === 'en'
              ? `${lowItems.filter((p) => p.accountable_quantity === 0).length} out · ${lowItems.filter((p) => p.accountable_quantity > 0).length} low`
              : `${lowItems.filter((p) => p.accountable_quantity === 0).length} 缺 · ${lowItems.filter((p) => p.accountable_quantity > 0).length} 低`}
          </div>
        </div>

        <div className="card kpi">
          <span className="lbl">{t.kToday}</span>
          <div className="v">{stats.todayTx}</div>
          <div className="delta">
            <span className="arrow-up">
              {stats.inToday} {t.units}
            </span>
            {' · '}
            <span className="arrow-down">
              {stats.outToday} {t.units}
            </span>
          </div>
        </div>

        <div className="card kpi">
          <span className="lbl">{t.kApStock}</span>
          <div className="v">{stats.apInStock}</div>
          <div className="delta">
            {lang === 'en' ? `across ${stats.apProducts} products` : `共 ${stats.apProducts} 項`}
          </div>
        </div>
      </div>

      <div className="cols">
        {/* LOW STOCK */}
        <div className="card panel">
          <h3>
            <span>{t.lowStockTitle}</span>
            <span className={'pill ' + (lowItems.length > 0 ? 'alert' : 'ok')}>{lowItems.length}</span>
          </h3>
          <div className="lbl" style={{ marginBottom: 6 }}>
            {t.lowStockHint}
          </div>
          <div className="rows">
            {lowItems.length === 0 && (
              <div style={{ padding: '24px 8px', color: 'var(--ink-3)', fontSize: 12, textAlign: 'center' }}>
                {lang === 'en' ? 'All stocked — nothing below threshold.' : '全數正常 — 無低於警戒線。'}
              </div>
            )}
            {lowItems.map((p) => (
              <div
                key={p.id}
                className="low-row"
                onClick={() => (p.type === 'ap' && onManageAPProduct ? onManageAPProduct(p) : onAdjustProduct(p))}
              >
                <div className="low-row-main">
                  <div className="low-row-head">
                    <span className="sku">{p.sku}</span>
                    {p.type === 'ap' && (
                      <span className="pill" style={{ fontSize: 9, padding: '0 5px', marginLeft: 6 }}>
                        AP
                      </span>
                    )}
                  </div>
                  <div className="low-row-name">{p.name}</div>
                  <div className="low-row-model">{p.model}</div>
                </div>
                <div className="low-row-qty">
                  <div className="qty-pair">
                    <span className="qty-pair-lbl">{t.acctShort}</span>
                    <span className={'qty-pair-v' + (p.accountable_quantity === 0 ? ' alert' : '')}>
                      {p.accountable_quantity}
                    </span>
                  </div>
                  <div className="qty-pair secondary">
                    <span className="qty-pair-lbl">{t.nonAcctShort}</span>
                    <span className="qty-pair-v">{p.non_accountable_quantity}</span>
                  </div>
                  <div className="qty-pair secondary">
                    <span className="qty-pair-lbl">{t.min}</span>
                    <span className="qty-pair-v">{p.min_stock}</span>
                  </div>
                </div>
                <span className={'pill ' + (p.accountable_quantity === 0 ? 'alert' : '')}>
                  {p.accountable_quantity === 0 ? t.out : t.low}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div className="card panel">
          <h3>
            <span>{t.recentTitle}</span>
            <span className="pill">{transactions.length}</span>
          </h3>
          <div className="lbl" style={{ marginBottom: 6 }}>
            {t.recentHint}
          </div>
          <div className="rows">
            {transactions.slice(0, 14).map((tx) => {
              const isIn = tx.quantity_change > 0;
              const prod = products.find((p) => p.sku === tx.sku || p.id === tx.product_id);
              return (
                <div key={tx.id} className="tx-row">
                  <span className={'dot ' + (isIn ? 'in' : 'out')} />
                  <div className="tx-main">
                    <div className="tx-head">
                      <span className="sku">{tx.sku}</span>
                      <span className="pill" style={{ fontSize: 9, padding: '0 5px' }}>
                        {tagLabel(tx.tag_name, lang)}
                      </span>
                      {tx.quantity_type === 'non_accountable' && (
                        <span className="pill" style={{ fontSize: 9, padding: '0 5px' }}>
                          {t.nonAcctShort}
                        </span>
                      )}
                      {tx.location_tag && <span className="loc-pill">{tx.location_tag}</span>}
                    </div>
                    <div className="tx-name">{prod ? prod.name : tx.sku}</div>
                    {tx.remarks && <div className="tx-remarks">{tx.remarks}</div>}
                  </div>
                  <div className="tx-qty">
                    <span className={'tx-q-v ' + (isIn ? 'in' : 'out')}>
                      {isIn ? '+' : ''}
                      {tx.quantity_change}
                    </span>
                    <span className="tx-q-t">{fmtTime(tx.created_at, lang)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
