// src/components/OutboundExtras.tsx
import type { SerialLookup } from '../types';
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

export function SerialList({
  units,
  onRemove,
  scanError,
  lang,
}: {
  units: SerialLookup[];
  onRemove: (serial: string) => void;
  scanError: string | null;
  lang: Lang;
}) {
  const en = lang === 'en';
  if (units.length === 0 && !scanError) return null;
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        {en ? 'AP serials' : 'AP 序號'} <span className="pill">{units.length}</span>
      </div>
      {scanError && <div className="batch-line-error">⚠ {scanError}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
    </div>
  );
}
