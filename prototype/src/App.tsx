import { useState, useCallback, useEffect, useRef } from 'react';
import type { Product, Transaction, ToastMessage, Language } from './types';
import { productsAPI, transactionsAPI } from './api';
import { getI18n } from './lib/i18n';
import Dashboard from './components/Dashboard';
import BatchFlow from './components/BatchFlow';
import ProductCombobox from './components/ProductCombobox';
import Toast from './components/Toast';
import AdjustStockModal from './components/modals/AdjustStockModal';
import ProductPickerModal from './components/modals/ProductPickerModal';

type ViewType = 'dashboard' | 'batch';
type ModalType = 'adjust' | 'picker' | null;

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

export default function App() {
  const [lang, setLang] = useState<Language>('zh');
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recentSkus, setRecentSkus] = useState<string[]>(loadRecent());
  const [view, setView] = useState<ViewType>('dashboard');
  const [batchKind, setBatchKind] = useState<'inbound' | 'outbound'>('inbound');
  const [modal, setModal] = useState<ModalType>(null);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = getI18n(lang);

  // 加载初始数据
  useEffect(() => {
    async function loadData() {
      const prods = await productsAPI.list();
      setProducts(prods);
      const txs = await transactionsAPI.list();
      setTransactions(txs);
    }
    loadData();
  }, []);

  // 保存最近使用的 SKU
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentSkus));
    } catch {}
  }, [recentSkus]);

  const trackRecent = useCallback((product: Product) => {
    if (!product) return;
    setRecentSkus(prev => {
      const next = [product.sku, ...prev.filter(s => s !== product.sku)];
      return next.slice(0, RECENT_MAX);
    });
  }, []);

  const showToast = useCallback((text: string, opts: Partial<ToastMessage> = {}) => {
    const id = Date.now();
    setToast({ id, text, ...opts });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToast(curr => (curr && curr.id === id) ? null : curr);
  }, []);

  return (
    <div className="app">
      {/* Topbar */}
      <div className="tb">
        <div className="logo">
          <span className="mark">S</span>{t.appName}
        </div>
        <div style={{ flex: 1, maxWidth: 340, minWidth: 180 }}>
          <ProductCombobox
            products={products}
            recentSkus={recentSkus}
            value=""
            onChange={(_, product) => {
              if (product) {
                trackRecent(product);
                setModalProduct(product);
                setModal('adjust');
              }
            }}
            lang={lang}
            variant="topbar"
            placeholder={t.search}
          />
        </div>

        <button
          className="btn"
          onClick={() => {
            setView('batch');
            setBatchKind('inbound');
          }}
        >
          <span style={{ color: 'var(--ok)', fontWeight: 700 }}>↑</span> {t.inbound}
        </button>
        <button
          className="btn"
          onClick={() => {
            setView('batch');
            setBatchKind('outbound');
          }}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>↓</span> {t.outbound}
        </button>

        <div className="tb-divider"></div>

        <button
          className="btn ghost"
          onClick={() => fileInputRef.current?.click()}
          title={t.importCsv}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>⤴</span>
          <span>CSV</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
        />

        <div className="tb-divider"></div>

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

      {/* Main Content */}
      {view === 'dashboard' && (
        <Dashboard
          products={products}
          transactions={transactions}
          lang={lang}
          onAdjustProduct={(product) => {
            trackRecent(product);
            setModalProduct(product);
            setModal('adjust');
          }}
        />
      )}

      {view === 'batch' && (
        <BatchFlow
          kind={batchKind}
          products={products}
          recentSkus={recentSkus}
          lang={lang}
          onBack={() => setView('dashboard')}
          onSubmit={() => {
            setView('dashboard');
            showToast(t.batchSaved);
          }}
          onOpenPicker={() => setModal('picker')}
          onPickProduct={trackRecent}
        />
      )}

      {/* Modals */}
      {modal === 'adjust' && modalProduct && (
        <AdjustStockModal
          product={modalProduct}
          lang={lang}
          onClose={() => {
            setModal(null);
            setModalProduct(null);
          }}
          onSubmit={() => {
            setModal(null);
            setModalProduct(null);
            showToast(t.txSaved);
          }}
        />
      )}

      {modal === 'picker' && (
        <ProductPickerModal
          products={products}
          lang={lang}
          onClose={() => setModal(null)}
          onPick={(product) => {
            trackRecent(product);
            setModal(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-stack">
          <Toast toast={toast} onDismiss={dismissToast} />
        </div>
      )}
    </div>
  );
}
