import { useState } from 'react';
import type { Product, Language } from '../types';
import { getI18n } from '../lib/i18n';
import ProductCombobox from './ProductCombobox';

interface BatchFlowProps {
  kind: 'inbound' | 'outbound';
  products: Product[];
  recentSkus: string[];
  lang: Language;
  onBack: () => void;
  onSubmit: (data: any) => void;
  onOpenPicker?: () => void;
  onPickProduct?: (product: Product) => void;
}

interface BatchLineItem {
  product_id: number | null;
  quantity_change: number;
  quantity_type: 'accountable' | 'non_accountable';
  tag_id: number;
  remarks?: string;
}

export default function BatchFlow({
  kind,
  products,
  recentSkus,
  lang,
  onBack,
  onSubmit,
  onOpenPicker,
  onPickProduct,
}: BatchFlowProps) {
  const t = getI18n(lang);
  const [batchName, setBatchName] = useState('');
  const [lines, setLines] = useState<BatchLineItem[]>([
    { product_id: null, quantity_change: 1, quantity_type: 'accountable', tag_id: kind === 'inbound' ? 1 : 2 }
  ]);

  const isInbound = kind === 'inbound';
  const title = isInbound ? t.batchInTitle : t.batchOutTitle;
  const totalItems = lines.filter(l => l.product_id !== null).length;

  return (
    <div className="flow">
      {/* Header */}
      <div className="flow-head">
        <div>
          <button className="back" onClick={onBack}>
            {t.back}
          </button>
          <h2>{title}</h2>
          <div className="sub">Batch mode</div>
        </div>
      </div>

      {/* Summary */}
      <div className="flow-summary">
        <div className="item">
          <div className="lbl">Batch Name</div>
          <div className="v">{batchName || '(unnamed)'}</div>
        </div>
        <div className="sep"></div>
        <div className="item">
          <div className="lbl">Items</div>
          <div className="v">{totalItems}</div>
        </div>
      </div>

      {/* Batch Name Input */}
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.batchName}</label>
        <input
          type="text"
          placeholder={t.batchNamePh}
          value={batchName}
          onChange={e => setBatchName(e.target.value)}
        />
      </div>

      {/* Line Items */}
      <div className="line-list">
        {lines.map((line, idx) => {
          const selectedProduct = line.product_id
            ? products.find(p => p.id === line.product_id)
            : null;

          return (
            <div key={idx} className="batch-line">
              <ProductCombobox
                products={products}
                recentSkus={recentSkus}
                value={line.product_id || ''}
                onChange={(_, product) => {
                  if (product) {
                    const newLines = [...lines];
                    newLines[idx].product_id = product.id;
                    setLines(newLines);
                    onPickProduct?.(product);
                  }
                }}
                lang={lang}
              />

              <input
                type="number"
                value={line.quantity_change}
                onChange={e => {
                  const newLines = [...lines];
                  newLines[idx].quantity_change = parseInt(e.target.value) || 0;
                  setLines(newLines);
                }}
                placeholder="Qty"
              />

              <select
                value={line.quantity_type}
                onChange={e => {
                  const newLines = [...lines];
                  newLines[idx].quantity_type = e.target.value as 'accountable' | 'non_accountable';
                  setLines(newLines);
                }}
              >
                <option value="accountable">{t.accountable}</option>
                <option value="non_accountable">{t.nonAccountable}</option>
              </select>

              <input
                type="text"
                placeholder={t.remarks}
                value={line.remarks || ''}
                onChange={e => {
                  const newLines = [...lines];
                  newLines[idx].remarks = e.target.value;
                  setLines(newLines);
                }}
              />

              <button
                onClick={() => {
                  setLines(lines.filter((_, i) => i !== idx));
                }}
                style={{ color: 'var(--accent)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          );
        })}

        <button
          className="btn"
          style={{ margin: '12px 0' }}
          onClick={() => {
            setLines([
              ...lines,
              { product_id: null, quantity_change: 1, quantity_type: 'accountable', tag_id: kind === 'inbound' ? 1 : 2 }
            ]);
          }}
        >
          {t.addLine}
        </button>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn" onClick={onBack}>
          {t.cancel}
        </button>
        <button
          className="btn primary"
          onClick={() => {
            onSubmit({
              name: batchName,
              items: lines.filter(l => l.product_id !== null),
              tagId: lines[0]?.tag_id || 1,
            });
          }}
        >
          {t.submit}
        </button>
      </div>
    </div>
  );
}
