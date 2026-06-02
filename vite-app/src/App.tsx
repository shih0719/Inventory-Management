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
  Product,
  Tag,
  Transaction,
} from './types';
import { listAllProducts } from './api/products';
import { listTransactions, createTransaction } from './api/transactions';
import { createBatch } from './api/batches';
import { listTags } from './api/tags';
import { importProductsCsv, exportProductsCsv, downloadCsvTemplate } from './api/csv';
import { ApiError, getToken, clearToken } from './api/client';
import { logout, getCurrentUser, type User } from './api/auth';
import { ChangePasswordModal } from './components/modals/ChangePasswordModal';
import { CreateProductModal } from './components/modals/CreateProductModal';
import { L, type Lang } from './lib/i18n';
import { Dashboard } from './components/Dashboard';
import { BatchFlow, type BatchSubmitPayload } from './components/BatchFlow';
import { APProductsPage } from './components/APProductsPage';
import { ShipmentsPage } from './components/ShipmentsPage';
import { AuditLogsPage } from './components/AuditLogsPage';
import { ReportsPage } from './components/ReportsPage';
import { WarehousesPage } from './components/WarehousesPage';
import { UsersPage } from './components/UsersPage';
import { BackupSettingsPage } from './components/BackupSettingsPage';
import { ProductCombobox } from './components/ProductCombobox';
import { Dropdown, DropdownItem } from './components/Dropdown';
import { AdjustStockModal } from './components/modals/AdjustStockModal';
import { ProductPickerModal } from './components/modals/ProductPickerModal';
import { APProductModal } from './components/modals/APProductModal';
import { TransactionDetailModal } from './components/modals/TransactionDetailModal';
import { BatchDetailModal } from './components/modals/BatchDetailModal';
import { ShipmentDetailModal } from './components/modals/ShipmentDetailModal';
import { Toast, type ToastState } from './components/Toast';
import { LoginPage } from './components/LoginPage';
import { WarehouseSelector } from './components/WarehouseSelector';
import { getActiveWarehouseId, type ActiveWarehouse } from './context/ActiveWarehouseContext';

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

type View =
  | { kind: 'dashboard' }
  | { kind: 'batch'; batchKind: 'inbound' | 'outbound' }
  | { kind: 'ap-products' }
  | { kind: 'shipments' }
  | { kind: 'audit-logs' }
  | { kind: 'reports' }
  | { kind: 'warehouses' }
  | { kind: 'users' }
  | { kind: 'backup-settings' };

type Modal =
  | null
  | { kind: 'adjust'; product: Product }
  | { kind: 'picker'; onPick: (p: Product) => void }
  | { kind: 'ap-product'; product: Product }
  | { kind: 'transaction-detail'; transactionId: number }
  | { kind: 'batch-detail'; batchId: number }
  | { kind: 'shipment-detail'; shipmentId: number }
  | { kind: 'change-password' }
  | { kind: 'create-product' };

// ---- App ------------------------------------------------------------------

export function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [activeWarehouse, setActiveWarehouse] = useState<ActiveWarehouse | null>(() => {
    const id = getActiveWarehouseId();
    const name = (() => { try { return localStorage.getItem('inv.warehouseName'); } catch { return null; } })();
    return id && name ? { id, name } : null;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recentSkus, setRecentSkus] = useState<string[]>(loadRecent);

  const [view, setView] = useState<View>({ kind: 'dashboard' });
  const [viewHistory, setViewHistory] = useState<View[]>([]);
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
      const [productList, txRes, tagList] = await Promise.all([
        listAllProducts(),
        listTransactions({ limit: 50, page: 1 }),
        listTags(),
      ]);
      setProducts(productList);
      setTransactions(txRes.data);
      setTags(tagList);
      setBootState('ready');
    } catch (err) {
      // Token expired (401) — logout + redirect to login
      if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setActiveWarehouse(null);
        clearToken();
        localStorage.removeItem('inv.warehouseId');
        localStorage.removeItem('inv.warehouseName');
        return;
      }
      setBootError(err instanceof Error ? err.message : String(err));
      setBootState('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const navigateTo = useCallback((newView: View) => {
    setViewHistory((prev) => [...prev, view]);
    setView(newView);
    window.history.pushState({}, '');
  }, [view]);

  useEffect(() => {
    const handlePopState = () => {
      setViewHistory((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        setView(last);
        return prev.slice(0, -1);
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Restore current user info on page refresh (if logged in but currentUser is null)
  useEffect(() => {
    if (isAuthenticated && !currentUser) {
      (async () => {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } catch (err) {
          // If getting current user fails, just continue without it
          console.error('Failed to get current user:', err);
        }
      })();
    }
  }, [isAuthenticated, currentUser]);

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
    const langMap = { en: 'en', zh: 'zh-Hant', ja: 'ja' };
    document.documentElement.lang = langMap[lang];
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
              showToast(lang === 'en' ? 'Reversed' : lang.startsWith('zh') ? '已復原' : '取り消されました');
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
      navigateTo({ kind: 'dashboard' });
      showToast(`${t.batchSaved} · ${items.length} ${t.lines}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : (err as Error).message;
      // Partial-failure shape: { data: { successful: [...], failed: [...] } }
      let detail = '';
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const body = err.body as any;
        if (body?.data?.failed) {
          detail = ` (${body.data.failed.length} ${lang === 'en' ? 'failed' : lang.startsWith('zh') ? '失敗' : '失敗'})`;

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setActiveWarehouse(null);
      localStorage.removeItem('inv.warehouseId');
      localStorage.removeItem('inv.warehouseName');
    }
  };

  const handleWarehouseSelect = (wh: ActiveWarehouse) => {
    localStorage.setItem('inv.warehouseId', String(wh.id));
    localStorage.setItem('inv.warehouseName', wh.name);
    setActiveWarehouse(wh);
    setView({ kind: 'dashboard' });
    void loadAll();
  };

  const handleSwitchWarehouse = () => {
    setActiveWarehouse(null);
    localStorage.removeItem('inv.warehouseId');
    localStorage.removeItem('inv.warehouseName');
    setView({ kind: 'dashboard' });
    setProducts([]);
    setTransactions([]);
  };

  // ---- CSV import / export ----------------------------------------------

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    try {
      await exportProductsCsv();
      showToast(`${t.exported} ${products.length} ${lang === 'en' ? 'products' : lang.startsWith('zh') ? '項' : '製品'}`);
    } catch (err) {
      showToast((err as Error).message, { kind: 'alert' });
    }
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

  // ---- role helpers -------------------------------------------------------

  const canWrite = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  // ---- Topbar -----------------------------------------------------------

  const Topbar = () => (
    <div className="tb">
      <button
        className="logo"
        onClick={() => navigateTo({ kind: 'dashboard' })}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span className="mark">S</span>
        {t.appName}
      </button>
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

      {canWrite && (
        <button
          className="btn"
          onClick={() => setModal({ kind: 'create-product' })}
          disabled={bootState !== 'ready'}
          title={lang === 'en' ? 'New Product' : lang.startsWith('zh') ? '新增產品' : '商品追加'}
        >
          + {lang === 'en' ? 'Product' : lang.startsWith('zh') ? '產品' : '商品'}
        </button>
      )}
      {canWrite && (
        <button
          className="btn"
          onClick={() => navigateTo({ kind: 'batch', batchKind: 'inbound' })}
          disabled={bootState !== 'ready'}
        >
          <span style={{ color: 'var(--ok)', fontWeight: 700 }}>↑</span> {t.inbound}
        </button>
      )}
      {canWrite && (
        <button
          className="btn"
          onClick={() => navigateTo({ kind: 'batch', batchKind: 'outbound' })}
          disabled={bootState !== 'ready'}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>↓</span> {t.outbound}
        </button>
      )}

      <div className="tb-divider" />

      <Dropdown
        trigger={lang === 'en' ? 'Manage' : lang.startsWith('zh') ? '管理' : '管理'}
        disabled={bootState !== 'ready'}
      >
        <DropdownItem onClick={() => navigateTo({ kind: 'ap-products' })} disabled={bootState !== 'ready'}>
          🏷 {lang === 'en' ? 'AP Products' : lang.startsWith('zh') ? 'AP 序號品' : 'AP商品'}
        </DropdownItem>
        <DropdownItem onClick={() => navigateTo({ kind: 'shipments' })} disabled={bootState !== 'ready'}>
          📦 {lang === 'en' ? 'Shipments' : lang.startsWith('zh') ? '出貨單據' : '配送'}
        </DropdownItem>
        <DropdownItem onClick={() => navigateTo({ kind: 'reports' })} disabled={bootState !== 'ready'}>
          📊 {lang === 'en' ? 'Inventory Report' : lang.startsWith('zh') ? '庫存報表' : '在庫レポート'}
        </DropdownItem>
        {isAdmin && (
          <DropdownItem onClick={() => navigateTo({ kind: 'audit-logs' })} disabled={bootState !== 'ready'}>
            📋 {lang === 'en' ? 'Audit Logs' : lang.startsWith('zh') ? '操作日誌' : '操作ログ'}
          </DropdownItem>
        )}
        {isAdmin && (
          <DropdownItem onClick={() => navigateTo({ kind: 'users' })} disabled={bootState !== 'ready'}>
            👥 {lang === 'en' ? 'Users' : lang.startsWith('zh') ? '使用者管理' : 'ユーザー管理'}
          </DropdownItem>
        )}
        {isAdmin && (
          <DropdownItem onClick={() => navigateTo({ kind: 'warehouses' })} disabled={bootState !== 'ready'}>
            🏭 {lang === 'en' ? 'Warehouses' : lang.startsWith('zh') ? '倉庫管理' : '倉庫管理'}
          </DropdownItem>
        )}
        {isAdmin && (
          <DropdownItem onClick={() => navigateTo({ kind: 'backup-settings' })} disabled={bootState !== 'ready'}>
            💾 {lang === 'en' ? 'Backup Settings' : lang.startsWith('zh') ? '備份設定' : 'バックアップ設定'}
          </DropdownItem>
        )}
      </Dropdown>

      <div className="tb-divider" />

      {canWrite && (
        <button className="btn ghost" onClick={handleImportClick} title={t.importCsv}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>⤴</span>
          <span>CSV</span>
        </button>
      )}
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

      <Dropdown
        trigger={<span style={{ fontSize: 14 }}>🌐</span>}
        align="right"
      >
        {(['en', 'zh', 'zh-cn', 'ja'] as const).map((l) => (
          <DropdownItem key={l} onClick={() => setLang(l)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-3)', minWidth: 28 }}>
                {l === 'en' ? 'EN' : l === 'zh' ? '繁' : l === 'zh-cn' ? '简' : 'JP'}
              </span>
              <span>{l === 'en' ? 'English' : l === 'zh' ? '繁體中文' : l === 'zh-cn' ? '简体中文' : '日本語'}</span>
              {lang === l && <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>✓</span>}
            </span>
          </DropdownItem>
        ))}
      </Dropdown>

      {activeWarehouse && (
        <button
          className="btn ghost"
          onClick={handleSwitchWarehouse}
          title={lang === 'en' ? 'Switch warehouse' : lang.startsWith('zh') ? '切換倉庫' : '倉庫を切り替え'}
          style={{ fontSize: 12, gap: 4 }}
        >
          🏭 <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeWarehouse.name}</span>
        </button>
      )}

      <Dropdown trigger={currentUser?.username?.[0]?.toUpperCase() || 'A'} align="right">
        <DropdownItem disabled>{currentUser?.username}</DropdownItem>
        {currentUser?.provider === 'local' && (
          <DropdownItem onClick={() => setModal({ kind: 'change-password' })}>{lang === 'en' ? 'Change Password' : lang.startsWith('zh') ? '修改密碼' : 'パスワード変更'}</DropdownItem>
        )}
        <DropdownItem onClick={handleLogout}>{lang === 'en' ? 'Sign out' : lang.startsWith('zh') ? '登出' : 'ログアウト'}</DropdownItem>
      </Dropdown>
    </div>
  );

  // ---- Render -----------------------------------------------------------

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={(user) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
      // Don't loadAll yet — wait for warehouse selection
    }} lang={lang} />;
  }

  if (!activeWarehouse) {
    return (
      <WarehouseSelector
        userWarehouseIds={currentUser?.warehouses ?? []}
        onSelect={handleWarehouseSelect}
        lang={lang}
      />
    );
  }

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
          onManageAPProduct={(product) => setModal({ kind: 'ap-product', product })}
          onViewTransaction={(tx) => setModal({ kind: 'transaction-detail', transactionId: tx.id })}
        />
      )}
      {view.kind === 'batch' && (
        <BatchFlow
          kind={view.batchKind}
          products={products}
          tags={tags}
          recentSkus={recentSkus}
          lang={lang}

          onSubmit={handleBatchSubmit}
          onOpenPicker={openPicker}
          onPickProduct={trackRecent}
        />
      )}
      {view.kind === 'ap-products' && (
        <APProductsPage
          products={products}
          lang={lang}

          onSelectProduct={(product) => setModal({ kind: 'ap-product', product })}
          onRefresh={() => void refetchProducts()}
        />
      )}
      {view.kind === 'shipments' && (
        <ShipmentsPage
          lang={lang}

        />
      )}
      {view.kind === 'reports' && (
        <ReportsPage
          lang={lang}

        />
      )}
      {view.kind === 'audit-logs' && (
        <AuditLogsPage
          lang={lang}

          onResourceClick={(resourceType, resourceId) => {
            if (resourceType === 'transaction') {
              setModal({ kind: 'transaction-detail', transactionId: resourceId });
            } else if (resourceType === 'batch') {
              setModal({ kind: 'batch-detail', batchId: resourceId });
            } else if (resourceType === 'shipment') {
              setModal({ kind: 'shipment-detail', shipmentId: resourceId });
            } else if (resourceType === 'product') {
              const product = products.find((p) => p.id === resourceId);
              if (product) {
                setModal({ kind: 'adjust', product });
              } else {
                showToast(`${lang === 'en' ? 'Product not found' : lang.startsWith('zh') ? '產品未找到' : '製品が見つかりません'}`, { kind: 'alert' });
              }
            }
          }}
        />
      )}
      {view.kind === 'warehouses' && (
        <WarehousesPage lang={lang} />
      )}
      {view.kind === 'users' && (
        <UsersPage lang={lang} />
      )}
      {view.kind === 'backup-settings' && (
        <BackupSettingsPage lang={lang} />
      )}

      {modal && modal.kind === 'adjust' && (
        <AdjustStockModal
          product={modal.product}
          tags={tags}
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
      {modal && modal.kind === 'ap-product' && (
        <APProductModal
          product={modal.product}
          lang={lang}
          onClose={() => setModal(null)}
          onProductUpdated={refetchProducts}
        />
      )}
      {modal && modal.kind === 'transaction-detail' && (
        <TransactionDetailModal
          transactionId={modal.transactionId}
          lang={lang}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal.kind === 'batch-detail' && (
        <BatchDetailModal
          batchId={modal.batchId}
          lang={lang}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal.kind === 'shipment-detail' && (
        <ShipmentDetailModal
          shipmentId={modal.shipmentId}
          lang={lang}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal.kind === 'change-password' && (
        <ChangePasswordModal
          lang={lang}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            showToast(lang.startsWith('zh') ? '密碼已更新' : lang === 'ja' ? 'パスワードを変更しました' : 'Password updated');
          }}
        />
      )}

      {modal && modal.kind === 'create-product' && (
        <CreateProductModal
          lang={lang}
          onClose={() => setModal(null)}
          onCreated={() => {
            void refetchProducts();
            showToast(lang.startsWith('zh') ? '產品已建立' : lang === 'ja' ? '商品を作成しました' : 'Product created');
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
