import { useEffect, useState } from 'react';
import { listAuditLogs, type AuditLog } from '../api/audit';
import { L, type Lang } from '../lib/i18n';
import type { Pagination } from '../types';

interface AuditLogsPageProps {
  lang: Lang;
  onResourceClick?: (resourceType: string, resourceId: number) => void;
  onBack?: () => void;
}

const texts = {
  en: {
    title: 'Audit Logs',
    noLogs: 'No activity logged',
    action: 'Action',
    resource: 'Resource',
    user: 'User',
    time: 'Time',
    loadError: 'Failed to load audit logs',
    tabAll: 'All',
    tabSystem: 'System',
    tabTransaction: 'Transaction',
  },
  zh: {
    title: '操作日誌',
    noLogs: '暫無活動記錄',
    action: '操作',
    resource: '資源',
    user: '使用者',
    time: '時間',
    loadError: '無法加載操作日誌',
    tabAll: '全部',
    tabSystem: '系統事件',
    tabTransaction: '交易事件',
  },
  ja: {
    title: '操作ログ',
    noLogs: 'アクティビティが記録されていません',
    action: '操作',
    resource: 'リソース',
    user: 'ユーザー',
    time: '時間',
    loadError: '操作ログを読み込めません',
    tabAll: 'すべて',
    tabSystem: 'システム',
    tabTransaction: 'トランザクション',
  },
};

type CategoryFilter = 'all' | 'system' | 'transaction';

export function AuditLogsPage({ lang, onResourceClick, onBack }: AuditLogsPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState<CategoryFilter>('all');

  const t = texts[lang];
  const limit = 8;

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const cat = category === 'all' ? undefined : category;
        const res = await listAuditLogs(undefined, undefined, undefined, limit, offset, cat);

        setTotalCount(res.pagination.total);
        setLogs(res.data);
      } catch (err) {
        setError(t.loadError);
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [offset, limit, t, category]);

  const handleCategoryChange = (cat: CategoryFilter) => {
    setCategory(cat);
    setOffset(0);
  };

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    const locale = lang === 'zh' ? 'zh-TW' : lang === 'ja' ? 'ja-JP' : 'en-US';
    return d.toLocaleString(locale, options);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
      case 'USER_CREATE':
      case 'WAREHOUSE_CREATE':
      case 'LOGIN':
        return '#10b981';
      case 'UPDATE':
      case 'USER_UPDATE':
      case 'WAREHOUSE_UPDATE':
        return '#f59e0b';
      case 'DELETE':
      case 'USER_DELETE':
        return '#ef4444';
      case 'LOGOUT':
        return '#6b7280';
      case 'LOGIN_FAILED':
        return '#dc2626';
      default:
        return 'var(--ink)';
    }
  };

  const getResourceLabel = (resourceType: string) => {
    const labels: Record<string, Record<'en' | 'zh' | 'ja', string>> = {
      transaction: { en: 'Transaction', zh: '庫存異動', ja: '在庫異動' },
      batch: { en: 'Batch', zh: '批次', ja: 'バッチ' },
      shipment: { en: 'Shipment', zh: '出貨單據', ja: '配送' },
      product: { en: 'Product', zh: '產品', ja: '製品' },
      user: { en: 'User', zh: '使用者', ja: 'ユーザー' },
      warehouse: { en: 'Warehouse', zh: '倉庫', ja: '倉庫' },
      auth: { en: 'Auth', zh: '認證', ja: '認証' },
      csv_import: { en: 'CSV Import', zh: 'CSV 匯入', ja: 'CSVインポート' },
    };
    return labels[resourceType]?.[lang] || resourceType;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, Record<'en' | 'zh' | 'ja', string>> = {
      CREATE: { en: 'Created', zh: '新增', ja: '作成' },
      UPDATE: { en: 'Updated', zh: '修改', ja: '更新' },
      DELETE: { en: 'Deleted', zh: '刪除', ja: '削除' },
      LOGIN: { en: 'Login', zh: '登入', ja: 'ログイン' },
      LOGOUT: { en: 'Logout', zh: '登出', ja: 'ログアウト' },
      LOGIN_FAILED: { en: 'Login Failed', zh: '登入失敗', ja: 'ログイン失敗' },
      USER_CREATE: { en: 'User Created', zh: '建立用戶', ja: 'ユーザー作成' },
      USER_UPDATE: { en: 'User Updated', zh: '更新用戶', ja: 'ユーザー更新' },
      USER_DELETE: { en: 'User Deleted', zh: '刪除用戶', ja: 'ユーザー削除' },
      WAREHOUSE_CREATE: { en: 'Warehouse Created', zh: '建立倉庫', ja: '倉庫作成' },
      WAREHOUSE_UPDATE: { en: 'Warehouse Updated', zh: '更新倉庫', ja: '倉庫更新' },
    };
    return labels[action]?.[lang] || action;
  };

  return (
    <div style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        {onBack && (
          <button className="btn ghost" onClick={onBack}>
            {lang === 'en' ? '← Back' : lang === 'zh' ? '← 返回' : '← 戻る'}
          </button>
        )}
        <h1 style={{ margin: 0, flex: 1, textAlign: onBack ? 'left' : 'center' }}>{t.title}</h1>
        {onBack && <div style={{ width: 80 }} />}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {(['all', 'system', 'transaction'] as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: category === cat ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: category === cat ? 600 : 400,
              color: category === cat ? 'var(--accent)' : 'var(--ink-2)',
              fontSize: '14px',
              marginBottom: '-1px',
            }}
          >
            {cat === 'all' ? t.tabAll : cat === 'system' ? t.tabSystem : t.tabTransaction}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            marginBottom: '16px',
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-2)' }}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-2)' }}>{t.noLogs}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'var(--surface)',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--ink-1)',
                  }}
                >
                  {t.time}
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--ink-1)',
                  }}
                >
                  {t.user}
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--ink-1)',
                  }}
                >
                  {t.action}
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--ink-1)',
                  }}
                >
                  {t.resource}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{formatTime(log.timestamp)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{log.username}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: `${getActionColor(log.action)}20`,
                        color: getActionColor(log.action),
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <button
                      onClick={() => onResourceClick?.(log.resource_type, log.resource_id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: onResourceClick ? 'pointer' : 'default',
                        display: 'inline',
                        fontFamily: 'inherit',
                      }}
                      title={onResourceClick ? 'Click to view details' : undefined}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--ink)', textDecoration: onResourceClick ? 'underline' : 'none' }}>
                        {getResourceLabel(log.resource_type)}
                      </span>
                      <span style={{ color: 'var(--ink-2)', marginLeft: '4px' }}>#{log.resource_id}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: '13px',
            color: 'var(--ink-2)',
          }}
        >
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              background: 'var(--surface)',
              cursor: offset === 0 ? 'default' : 'pointer',
              opacity: offset === 0 ? 0.5 : 1,
              fontSize: '13px',
            }}
          >
            ← {lang === 'en' ? 'Previous' : lang === 'zh' ? '上一頁' : '前へ'}
          </button>

          <span>
            {lang === 'en' ? 'Page' : lang === 'zh' ? '第' : 'ページ'} {Math.floor(offset / limit) + 1}{' '}
            {lang === 'en' ? 'of' : lang === 'zh' ? '，共' : '（全'} {Math.ceil(totalCount / limit)}{' '}
            {lang === 'en' ? '' : lang === 'zh' ? '頁' : 'ページ）'}
          </span>

          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= totalCount}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              background: 'var(--surface)',
              cursor: offset + limit >= totalCount ? 'default' : 'pointer',
              opacity: offset + limit >= totalCount ? 0.5 : 1,
              fontSize: '13px',
            }}
          >
            {lang === 'en' ? 'Next' : lang === 'zh' ? '下一頁' : '次へ'} →
          </button>
        </div>
      )}
    </div>
  );
}
