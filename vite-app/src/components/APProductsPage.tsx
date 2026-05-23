import { useMemo } from 'react';
import type { Product } from '../types';
import { L, type Lang } from '../lib/i18n';

export interface APProductsPageProps {
  products: Product[];
  lang: Lang;
  onBack: () => void;
  onSelectProduct: (product: Product) => void;
}

export function APProductsPage({
  products,
  lang,
  onBack,
  onSelectProduct,
}: APProductsPageProps) {
  const t = L[lang];

  const apProducts = useMemo(() => products.filter((p) => p.type === 'ap'), [products]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <button className="back" onClick={onBack}>
            {t.back}
          </button>
          <div>
            <h2>{lang === 'en' ? 'AP Products' : 'AP 序號品'}</h2>
            <div className="sub">
              {lang === 'en'
                ? 'Manage serial numbers for all AP products'
                : '管理所有序號品產品'}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {apProducts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--ink-3)',
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              {lang === 'en' ? 'No AP products yet' : '尚無序號品產品'}
            </div>
            <div style={{ fontSize: 12 }}>
              {lang === 'en'
                ? 'Create products and set type to "AP" to manage serial numbers'
                : '建立產品並設定類型為 AP，即可管理序號品'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {apProducts.map((product) => (
              <div
                key={product.id}
                className="card"
                onClick={() => onSelectProduct(product)}
                style={{
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--surface)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{product.sku}</span>
                      <span
                        className="pill"
                        style={{ fontSize: 9, padding: '0 5px', background: 'var(--primary)', color: 'white' }}
                      >
                        AP
                      </span>
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 2 }}>{product.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{product.model}</div>
                  </div>

                  {/* Stats */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      marginLeft: 16,
                    }}
                  >
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 2 }}>
                        {lang === 'en' ? 'In Stock' : '在庫'}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--ok)' }}>
                        {product.ap_in_stock_count ?? 0}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 2 }}>
                        {lang === 'en' ? 'Account' : '有帳'}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        {product.accountable_quantity}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
