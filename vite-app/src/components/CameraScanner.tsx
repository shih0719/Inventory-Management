// src/components/CameraScanner.tsx
// Full-screen camera barcode scanner. Scans continuously: every new code is
// handed to `onDetect`, so a run of serial labels can be scanned without
// closing. The zxing decoder is loaded on first open to keep the main bundle lean.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../lib/i18n';

export interface CameraScannerProps {
  lang: Lang;
  /** Called for each newly decoded code. Return false when it was rejected (e.g. duplicate). */
  onDetect: (code: string) => boolean;
  onClose: () => void;
  /** How many codes have been collected so far (shown in the footer). */
  count: number;
}

type Status = 'starting' | 'scanning' | 'insecure' | 'denied' | 'nocamera' | 'error';

// A label held in frame decodes on every pass. Treat it as one scan until it has
// been out of view for this long; only then does seeing it again count as a re-scan.
const REPEAT_WINDOW_MS = 1500;

export function CameraScanner({ lang, onDetect, onClose, count }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [last, setLast] = useState<{ code: string; ok: boolean; n: number } | null>(null);
  const lastSeen = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const tx = (en: string, zh: string, zhcn: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh-cn' ? zhcn : lang === 'ja' ? ja : zh;

  useEffect(() => {
    // getUserMedia only exists on HTTPS (or localhost).
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('insecure');
      return;
    }

    let stopped = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        // Limiting formats makes each decode pass much cheaper on phones.
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        if (stopped || !videoRef.current) return;

        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current,
          (result) => {
            if (!result) return;
            const code = result.getText().trim().toUpperCase();
            if (!code) return;
            const now = Date.now();
            const seen = lastSeen.current;
            if (code === seen.code && now - seen.at < REPEAT_WINDOW_MS) {
              seen.at = now; // still in view — extend, don't re-fire
              return;
            }
            lastSeen.current = { code, at: now };
            const ok = onDetectRef.current(code);
            setLast((p) => ({ code, ok, n: (p?.n ?? 0) + 1 }));
            if (navigator.vibrate) navigator.vibrate(ok ? 40 : [30, 60, 30]);
          },
        );
        if (stopped) c.stop();
        else {
          controls = c;
          setStatus('scanning');
        }
      } catch (err) {
        if (stopped) return;
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setStatus('nocamera');
        else setStatus('error');
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const message: Record<Exclude<Status, 'scanning'>, string> = {
    starting: tx('Starting camera…', '正在開啟相機…', '正在打开相机…', 'カメラを起動中…'),
    insecure: tx(
      'The camera needs a secure (HTTPS) connection. Open this system over https:// to scan, or type the serials in instead.',
      '相機需要 HTTPS 安全連線才能使用。請改用 https:// 開啟系統，或先手動輸入序號。',
      '相机需要 HTTPS 安全连接才能使用。请改用 https:// 打开系统，或先手动输入序号。',
      'カメラには HTTPS 接続が必要です。https:// で開くか、シリアルを手入力してください。',
    ),
    denied: tx(
      'Camera access was blocked. Allow camera for this site in the browser settings, then try again.',
      '相機權限被拒絕。請在瀏覽器設定中允許此網站使用相機，再試一次。',
      '相机权限被拒绝。请在浏览器设置中允许此网站使用相机，再试一次。',
      'カメラへのアクセスが拒否されました。ブラウザ設定で許可してから再試行してください。',
    ),
    nocamera: tx('No camera was found on this device.', '這台裝置找不到相機。', '这台设备找不到相机。', 'カメラが見つかりません。'),
    error: tx('The camera could not be started.', '無法開啟相機。', '无法打开相机。', 'カメラを起動できませんでした。'),
  };

  return createPortal(
    <div className="cam-scan" role="dialog" aria-modal="true" aria-label={tx('Scan barcode', '掃描條碼', '扫描条码', 'バーコードをスキャン')}>
      <video ref={videoRef} className="cam-scan-video" playsInline muted />

      <div className="cam-scan-head">
        <span className="cam-scan-title">{tx('Scan serial labels', '掃描序號條碼', '扫描序号条码', 'シリアルをスキャン')}</span>
        <button className="cam-scan-close" onClick={onClose} aria-label={tx('Close', '關閉', '关闭', '閉じる')}>
          ✕
        </button>
      </div>

      {status === 'scanning' ? (
        <div className="cam-scan-frame" aria-hidden="true">
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          <span className="laser" />
        </div>
      ) : (
        <div className="cam-scan-msg" role="status">
          {message[status]}
        </div>
      )}

      <div className="cam-scan-foot">
        <div className="cam-scan-last" aria-live="polite">
          {last ? (
            <span key={last.n} className={'cam-scan-chip' + (last.ok ? '' : ' dup')}>
              {last.ok ? '+ ' : ''}
              {last.code}
              {!last.ok && <em>{tx(' already added', ' 已在清單', ' 已在清单', ' 追加済み')}</em>}
            </span>
          ) : (
            status === 'scanning' && (
              <span className="cam-scan-hint">
                {tx('Point at a barcode — it adds automatically', '對準條碼，掃到會自動加入', '对准条码，扫到会自动加入', 'バーコードに向けると自動で追加')}
              </span>
            )
          )}
        </div>
        <button className="btn-lg primary cam-scan-done" onClick={onClose}>
          {tx('Done', '完成', '完成', '完了')} · {count}
        </button>
      </div>
    </div>,
    document.body,
  );
}
