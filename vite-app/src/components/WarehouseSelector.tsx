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
          <div className="logo-large">S</div>
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
                <span className="warehouse-item-name">{wh.name}</span>
                {wh.description && (
                  <span className="warehouse-item-desc">{wh.description}</span>
                )}
                <span className="warehouse-item-arrow">→</span>
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
          background: linear-gradient(135deg, var(--bg-0) 0%, var(--bg-1) 100%);
          position: fixed;
          top: 0;
          left: 0;
        }
        .warehouse-selector-container {
          width: 100%;
          max-width: 400px;
          padding: 0 16px;
        }
        .warehouse-selector-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .warehouse-selector-header h1 {
          font-size: 20px;
          font-weight: 600;
          color: var(--ink-0);
          margin: 8px 0 4px;
        }
        .warehouse-selector-header p {
          font-size: 13px;
          color: var(--ink-2);
          margin: 0;
        }
        .warehouse-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .warehouse-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.15s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .warehouse-item:hover {
          border-color: var(--accent);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .warehouse-item-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink-0);
          flex: 1;
        }
        .warehouse-item-desc {
          font-size: 12px;
          color: var(--ink-2);
        }
        .warehouse-item-arrow {
          font-size: 16px;
          color: var(--ink-3);
        }
        .warehouse-selector-loading,
        .warehouse-selector-error,
        .warehouse-selector-empty {
          padding: 24px 16px;
          text-align: center;
          font-size: 13px;
          color: var(--ink-2);
          background: white;
          border-radius: 8px;
          border: 1px solid var(--border);
        }
        .warehouse-selector-error {
          color: #d32f2f;
          background: #ffebee;
          border-color: #d32f2f;
        }
      `}</style>
    </div>
  );
}
