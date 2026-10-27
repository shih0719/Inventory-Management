import { useRef, useState } from 'react';
import type { Product } from '../../types';
import { L, type Lang } from '../../lib/i18n';
import { bulkCreateUnits } from '../../api/product-units';
import { ApiError } from '../../api/client';
import { ConfirmModal } from './ConfirmModal';
import { CameraScanner } from '../CameraScanner';
import { normalizeSerial, parseSerialList } from '../../lib/serial';

export interface CreateProductUnitsModalProps {
  product: Product;
  lang: Lang;
  onClose: () => void;
  onConfirm: () => void;
}

export function CreateProductUnitsModal({
  product,
  lang,
  onClose,
  onConfirm,
}: CreateProductUnitsModalProps) {
  const t = L[lang];
  const [serials, setSerials] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  // Camera callbacks fire between renders; read the latest text from a ref.
  const serialsRef = useRef(serials);
  serialsRef.current = serials;

  /** Append a scanned code as a new line. Serials are stored upper-case, so compare that way. */
  const addScanned = (code: string): boolean => {
    const norm = normalizeSerial(code);
    const prev = serialsRef.current;
    if (parseSerialList(prev).includes(norm)) return false;
    const next = prev + (prev && !prev.endsWith('\n') ? '\n' : '') + norm + '\n';
    serialsRef.current = next;
    setSerials(next);
    return true;
  };

  // What will be stored: one normalized serial per non-blank line
  const serialList = parseSerialList(serials);

  const handleSubmit = async () => {
    if (serialList.length === 0) return;
    setSubmitting(true);
    try {
      const response = await bulkCreateUnits(product.id, serialList);
      setResultModal({ type: 'success', message: response.message });
    } catch (err) {
      console.error('Failed to create units:', err);
      let errorMessage = lang === 'en' ? 'Failed to create units' : '建立序號品失敗';

      if (err instanceof ApiError) {
        if (err.body && typeof err.body === 'object') {
          const body = err.body as any;
          if (body.error) {
            errorMessage = body.error;
          } else if (body.message) {
            errorMessage = body.message;
          } else {
            errorMessage = err.message;
          }
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setResultModal({ type: 'error', message: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResultConfirm = () => {
    if (resultModal?.type === 'success') {
      onConfirm();
      onClose();
    }
    setResultModal(null);
  };

  const canSubmit = serialList.length > 0 && !submitting;

  return (
    <>
      <div className="modal-scrim" onClick={onClose}>
        <div
          className="modal"
          style={{ width: 450, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="modal-head">
          <h3>{lang === 'en' ? 'Create Serial Numbers' : '建立序號品'}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 12, padding: '12px', background: 'var(--surface-2)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{product.sku}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{product.name}</div>
          </div>

          <div className="field">
            <div className="serial-label-row">
              <label style={{ margin: 0 }}>
                {lang === 'en' ? 'Serial Numbers (one per line)' : '序號品 (一行一個)'}
              </label>
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
                {lang === 'en' ? 'Scan with camera' : lang === 'ja' ? 'カメラでスキャン' : lang === 'zh-cn' ? '相机扫描' : '相機掃描'}
              </button>
            </div>
            <textarea
              autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
              value={serials}
              onChange={(e) => setSerials(e.target.value)}
              placeholder={
                lang === 'en'
                  ? 'SN-001\nSN-002\nSN-003\nLT-A001\nLT-A002'
                  : 'SN-001\nSN-002\nSN-003\nLT-A001\nLT-A002'
              }
              style={{
                width: '100%',
                minHeight: 200,
                padding: '10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontFamily: 'var(--mono)',
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                marginTop: 8,
              }}
            >
              {lang === 'en'
                ? `Ready to create: ${serialList.length} serial number${serialList.length !== 1 ? 's' : ''}`
                : `準備建立: ${serialList.length} 個序號品`}
            </div>
          </div>

          {serialList.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '12px',
                background: 'var(--surface-2)',
                borderRadius: 6,
                maxHeight: 150,
                overflowY: 'auto',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 8, color: 'var(--ink-2)' }}>
                {lang === 'en' ? 'Preview:' : '預覽:'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {serialList.map((serial, idx) => (
                  <div key={idx} style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>
                    {serial}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" onClick={onClose}>
              {lang === 'en' ? 'Cancel' : '取消'}
            </button>
            <button
              className="btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={canSubmit ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
            >
              {submitting
                ? lang === 'en'
                  ? 'Creating...'
                  : '建立中...'
                : lang === 'en'
                  ? `Create ${serialList.length} Unit${serialList.length !== 1 ? 's' : ''}`
                  : `建立 ${serialList.length} 個序號品`}
            </button>
          </div>
        </div>
      </div>
      </div>

      {scanning && (
        <CameraScanner
          lang={lang}
          count={serialList.length}
          onDetect={addScanned}
          onClose={() => setScanning(false)}
        />
      )}

      {resultModal && (
        <ConfirmModal
          title={
            resultModal.type === 'success'
              ? lang === 'en'
                ? 'Serial Numbers Created'
                : '序號品建立成功'
              : lang === 'en'
                ? 'Failed to Create Serial Numbers'
                : '建立序號品失敗'
          }
          message={resultModal.message}
          confirmText={lang === 'en' ? 'OK' : '確認'}
          showCancel={false}
          isDangerous={resultModal.type === 'error'}
          lang={lang}
          onConfirm={handleResultConfirm}
          onCancel={() => setResultModal(null)}
        />
      )}
    </>
  );
}
