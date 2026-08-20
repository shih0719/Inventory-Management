import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { Product, Transaction, Tag, Lang, ToastState } from '../types';
import { listAllProducts } from '../api/products';
import { listTransactions } from '../api/transactions';
import { L } from '../lib/i18n';

const RECENT_MAX = 5;

export function useAppHelpers(
  lang: Lang,
  products: Product[],
  tags: Tag[],
  setRecentSkus: (skus: string[] | ((prev: string[]) => string[])) => void,
  setToast: Dispatch<SetStateAction<ToastState | null>>,
  setProducts: (products: Product[]) => void,
  setTransactions: (txs: Transaction[]) => void,
) {
  const t = L[lang];

  const trackRecent = useCallback(
    (product: Product | null | undefined) => {
      if (!product) return;
      setRecentSkus((prev) => {
        const next = [product.sku, ...prev.filter((s) => s !== product.sku)];
        return next.slice(0, RECENT_MAX);
      });
    },
    [setRecentSkus],
  );

  const showToast = useCallback(
    (text: string, opts: Partial<ToastState> = {}) => {
      const id = Date.now();
      setToast({ id, text, lang, ...opts });
    },
    [lang, setToast],
  );

  const dismissToast = useCallback(
    (id: number) => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
    },
    [setToast],
  );

  const refetchProducts = useCallback(async () => {
    try {
      const next = await listAllProducts();
      setProducts(next);
    } catch (err) {
      showToast(`${t.loadFailed}: ${(err as Error).message}`, { kind: 'alert' });
    }
  }, [showToast, t.loadFailed, setProducts]);

  const refetchTransactions = useCallback(async () => {
    try {
      const res = await listTransactions({ limit: 50, page: 1 });
      setTransactions(res.data);
    } catch (err) {
      showToast(`${t.loadFailed}: ${(err as Error).message}`, { kind: 'alert' });
    }
  }, [showToast, t.loadFailed, setTransactions]);

  const adjustTag = useMemo(() => tags.find((tg) => tg.name === 'ADJUST'), [tags]);

  return {
    trackRecent,
    showToast,
    dismissToast,
    refetchProducts,
    refetchTransactions,
    adjustTag,
  };
}
