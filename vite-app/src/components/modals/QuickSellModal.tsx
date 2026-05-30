import { useState } from 'react';
import { bulkSellUnits } from '../../api/product-units';
import { ApiError } from '../../api/client';
import { L, type Lang } from '../../lib/i18n';

export interface QuickSellModalProps {
  lang: Lang;
  onClose: () => void;
  onSuccess: () => void;
}

interface SellError {
  serial_number: string;
  reason: string;
}

export function QuickSellModal({ lang, onClose, onSuccess }: QuickSellModalProps) {
  const t = L[lang];
  const [serialInput, setSerialInput] = useState('');
  const [projectCase, setProjectCase] = useState('');
  const [soldTo, setSoldTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success'; count: number } | { type: 'error'; errors: SellError[] } | null>(null);

  const serialList = serialInput
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const canSubmit = serialList.length > 0 && projectCase.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const data = await bulkSellUnits(serialList, projectCase.trim(), soldTo.trim() || undefined);
      setResult({ type: 'success', count: data.sold });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const body = err.body as { errors?: SellError[]; error?: string };
        if (Array.isArray(body.errors) && body.errors.length > 0) {
          setResult({ type: 'error', errors: body.errors });
        } else {
          setResult({ type: 'error', errors: [{ serial_number: '', reason: body.error || err.message }] });
        }
      } else {
        setResult({ type: 'error', errors: [{ serial_number: '', reason: (err as Error).message }] });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t.quickSellTitle}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div className="field">
            <label>{t.quickSellSerialLabel}</label>
            <textarea
              rows={6}
              placeholder={t.quickSellSerialPh}
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12 }}
              autoFocus
            />
          </div>

          <div className="field">
            <label>{t.quickSellProjectCase}</label>
            <input
              type="text"
              placeholder={t.quickSellProjectCasePh}
              value={projectCase}
              onChange={(e) => setProjectCase(e.target.value)}
            />
          </div>

          <div className="field">
            <label>{t.quickSellSoldTo}</label>
            <input
              type="text"
              placeholder={t.quickSellSoldToPh}
              value={soldTo}
              onChange={(e) => setSoldTo(e.target.value)}
            />
          </div>

          {result?.type === 'success' && (
            <div style={{ color: 'var(--ok)', fontSize: 13 }}>
              ✓ {result.count} {t.quickSellSuccess}
            </div>
          )}

          {result?.type === 'error' && (
            <div style={{ color: 'var(--accent)', fontSize: 13 }}>
              <div style={{ marginBottom: 6 }}>{t.quickSellErrors}</div>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {e.serial_number ? `${e.serial_number}: ` : ''}{e.reason}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn-lg" onClick={onClose}>{t.cancel}</button>
          <button className="btn-lg primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? '…' : t.quickSellSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
