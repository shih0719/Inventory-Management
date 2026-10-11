// src/components/BatchFlow.tsx
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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

  // Scan-first focus: the product field of `lineId` is focused whenever `n` changes
  // (on open, after Enter in qty, after + add line). After a pick, focus jumps to qty.
  const [scanFocus, setScanFocus] = useState({ lineId: 1, n: 1 });
  const focusProduct = (lineId: number) => setScanFocus((s) => ({ lineId, n: s.n + 1 }));
  const qtyRefs = useRef(new Map<number, HTMLInputElement>());
  const [justPicked, setJustPicked] = useState<number | null>(null);
  // "Quantity required" waits until the qty field was left or Enter was pressed,
  // so a freshly scanned line doesn't turn red before the user can type.
  const [touched, setTouched] = useState<Set<number>>(() => new Set());
  const touch = (id: number) => setTouched((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  useEffect(() => {
    if (justPicked === null) return;
    const timer = setTimeout(() => setJustPicked(null), 700);
    return () => clearTimeout(timer);
  }, [justPicked]);

  const scanPh =
    lang === 'en' ? 'Scan or search product…' : lang === 'ja' ? 'スキャンまたは商品を検索…' : lang === 'zh-cn' ? '扫描或搜索商品…' : '掃描或搜尋商品…';

  const setLine = (id: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = (): number => {
    const id = (lines.at(-1)?.id || 0) + 1;
    setLines((prev) => [
      ...prev,
      {
        id,
        product_id: '',
        qty: 0,
        quantity_type: 'accountable',
        remarks: '',
      },
    ]);
    return id;
  };

  /** Enter in qty: move to the next line's product field, adding a line when on the last one. */
  const advanceFrom = (id: number) => {
    const idx = lines.findIndex((x) => x.id === id);
    const next = lines[idx + 1];
    focusProduct(next ? next.id : addLine());
  };

  const removeLine = (id: number) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const qtyRequiredMsg = lang === 'en' ? 'Quantity required' : '需要數量';

  // Validation: each line must have product + non-zero qty; outbound can't go negative.
  const linesWithStatus = useMemo(
    () =>
      lines.map((l) => {
        const product = products.find((p) => p.id === Number(l.product_id));
        let error: string | null = null;
        if (!product) {
          error = null; // empty line is fine until submit
        } else if (l.qty === 0 || l.qty === '') {
          error = qtyRequiredMsg;
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
        className="batch-lines"
      >
        <div className="batch-line-head">
          <span>{t.product}</span>
          <span>{t.qty}</span>
          <span>{t.type}</span>
          <span>{t.remarks}</span>
          <span />
        </div>
        <div className="batch-lines-scroll">
          {linesWithStatus.map((l) => (
            <Fragment key={l.id}>
              <div
                className={
                  'batch-line' +
                  (l.error && (touched.has(l.id) || l.error !== qtyRequiredMsg) ? ' invalid' : '') +
                  (justPicked === l.id ? ' just-picked' : '')
                }
              >
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
                    placeholder={scanPh}
                    focusSignal={scanFocus.lineId === l.id ? scanFocus.n : 0}
                    onPicked={() => {
                      setJustPicked(l.id);
                      const el = qtyRefs.current.get(l.id);
                      el?.focus();
                      el?.select();
                    }}
                  />
                  {!!l.product?.track_serial && (
                    <div style={{ marginTop: 4 }}>
                      <span className="ap-note">{t.apNoteForBatch}</span>
                    </div>
                  )}
                </div>
                <input
                  className="col-qty"
                  ref={(el) => {
                    if (el) qtyRefs.current.set(l.id, el);
                    else qtyRefs.current.delete(l.id);
                  }}
                  type="number"
                  inputMode="numeric"
                  enterKeyHint="next"
                  onBlur={() => l.product && touch(l.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!l.product) return;
                    touch(l.id);
                    if (Number(l.qty) > 0 && !l.error) advanceFrom(l.id);
                  }}
                  min={0}
                  aria-label={t.qty}
                  placeholder={t.qty}
                  value={l.qty || ''}
                  onChange={(e) =>
                    setLine(l.id, {
                      qty: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                />
                <div className="qty-type-seg col-type">
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
                  className="col-rem"
                  aria-label={t.remarks}
                  value={l.remarks}
                  onChange={(e) => setLine(l.id, { remarks: e.target.value })}
                  placeholder={t.remarksPh}
                />
                <button
                  className="remove"
                  onClick={() => removeLine(l.id)}
                  disabled={lines.length === 1}
                  title={lang === 'en' ? 'Remove line' : '移除'}
                  aria-label={lang === 'en' ? 'Remove line' : '移除'}
                >
                  ✕
                </button>
              </div>
              {l.error && (touched.has(l.id) || l.error !== qtyRequiredMsg) && <div className="batch-line-error">⚠ {l.error}</div>}
            </Fragment>
          ))}
        </div>
        <div className="batch-lines-foot">
          <button className="batch-add" onClick={() => focusProduct(addLine())}>
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
