import { useState } from 'react';
import { createProduct } from '../../api/products';
import { ApiError } from '../../api/client';
import type { Lang } from '../../lib/i18n';
import type { Product } from '../../types';

interface CreateProductModalProps {
  lang: Lang;
  onClose: () => void;
  onCreated: () => void;
}

const texts = {
  en: {
    title: 'New Product',
    sku: 'SKU',
    name: 'Name',
    model: 'Model',
    type: 'Type',
    minStock: 'Min Stock',
    trackSerial: 'Track Serial (AP)',
    cancel: 'Cancel',
    create: 'Create',
    creating: 'Creating...',
    skuRequired: 'SKU is required',
    nameRequired: 'Name is required',
    typeRequired: 'Type is required',
    hardware: 'Hardware',
    consumable: 'Consumable',
    other: 'Other',
  },
  zh: {
    title: '新增產品',
    sku: 'SKU',
    name: '產品名稱',
    model: '型號',
    type: '類型',
    minStock: '最低庫存',
    trackSerial: '序號追蹤 (AP)',
    cancel: '取消',
    create: '建立',
    creating: '建立中...',
    skuRequired: 'SKU 為必填',
    nameRequired: '名稱為必填',
    typeRequired: '類型為必填',
    hardware: '硬體',
    consumable: '耗材',
    other: '其他',
  },
  ja: {
    title: '商品追加',
    sku: 'SKU',
    name: '商品名',
    model: 'モデル',
    type: '種類',
    minStock: '最低在庫',
    trackSerial: 'シリアル追跡 (AP)',
    cancel: 'キャンセル',
    create: '作成',
    creating: '作成中...',
    skuRequired: 'SKUは必須です',
    nameRequired: '名前は必須です',
    typeRequired: '種類は必須です',
    hardware: 'ハードウェア',
    consumable: '消耗品',
    other: 'その他',
  },
};

export function CreateProductModal({ lang, onClose, onCreated }: CreateProductModalProps) {
  const t = texts[lang];
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState<Product['type']>('normal');
  const [minStock, setMinStock] = useState<number | ''>(0);
  const [trackSerial, setTrackSerial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) { setError(t.skuRequired); return; }
    if (!name.trim()) { setError(t.nameRequired); return; }
    if (!type) { setError(t.typeRequired); return; }

    setError(null);
    setSubmitting(true);
    try {
      await createProduct({
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        model: model.trim(),
        type: type as Product['type'],
        min_stock: Number(minStock) || 0,
        track_serial: trackSerial,
        accountable_quantity: 0,
        non_accountable_quantity: 0,
      });
      onCreated();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-row">
            <label>{t.sku} *</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU-001"
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="form-row">
            <label>{t.name} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'en' ? 'Product name' : lang === 'zh' ? '產品名稱' : '商品名'}
              disabled={submitting}
            />
          </div>

          <div className="form-row">
            <label>{t.model}</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={lang === 'en' ? 'Model number' : lang === 'zh' ? '型號' : 'モデル番号'}
              disabled={submitting}
            />
          </div>

          <div className="form-row">
            <label>{t.type} *</label>
            <select value={type} onChange={(e) => setType(e.target.value as Product['type'])} disabled={submitting}>
              <option value="normal">{t.hardware}</option>
              <option value="ap">AP ({t.trackSerial})</option>
            </select>
          </div>

          <div className="form-row">
            <label>{t.minStock}</label>
            <input
              type="number"
              min={0}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={submitting}
            />
          </div>

          <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              id="track-serial"
              type="checkbox"
              checked={trackSerial}
              onChange={(e) => setTrackSerial(e.target.checked)}
              disabled={submitting}
              style={{ width: 'auto', margin: 0 }}
            />
            <label htmlFor="track-serial" style={{ margin: 0, fontSize: 13 }}>{t.trackSerial}</label>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#ffebee', color: '#d32f2f', borderRadius: 4, fontSize: 13, borderLeft: '3px solid #d32f2f' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>{t.cancel}</button>
            <button type="submit" className="btn-lg" disabled={submitting} style={{ padding: '6px 20px', fontSize: 13 }}>
              {submitting ? t.creating : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
