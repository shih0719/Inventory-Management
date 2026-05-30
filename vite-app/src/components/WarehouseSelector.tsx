import { useEffect, useState } from 'react';
import { listWarehouses, type Warehouse } from '../api/warehouses';
import type { Lang } from '../lib/i18n';

interface WarehouseSelectorProps {
  userWarehouseIds: number[];
  onSelect: (warehouse: Warehouse) => void;
  lang: Lang;
}

const texts = {
  en: {
    title: 'Select Warehouse',
    subtitle: 'Choose a warehouse to continue',
    noWarehouses: 'You have no warehouse access. Please contact your administrator.',
    loading: 'Loading...',
    error: 'Failed to load warehouses',
    select: 'Select',
  },
  zh: {
    title: '選擇倉庫',
    subtitle: '選擇要操作的倉庫',
    noWarehouses: '您沒有任何倉庫的存取權限，請聯絡管理員。',
    loading: '載入中...',
    error: '無法載入倉庫列表',
    select: '選擇',
  },
  ja: {
    title: '倉庫を選択',
    subtitle: '操作する倉庫を選んでください',
    noWarehouses: '倉庫へのアクセス権限がありません。管理者に連絡してください。',
    loading: '読み込み中...',
    error: '倉庫の読み込みに失敗しました',
    select: '選択',
  },
};

export function WarehouseSelector({ userWarehouseIds, onSelect, lang }: WarehouseSelectorProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = texts[lang];

  useEffect(() => {
    listWarehouses()
      .then((all) => {
        const accessible = all.filter((wh) => userWarehouseIds.includes(wh.id));
        setWarehouses(accessible);
      })
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [userWarehouseIds, t.error]);

  return (
    <div className="warehouse-selector-page">
      <div className="warehouse-selector-container">
        <div className="warehouse-selector-header">
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ink)', color: 'var(--bg)', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, margin: '0 auto' }}>S</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>

        {loading && <div className="warehouse-selector-loading">{t.loading}</div>}

        {error && <div className="warehouse-selector-error">{error}</div>}

        {!loading && !error && warehouses.length === 0 && (
          <div className="warehouse-selector-empty">{t.noWarehouses}</div>
        )}

        {!loading && !error && warehouses.length > 0 && (
          <div className="warehouse-list">
            {warehouses.map((wh) => (
              <button
                key={wh.id}
                className="warehouse-item"
                onClick={() => onSelect(wh)}
              >
                <div className="warehouse-item-mark">{wh.name[0]?.toUpperCase()}</div>
                <span className="warehouse-item-name">{wh.name}</span>
                {wh.description && (
                  <span className="warehouse-item-desc">{wh.description}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .warehouse-selector-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          position: fixed;
          top: 0;
          left: 0;
        }
        .warehouse-selector-container {
          width: 100%;
          max-width: 900px;
          padding: 0 24px;
        }
        .warehouse-selector-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .warehouse-selector-header h1 {
          font-size: 20px;
          font-weight: 600;
          color: var(--ink);
          margin: 10px 0 4px;
          letter-spacing: -0.01em;
        }
        .warehouse-selector-header p {
          font-size: 13px;
          color: var(--ink-2);
          margin: 0;
        }
        .warehouse-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .warehouse-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
          padding: 32px 28px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: border-color .15s, background .15s;
          min-height: 160px;
        }
        .warehouse-item:hover {
          border-color: var(--ink);
          background: var(--surface-2);
        }
        .warehouse-item-mark {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: var(--ink);
          color: var(--bg);
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .warehouse-item-name {
          font-size: 17px;
          font-weight: 600;
          color: var(--ink);
          line-height: 1.3;
          letter-spacing: -0.01em;
        }
        .warehouse-item-desc {
          font-size: 13px;
          color: var(--ink-3);
          line-height: 1.5;
          margin-top: -10px;
        }
        .warehouse-selector-loading,
        .warehouse-selector-empty {
          padding: 24px 16px;
          text-align: center;
          font-size: 13px;
          color: var(--ink-2);
        }
        .warehouse-selector-error {
          padding: 12px 16px;
          text-align: center;
          font-size: 13px;
          color: var(--accent);
          background: var(--accent-soft);
          border: 1px solid var(--accent);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
