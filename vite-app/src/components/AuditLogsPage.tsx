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
  },
  zh: {
    title: '操作日誌',
    noLogs: '暫無活動記錄',
    action: '操作',
    resource: '資源',
    user: '使用者',
    time: '時間',
    loadError: '無法加載操作日誌',
  },
  ja: {
    title: '操作ログ',
    noLogs: 'アクティビティが記録されていません',
    action: '操作',
    resource: 'リソース',
    user: 'ユーザー',
    time: '時間',
    loadError: '操作ログを読み込めません',
  },
};

export function AuditLogsPage({ lang, onResourceClick, onBack }: AuditLogsPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const t = texts[lang];
  const limit = 8;

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await listAuditLogs(undefined, undefined, undefined, limit, offset);

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
  }, [offset, limit, t]);

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
        return '#10b981'; // green
      case 'UPDATE':
        return '#f59e0b'; // amber
      case 'DELETE':
        return '#ef4444'; // red
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
    };
    return labels[resourceType]?.[lang] || resourceType;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, Record<'en' | 'zh' | 'ja', string>> = {
      CREATE: { en: 'Created', zh: '新增', ja: '作成' },
      UPDATE: { en: 'Updated', zh: '修改', ja: '更新' },
      DELETE: { en: 'Deleted', zh: '刪除', ja: '削除' },
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
