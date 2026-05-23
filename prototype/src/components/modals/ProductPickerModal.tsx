import { useState, useMemo } from 'react';
import type { Product, Language } from '../../types';
import { getI18n } from '../../lib/i18n';

interface ProductPickerModalProps {
  products: Product[];
  lang: Language;
  onClose: () => void;
  onPick: (product: Product) => void;
}

export default function ProductPickerModal({
  products,
  lang,
  onClose,
  onPick,
}: ProductPickerModalProps) {
  const t = getI18n(lang);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return products;
    const q = query.toLowerCase();
    return products.filter(
      p =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q)
    );
  }, [products, query]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width: '90%', maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Select Product</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <input
            type="text"
            placeholder={t.search}
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              marginBottom: 12,
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          />

          <table className="picker-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Model</th>
                <th>Qty</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => onPick(p)} style={{ cursor: 'pointer' }}>
                  <td className="sku">{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.model}</td>
                  <td className="num">
                    {p.accountable_quantity} / {p.non_accountable_quantity}
                  </td>
                  <td>
                    <button className="btn" onClick={() => onPick(p)}>
                      選擇
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
