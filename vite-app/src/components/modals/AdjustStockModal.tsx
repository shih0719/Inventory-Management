// src/components/modals/AdjustStockModal.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CreateTransactionInput, Product, QuantityType, Tag } from '../../types';
import { L, type Lang } from '../../lib/i18n';
import { updateProduct } from '../../api/products';

export interface AdjustStockModalProps {
  product: Product;
  tags: Tag[];
  lang: Lang;
  onClose: () => void;
  onSubmit: (input: CreateTransactionInput & { sku: string }) => Promise<void> | void;
}

export function AdjustStockModal({ product, tags, lang, onClose, onSubmit }: AdjustStockModalProps) {
  const t = L[lang];

  // Suggested quantity to refill back to min_stock + 50% buffer
  const refillTarget = Math.ceil(product.min_stock * 1.5);
  const suggested = Math.max(refillTarget - product.accountable_quantity, 1);

  const inboundTag = tags.find((tg) => tg.name === 'INBOUND');
  const outboundTag = tags.find((tg) => tg.name === 'OUTBOUND');

  const [qty, setQty] = useState<number | ''>(suggested);
  const [quantityType, setQuantityType] = useState<QuantityType>('accountable');
  const [tagId, setTagId] = useState<number>(inboundTag?.id ?? tags[0]?.id ?? 1);
  const [remarks, setRemarks] = useState('');
  const [minStock, setMinStock] = useState<number | ''>(product.min_stock);
  const [productType, setProductType] = useState<'normal' | 'ap'>(product.type);
  const [submitting, setSubmitting] = useState(false);
  const tagIdRef = useRef(tagId);

  const isInbound = typeof qty === 'number' && qty > 0;
  const isOutbound = typeof qty === 'number' && qty < 0;
  const isZero = qty === 0 || qty === '' || Number.isNaN(qty as number);

  const result = useMemo(() => {
    const curr = quantityType === 'accountable' ? product.accountable_quantity : product.non_accountable_quantity;
    return curr + Number(qty || 0);
  }, [product, qty, quantityType]);

  const stockShort = result < 0;

  // Keep tagIdRef in sync
  useEffect(() => {
    tagIdRef.current = tagId;
  }, [tagId]);

  // Auto-suggest tag based on sign of qty only (not when user manually changes tag)
  useEffect(() => {
    if (isInbound && outboundTag && tagIdRef.current === outboundTag.id && inboundTag) setTagId(inboundTag.id);
    if (isOutbound && inboundTag && tagIdRef.current === inboundTag.id && outboundTag) setTagId(outboundTag.id);
  }, [isInbound, isOutbound, inboundTag, outboundTag]);

  const newMinStock = typeof minStock === 'number' ? minStock : product.min_stock;
  const hasMetaChanges =
    newMinStock !== product.min_stock || productType !== product.type;
  const canSubmit = (!isZero || hasMetaChanges) && !stockShort && !submitting;


  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (!isZero) {
        await onSubmit({
          product_id: product.id,
          sku: product.sku,
          quantity_change: Number(qty),
          quantity_type: quantityType,
          tag_id: tagId,
          remarks: remarks || '',
        });
      }

      const updates: Partial<Product> = {};
      if (newMinStock !== product.min_stock) updates.min_stock = newMinStock;
      if (productType !== product.type) {
        updates.type = productType;
        if (productType === 'ap') {
          (updates as any).track_serial = true;
        }
      }
      if (Object.keys(updates).length > 0) {
        await updateProduct(product.id, updates);
      }

      if (isZero) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const currentAcct = product.accountable_quantity;
  const currentNonAcct = product.non_accountable_quantity;
  const isAcct = quantityType === 'accountable';
  const currentVal = isAcct ? currentAcct : currentNonAcct;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>
              {t.adjustTitle} — {product.sku}
              {product.type === 'ap' && <span className="ap-note">{t.apNote}</span>}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              {product.name} · {product.model}
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* result preview */}
          <div className="result-preview">
            <div className="cell">
              <span className="lbl">{lang === 'en' ? 'Current' : '目前'}</span>
              <div className={'v' + (currentVal === 0 ? ' alert' : '')}>{currentVal}</div>
              <div className="v-sub">{isAcct ? t.accountable : t.nonAccountable}</div>
            </div>
            <div className="cell arrow">→</div>
            <div className="cell">
              <span className="lbl">{lang === 'en' ? 'After' : '異動後'}</span>
              <div className={'v' + (stockShort ? ' alert' : isInbound ? ' in' : '')}>{result}</div>
              <div className="v-sub">
                {isInbound && '+'}
                {qty || 0} {t.units}
              </div>
            </div>
          </div>

          {/* Quantity type */}
          <div className="field">
            <label>{t.quantityType}</label>
            <div className="type-chips">
              <button
                className={quantityType === 'accountable' ? 'on' : ''}
                onClick={() => setQuantityType('accountable')}
              >
                {t.accountable}{' '}
                <span style={{ opacity: 0.7, fontSize: 10 }}>({currentAcct})</span>
              </button>
              <button
                className={quantityType === 'non_accountable' ? 'on' : ''}
                onClick={() => setQuantityType('non_accountable')}
              >
                {t.nonAccountable}{' '}
                <span style={{ opacity: 0.7, fontSize: 10 }}>({currentNonAcct})</span>
              </button>
            </div>
          </div>

          {/* Quantity change */}
          <div className="field">
            <label>{t.adjustQty}</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <div className="qty-stepper">
                <button onClick={() => setQty((q) => Number(q || 0) - 1)}>−</button>
                <input
                  type="number"
                  className={isInbound ? 'in' : isOutbound ? 'out' : ''}
                  value={qty}
                  onChange={(e) => setQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                />
                <button onClick={() => setQty((q) => Number(q || 0) + 1)}>+</button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[5, 10, 20, 50].map((v) => (
                  <button
                    key={v}
                    onClick={() => setQty(v)}
                    style={{
                      border: '1px solid var(--border-2)',
                      background: qty === v ? 'var(--ink)' : 'var(--surface)',
                      color: qty === v ? 'var(--bg)' : 'var(--ink-2)',
                      borderColor: qty === v ? 'var(--ink)' : 'var(--border-2)',
                      padding: '0 12px',
                      borderRadius: 4,
                      font: '500 12px var(--sans)',
                      cursor: 'pointer',
                    }}
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="hint"
              style={{
                color: stockShort ? 'var(--accent)' : 'var(--ink-3)',
                fontWeight: stockShort ? 600 : 400,
                marginTop: 6,
              }}
            >
              {stockShort ? '⚠ ' + t.stockShort : t.adjustHint}
            </div>
          </div>


          {/* Remarks */}
          <div className="field">
            <label>{t.remarks}</label>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t.remarksPh} />
          </div>

          {/* Product Type */}
          <div className="field">
            <label>{lang === 'en' ? 'Product Type' : '產品類型'}</label>
            <div className="type-chips">
              <button
                className={productType === 'normal' ? 'on' : ''}
                onClick={() => setProductType('normal')}
              >
                {lang === 'en' ? 'Normal' : '一般'}
              </button>
              <button
                className={productType === 'ap' ? 'on' : ''}
                onClick={() => setProductType('ap')}
              >
                {lang === 'en' ? 'AP (Serial)' : 'AP (序號品)'}
              </button>
            </div>
          </div>

          {/* Min Stock */}
          <div className="field">
            <label>{lang === 'en' ? 'Min Stock' : '最低庫存'}</label>
            <input
              type="number"
              min={0}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            />
          </div>
        </div>

        <div className="modal-foot">
          <span className="hint">
            {lang === 'en' ? (
              <>
                Creates 1 transaction via <code style={{ fontFamily: 'var(--mono)' }}>POST /api/transactions</code>
              </>
            ) : (
              <>
                將透過 <code style={{ fontFamily: 'var(--mono)' }}>POST /api/transactions</code> 建立 1 筆異動
              </>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-lg" onClick={onClose} disabled={submitting}>
              {t.cancel}
            </button>
            <button
              className="btn-lg primary"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? t.loading : t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
