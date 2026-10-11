// src/components/OutboundExtras.tsx
import { useEffect, useRef, useState } from 'react';
import type { SerialLookup } from '../types';
import { CameraScanner } from './CameraScanner';
import type { Lang } from '../lib/i18n';

export interface ShipmentDraft {
  customer: string;
  project_case: string;
  shipment_date: string;
}

export function ShipmentFields({
  value,
  onChange,
  createsShipment,
  caseRequired,
  lang,
}: {
  value: ShipmentDraft;
  onChange: (patch: Partial<ShipmentDraft>) => void;
  /** Tag is OUTBOUND → a shipment document will be created. */
  createsShipment: boolean;
  /** At least one AP serial is in the list. */
  caseRequired: boolean;
  lang: Lang;
}) {
  const en = lang === 'en';
  const caseMissing = caseRequired && !value.project_case.trim();
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
        {createsShipment
          ? en ? 'A shipment document is created on submit.' : '送出時會自動建立出貨單據'
          : en ? 'This tag does not create a shipment document.' : '此標籤不會建立出貨單據'}
      </div>
      <div className="batch-meta-fields">
        <div className="field">
          <label>{en ? 'Customer' : '客戶'}</label>
          <input value={value.customer} onChange={(e) => onChange({ customer: e.target.value })} />
        </div>
        <div className="field">
          <label>
            {en ? 'Project' : '案子'}
            {caseRequired && <span style={{ color: 'var(--accent)' }}> *</span>}
          </label>
          <input
            value={value.project_case}
            aria-invalid={caseMissing}
            onChange={(e) => onChange({ project_case: e.target.value })}
            placeholder={caseRequired ? (en ? 'Required for AP serials' : 'AP 序號出貨必填') : ''}
          />
        </div>
        {createsShipment && (
          <div className="field">
            <label>{en ? 'Shipment date' : '出貨日期'}</label>
            <input
              type="date"
              value={value.shipment_date}
              onChange={(e) => onChange({ shipment_date: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** In-stock serials of an AP product picked by name, offered for clicking. */
export interface SerialCandidates {
  sku: string;
  name: string;
  units: SerialLookup[];
}

export function SerialSection({
  units,
  onRemove,
  onScan,
  candidates,
  onCloseCandidates,
  scanError,
  focusSignal,
  lang,
}: {
  units: SerialLookup[];
  onRemove: (serial: string) => void;
  /** Look up and add a serial. Resolves true when it was added. */
  onScan: (serial: string) => Promise<boolean>;
  candidates: SerialCandidates | null;
  onCloseCandidates: () => void;
  scanError: string | null;
  /** Bump to focus the serial input. */
  focusSignal: number;
  lang: Lang;
}) {
  const en = lang === 'en';
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Camera callbacks fire between renders; read the latest list from a ref.
  const unitsRef = useRef(units);
  unitsRef.current = units;

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const submitText = async () => {
    const sn = text.trim();
    if (!sn) return;
    setText('');
    if (!(await onScan(sn))) {
      setText((cur) => (cur === '' ? sn : cur));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  const picked = new Set(units.map((u) => u.serial_number));
  const offered = candidates?.units.filter((u) => !picked.has(u.serial_number)) ?? [];

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="serial-label-row" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {en ? 'AP serials' : 'AP 序號'} <span className="pill">{units.length}</span>
        </span>
        <button type="button" className="scan-btn" onClick={() => setScanning(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M1.5 5V2.5a1 1 0 0 1 1-1H5M11 1.5h2.5a1 1 0 0 1 1 1V5M14.5 11v2.5a1 1 0 0 1-1 1H11M5 14.5H2.5a1 1 0 0 1-1-1V11M4.5 5v6M7 5v6M9 5v6M11.5 5v6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          {en ? 'Scan with camera' : lang === 'ja' ? 'カメラでスキャン' : lang === 'zh-cn' ? '相机扫描' : '相機掃描'}
        </button>
      </div>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          void submitText();
        }}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={en ? 'AP serial number' : 'AP 序號'}
        placeholder={en ? 'Scan or type an AP serial, then Enter' : '掃描或輸入 AP 序號後按 Enter'}
        style={{ fontFamily: 'var(--mono)', width: '100%' }}
      />
      {scanError && <div className="batch-line-error">⚠ {scanError}</div>}

      {candidates && (
        <div style={{ marginTop: 10, padding: 10, border: '1px dashed var(--border)', borderRadius: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
            <span>
              {en
                ? `${candidates.sku} is an AP product — pick the serials to ship`
                : `${candidates.sku} 是 AP 商品，點選要出貨的序號`}
            </span>
            <button
              className="remove"
              style={{ marginLeft: 'auto' }}
              onClick={onCloseCandidates}
              aria-label={en ? 'Close' : '關閉'}
            >
              ✕
            </button>
          </div>
          {offered.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {en ? 'No more serials in stock' : '沒有其他在庫序號'}
            </div>
          ) : (
            <div className="tag-chips">
              {offered.map((u) => (
                <button key={u.serial_number} onClick={() => void onScan(u.serial_number)} style={{ fontFamily: 'var(--mono)' }}>
                  + {u.serial_number}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {units.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          {units.map((u) => (
            <div key={u.serial_number} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--mono)' }}>{u.serial_number}</span>
              <span style={{ color: 'var(--ink-3)' }}>
                {u.sku} · {u.product_name}
              </span>
              <button
                className="remove"
                style={{ marginLeft: 'auto' }}
                onClick={() => onRemove(u.serial_number)}
                aria-label={en ? 'Remove serial' : '移除序號'}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {scanning && (
        <CameraScanner
          lang={lang}
          count={units.length}
          onDetect={(code) => {
            const sn = code.trim().toUpperCase();
            if (unitsRef.current.some((u) => u.serial_number === sn)) return false;
            void onScan(sn);
            return true;
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
