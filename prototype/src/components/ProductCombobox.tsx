import { useState, useRef, useMemo } from 'react';
import type { Product, Language } from '../types';
import { getI18n } from '../lib/i18n';

interface ProductComboboxProps {
  products: Product[];
  recentSkus: string[];
  value: string | number;
  onChange: (id: string | number, product: Product | null) => void;
  onOpenPicker?: () => void;
  lang: Language;
  variant?: 'default' | 'topbar';
  placeholder?: string;
  showQty?: boolean;
}

export default function ProductCombobox({
  products,
  recentSkus,
  value,
  onChange,
  onOpenPicker,
  lang,
  variant = 'default',
  placeholder = 'Search...',
  showQty = true,
}: ProductComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = getI18n(lang);

  const filtered = useMemo(() => {
    if (!query) {
      const recent = recentSkus
        .map(sku => products.find(p => p.sku === sku))
        .filter(Boolean) as Product[];
      return { recent, search: [] };
    }

    const q = query.toLowerCase();
    const search = products.filter(
      p =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q)
    );
    return { recent: [], search };
  }, [query, products, recentSkus]);

  const items = filtered.recent.length > 0 ? filtered.recent : filtered.search;

  return (
    <div className={`combobox combobox--${variant}`}>
      <div className="combobox-input-wrap">
        <div className="combobox-search-ic"></div>
        <input
          ref={inputRef}
          type="text"
          className="combobox-input"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              setHi(Math.min(hi + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              setHi(Math.max(hi - 1, 0));
            } else if (e.key === 'Enter' && items[hi]) {
              onChange(items[hi].id, items[hi]);
              setQuery('');
              setOpen(false);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {query && (
          <button
            className="combobox-clear"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
        {onOpenPicker && (
          <button className="combobox-picker-btn" onClick={onOpenPicker} title="Open picker">
            📋
          </button>
        )}
      </div>

      {open && (
        <div className="combobox-pop">
          {filtered.recent.length > 0 && !query && (
            <>
              <div className="combobox-section-label">Recent</div>
              {filtered.recent.map((p, i) => (
                <div
                  key={p.id}
                  className={`combobox-item ${i === hi ? 'active' : ''}`}
                  onClick={() => {
                    onChange(p.id, p);
                    setQuery('');
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHi(i)}
                >
                  <div className="combobox-item-main">
                    <div className="combobox-item-head">
                      <span className="combobox-item-sku">{p.sku}</span>
                    </div>
                    <div className="combobox-item-name">{p.name}</div>
                    <div className="combobox-item-meta">{p.model}</div>
                  </div>
                  {showQty && (
                    <div className="combobox-item-qty">
                      {p.accountable_quantity}/{p.non_accountable_quantity}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {filtered.search.length > 0 && (
            <>
              {query && filtered.recent.length === 0 && (
                <div className="combobox-section-label">Results</div>
              )}
              {filtered.search.map((p, i) => (
                <div
                  key={p.id}
                  className={`combobox-item ${i === hi ? 'active' : ''}`}
                  onClick={() => {
                    onChange(p.id, p);
                    setQuery('');
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHi(i)}
                >
                  <div className="combobox-item-main">
                    <div className="combobox-item-head">
                      <span className="combobox-item-sku">{p.sku}</span>
                    </div>
                    <div className="combobox-item-name">{p.name}</div>
                    <div className="combobox-item-meta">{p.model}</div>
                  </div>
                  {showQty && (
                    <div className="combobox-item-qty">
                      {p.accountable_quantity}/{p.non_accountable_quantity}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {items.length === 0 && (
            <div className="combobox-empty">No products found</div>
          )}
        </div>
      )}
    </div>
  );
}
