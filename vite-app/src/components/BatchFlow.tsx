// src/components/BatchFlow.tsx
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateBatchItem, Product, QuantityType, SerialLookup, Tag } from '../types';
import { L, tagLabel, type Lang } from '../lib/i18n';
import { ProductCombobox } from './ProductCombobox';
import { ShipmentFields, SerialSection, type SerialCandidates, type ShipmentDraft } from './OutboundExtras';
import { listProductUnits, lookupSerial } from '../api/product-units';
import { ApiError } from '../api/client';
import { InboundSerialEntry, type InboundSerial } from './InboundSerialEntry';

export interface BatchSubmitPayload {
  name: string;
  items: CreateBatchItem[];
  /** UI-only convenience copy, NOT sent to the backend. */
  tagId: number;
  locationTag: string;
  /** Outbound only: AP serials and shipment fields, sent to POST /api/outbound. */
  outbound?: { serials: string[]; shipment: ShipmentDraft };
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
  /** Inbound AP lines only: serials coming in; the line's quantity is their count. */
  serials: InboundSerial[];
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
    { id: 1, product_id: '', qty: 0, quantity_type: 'accountable', remarks: '', serials: [] },
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

  // Outbound only: scanned AP serials + shipment fields.
  const [serialUnits, setSerialUnits] = useState<SerialLookup[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SerialCandidates | null>(null);
  const [serialFocus, setSerialFocus] = useState(0);
  const [shipment, setShipment] = useState<ShipmentDraft>({
    customer: '',
    project_case: '',
    shipment_date: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })(),
  });
  const createsShipment = tags.find((tg) => tg.id === tagId)?.name === 'OUTBOUND';
  const caseRequired = serialUnits.length > 0;

  /**
   * Look up a serial and add it to the AP list. `lineId` is set when the text was
   * scanned into a product field (no SKU matched); focus then returns to that line.
   */
  const handleSerialScan = async (text: string, lineId?: number): Promise<boolean> => {
    const sn = text.trim().toUpperCase();
    if (serialUnits.some((u) => u.serial_number === sn)) {
      setScanError(lang === 'en' ? `${sn} is already in the list` : `${sn} 已在清單中`);
      return false;
    }
    try {
      const unit = await lookupSerial(sn);
      if (unit.status !== 'in_stock') {
        setScanError(lang === 'en' ? `${sn} is already shipped` : `${sn} 已出庫`);
        return false;
      }
      setSerialUnits((prev) =>
        prev.some((u) => u.serial_number === unit.serial_number) ? prev : [...prev, unit],
      );
      setScanError(null);
      if (lineId !== undefined) focusProduct(lineId);
      return true;
    } catch {
      setScanError(lang === 'en' ? `No product or serial "${sn}"` : `找不到商品或序號「${sn}」`);
      return false;
    }
  };

  /** Outbound: an AP product picked by name can't go out by quantity. Clear the line and offer its serials. */
  const redirectApPick = (lineId: number, product: Product): boolean => {
    if (isInbound || !product.track_serial) return false;
    setLine(lineId, { product_id: '' });
    setScanError(null);
    setSerialFocus((n) => n + 1);
    setCandidates({ sku: product.sku, name: product.name, units: [] });
    listProductUnits(product.id, 'in_stock')
      .then((list) =>
        setCandidates({
          sku: product.sku,
          name: product.name,
          units: list.map((u) => ({
            id: u.id,
            serial_number: u.serial_number,
            status: 'in_stock' as const,
            product_id: u.product_id,
            sku: product.sku,
            product_name: product.name,
          })),
        }),
      )
      .catch((err) => setScanError((err as Error).message));
    return true;
  };

  useEffect(() => {
    if (justPicked === null) return;
    const timer = setTimeout(() => setJustPicked(null), 700);
    return () => clearTimeout(timer);
  }, [justPicked]);

  const scanPh = isInbound
    ? lang === 'en' ? 'Scan or search product…' : lang === 'ja' ? 'スキャンまたは商品を検索…' : lang === 'zh-cn' ? '扫描或搜索商品…' : '掃描或搜尋商品…'
    : lang === 'en' ? 'Scan SKU / AP serial, or search…' : lang === 'ja' ? 'SKU / AP シリアルをスキャン…' : lang === 'zh-cn' ? '扫描 SKU / AP 序号或搜索…' : '掃描 SKU / AP 序號或搜尋…';

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
        serials: [],
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

  // Inbound AP lines: per-line scan error and focus signal for the serial input.
  const [inboundSerialError, setInboundSerialError] = useState<{ lineId: number; msg: string } | null>(null);
  const [inboundSerialFocus, setInboundSerialFocus] = useState({ lineId: 0, n: 0 });

  /** Check a serial for an inbound AP line: new serials are fine; a sold one only comes back under RETURN. */
  const addInboundSerial = async (lineId: number, product: Product, text: string): Promise<boolean> => {
    const sn = text.trim().toUpperCase();
    const fail = (msg: string) => {
      setInboundSerialError({ lineId, msg });
      return false;
    };
    if (lines.some((l) => l.serials.some((s) => s.serial_number === sn))) {
      return fail(lang === 'en' ? `${sn} is already in this batch` : `${sn} 已在本批次中`);
    }
    let kind: InboundSerial['kind'] = 'new';
    try {
      const unit = await lookupSerial(sn);
      if (unit.status === 'in_stock') return fail(lang === 'en' ? `${sn} is already in stock` : `${sn} 已在庫`);
      if (!isReturnTag) {
        return fail(lang === 'en' ? `${sn} was shipped — choose the Return tag to bring it back` : `${sn} 已出庫，退貨請選「退貨」標籤`);
      }
      if (unit.product_id !== product.id) return fail(lang === 'en' ? `${sn} belongs to ${unit.sku}` : `${sn} 屬於 ${unit.sku}`);
      kind = 'return';
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) return fail((err as Error).message);
    }
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId && !l.serials.some((s) => s.serial_number === sn)
          ? { ...l, serials: [...l.serials, { serial_number: sn, kind }] }
          : l,
      ),
    );
    setInboundSerialError(null);
    return true;
  };

  const removeLine = (id: number) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const qtyRequiredMsg = lang === 'en' ? 'Quantity required' : '需要數量';

  const isReturnTag = tags.find((tg) => tg.id === tagId)?.name === 'RETURN';

  // Validation: each line must have product + non-zero qty; outbound can't go negative.
  const linesWithStatus = useMemo(
    () =>
      lines.map((l) => {
        const product = products.find((p) => p.id === Number(l.product_id));
        const apInbound = isInbound && !!product?.track_serial;
        const qty = apInbound ? l.serials.length : l.qty;
        let error: string | null = null;
        if (!product) {
          error = null; // empty line is fine until submit
        } else if (!isInbound && product.track_serial) {
          error = lang === 'en' ? 'AP product — scan its serial numbers instead' : 'AP 商品請改掃描序號';
        } else if (apInbound && l.serials.length === 0) {
          error = lang === 'en' ? 'Scan the serial numbers coming in' : '請掃描進貨的序號';
        } else if (apInbound && l.serials.some((s) => s.kind === 'return') && !isReturnTag) {
          error = lang === 'en' ? 'Returned serials need the Return tag' : '退回的序號需使用「退貨」標籤';
        } else if (qty === 0 || qty === '') {
          error = qtyRequiredMsg;
        } else if (!isInbound && product) {
          const current =
            l.quantity_type === 'accountable' ? product.accountable_quantity : product.non_accountable_quantity;
          if (Number(qty) > current) {
            error = lang === 'en' ? `Stock short — have ${current}` : `庫存不足 — 現有 ${current}`;
          }
        }
        return { ...l, qty, product, apInbound, error };
      }),
    [lines, products, isInbound, isReturnTag, lang],
  );

  const validLines = linesWithStatus.filter((l) => l.product && Number(l.qty) > 0 && !l.error);
  const hasErrors = linesWithStatus.some((l) => l.error);
  const caseMissing = caseRequired && !shipment.project_case.trim();
  const canSubmit =
    (validLines.length > 0 || serialUnits.length > 0) && !hasErrors && !caseMissing && !submitting;

  const totalUnits = validLines.reduce((s, l) => s + Number(l.qty), 0) + serialUnits.length;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const items: CreateBatchItem[] = validLines.map((l) => ({
      product_id: l.product!.id,
      quantity_change: isInbound ? Number(l.qty) : -Number(l.qty),
      quantity_type: l.quantity_type,
      remarks: l.remarks || name || '',
      ...(l.apInbound ? { serial_numbers: l.serials.map((s) => s.serial_number) } : {}),
    }));
    const generatedName =
      name || `${isInbound ? 'IN' : 'OUT'}-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '')}`;

    setSubmitting(true);
    try {
      await onSubmit({
        name: generatedName,
        items,
        tagId,
        locationTag: '',
        ...(isInbound ? {} : { outbound: { serials: serialUnits.map((u) => u.serial_number), shipment } }),
      });
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

      {!isInbound && (
        <ShipmentFields
          value={shipment}
          onChange={(patch) => setShipment((s) => ({ ...s, ...patch }))}
          createsShipment={createsShipment}
          caseRequired={caseRequired}
          lang={lang}
        />
      )}

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
                      if (prod && redirectApPick(l.id, prod)) return;
                      setLine(l.id, { product_id: id === '' ? '' : Number(id), serials: [], quantity_type: 'accountable' });
                      if (prod) setScanError(null);
                      if (prod && onPickProduct) onPickProduct(prod);
                    }}
                    onOpenPicker={
                      onOpenPicker
                        ? () =>
                            onOpenPicker((picked) => {
                              if (redirectApPick(l.id, picked)) return;
                              setLine(l.id, { product_id: picked.id, serials: [], quantity_type: 'accountable' });
                              if (isInbound && picked.track_serial) setInboundSerialFocus((f) => ({ lineId: l.id, n: f.n + 1 }));
                              if (onPickProduct) onPickProduct(picked);
                            })
                        : undefined
                    }
                    lang={lang}
                    placeholder={scanPh}
                    focusSignal={scanFocus.lineId === l.id ? scanFocus.n : 0}
                    onUnmatchedEnter={isInbound ? undefined : (text) => handleSerialScan(text, l.id)}
                    onPicked={(prod) => {
                      if (!isInbound && prod.track_serial) return;
                      if (isInbound && prod.track_serial) {
                        setInboundSerialFocus((f) => ({ lineId: l.id, n: f.n + 1 }));
                        return;
                      }
                      setJustPicked(l.id);
                      const el = qtyRefs.current.get(l.id);
                      el?.focus();
                      el?.select();
                    }}
                  />
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
                  readOnly={l.apInbound}
                  title={l.apInbound ? (lang === 'en' ? 'Count of scanned serials' : '依掃描的序號數量') : undefined}
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
                    disabled={l.apInbound}
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
              {l.apInbound && l.product && (
                <InboundSerialEntry
                  serials={l.serials}
                  onAdd={(sn) => addInboundSerial(l.id, l.product!, sn)}
                  onRemove={(sn) => {
                    setLine(l.id, { serials: l.serials.filter((s) => s.serial_number !== sn) });
                    setInboundSerialError(null);
                  }}
                  error={inboundSerialError?.lineId === l.id ? inboundSerialError.msg : null}
                  focusSignal={inboundSerialFocus.lineId === l.id ? inboundSerialFocus.n : 0}
                  lang={lang}
                />
              )}
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

      {!isInbound && (
        <SerialSection
          units={serialUnits}
          onRemove={(sn) => {
            setSerialUnits((prev) => prev.filter((u) => u.serial_number !== sn));
            setScanError(null);
          }}
          onScan={(sn) => handleSerialScan(sn)}
          candidates={candidates}
          onCloseCandidates={() => setCandidates(null)}
          scanError={scanError}
          focusSignal={serialFocus}
          lang={lang}
        />
      )}

      <div className="flow-foot">
        <div className="progress">
          <strong>{validLines.length}</strong> {t.of} <strong>{lines.length}</strong> {t.valid}
          {' · '}
          <strong>{totalUnits}</strong> {t.units}
          {' · '}
          <span
            style={{
              color: isInbound ? 'var(--ok)' : 'var(--out)',
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
