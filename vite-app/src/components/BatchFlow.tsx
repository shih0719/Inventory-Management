// src/components/BatchFlow.tsx
import { Fragment, useMemo, useState } from 'react';
import type { CreateBatchItem, Product, QuantityType, Tag } from '../types';
import { L, tagLabel, type Lang } from '../lib/i18n';
import { ProductCombobox } from './ProductCombobox';

export interface BatchSubmitPayload {
  name: string;
  items: CreateBatchItem[];
  /** UI-only convenience copy, NOT sent to the backend. */
  tagId: number;
  locationTag: string;
}

export interface BatchFlowProps {
  kind: 'inbound' | 'outbound';
  products: Product[];
  tags: Tag[];
  recentSkus?: string[];
  lang: Lang;
  onSubmit: (payload: BatchSubmitPayload) => void | Promise<void>;
  onOpenPicker?: (onPick: (p: Product) => void) => void;
  onPickProduct?: (p: Product) => void;
}

interface LineRow {
  id: number;
  product_id: number | '';
  qty: number | '';
  quantity_type: QuantityType;
  remarks: string;
}

export function BatchFlow({
  kind,
  products,
  tags,
  lang,
  onSubmit,
  recentSkus,
  onOpenPicker,
  onPickProduct,
}: BatchFlowProps) {
  const t = L[lang];
  const isInbound = kind === 'inbound';

  // pick default tag id from server-side tags
  const inboundTag = tags.find((tg) => tg.name === 'INBOUND');
  const outboundTag = tags.find((tg) => tg.name === 'OUTBOUND');
  const defaultTagId = (isInbound ? inboundTag?.id : outboundTag?.id) ?? tags[0]?.id ?? 1;

  const [name, setName] = useState('');
  const [tagId, setTagId] = useState<number>(defaultTagId);
  const [lines, setLines] = useState<LineRow[]>([
    { id: 1, product_id: '', qty: 0, quantity_type: 'accountable', remarks: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const setLine = (id: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        id: (prev.at(-1)?.id || 0) + 1,
        product_id: '',
        qty: 0,
        quantity_type: 'accountable',
        remarks: '',
      },
    ]);

  const removeLine = (id: number) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  // Validation: each line must have product + non-zero qty; outbound can't go negative.
  const linesWithStatus = useMemo(
    () =>
      lines.map((l) => {
        const product = products.find((p) => p.id === Number(l.product_id));
        let error: string | null = null;
        if (!product) {
          error = null; // empty line is fine until submit
        } else if (l.qty === 0 || l.qty === '') {
          error = lang === 'en' ? 'Quantity required' : '需要數量';
        } else if (!isInbound && product) {
          const current =
            l.quantity_type === 'accountable' ? product.accountable_quantity : product.non_accountable_quantity;
          if (Number(l.qty) > current) {
            error = lang === 'en' ? `Stock short — have ${current}` : `庫存不足 — 現有 ${current}`;
          }
        }
        return { ...l, product, error };
      }),
    [lines, products, isInbound, lang],
  );

  const validLines = linesWithStatus.filter((l) => l.product && Number(l.qty) > 0 && !l.error);
  const hasErrors = linesWithStatus.some((l) => l.error);
  const canSubmit = validLines.length > 0 && !hasErrors && !submitting;

  const totalUnits = validLines.reduce((s, l) => s + Number(l.qty), 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const items: CreateBatchItem[] = validLines.map((l) => ({
      product_id: l.product!.id,
      quantity_change: isInbound ? Number(l.qty) : -Number(l.qty),
      quantity_type: l.quantity_type,
      remarks: l.remarks || name || '',
    }));
    const generatedName =
      name || `${isInbound ? 'IN' : 'OUT'}-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '')}`;

    setSubmitting(true);
    try {
      await onSubmit({ name: generatedName, items, tagId, locationTag: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const availableTags = isInbound
    ? tags.filter((tg) => ['INBOUND', 'RETURN'].includes(tg.name))
    : tags.filter((tg) => ['OUTBOUND', 'INTERNAL', 'ADJUST'].includes(tg.name));

  return (
    <div className="batch-flow">
      <div className="flow-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <h2>{isInbound ? t.batchInTitle : t.batchOutTitle}</h2>
            <div className="sub">
              {isInbound
                ? lang === 'en'
                  ? 'Create one or more inbound transactions in a single batch'
                  : '一次建立一或多筆進貨異動'
                : lang === 'en'
                  ? 'Create one or more outbound transactions in a single batch'
                  : '一次建立一或多筆出貨異動'}
            </div>
          </div>
        </div>
      </div>

      {/* Batch metadata */}
      <div className="card" style={{ padding: 14 }}>
        <div className="batch-meta-fields">
          <div className="field">
            <label>{t.batchName}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.batchNamePh} />
          </div>
          <div className="field">
            <label>{t.tag}</label>
            <div className="tag-chips">
              {availableTags.map((tg) => (
                <button key={tg.id} className={tagId === tg.id ? 'on' : ''} onClick={() => setTagId(tg.id)}>
                  {tagLabel(tg.name, lang)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="batch-line-head">
          <span>{t.product}</span>
          <span>{t.qty}</span>
          <span>{t.type}</span>
          <span>{t.remarks}</span>
          <span />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {linesWithStatus.map((l) => (
            <Fragment key={l.id}>
              <div className={'batch-line' + (l.error ? ' invalid' : '')}>
                <div className="col-name">
                  <ProductCombobox
                    products={products}
                    recentSkus={recentSkus || []}
                    value={l.product_id}
                    onChange={(id, prod) => {
                      setLine(l.id, { product_id: id === '' ? '' : Number(id) });
                      if (prod && onPickProduct) onPickProduct(prod);
                    }}
                    onOpenPicker={
                      onOpenPicker
                        ? () =>
                            onOpenPicker((picked) => {
                              setLine(l.id, { product_id: picked.id });
                              if (onPickProduct) onPickProduct(picked);
                            })
                        : undefined
                    }
                    lang={lang}
                  />
                  {l.product && l.product.type === 'ap' && (
                    <div style={{ marginTop: 4 }}>
                      <span className="ap-note">{t.apNoteForBatch}</span>
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  value={l.qty || ''}
                  onChange={(e) =>
                    setLine(l.id, {
                      qty: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                />
                <div className="qty-type-seg">
                  <button
                    className={l.quantity_type === 'accountable' ? 'on' : ''}
                    onClick={() => setLine(l.id, { quantity_type: 'accountable' })}
                  >
                    {t.acctShort}
                  </button>
                  <button
                    className={l.quantity_type === 'non_accountable' ? 'on' : ''}
                    onClick={() => setLine(l.id, { quantity_type: 'non_accountable' })}
                  >
                    {t.nonAcctShort}
                  </button>
                </div>
                <input
                  value={l.remarks}
                  onChange={(e) => setLine(l.id, { remarks: e.target.value })}
                  placeholder={t.remarksPh}
                />
                <button
                  className="remove"
                  onClick={() => removeLine(l.id)}
                  disabled={lines.length === 1}
                  title={lang === 'en' ? 'Remove line' : '移除'}
                >
                  ✕
                </button>
              </div>
              {l.error && <div className="batch-line-error">⚠ {l.error}</div>}
            </Fragment>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button
            onClick={addLine}
            style={{
              background: 'transparent',
              border: '1px dashed var(--border-2)',
              borderRadius: 6,
              padding: '6px 14px',
              font: '500 12px var(--sans)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.addLine}
          </button>
        </div>
      </div>

      <div className="flow-foot">
        <div className="progress">
          <strong>{validLines.length}</strong> {t.of} <strong>{lines.length}</strong> {t.valid}
          {' · '}
          <strong>{totalUnits}</strong> {t.units}
          {' · '}
          <span
            style={{
              color: isInbound ? 'var(--ok)' : 'var(--accent)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {isInbound ? '↑ ' : '↓ '}
            {isInbound ? t.inboundLbl : t.outboundLbl}
          </span>
        </div>
        <div className="actions">
          <button className="btn-lg primary" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? t.loading : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
