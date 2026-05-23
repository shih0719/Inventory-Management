import { useEffect, useState } from 'react';
import type { Product, ProductUnit } from '../../types';
import { L, type Lang } from '../../lib/i18n';
import { listProductUnits } from '../../api/product-units';
import { CreateProductUnitsModal } from './CreateProductUnitsModal';
import { ProductUnitsModal } from './ProductUnitsModal';

export interface APProductModalProps {
  product: Product;
  lang: Lang;
  onClose: () => void;
  onProductUpdated?: () => Promise<void>;
}

type SubModal = null | 'create' | 'sell';

export function APProductModal({
  product,
  lang,
  onClose,
  onProductUpdated,
}: APProductModalProps) {
  const t = L[lang];
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [subModal, setSubModal] = useState<SubModal>(null);

  useEffect(() => {
    loadUnits();
  }, [product.id]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await listProductUnits(product.id);
      setUnits(data);
    } catch (err) {
      console.error('Failed to load units:', err);
    } finally {
      setLoading(false);
    }
  };

  const inStockCount = units.filter((u) => u.status === 'in_stock').length;
  const soldCount = units.filter((u) => u.status === 'sold').length;
  const returnedCount = units.filter((u) => u.status === 'returned').length;

  const handleCreateConfirm = async () => {
    setSubModal(null);
    await loadUnits();
    await onProductUpdated?.();
  };

  const handleSellConfirm = (items: Array<{ id: number; sold_to: string; project_case: string }>) => {
    setSubModal(null);
    void loadUnits();
    void onProductUpdated?.();
  };

  return (
    <>
      <div className="modal-scrim" onClick={onClose}>
        <div
          className="modal"
          style={{ width: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <div>
              <h3>{lang === 'en' ? 'AP Product Management' : 'AP 序號品管理'}</h3>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
                {product.sku} · {product.name} · {product.model}
              </div>
            </div>
            <button className="close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body">
            {/* Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4 }}>
                  {lang === 'en' ? 'In Stock' : '庫存中'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ok)' }}>
                  {inStockCount}
                </div>
              </div>
              <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4 }}>
                  {lang === 'en' ? 'Sold' : '已出售'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)' }}>
                  {soldCount}
                </div>
              </div>
              <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 4 }}>
                  {lang === 'en' ? 'Returned' : '已退貨'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  {returnedCount}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                className="btn"
                onClick={() => setSubModal('create')}
                style={{ flex: 1 }}
              >
                {lang === 'en' ? '+ Create Serial Numbers' : '+ 建立序號品'}
              </button>
              <button
                className="btn"
                onClick={() => setSubModal('sell')}
                disabled={inStockCount === 0}
                style={{ flex: 1, opacity: inStockCount === 0 ? 0.5 : 1, cursor: inStockCount === 0 ? 'not-allowed' : 'pointer' }}
              >
                {lang === 'en' ? '✓ Mark as Sold' : '✓ 標記出售'}
              </button>
            </div>

            {/* Units list */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-3)' }}>
                {lang === 'en' ? 'Loading...' : '載入中...'}
              </div>
            ) : units.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-3)' }}>
                {lang === 'en' ? 'No serial numbers created yet' : '尚未建立序號品'}
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 80px',
                    gap: 1,
                    background: 'var(--surface-2)',
                    padding: '8px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--ink-2)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>{lang === 'en' ? 'Serial Number' : '序號'}</div>
                  <div>{lang === 'en' ? 'Status' : '狀態'}</div>
                  <div>{lang === 'en' ? 'Customer' : '客戶'}</div>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {units.map((unit) => (
                    <div
                      key={unit.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 100px 80px',
                        gap: 1,
                        padding: '10px 8px',
                        borderBottom: '1px solid var(--border-2)',
                        fontSize: 13,
                        alignItems: 'center',
                        background:
                          unit.status === 'in_stock'
                            ? 'transparent'
                            : unit.status === 'sold'
                              ? 'rgba(88, 175, 88, 0.05)'
                              : 'rgba(200, 100, 100, 0.05)',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{unit.serial_number}</div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color:
                            unit.status === 'in_stock'
                              ? 'var(--ok)'
                              : unit.status === 'sold'
                                ? 'var(--accent)'
                                : 'var(--ink-2)',
                        }}
                      >
                        {unit.status === 'in_stock'
                          ? lang === 'en'
                            ? 'In Stock'
                            : '庫存'
                          : unit.status === 'sold'
                            ? lang === 'en'
                              ? 'Sold'
                              : '已售'
                            : lang === 'en'
                              ? 'Returned'
                              : '退貨'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {unit.sold_to || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-foot">
            <div />
            <button className="btn ghost" onClick={onClose}>
              {lang === 'en' ? 'Close' : '關閉'}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {subModal === 'create' && (
        <CreateProductUnitsModal
          product={product}
          lang={lang}
          onClose={() => setSubModal(null)}
          onConfirm={handleCreateConfirm}
        />
      )}

      {subModal === 'sell' && (
        <ProductUnitsModal
          product={product}
          lang={lang}
          onClose={() => setSubModal(null)}
          onConfirm={handleSellConfirm}
        />
      )}
    </>
  );
}
