import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { L, type Lang } from '../lib/i18n';
import { QuickSellModal } from './modals/QuickSellModal';

export interface APProductsPageProps {
  products: Product[];
  lang: Lang;
  onSelectProduct: (product: Product) => void;
  onRefresh?: () => void;
}

export function APProductsPage({
  products,
  lang,
  onSelectProduct,
  onRefresh,
}: APProductsPageProps) {
  const t = L[lang];
  const [showQuickSell, setShowQuickSell] = useState(false);

  const apProducts = useMemo(() => products.filter((p) => p.type === 'ap'), [products]);

  return (
    <div className="locations-page">
      <div className="flow-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{lang === 'en' ? 'AP Products' : 'AP 序號品'}</h2>
            <div className="sub">
              {lang === 'en'
                ? 'Manage serial numbers for all AP products'
                : '管理所有序號品產品'}
            </div>
          </div>
          </div>
          <button className="btn-lg primary" onClick={() => setShowQuickSell(true)}>
            {t.quickSellTitle}
          </button>
        </div>
      </div>

      {showQuickSell && (
        <QuickSellModal
          lang={lang}
          onClose={() => setShowQuickSell(false)}
          onSuccess={() => {
            setShowQuickSell(false);
            onRefresh?.();
          }}
        />
      )}

      <div className="card panel">
        <h3>
          <span>{lang === 'en' ? 'AP Products' : 'AP 序號品'}</span>
          <span className="pill">{apProducts.length}</span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1, minHeight: 0 }}>
          {apProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '24px 8px', color: 'var(--ink-3)', fontSize: 12, textAlign: 'center' }}>
              {lang === 'en'
                ? 'Create products and set type to "AP" to manage serial numbers'
                : '建立產品並設定類型為 AP，即可管理序號品'}
            </div>
          ) : (
            apProducts.map((product) => (
              <div
                key={product.id}
                className="card"
                onClick={() => onSelectProduct(product)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  backgroundColor: 'var(--surface-2)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div className="sku">{product.sku}</div>
                    <span className="pill">AP</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{product.name}</div>
                  {product.model && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{product.model}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {lang === 'en' ? 'In Stock: ' : '在庫: '}
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {product.ap_in_stock_count ?? 0}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {lang === 'en' ? 'Account: ' : '有帳: '}
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                      {product.accountable_quantity}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
