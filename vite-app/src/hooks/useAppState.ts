import { useState, useEffect, useCallback } from 'react';
import type {
  Product,
  Transaction,
  Tag,
  User,
  Lang,
  ToastState,
} from '../types';
import type { ActiveWarehouse } from '../context/ActiveWarehouseContext';
import { getToken, clearToken } from '../api/client';
import { getActiveWarehouseId } from '../context/ActiveWarehouseContext';
import { listAllProducts } from '../api/products';
import { listTransactions } from '../api/transactions';
import { listTags } from '../api/tags';
import { getCurrentUser } from '../api/auth';

type View =
  | { kind: 'dashboard' }
  | { kind: 'batch'; batchKind: 'inbound' | 'outbound' }
  | { kind: 'ap-products' }
  | { kind: 'edit-products' }
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

export interface AppState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  activeWarehouse: ActiveWarehouse | null;
  setActiveWarehouse: (wh: ActiveWarehouse | null) => void;
  products: Product[];
  setProducts: (products: Product[]) => void;
  transactions: Transaction[];
  setTransactions: (txs: Transaction[]) => void;
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  recentSkus: string[];
  setRecentSkus: (skus: string[]) => void;
  view: View;
  setView: (view: View) => void;
  viewHistory: View[];
  setViewHistory: (history: View[]) => void;
  modal: Modal;
  setModal: (modal: Modal) => void;
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
  bootState: 'loading' | 'ready' | 'error';
  setBootState: (state: 'loading' | 'ready' | 'error') => void;
  bootError: string | null;
  setBootError: (error: string | null) => void;
}

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

export function useAppState(): AppState {
  const [lang, setLang] = useState<Lang>('en');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [activeWarehouse, setActiveWarehouse] = useState<ActiveWarehouse | null>(() => {
    const id = getActiveWarehouseId();
    const name = (() => {
      try {
        return localStorage.getItem('inv.warehouseName');
      } catch {
        return null;
      }
    })();
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

  // ---- initial fetch
  const loadAll = useCallback(async () => {
    console.log('[loadAll] Starting...');
    setBootState('loading');
    setBootError(null);
    try {
      console.log('[loadAll] Fetching products, transactions, tags...');
      const startTime = performance.now();
      const [productList, txRes, tagList] = await Promise.all([
        listAllProducts(),
        listTransactions({ limit: 50, page: 1 }),
        listTags(),
      ]);
      const duration = performance.now() - startTime;
      console.log(`[loadAll] Data fetched in ${duration.toFixed(0)}ms`, {
        productsCount: productList.length,
        transactionsCount: txRes.data.length,
        tagsCount: tagList.length,
      });
      setProducts(productList);
      setTransactions(txRes.data);
      setTags(tagList);
      console.log('[loadAll] Setting bootState to ready');
      setBootState('ready');
    } catch (err) {
      console.error('[loadAll] Error:', err);
      if (err instanceof Error && 'status' in err && (err as any).status === 401) {
        console.log('[loadAll] 401 Unauthorized - clearing auth');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setActiveWarehouse(null);
        clearToken();
        localStorage.removeItem('inv.warehouseId');
        localStorage.removeItem('inv.warehouseName');
        setBootState('ready');
        return;
      }
      setBootError(err instanceof Error ? err.message : String(err));
      setBootState('error');
    }
  }, []);

  useEffect(() => {
    // Load data when authenticated and warehouse is selected
    if (isAuthenticated && activeWarehouse) {
      console.log('[useEffect] Triggering loadAll - auth & warehouse ready');
      void loadAll();
    } else if (isAuthenticated && !activeWarehouse) {
      // If authenticated but no warehouse, just mark as ready to show warehouse selector
      console.log('[useEffect] Authenticated but no warehouse selected');
      setBootState('ready');
    }
  }, [isAuthenticated, activeWarehouse, loadAll]);

  // ---- navigation
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

  // ---- restore current user on page refresh
  useEffect(() => {
    if (isAuthenticated && !currentUser) {
      (async () => {
        try {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } catch (err) {
          console.error('Failed to get current user:', err);
        }
      })();
    }
  }, [isAuthenticated, currentUser]);

  // ---- persist recents
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentSkus));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [recentSkus]);

  // ---- update <html lang>
  useEffect(() => {
    const langMap = { en: 'en', zh: 'zh-Hant', ja: 'ja' };
    document.documentElement.lang = langMap[lang];
    document.body.dataset.lang = lang;
  }, [lang]);

  return {
    lang,
    setLang,
    currentUser,
    setCurrentUser,
    isAuthenticated,
    setIsAuthenticated,
    activeWarehouse,
    setActiveWarehouse,
    products,
    setProducts,
    transactions,
    setTransactions,
    tags,
    setTags,
    recentSkus,
    setRecentSkus,
    view,
    setView,
    viewHistory,
    setViewHistory,
    modal,
    setModal,
    toast,
    setToast,
    bootState,
    setBootState,
    bootError,
    setBootError,
  };
}
