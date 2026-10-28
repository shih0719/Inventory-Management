import { useCallback, useRef } from 'react';
import type {
  Product,
  Transaction,
  Lang,
  CreateTransactionInput,
  CreateBatchItem,
  Modal,
  ToastState,
} from '../types';
import type { BatchSubmitPayload } from '../components/BatchFlow';
import type { Inventory } from './useInventory';
import { ApiError } from '../api/client';
import { createTransaction } from '../api/transactions';
import { createBatch } from '../api/batches';
import { createOutbound } from '../api/outbound';
import { exportProductsCsv, importProductsCsv } from '../api/csv';
import { L } from '../lib/i18n';
import type { View } from '../lib/routes';

export interface AppHandlersDeps {
  lang: Lang;
  inventory: Inventory;
  showToast: (text: string, opts?: Partial<ToastState>) => void;
  setModal: (modal: Modal) => void;
  navigateTo: (view: View) => void;
}

/** Stock-changing actions started from the app shell (adjust, batch, CSV import/export). */
export function useAppHandlers({ lang, inventory, showToast, setModal, navigateTo }: AppHandlersDeps) {
  const t = L[lang];
  const { products, tags, adjustTag, trackRecent, refetchProducts, refetchTransactions, prependTransaction } = inventory;
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
        prependTransaction(enriched);
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
                prependTransaction({ ...reverse, sku: reverse.sku || sku, tag_name: reverse.tag_name || '' });
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
    [tags, prependTransaction, setModal, refetchProducts, adjustTag, showToast, t.txSaved, lang],
  );

  const handleBatchSubmit = useCallback(
    async (payload: BatchSubmitPayload) => {
      try {
        const items: CreateBatchItem[] = payload.items;
        let suffix = `${items.length} ${t.lines}`;
        if (payload.outbound) {
          const result = await createOutbound({
            tag_id: payload.tagId,
            description: payload.name,
            items: items.map((i) => ({
              product_id: i.product_id,
              quantity: Math.abs(i.quantity_change),
              quantity_type: i.quantity_type,
              remarks: i.remarks,
            })),
            serial_numbers: payload.outbound.serials,
            shipment: payload.outbound.shipment,
          });
          suffix = result.shipment_number ?? `${items.length + payload.outbound.serials.length} ${t.lines}`;
        } else {
          await createBatch({ description: payload.name, tag_id: payload.tagId, items });
        }
        await Promise.all([refetchProducts(), refetchTransactions()]);
        navigateTo({ kind: 'dashboard' });
        showToast(`${t.batchSaved} · ${suffix}`);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : (err as Error).message;
        let detail = '';
        if (err instanceof ApiError && err.body && typeof err.body === 'object') {
          const body = err.body as any;
          if (body?.data?.failed) {
            detail = ` (${body.data.failed.length} ${lang === 'en' ? 'failed' : lang.startsWith('zh') ? '失敗' : '失敗'})`;
          }
          if (Array.isArray(body?.errors) && body.errors.length > 0) {
            // Already text in the UI language (see api/client.ts).
            detail = ` — ${body.errors[0]}`;
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
        // Show the first failed row, already in the UI language (see api/csv.ts).
        const errors = err instanceof ApiError ? (err.body as { errors?: unknown[] } | null)?.errors : undefined;
        const detail = Array.isArray(errors) && errors.length > 0 ? ` — ${errors[0]}` : '';
        showToast(`❌ ${message}${detail}`, { kind: 'alert', duration: 6000 });
      }
    },
    [refetchProducts, showToast, lang, t.importDone, t.rows],
  );

  return {
    handleAdjustProduct,
    handleAdjustSubmit,
    handleBatchSubmit,
    handleTopbarPick,
    handleExport,
    handleImportClick,
    handleImportFile,
    fileInputRef,
  };
}
