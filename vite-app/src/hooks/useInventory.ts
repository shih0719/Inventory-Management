import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, Transaction, Tag, Lang, ToastState } from '../types';
import { ApiError } from '../api/client';
import { listAllProducts } from '../api/products';
import { listTransactions } from '../api/transactions';
import { listTags } from '../api/tags';
import { L } from '../lib/i18n';

const RECENT_KEY = 'inv.recentSkus';
const RECENT_MAX = 5;
const RECENT_TX_LIMIT = 50;

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

export type BootState = 'loading' | 'ready' | 'error';

export interface Inventory {
  products: Product[];
  /** The latest transactions of the warehouse (first page of the history). */
  transactions: Transaction[];
  tags: Tag[];
  /** SKUs picked most recently, newest first. */
  recentSkus: string[];
  bootState: BootState;
  bootError: string | null;
  /** The ADJUST tag, used to reverse a quick adjustment. */
  adjustTag: Tag | undefined;
  loadAll: () => Promise<void>;
  refetchProducts: () => Promise<void>;
  refetchTransactions: () => Promise<void>;
  /** Show a transaction just created, before the next refetch. */
  prependTransaction: (tx: Transaction) => void;
  trackRecent: (product: Product | null | undefined) => void;
}

/**
 * The selected warehouse's products, latest transactions and tags. Loads when a
 * warehouse is selected (`warehouseId`) and empties when it is cleared.
 */
export function useInventory(
  lang: Lang,
  warehouseId: number | null,
  showToast: (text: string, opts?: Partial<ToastState>) => void,
): Inventory {
  const t = L[lang];
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recentSkus, setRecentSkus] = useState<string[]>(loadRecent);
  const [bootState, setBootState] = useState<BootState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setBootState('loading');
    setBootError(null);
    try {
      const [productList, txRes, tagList] = await Promise.all([
        listAllProducts(),
        listTransactions({ limit: RECENT_TX_LIMIT, page: 1 }),
        listTags(),
      ]);
      setProducts(productList);
      setTransactions(txRes.data);
      setTags(tagList);
      setBootState('ready');
    } catch (err) {
      // 401 already ended the session (see useSession); the login page takes over.
      if (err instanceof ApiError && err.status === 401) return;
      console.error('[loadAll] Error:', err);
      setBootError(err instanceof Error ? err.message : String(err));
      setBootState('error');
    }
  }, []);

  useEffect(() => {
    if (warehouseId) {
      void loadAll();
    } else {
      setProducts([]);
      setTransactions([]);
      setBootState('ready');
    }
  }, [warehouseId, loadAll]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentSkus));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [recentSkus]);

  const refetchProducts = useCallback(async () => {
    try {
      setProducts(await listAllProducts());
    } catch (err) {
      showToast(`${t.loadFailed}: ${(err as Error).message}`, { kind: 'alert' });
    }
  }, [showToast, t.loadFailed]);

  const refetchTransactions = useCallback(async () => {
    try {
      setTransactions((await listTransactions({ limit: RECENT_TX_LIMIT, page: 1 })).data);
    } catch (err) {
      showToast(`${t.loadFailed}: ${(err as Error).message}`, { kind: 'alert' });
    }
  }, [showToast, t.loadFailed]);

  const prependTransaction = useCallback((tx: Transaction) => {
    setTransactions((prev) => [tx, ...prev]);
  }, []);

  const trackRecent = useCallback((product: Product | null | undefined) => {
    if (!product) return;
    setRecentSkus((prev) => [product.sku, ...prev.filter((s) => s !== product.sku)].slice(0, RECENT_MAX));
  }, []);

  const adjustTag = useMemo(() => tags.find((tg) => tg.name === 'ADJUSTMENT'), [tags]);

  return {
    products,
    transactions,
    tags,
    recentSkus,
    bootState,
    bootError,
    adjustTag,
    loadAll,
    refetchProducts,
    refetchTransactions,
    prependTransaction,
    trackRecent,
  };
}
