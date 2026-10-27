import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
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
  setTransactions: Dispatch<SetStateAction<Transaction[]>>;
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  recentSkus: string[];
  setRecentSkus: (skus: string[]) => void;
  modal: Modal;
  setModal: (modal: Modal) => void;
  toast: ToastState | null;
  setToast: (toast: ToastState | null) => void;
  bootState: 'loading' | 'ready' | 'error';
  setBootState: (state: 'loading' | 'ready' | 'error') => void;
  bootError: string | null;
  setBootError: (error: string | null) => void;
  loadAll: () => Promise<void>;
}

const RECENT_KEY = 'inv.recentSkus';
const LANG_KEY = 'inv.lang';
const LANGS: Lang[] = ['en', 'zh', 'zh-cn', 'ja'];

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    return saved && LANGS.includes(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

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
  const [lang, setLang] = useState<Lang>(loadLang);
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

  // ---- update <html lang> + persist choice
  useEffect(() => {
    const langMap: Record<Lang, string> = { en: 'en', zh: 'zh-Hant', 'zh-cn': 'zh-Hans', ja: 'ja' };
    document.documentElement.lang = langMap[lang];
    document.body.dataset.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* quota / private mode — ignore */
    }
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
    modal,
    setModal,
    toast,
    setToast,
    bootState,
    setBootState,
    bootError,
    setBootError,
    loadAll,
  };
}
