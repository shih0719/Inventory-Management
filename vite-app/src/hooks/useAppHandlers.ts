import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type {
  Product,
  Transaction,
  Tag,
  Lang,
  CreateTransactionInput,
  CreateBatchItem,
  ToastState,
} from '../types';
import type { ActiveWarehouse } from '../context/ActiveWarehouseContext';
import type { BatchSubmitPayload } from '../components/BatchFlow';
import { ApiError } from '../api/client';
import { createTransaction } from '../api/transactions';
import { createBatch } from '../api/batches';
import { logout } from '../api/auth';
import { exportProductsCsv, importProductsCsv } from '../api/csv';
import { L } from '../lib/i18n';

type View =
  | { kind: 'dashboard' }
  | { kind: 'batch'; batchKind: 'inbound' | 'outbound' }
  | { kind: 'ap-products' }
  | { kind: 'edit-products' }
  | { kind: 'shipments' }
  | { kind: 'transactions' }
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

export function useAppHandlers(
  lang: Lang,
  products: Product[],
  tags: Tag[],
  setModal: (modal: Modal) => void,
  setView: (view: View) => void,
  setIsAuthenticated: (auth: boolean) => void,
  setCurrentUser: (user: any) => void,
  setActiveWarehouse: (wh: ActiveWarehouse | null) => void,
  setProducts: (products: Product[]) => void,
  setTransactions: Dispatch<SetStateAction<Transaction[]>>,
  trackRecent: (product: Product | null | undefined) => void,
  showToast: (text: string, opts?: Partial<ToastState>) => void,
  refetchProducts: () => Promise<void>,
  refetchTransactions: () => Promise<void>,
  adjustTag: Tag | undefined,
  navigateTo: (view: View) => void,
  loadAll: () => Promise<void>,
) {
  const t = L[lang];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAdjustProduct = useCallback(
    (product: Product) => {
      trackRecent(product);
      setModal({ kind: 'adjust', product });
    },
    [trackRecent, setModal],
  );

  const handleAdjustSubmit = useCallback(
    async (input: CreateTransactionInput & { sku: string }) => {
      const { sku, ...payload } = input;
      try {
        const newTx = await createTransaction(payload);
        const enriched: Transaction = {
          ...newTx,
          sku: newTx.sku || sku,
          tag_name: newTx.tag_name || tags.find((tg) => tg.id === payload.tag_id)?.name || '',
        };
        setTransactions((prev) => [enriched, ...prev]);
        setModal(null);
        void refetchProducts();

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
    },
    [tags, setTransactions, setModal, refetchProducts, adjustTag, showToast, t.txSaved, lang],
  );

  const handleBatchSubmit = useCallback(
    async (payload: BatchSubmitPayload) => {
      try {
        const items: CreateBatchItem[] = payload.items;
        await createBatch({ name: payload.name, tag_id: payload.tagId, items });
        await Promise.all([refetchProducts(), refetchTransactions()]);
        navigateTo({ kind: 'dashboard' });
        showToast(`${t.batchSaved} · ${items.length} ${t.lines}`);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : (err as Error).message;
        let detail = '';
        if (err instanceof ApiError && err.body && typeof err.body === 'object') {
          const body = err.body as any;
          if (body?.data?.failed) {
            detail = ` (${body.data.failed.length} ${lang === 'en' ? 'failed' : lang.startsWith('zh') ? '失敗' : '失敗'})`;
          }
        }
        showToast(`❌ ${message}${detail}`, { kind: 'alert', duration: 6000 });
        void refetchProducts();
        void refetchTransactions();
      }
    },
    [refetchProducts, refetchTransactions, navigateTo, showToast, t.batchSaved, t.lines, lang],
  );

  const handleTopbarPick = useCallback(
    (id: number | '', product: Product | null) => {
      if (!product) return;
      trackRecent(product);
      setModal({ kind: 'adjust', product });
    },
    [trackRecent, setModal],
  );

  const handleLogout = useCallback(async () => {
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
  }, [setIsAuthenticated, setCurrentUser, setActiveWarehouse]);

  const handleWarehouseSelect = useCallback(
    (wh: ActiveWarehouse) => {
      localStorage.setItem('inv.warehouseId', String(wh.id));
      localStorage.setItem('inv.warehouseName', wh.name);
      setActiveWarehouse(wh);
      setView({ kind: 'dashboard' });
      void loadAll();
    },
    [setActiveWarehouse, setView, loadAll],
  );

  const handleSwitchWarehouse = useCallback(() => {
    setActiveWarehouse(null);
    localStorage.removeItem('inv.warehouseId');
    localStorage.removeItem('inv.warehouseName');
    setView({ kind: 'dashboard' });
    setProducts([]);
    setTransactions([]);
  }, [setActiveWarehouse, setView, setProducts, setTransactions]);

  const handleExport = useCallback(async (skus?: string[]) => {
    try {
      await exportProductsCsv({ skus });
      showToast(`${t.exported} ${products.length} ${lang === 'en' ? 'products' : lang.startsWith('zh') ? '項' : '製品'}`);
    } catch (err) {
      showToast((err as Error).message, { kind: 'alert' });
    }
  }, [products.length, showToast, t.exported, lang]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [refetchProducts, showToast, lang, t.importDone, t.rows],
  );

  return {
    handleAdjustProduct,
    handleAdjustSubmit,
    handleBatchSubmit,
    handleTopbarPick,
    handleLogout,
    handleWarehouseSelect,
    handleSwitchWarehouse,
    handleExport,
    handleImportClick,
    handleImportFile,
    fileInputRef,
  };
}
