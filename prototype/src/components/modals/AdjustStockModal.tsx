import { useState, useMemo } from 'react';
import type { Product, Language, Tag } from '../../types';
import { getI18n } from '../../lib/i18n';

interface AdjustStockModalProps {
  product: Product;
  lang: Language;
  onClose: () => void;
  onSubmit: (data: any) => void;
  tags?: Tag[];
}

export default function AdjustStockModal({
  product,
  lang,
  onClose,
  onSubmit,
  tags = [],
}: AdjustStockModalProps) {
  const t = getI18n(lang);
  const [quantityChange, setQuantityChange] = useState(0);
  const [quantityType, setQuantityType] = useState<'accountable' | 'non_accountable'>('accountable');
  const [tagId, setTagId] = useState(1);
  const [remarks, setRemarks] = useState('');

  const refillTarget = Math.ceil(product.min_stock * 1.5);
  const suggested = Math.max(refillTarget - product.accountable_quantity, 1);

  const preview = useMemo(() => {
    if (quantityType === 'accountable') {
      return {
        before: product.accountable_quantity,
        after: product.accountable_quantity + quantityChange,
      };
    }
    return {
      before: product.non_accountable_quantity,
      after: product.non_accountable_quantity + quantityChange,
    };
  }, [product, quantityChange, quantityType]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t.adjustTitle}</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Product Info */}
          <div className="field">
            <label>
              {product.sku} · {product.name}
            </label>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
              {product.model}
            </div>
          </div>

          {/* Quantity Preview */}
          <div className="result-preview">
            <div className="cell">
              <div className="lbl">{t.accountable}</div>
              <div className="v">{preview.before}</div>
            </div>
            <div className="cell arrow">→</div>
            <div className="cell">
              <div className="lbl">{t.accountable}</div>
              <div className="v">{preview.after}</div>
            </div>
          </div>

          {/* Quantity Change */}
          <div className="field">
            <label>{t.adjustQty}</label>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <input
                type="number"
                value={quantityChange}
                onChange={e => setQuantityChange(parseInt(e.target.value) || 0)}
                style={{ flex: 1 }}
              />
              <button
                className="btn"
                onClick={() => setQuantityChange(suggested)}
                title={`Suggest ${suggested}`}
              >
                提議 {suggested}
              </button>
            </div>
            <div className="hint">{t.adjustHint}</div>
          </div>

          {/* Quantity Type */}
          <div className="field">
            <label>{t.quantityType}</label>
            <div className="type-chips">
              <button
                className={`on ${quantityType === 'accountable' ? 'on' : ''}`}
                onClick={() => setQuantityType('accountable')}
              >
                {t.accountable}
              </button>
              <button
                className={quantityType === 'non_accountable' ? 'on' : ''}
                onClick={() => setQuantityType('non_accountable')}
              >
                {t.nonAccountable}
              </button>
            </div>
          </div>

          {/* Tag Selection */}
          {tags.length > 0 && (
            <div className="field">
              <label>{t.tag}</label>
              <select value={tagId} onChange={e => setTagId(parseInt(e.target.value))}>
                {tags.map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {tag.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Remarks */}
          <div className="field">
            <label>{t.remarks}</label>
            <input
              type="text"
              placeholder={t.remarksPh}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onSubmit({
                product_id: product.id,
                sku: product.sku,
                quantity_change: quantityChange,
                quantity_type: quantityType,
                tag_id: tagId,
                remarks,
              });
            }}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
