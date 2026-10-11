// src/components/InboundSerialEntry.tsx
// Serial entry under an inbound batch line for an AP product: scan, type or
// use the camera; each serial is checked against the server before it is added.
import { useEffect, useRef, useState } from 'react';
import { CameraScanner } from './CameraScanner';
import type { Lang } from '../lib/i18n';

export interface InboundSerial {
  serial_number: string;
  /** new = registered on submit; return = a sold unit coming back (RETURN tag). */
  kind: 'new' | 'return';
}

export function InboundSerialEntry({
  serials,
  onAdd,
  onRemove,
  error,
  focusSignal,
  lang,
}: {
  serials: InboundSerial[];
  /** Check and add a serial. Resolves true when it was added. */
  onAdd: (serial: string) => Promise<boolean>;
  onRemove: (serial: string) => void;
  error: string | null;
  /** Bump to focus the serial input. */
  focusSignal: number;
  lang: Lang;
}) {
  const en = lang === 'en';
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Camera callbacks fire between renders; read the latest list from a ref.
  const serialsRef = useRef(serials);
  serialsRef.current = serials;

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  const submitText = async () => {
    const sn = text.trim();
    if (!sn) return;
    setText('');
    if (!(await onAdd(sn))) {
      setText((cur) => (cur === '' ? sn : cur));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  return (
    <div className="batch-line-serials" style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          placeholder={en ? 'Scan or type a serial, then Enter' : '掃描或輸入序號後按 Enter'}
          style={{ fontFamily: 'var(--mono)', flex: 1, minWidth: 0 }}
        />
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
          {en ? 'Camera' : lang === 'ja' ? 'カメラ' : lang === 'zh-cn' ? '相机' : '相機'}
        </button>
      </div>
      {error && <div className="batch-line-error">⚠ {error}</div>}
      {serials.length > 0 && (
        <div className="tag-chips">
          {serials.map((s) => (
            <button
              key={s.serial_number}
              onClick={() => onRemove(s.serial_number)}
              title={en ? 'Remove' : '移除'}
              style={{ fontFamily: 'var(--mono)' }}
            >
              {s.serial_number}
              {s.kind === 'return' && ` · ${en ? 'return' : '退回'}`} ✕
            </button>
          ))}
        </div>
      )}
      {scanning && (
        <CameraScanner
          lang={lang}
          count={serials.length}
          onDetect={(code) => {
            const sn = code.trim().toUpperCase();
            if (serialsRef.current.some((s) => s.serial_number === sn)) return false;
            void onAdd(sn);
            return true;
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
