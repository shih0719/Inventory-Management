// src/components/modals/ProductPickerModal.tsx
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { L, type Lang } from '../../lib/i18n';

export interface ProductPickerModalProps {
  products: Product[];
  lang: Lang;
  onClose: () => void;
  onPick: (p: Product) => void;
}

export function ProductPickerModal({ products, lang, onClose, onPick }: ProductPickerModalProps) {
  const t = L[lang];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out' | 'ap'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === 'low' && p.accountable_quantity >= p.min_stock) return false;
      if (filter === 'out' && p.accountable_quantity !== 0) return false;
      if (filter === 'ap' && p.type !== 'ap') return false;
      if (!q) return true;
      return (
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.model || '').toLowerCase().includes(q)
      );
    });
  }, [products, query, filter]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width: 780, maxHeight: '85%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <h3>{lang === 'en' ? 'Browse products' : '瀏覽產品'}</h3>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
              {lang === 'en' ? 'Filter, search, click a row to select.' : '可篩選、搜尋,點任一列即選擇。'}
            </div>
          </div>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          style={{
            padding: '12px 20px 8px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            style={{
              flex: 1,
              padding: '7px 12px',
              border: '1px solid var(--border-2)',
              borderRadius: 6,
              font: '500 13px var(--sans)',
              background: 'var(--surface-2)',
            }}
          />
          <div className="tag-chips">
            {[
              { k: 'all', l: lang === 'en' ? 'All' : '全部' },
              { k: 'low', l: lang === 'en' ? 'Low' : '低量' },
              { k: 'out', l: lang === 'en' ? 'Out' : '缺貨' },
              { k: 'ap', l: 'AP' },
            ].map((f) => (
              <button
                key={f.k}
                className={filter === f.k ? 'on' : ''}
                onClick={() => setFilter(f.k as typeof filter)}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          <table className="picker-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>{lang === 'en' ? 'Name' : '名稱'}</th>
                <th>{lang === 'en' ? 'Type' : '類型'}</th>
                <th style={{ textAlign: 'right' }}>{t.acctShort}</th>
                <th style={{ textAlign: 'right' }}>{t.nonAcctShort}</th>
                <th style={{ textAlign: 'right' }}>{t.min}</th>
                <th>{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>
                    {lang === 'en' ? 'No matches.' : '無相符項目。'}
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const isOut = p.accountable_quantity === 0;
                const isLow = !isOut && p.accountable_quantity < p.min_stock;
                return (
                  <tr key={p.id} onClick={() => onPick(p)}>
                    <td className="sku">{p.sku}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{p.model}</div>
                    </td>
                    <td>
                      {p.type === 'ap' ? (
                        <span className="pill">AP</span>
                      ) : (
                        <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>normal</span>
                      )}
                    </td>
                    <td className="num" style={{ color: isOut ? 'var(--accent)' : 'inherit' }}>
                      {p.accountable_quantity}
                    </td>
                    <td className="num" style={{ color: 'var(--ink-2)' }}>
                      {p.non_accountable_quantity}
                    </td>
                    <td className="num" style={{ color: 'var(--ink-3)' }}>
                      {p.min_stock}
                    </td>
                    <td>
                      {isOut && <span className="pill alert">{t.out}</span>}
                      {isLow && <span className="pill alert">{t.low}</span>}
                      {!isOut && !isLow && <span className="pill ok">{t.ok}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-foot">
          <span className="hint">
            {filtered.length} / {products.length} {lang === 'en' ? 'products' : '項'}
          </span>
          <button className="btn-lg" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
