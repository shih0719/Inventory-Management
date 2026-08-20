// src/components/ProductCombobox.tsx
import { useEffect, useMemo, useRef, useState, Fragment, CSSProperties } from 'react';
import type { Product } from '../types';
import { L, type Lang } from '../lib/i18n';

export interface ProductComboboxProps {
  products: Product[];
  recentSkus?: string[];
  value: number | string | '';
  onChange: (id: number | '', product: Product | null) => void;
  onOpenPicker?: (onPick: (p: Product) => void) => void;
  lang: Lang;
  placeholder?: string;
  variant?: 'default' | 'topbar';
  showQty?: boolean;
}

/**
 * Type-ahead product selector. Up/Down/Enter/Esc keyboard control,
 * "Recent" section when query is empty, optional `Browse all` modal.
 */
export function ProductCombobox({
  products,
  recentSkus = [],
  value,
  onChange,
  onOpenPicker,
  lang,
  placeholder,
  variant = 'default',
  showQty = true,
}: ProductComboboxProps) {
  const t = L[lang];
  const selected = value ? products.find((p) => p.id === Number(value)) : null;

  const labelFor = (p: Product) => `${p.sku} · ${p.name}`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [popStyle, setPopStyle] = useState<CSSProperties | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPopStyle(null);
      return;
    }
    const calc = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const popHeight = 360;
      const vh = window.innerHeight;
      const placeAbove = r.bottom + popHeight + 8 > vh && r.top > popHeight;
      setPopStyle({
        position: 'fixed',
        left: r.left + 'px',
        width: r.width + 'px',
        top: placeAbove ? r.top - 4 + 'px' : r.bottom + 4 + 'px',
        transform: placeAbove ? 'translateY(-100%)' : 'none',
        zIndex: 1500,
      });
    };
    calc();
    window.addEventListener('scroll', calc, true);
    window.addEventListener('resize', calc);
    return () => {
      window.removeEventListener('scroll', calc, true);
      window.removeEventListener('resize', calc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrap = wrapRef.current && wrapRef.current.contains(target);
      const inPop = listRef.current && listRef.current.contains(target);
      if (!inWrap && !inPop) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const showingRecents = !query.trim();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const recents = recentSkus
        .map((sku) => products.find((p) => p.sku === sku))
        .filter((p): p is Product => !!p);
      const recentSet = new Set(recents.map((p) => p.id));
      const rest = products.filter((p) => !recentSet.has(p.id));
      return [...recents, ...rest];
    }
    return products.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.model || '').toLowerCase().includes(q),
    );
  }, [query, products, recentSkus]);

  const visible = filtered.slice(0, 10);

  useEffect(() => {
    setHi(0);
  }, [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('.combobox-item.active') as HTMLElement | null;
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function pick(product: Product) {
    onChange(product.id, product);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange('', null);
    setQuery('');
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      setOpen(true);
      setHi((h) => Math.min(h + 1, visible.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHi((h) => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (open && visible[hi]) {
        pick(visible[hi]);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const inputValue = open ? query : selected ? labelFor(selected) : query;

  return (
    <div className={'combobox' + (variant === 'topbar' ? ' combobox--topbar' : '')} ref={wrapRef}>
      <div className="combobox-input-wrap">
        <span className="combobox-search-ic" aria-hidden />
        <input
          ref={inputRef}
          className="combobox-input"
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder || t.search}
        />
        {selected && !open && (
          <button
            className="combobox-clear"
            onMouseDown={(e) => {
              e.preventDefault();
              clear();
            }}
            title={lang === 'en' ? 'Clear' : '清除'}
          >
            ✕
          </button>
        )}
        {onOpenPicker && (
          <button
            className="combobox-picker-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              onOpenPicker(pick);
            }}
            title={lang === 'en' ? 'Browse all products' : '瀏覽全部產品'}
          >
            ▤
          </button>
        )}
      </div>
      {open && (
        <div className="combobox-pop" ref={listRef} style={popStyle || { visibility: 'hidden' }}>
          {showingRecents && recentSkus.length > 0 && (
            <div className="combobox-section-label">{lang === 'en' ? 'Recent' : '最近使用'}</div>
          )}
          {showingRecents && recentSkus.length === 0 && (
            <div className="combobox-section-label">{lang === 'en' ? 'All products' : '全部產品'}</div>
          )}
          {visible.length === 0 && (
            <div className="combobox-empty">{lang === 'en' ? 'No matches.' : '無相符項目。'}</div>
          )}
          {visible.map((p, i) => {
            const inRecent = showingRecents && recentSkus.includes(p.sku);
            const showRecentDivider = i === recentSkus.length && showingRecents && recentSkus.length > 0;
            return (
              <Fragment key={p.id}>
                {showRecentDivider && (
                  <div className="combobox-section-label">{lang === 'en' ? 'All products' : '全部產品'}</div>
                )}
                <div
                  className={'combobox-item' + (i === hi ? ' active' : '')}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                >
                  <div className="combobox-item-main">
                    <div className="combobox-item-head">
                      <span className="combobox-item-sku">{p.sku}</span>
                      {p.track_serial && (
                        <span className="pill" style={{ fontSize: 9, padding: '0 4px' }}>
                          AP
                        </span>
                      )}
                      {p.accountable_quantity < p.min_stock && (
                        <span
                          className={'pill ' + (p.accountable_quantity === 0 ? 'alert' : '')}
                          style={{ fontSize: 9, padding: '0 4px' }}
                        >
                          {p.accountable_quantity === 0 ? t.out : t.low}
                        </span>
                      )}
                      {inRecent && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)' }}>↺</span>
                      )}
                    </div>
                    <div className="combobox-item-name">{p.name}</div>
                    <div className="combobox-item-meta">{p.model}</div>
                  </div>
                  {showQty && (
                    <div className="combobox-item-qty">
                      <div className="qty-pair">
                        <span className="qty-pair-lbl">{t.acctShort}</span>
                        <span className={'qty-pair-v' + (p.accountable_quantity === 0 ? ' alert' : '')}>
                          {p.accountable_quantity}
                        </span>
                      </div>
                      <div className="qty-pair secondary">
                        <span className="qty-pair-lbl">{t.nonAcctShort}</span>
                        <span className="qty-pair-v">{p.non_accountable_quantity}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
          {filtered.length > visible.length && (
            <div className="combobox-more">
              + {filtered.length - visible.length}{' '}
              {lang === 'en' ? 'more — keep typing to narrow' : '項 — 繼續輸入以縮小範圍'}
            </div>
          )}
          {onOpenPicker && (
            <button
              className="combobox-pop-foot"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onOpenPicker(pick);
              }}
            >
              <span>▤</span>
              <span>{lang === 'en' ? 'Browse all products' : '瀏覽全部產品'}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 10, fontFamily: 'var(--mono)' }}>
                {products.length}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
