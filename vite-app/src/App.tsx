// src/App.tsx — top-level app with real API integration.
//
// State is loaded from the backend on mount; every mutation goes through an
// API call and the UI updates after the call succeeds. Optimistic updates are
// kept lightweight (we just refetch the affected resources) to avoid drifting
// out of sync with server-side validation (e.g. stock-can't-go-negative).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CreateBatchItem,
  CreateTransactionInput,
  Location,
  Product,
  Tag,
  Transaction,
} from './types';
import { listAllProducts } from './api/products';
import { listTransactions, createTransaction } from './api/transactions';
import { createBatch } from './api/batches';
import { listTags } from './api/tags';
import { listLocations } from './api/locations';
import { importProductsCsv, exportProductsCsvUrl } from './api/csv';
import { ApiError } from './api/client';
import { L, type Lang } from './lib/i18n';
import { Dashboard } from './components/Dashboard';
import { BatchFlow, type BatchSubmitPayload } from './components/BatchFlow';
import { ProductCombobox } from './components/ProductCombobox';
import { AdjustStockModal } from './components/modals/AdjustStockModal';
import { ProductPickerModal } from './components/modals/ProductPickerModal';
import { Toast, type ToastState } from './components/Toast';

// ---- recent SKU memory (localStorage) -------------------------------------

const RECENT_MAX = 5;
const RECENT_KEY = 'inv.recentSkus';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---- view state -----------------------------------------------------------

type View = { kind: 'dashboard' } | { kind: 'batch'; batchKind: 'inbound' | 'outbound' };

type Modal =
  | null
  | { kind: 'adjust'; product: Product }
  | { kind: 'picker'; onPick: (p: Product) => void };

// ---- App ------------------------------------------------------------------

export function App() {
  const [lang, setLang] = useState<Lang>('en');

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recentSkus, setRecentSkus] = useState<string[]>(loadRecent);

  const [view, setView] = useState<View>({ kind: 'dashboard' });
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const t = L[lang];

  // ---- initial fetch -----------------------------------------------------

  const loadAll = useCallback(async () => {
    setBootState('loading');
    setBootError(null);
    try {
      const [productList, txRes, tagList, locList] = await Promise.all([
        listAllProducts(),
        listTransactions({ limit: 50, page: 1 }),
        listTags(),
        listLocations(),
      ]);
      setProducts(productList);
      setTransactions(txRes.data);
      setTags(tagList);
      setLocations(locList);
      setBootState('ready');
    } catch (err) {
      setBootError(err instanceof Error ? err.message : String(err));
      setBootState('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Persist recents
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentSkus));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [recentSkus]);

  // Update <html lang> when language changes
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
    document.body.dataset.lang = lang;
  }, [lang]);

  // ---- helpers -----------------------------------------------------------

  const trackRecent = useCallback((product: Product | null | undefined) => {
    if (!product) return;
    setRecentSkus((prev) => {
      const next = [product.sku, ...prev.filter((s) => s !== product.sku)];
      return next.slice(0, RECENT_MAX);
    });
  }, []);

  const showToast = useCallback(
    (text: string, opts: Partial<ToastState> = {}) => {
      const id = Date.now();
      setToast({ id, text, lang, ...opts });
    },
    [lang],
  );

  const dismissToast = useCallback((id: number) => {
    setToast((curr) => (curr && curr.id === id ? null : curr));
  }, []);

  // Refetch helpers — called after each successful mutation so the UI mirrors
  // server state without us having to guess the exact response shape.
  const refetchProducts = useCallback(async () => {
    try {
      const next = await listAllProducts();
      setProducts(next);
    } catch (err) {
      // non-fatal — toast and keep stale state
      showToast(`${t.loadFailed}: ${(err as Error).message}`, { kind: 'alert' });
    }
  }, [showToast, t.loadFailed]);

  const refetchTransactions = useCallback(async () => {
    try {
      const res = await listTransactions({ limit: 50, page: 1 });
      setTransactions(res.data);
    } catch (err) {
      showToast(`${t.loadFailed}: ${(err as Error).message}`, { kind: 'alert' });
    }
  }, [showToast, t.loadFailed]);

  // Tag id helpers (used for the "undo" reversal flow)
  const adjustTag = useMemo(() => tags.find((tg) => tg.name === 'ADJUST'), [tags]);

  // ---- product picker plumbing ------------------------------------------

  const openPicker = useCallback((onPick: (p: Product) => void) => {
    setModal({ kind: 'picker', onPick });
  }, []);

  // ---- handlers ---------------------------------------------------------

  const handleAdjustProduct = (product: Product) => {
    trackRecent(product);
    setModal({ kind: 'adjust', product });
  };

  const handleAdjustSubmit = async (input: CreateTransactionInput & { sku: string }) => {
    const { sku, ...payload } = input;
    try {
      const newTx = await createTransaction(payload);
      // Optimistically prepend the new transaction; refetch products in background.
      const enriched: Transaction = {
        ...newTx,
        sku: newTx.sku || sku,
        tag_name: newTx.tag_name || tags.find((tg) => tg.id === payload.tag_id)?.name || '',
        location_tag:
          newTx.location_tag ??
          (payload.location_id ? locations.find((l) => l.id === payload.location_id)?.tag ?? null : null),
      };
      setTransactions((prev) => [enriched, ...prev]);
      setModal(null);
      void refetchProducts();

      // Undo = create a reversing transaction (since API has no DELETE).
      const undoTagId = adjustTag?.id ?? payload.tag_id;
      showToast(
        `${t.txSaved} · ${sku} ${payload.quantity_change > 0 ? '+' : ''}${payload.quantity_change}`,
        {
          onUndo: async () => {
            try {
              const reverse = await createTransaction({
                ...payload,
                quantity_change: -payload.quantity_change,
                tag_id: undoTagId,
                remarks: `Undo · ${payload.remarks || ''}`.trim(),
              });
              setTransactions((prev) => [
                { ...reverse, sku: reverse.sku || sku, tag_name: reverse.tag_name || '' },
                ...prev,
              ]);
              void refetchProducts();
              showToast(lang === 'en' ? 'Reversed' : '已復原');
            } catch (err) {
              showToast(`❌ ${(err as Error).message}`, { kind: 'alert', duration: 6000 });
            }
          },
        },
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      showToast(`❌ ${message}`, { kind: 'alert', duration: 6000 });
    }
  };

  const handleBatchSubmit = async (payload: BatchSubmitPayload) => {
    try {
      const items: CreateBatchItem[] = payload.items;
      await createBatch({ name: payload.name, tag_id: payload.tagId, items });
      // Server state has changed — refetch both lists.
      await Promise.all([refetchProducts(), refetchTransactions()]);
      setView({ kind: 'dashboard' });
      showToast(`${t.batchSaved} · ${items.length} ${t.lines}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      // Partial-failure shape: { data: { successful: [...], failed: [...] } }
      let detail = '';
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const body = err.body as any;
        if (body?.data?.failed) {
          detail = ` (${body.data.failed.length} ${lang === 'en' ? 'failed' : '失敗'})`;
        }
      }
      showToast(`❌ ${message}${detail}`, { kind: 'alert', duration: 6000 });
      // Even on partial failure, server may have applied some items — refetch.
      void refetchProducts();
      void refetchTransactions();
    }
  };

  const handleTopbarPick = (id: number | '', product: Product | null) => {
    if (!product) return;
    trackRecent(product);
    setModal({ kind: 'adjust', product });
  };

  // ---- CSV import / export ----------------------------------------------

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    // /api/csv/export streams a CSV download; open in same tab so the browser
    // intercepts the Content-Disposition header.
    const a = document.createElement('a');
    a.href = exportProductsCsvUrl();
    a.download = '';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    showToast(`${t.exported} ${products.length} ${lang === 'en' ? 'products' : '項'}`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = await importProductsCsv(file);
      await refetchProducts();
      showToast(
        lang === 'en'
          ? `${t.importDone} ${result.imported} ${t.rows}`
          : `${t.importDone} ${result.imported} ${t.rows}`,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      showToast(`❌ ${message}`, { kind: 'alert', duration: 6000 });
    }
  };

  // ---- Topbar -----------------------------------------------------------

  const Topbar = () => (
    <div className="tb">
      <div className="logo">
        <span className="mark">S</span>
        {t.appName}
      </div>
      <div style={{ flex: 1, maxWidth: 340, minWidth: 180 }}>
        <ProductCombobox
          products={products}
          recentSkus={recentSkus}
          value=""
          onChange={handleTopbarPick}
          onOpenPicker={() =>
            openPicker((p) => {
              trackRecent(p);
              setModal({ kind: 'adjust', product: p });
            })
          }
          lang={lang}
          variant="topbar"
          placeholder={t.search}
        />
      </div>
      <button
        className="btn"
        onClick={() => setView({ kind: 'batch', batchKind: 'inbound' })}
        disabled={bootState !== 'ready'}
      >
        <span style={{ color: 'var(--ok)', fontWeight: 700 }}>↑</span> {t.inbound}
      </button>
      <button
        className="btn"
        onClick={() => setView({ kind: 'batch', batchKind: 'outbound' })}
        disabled={bootState !== 'ready'}
      >
        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>↓</span> {t.outbound}
      </button>

      <div className="tb-divider" />

      <button className="btn ghost" onClick={handleImportClick} title={t.importCsv}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>⤴</span>
        <span>CSV</span>
      </button>
      <button className="btn ghost" onClick={handleExport} title={t.exportCsv}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>⤵</span>
        <span>CSV</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      <div className="tb-divider" />

      <div className="lang-seg" role="group" aria-label="Language">
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
          EN
        </button>
        <button className={lang === 'zh' ? 'on' : ''} onClick={() => setLang('zh')}>
          中
        </button>
      </div>

      <div className="avatar">A</div>
    </div>
  );

  // ---- Render -----------------------------------------------------------

  if (bootState === 'loading') {
    return (
      <div className="app-shell">
        <Topbar />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
          {t.loading}
        </div>
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="app-shell">
        <Topbar />
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--accent)',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 600 }}>{t.loadFailed}</div>
          <div style={{ color: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--mono)' }}>{bootError}</div>
          <button className="btn-lg" onClick={() => void loadAll()}>
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Topbar />
      {view.kind === 'dashboard' && (
        <Dashboard
          products={products}
          transactions={transactions}
          lang={lang}
          onAdjustProduct={handleAdjustProduct}
        />
      )}
      {view.kind === 'batch' && (
        <BatchFlow
          kind={view.batchKind}
          products={products}
          tags={tags}
          locations={locations}
          recentSkus={recentSkus}
          lang={lang}
          onBack={() => setView({ kind: 'dashboard' })}
          onSubmit={handleBatchSubmit}
          onOpenPicker={openPicker}
          onPickProduct={trackRecent}
        />
      )}

      {modal && modal.kind === 'adjust' && (
        <AdjustStockModal
          product={modal.product}
          tags={tags}
          locations={locations}
          lang={lang}
          onClose={() => setModal(null)}
          onSubmit={handleAdjustSubmit}
        />
      )}
      {modal && modal.kind === 'picker' && (
        <ProductPickerModal
          products={products}
          lang={lang}
          onClose={() => setModal(null)}
          onPick={(p) => {
            const cb = modal.onPick;
            setModal(null);
            cb?.(p);
          }}
        />
      )}

      {toast && (
        <div className="toast-stack">
          <Toast toast={toast} onDismiss={dismissToast} />
        </div>
      )}
    </div>
  );
}
