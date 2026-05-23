import { useMemo, useState } from 'react';
import type { Location, Product } from '../types';
import { L, type Lang } from '../lib/i18n';
import {
  createLocation,
  getLocationContent,
  removeProductFromLocation,
  assignProductToLocation,
  deleteLocation,
  type LocationContent,
} from '../api/locations';
import { ProductCombobox } from './ProductCombobox';
import { ConfirmModal } from './modals/ConfirmModal';

export interface LocationsPageProps {
  locations: Location[];
  products: Product[];
  lang: Lang;
  onBack: () => void;
  onLocationsUpdate: (locs: Location[]) => void;
}

export function LocationsPage({ locations, products, lang, onBack, onLocationsUpdate }: LocationsPageProps) {
  const t = L[lang];
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<LocationContent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ name: string } | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');

  const availableProducts = useMemo(() => {
    if (!selectedContent) return [];
    const existingIds = new Set(selectedContent.products.map((p) => p.id));
    return products.filter((p) => !existingIds.has(p.id));
  }, [products, selectedContent]);

  const handleSelectLocation = async (loc: Location) => {
    try {
      setLoading(true);
      setError(null);
      const content = await getLocationContent(loc.name);
      setSelectedName(loc.name);
      setSelectedContent(content);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim() || !name.trim()) {
      setError(lang === 'en' ? 'Please fill in all fields' : '請填入所有欄位');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const newLoc = await createLocation({ name: tag.trim(), description: name.trim() });
      onLocationsUpdate([...locations, newLoc]);
      setTag('');
      setName('');
      setIsCreating(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedName || !selectedProductId) return;
    try {
      setLoading(true);
      setError(null);
      await assignProductToLocation(selectedName, selectedProductId as number);
      const updated = await getLocationContent(selectedName);
      setSelectedContent(updated);
      setIsAddingProduct(false);
      setSelectedProductId('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProduct = async (productId: number) => {
    if (!selectedName) return;
    try {
      setLoading(true);
      setError(null);
      await removeProductFromLocation(selectedName, productId);
      const updated = await getLocationContent(selectedName);
      setSelectedContent(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = (name: string) => {
    setDeleteConfirm({ name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const name = deleteConfirm.name;
    setDeleteConfirm(null);

    try {
      setLoading(true);
      setError(null);
      await deleteLocation(name);
      // Refresh locations list
      const res = await fetch('/api/locations');
      const data = await res.json();
      if (data.success) {
        onLocationsUpdate(data.data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (selectedName && selectedContent) {
    return (
      <div className="locations-page">
        <div className="page-header">
          <button className="btn ghost" onClick={() => setSelectedName(null)}>
            {t.back}
          </button>
          <h2>{selectedContent.location.name}</h2>
          <div style={{ flex: 1 }} />
        </div>

        {error && (
          <div style={{ padding: 16, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 4 }}>
            {error}
          </div>
        )}

        {isAddingProduct && (
          <div className="card panel" style={{ marginBottom: 16 }}>
            <h3>{lang === 'en' ? 'Add Product' : '添加產品'}</h3>
            {availableProducts.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 12, padding: '12px 0' }}>
                {lang === 'en' ? 'All products have been added to this location.' : '所有產品已添加至此位置。'}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <ProductCombobox
                    products={availableProducts}
                    value={selectedProductId}
                    onChange={(id) => setSelectedProductId(id)}
                    lang={lang}
                    placeholder={lang === 'en' ? 'Search product...' : '搜尋產品...'}
                    showQty={false}
                  />
                </div>
                <button
                  onClick={handleAddProduct}
                  disabled={!selectedProductId || loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selectedProductId ? 'var(--ok)' : 'var(--surface-3)',
                    color: 'var(--bg)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: selectedProductId ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: 500,
                    opacity: selectedProductId ? 1 : 0.5,
                    marginTop: 6,
                  }}
                >
                  {lang === 'en' ? 'Add' : '添加'}
                </button>
                <button
                  onClick={() => {
                    setIsAddingProduct(false);
                    setSelectedProductId('');
                  }}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-2)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    marginTop: 6,
                  }}
                >
                  {t.cancel}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="card panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{t.products}</h3>
            {!isAddingProduct && (
              <button
                onClick={() => setIsAddingProduct(true)}
                disabled={loading || availableProducts.length === 0}
                style={{
                  padding: '6px 12px',
                  backgroundColor: availableProducts.length > 0 ? 'var(--ok)' : 'var(--surface-3)',
                  color: 'var(--bg)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: availableProducts.length > 0 ? 'pointer' : 'not-allowed',
                  fontSize: 12,
                  fontWeight: 500,
                  opacity: availableProducts.length > 0 ? 1 : 0.5,
                }}
              >
                {lang === 'en' ? '+ Add Product' : '+ 添加產品'}
              </button>
            )}
          </div>
          {selectedContent.products.length === 0 ? (
            <div style={{ padding: '24px 8px', color: 'var(--ink-3)', fontSize: 12, textAlign: 'center' }}>
              {t.noProducts}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {selectedContent.products.map((prod) => (
                <div
                  key={prod.id}
                  style={{
                    backgroundColor: 'rgba(100, 200, 150, 0.08)',
                    border: '1px solid rgba(100, 200, 150, 0.2)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ok)' }}>{prod.sku}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{prod.name}</div>
                    {prod.model && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{prod.model}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      {lang === 'en' ? 'Qty: ' : '數量: '}
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {prod.accountable_quantity + prod.non_accountable_quantity}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveProduct(prod.id)}
                      disabled={loading}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'en' ? 'Remove' : '移除'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="locations-page">
      <div className="flow-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="back" onClick={onBack}>
            {t.back}
          </button>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{t.locations}</h2>
            <div className="sub">
              {lang === 'en' ? 'Manage warehouse locations and view inventory distribution.' : '管理倉庫位置並查看庫存分佈。'}
            </div>
          </div>
        </div>
        <button
          className="btn"
          onClick={() => setIsCreating(true)}
          disabled={loading}
        >
          {t.createLocation}
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {isCreating && (
        <div className="card panel">
          <h3>{t.addLocation}</h3>
          <form onSubmit={handleCreateLocation} className="form">
            <div className="form-group">
              <label>{lang === 'en' ? 'Name (ID)' : '名稱（位置代碼）'}</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. A-01"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>{lang === 'en' ? 'Description' : '描述'}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'en' ? 'e.g. Shelf A, Level 1' : 'e.g. 貨架 A 第 1 層'}
                disabled={loading}
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setIsCreating(false);
                  setTag('');
                  setName('');
                  setError(null);
                }}
                disabled={loading}
              >
                {t.cancel}
              </button>
              <button type="submit" className="btn" disabled={loading}>
                {t.addLocation}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card panel">
        <h3>
          <span>{t.locations}</span>
          <span className="pill">{locations.length}</span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flex: 1, minHeight: 0 }}>
          {locations.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '24px 8px', color: 'var(--ink-3)', fontSize: 12, textAlign: 'center' }}>
              {t.noLocations}
            </div>
          ) : (
            locations.map((loc) => (
              <div
                key={loc.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  backgroundColor: 'var(--surface-2)',
                }}
              >
                <div onClick={() => handleSelectLocation(loc)}>
                  <div className="loc-tag">{loc.name}</div>
                  <div className="loc-name">{loc.description}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }} onClick={() => handleSelectLocation(loc)}>
                    查看 →
                  </div>
                  <button
                    className="btn small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLocation(loc.name);
                    }}
                    disabled={loading}
                    style={{ color: 'var(--accent)' }}
                  >
                    {lang === 'en' ? 'Delete' : '刪除'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {deleteConfirm && (
        <ConfirmModal
          title={lang === 'en' ? 'Delete location' : '刪除位置'}
          message={
            lang === 'en'
              ? `Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`
              : `確定要刪除位置「${deleteConfirm.name}」？此操作無法復原。`
          }
          confirmText={lang === 'en' ? 'Delete' : '刪除'}
          cancelText={lang === 'en' ? 'Cancel' : '取消'}
          isDangerous={true}
          lang={lang}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
