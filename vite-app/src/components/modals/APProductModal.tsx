import { useEffect, useState } from 'react';
import type { Product, ProductUnit } from '../../types';
import { L, type Lang } from '../../lib/i18n';
import { listProductUnits, transferUnits } from '../../api/product-units';
import { listWarehouses, type Warehouse } from '../../api/warehouses';
import { lookupProduct } from '../../api/products';
import { ApiError } from '../../api/client';
import type { Product as ProductType } from '../../types';
import { CreateProductUnitsModal } from './CreateProductUnitsModal';

export interface APProductModalProps {
  product: Product;
  lang: Lang;
  onClose: () => void;
  onProductUpdated?: () => Promise<void>;
}

type SubModal = null | 'create' | 'transfer';

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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transferSerialInput, setTransferSerialInput] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferErrors, setTransferErrors] = useState<Array<{ serial_number: string; reason: string }> | string | null>(null);
  const [targetProduct, setTargetProduct] = useState<ProductType | null | undefined>(undefined);

  useEffect(() => {
    loadUnits();
    listWarehouses().then(setWarehouses).catch(() => {});
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

  const serialList = transferSerialInput
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const openTransfer = () => {
    setTransferSerialInput('');
    setTargetWarehouseId(null);
    setTargetProduct(undefined);
    setTransferErrors(null);
    setSubModal('transfer');
  };

  useEffect(() => {
    if (!targetWarehouseId) { setTargetProduct(undefined); return; }
    setTargetProduct(undefined);
    lookupProduct(product.sku, targetWarehouseId)
      .then(setTargetProduct)
      .catch(() => setTargetProduct(null));
  }, [targetWarehouseId, product.sku]);

  const handleTransfer = async () => {
    if (!targetWarehouseId || serialList.length === 0) return;
    setTransferring(true);
    setTransferErrors(null);
    try {
      await transferUnits(serialList, targetWarehouseId);
      setSubModal(null);
      await loadUnits();
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const body = err.body as any;
        if (Array.isArray(body.errors)) {
          setTransferErrors(body.errors);
        } else {
          setTransferErrors(body.error || err.message);
        }
      } else {
        setTransferErrors(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setTransferring(false);
    }
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
              <button className="btn" onClick={() => setSubModal('create')} style={{ flex: 1 }}>
                {lang === 'en' ? '+ Serial Number Inbound' : '+ 序號入庫'}
              </button>
              <button
                className="btn ghost"
                onClick={openTransfer}
                disabled={inStockCount === 0}
                style={{ flex: 1 }}
              >
                {lang === 'en' ? '⇄ Transfer Warehouse' : '⇄ 移倉'}
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
                  {units.slice(0, 5).map((unit) => (
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
                  {units.length > 5 && (
                    <div style={{ padding: '10px 8px', fontSize: 12, color: 'var(--ink-2)', textAlign: 'center', borderTop: '1px solid var(--border-2)' }}>
                      {lang === 'en' ? `... and ${units.length - 5} more` : `... 等共 ${units.length - 5} 筆`}
                    </div>
                  )}
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

      {subModal === 'transfer' && (
        <div className="modal-scrim" onClick={() => setSubModal(null)}>
          <div
            className="modal"
            style={{ width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3>{lang === 'en' ? 'Transfer to Warehouse' : '移倉'}</h3>
              <button className="close" onClick={() => setSubModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {transferErrors && (
                <div style={{ fontSize: 12, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, padding: '8px 12px' }}>
                  {Array.isArray(transferErrors) ? (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        {lang === 'en' ? 'Transfer failed:' : '移倉失敗：'}
                      </div>
                      {transferErrors.map((e, i) => (
                        <div key={i} style={{ fontFamily: 'var(--mono)', marginBottom: 2 }}>
                          {e.serial_number} — {e.reason}
                        </div>
                      ))}
                    </>
                  ) : (
                    transferErrors
                  )}
                </div>
              )}
              <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div>
                    <div style={{ color: 'var(--ink-2)', marginBottom: 2 }}>
                      {lang === 'en' ? 'From (current)' : '來源'}
                    </div>
                    <div style={{ fontWeight: 600 }}>{product.sku}</div>
                    <div style={{ color: 'var(--ink-2)' }}>{product.name}{product.model ? ` · ${product.model}` : ''}</div>
                  </div>
                  {targetWarehouseId && (
                    <div>
                      <div style={{ color: 'var(--ink-2)', marginBottom: 2 }}>
                        {lang === 'en' ? 'To (target warehouse)' : '目標倉庫'}
                      </div>
                      {targetProduct === undefined ? (
                        <div style={{ color: 'var(--ink-3)' }}>{lang === 'en' ? 'Looking up...' : '查詢中...'}</div>
                      ) : targetProduct === null ? (
                        <div style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          {lang === 'en' ? '✕ SKU not found in target warehouse' : '✕ 目標倉庫無此 SKU'}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>{targetProduct.sku}</div>
                          <div style={{ color: 'var(--ink-2)' }}>{targetProduct.name}{targetProduct.model ? ` · ${targetProduct.model}` : ''}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ color: 'var(--accent)', marginTop: 8, fontSize: 11, fontWeight: 600 }}>
                  ⚠ {lang === 'en'
                    ? 'Same SKU in target warehouse must refer to the same product'
                    : '目標倉庫的相同 SKU 必須是同一商品，請人工確認'}
                </div>
              </div>
              <div className="field">
                <label>{lang === 'en' ? 'Target Warehouse' : '目標倉庫'}</label>
                <select
                  value={targetWarehouseId ?? ''}
                  onChange={(e) => setTargetWarehouseId(e.target.value ? Number(e.target.value) : null)}
                  style={{ width: '100%' }}
                >
                  <option value="">{lang === 'en' ? '— Select warehouse —' : '— 選擇倉庫 —'}</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label style={{ marginBottom: 8 }}>
                  {lang === 'en' ? 'Serial Numbers to Transfer (one per line)' : '移倉序號（一行一個）'}
                </label>
                <textarea
                  value={transferSerialInput}
                  onChange={(e) => setTransferSerialInput(e.target.value)}
                  placeholder={'SN-001\nSN-002\nSN-003'}
                  style={{
                    width: '100%',
                    minHeight: 160,
                    padding: '10px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 6 }}>
                  {lang === 'en'
                    ? `Ready to transfer: ${serialList.length} serial number${serialList.length !== 1 ? 's' : ''}`
                    : `準備移倉：${serialList.length} 筆序號`}
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <div />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" onClick={() => setSubModal(null)}>
                  {lang === 'en' ? 'Cancel' : '取消'}
                </button>
                <button
                  className="btn"
                  onClick={handleTransfer}
                  disabled={!targetWarehouseId || serialList.length === 0 || transferring || !targetProduct}
                >
                  {transferring
                    ? lang === 'en' ? 'Transferring...' : '移倉中...'
                    : lang === 'en'
                      ? `Transfer ${serialList.length} Unit${serialList.length !== 1 ? 's' : ''}`
                      : `移倉 ${serialList.length} 筆`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
