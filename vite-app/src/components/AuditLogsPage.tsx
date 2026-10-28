import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listAuditLogs, type AuditLog } from '../api/audit';
import { type Lang } from '../lib/i18n';

interface AuditLogsPageProps {
  lang: Lang;
  onResourceClick?: (resourceType: string, resourceId: number) => void;
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
  'zh-cn': {
    title: '操作日志',
    noLogs: '暂无活动记录',
    action: '操作',
    resource: '资源',
    user: '用户',
    time: '时间',
    loadError: '无法加载操作日志',
    tabAll: '全部',
    tabSystem: '系统事件',
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

export function AuditLogsPage({ lang, onResourceClick }: AuditLogsPageProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = texts[lang];
  const limit = 8;

  // Category and page live in the URL so refresh, back and shared links keep them.
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const category: CategoryFilter =
    categoryParam === 'system' || categoryParam === 'transaction' ? categoryParam : 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const offset = (page - 1) * limit;

  const updateParams = (changes: Record<string, string>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };
  const setOffset = (n: number) => updateParams({ page: n > 0 ? String(n / limit + 1) : '' });

  useEffect(() => {
    // Ignore a response once the filters have moved on, so a slow request can't overwrite a newer one.
    let ignore = false;
    const loadLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const cat = category === 'all' ? undefined : category;
        const res = await listAuditLogs(undefined, undefined, undefined, limit, offset, cat);
        if (ignore) return;

        setTotalCount(res.pagination.total);
        setLogs(res.data);
      } catch (err) {
        if (ignore) return;
        setError(t.loadError);
        console.error('Failed to load audit logs:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadLogs();
    return () => {
      ignore = true;
    };
  }, [offset, limit, t, category]);

  const handleCategoryChange = (cat: CategoryFilter) => {
    updateParams({ category: cat === 'all' ? '' : cat, page: '' });
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

  const getActionPillClass = (action: string) => {
    switch (action) {
      case 'CREATE':
      case 'USER_CREATE':
      case 'WAREHOUSE_CREATE':
      case 'LOGIN':
        return 'pill ok';
      case 'DELETE':
      case 'USER_DELETE':
      case 'LOGIN_FAILED':
        return 'pill alert';
      default:
        return 'pill';
    }
  };

  const getResourceLabel = (resourceType: string) => {
    const labels: Record<string, Record<'en' | 'zh' | 'zh-cn' | 'ja', string>> = {
      transaction: { en: 'Transaction', zh: '庫存異動', 'zh-cn': '库存异动', ja: '在庫異動' },
      batch: { en: 'Batch', zh: '批次', 'zh-cn': '批次', ja: 'バッチ' },
      shipment: { en: 'Shipment', zh: '出貨單據', 'zh-cn': '出货单据', ja: '配送' },
      product: { en: 'Product', zh: '產品', 'zh-cn': '产品', ja: '製品' },
      user: { en: 'User', zh: '使用者', 'zh-cn': '用户', ja: 'ユーザー' },
      warehouse: { en: 'Warehouse', zh: '倉庫', 'zh-cn': '仓库', ja: '倉庫' },
      auth: { en: 'Auth', zh: '認證', 'zh-cn': '认证', ja: '認証' },
      csv_import: { en: 'CSV Import', zh: 'CSV 匯入', 'zh-cn': 'CSV 导入', ja: 'CSVインポート' },
    };
    return labels[resourceType]?.[lang] || resourceType;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, Record<'en' | 'zh' | 'zh-cn' | 'ja', string>> = {
      CREATE: { en: 'Created', zh: '新增', 'zh-cn': '新增', ja: '作成' },
      UPDATE: { en: 'Updated', zh: '修改', 'zh-cn': '修改', ja: '更新' },
      DELETE: { en: 'Deleted', zh: '刪除', 'zh-cn': '删除', ja: '削除' },
      LOGIN: { en: 'Login', zh: '登入', 'zh-cn': '登录', ja: 'ログイン' },
      LOGOUT: { en: 'Logout', zh: '登出', 'zh-cn': '退出登录', ja: 'ログアウト' },
      LOGIN_FAILED: { en: 'Login Failed', zh: '登入失敗', 'zh-cn': '登录失败', ja: 'ログイン失敗' },
      USER_CREATE: { en: 'User Created', zh: '建立用戶', 'zh-cn': '创建用户', ja: 'ユーザー作成' },
      USER_UPDATE: { en: 'User Updated', zh: '更新用戶', 'zh-cn': '更新用户', ja: 'ユーザー更新' },
      USER_DELETE: { en: 'User Deleted', zh: '刪除用戶', 'zh-cn': '删除用户', ja: 'ユーザー削除' },
      WAREHOUSE_CREATE: { en: 'Warehouse Created', zh: '建立倉庫', 'zh-cn': '创建仓库', ja: '倉庫作成' },
      WAREHOUSE_UPDATE: { en: 'Warehouse Updated', zh: '更新倉庫', 'zh-cn': '更新仓库', ja: '倉庫更新' },
    };
    return labels[action]?.[lang] || action;
  };

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="locations-page">
      <div className="flow-head">
        <h2 style={{ margin: 0, flex: 1 }}>{t.title}</h2>
      </div>

      <div className="tag-chips" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {(['all', 'system', 'transaction'] as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            className={category === cat ? 'on' : ''}
            onClick={() => handleCategoryChange(cat)}
          >
            {cat === 'all' ? t.tabAll : cat === 'system' ? t.tabSystem : t.tabTransaction}
          </button>
        ))}
      </div>

      {error && (
        <div className="card alert" style={{ fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-2)', fontSize: 13 }}>
          {lang === 'en' ? 'Loading…' : lang === 'zh' ? '載入中…' : '読み込み中…'}
        </div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 12 }}>{t.noLogs}</div>
      ) : (
        <div className="card panel" style={{ flex: 1, minHeight: 0, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table className="picker-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>{t.time}</th>
                  <th style={{ width: '14%' }}>{t.user}</th>
                  <th style={{ width: '20%' }}>{t.action}</th>
                  <th>{t.resource}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="sku">{formatTime(log.timestamp)}</td>
                    <td style={{ fontWeight: 500 }}>{log.username}</td>
                    <td>
                      <span className={getActionPillClass(log.action)}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => onResourceClick?.(log.resource_type, log.resource_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: onResourceClick ? 'pointer' : 'default',
                          font: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontWeight: 500, textDecoration: onResourceClick ? 'underline' : 'none' }}>
                          {getResourceLabel(log.resource_type)}
                        </span>
                        <span className="sku" style={{ marginLeft: 4 }}>#{log.resource_id}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            className="btn-lg"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            {lang === 'en' ? '← Prev' : lang === 'zh' ? '← 上一頁' : '← 前へ'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            {lang === 'en' ? `Page ${currentPage} of ${totalPages}` : lang === 'zh' ? `第 ${currentPage} / ${totalPages} 頁` : `${currentPage} / ${totalPages} ページ`}
          </span>
          <button
            className="btn-lg"
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= totalCount}
          >
            {lang === 'en' ? 'Next →' : lang === 'zh' ? '下一頁 →' : '次へ →'}
          </button>
        </div>
      )}
    </div>
  );
}
