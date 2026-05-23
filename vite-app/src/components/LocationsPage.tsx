import { useState } from 'react';
import type { Location } from '../types';
import { L, type Lang } from '../lib/i18n';
import {
  createLocation,
  getLocationContent,
  removeProductFromLocation,
  deleteLocation,
  type LocationContent,
} from '../api/locations';

export interface LocationsPageProps {
  locations: Location[];
  lang: Lang;
  onBack: () => void;
  onLocationsUpdate: (locs: Location[]) => void;
}

export function LocationsPage({ locations, lang, onBack, onLocationsUpdate }: LocationsPageProps) {
  const t = L[lang];
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<LocationContent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleDeleteLocation = async (name: string) => {
    const confirm = window.confirm(
      lang === 'en'
        ? `Delete location "${name}"?`
        : `確定要刪除位置「${name}」？`
    );
    if (!confirm) return;

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

        <div className="card panel">
          <h3>{t.products}</h3>
          <div className="rows">
            {selectedContent.products.length === 0 ? (
              <div style={{ padding: '24px 8px', color: 'var(--ink-3)', fontSize: 12, textAlign: 'center' }}>
                {t.noProducts}
              </div>
            ) : (
              selectedContent.products.map((prod) => (
                <div key={prod.id} className="location-product-row">
                  <div className="loc-prod-info">
                    <div className="loc-prod-sku">{prod.sku}</div>
                    <div className="loc-prod-name">{prod.name}</div>
                  </div>
                  <div className="loc-prod-qty">
                    <span>{prod.accountable_quantity + prod.non_accountable_quantity}</span>
                  </div>
                  <button
                    className="btn small"
                    onClick={() => handleRemoveProduct(prod.id)}
                    disabled={loading}
                  >
                    {t.removeProduct}
                  </button>
                </div>
              ))
            )}
          </div>
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
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
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
    </div>
  );
}
