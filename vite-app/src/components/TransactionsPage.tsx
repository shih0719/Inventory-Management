// src/components/TransactionsPage.tsx
// Dedicated transaction history page with server-side pagination & filters.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import type { Transaction, Tag, Lang } from '../types';
import { listTransactions, exportTransactionsCsv } from '../api/transactions';
import { tagLabel, L, TAGS_IN_USE } from '../lib/i18n';
import { fmtDateTime } from '../lib/format';

type SortKey = 'created_at' | 'quantity_change' | 'sku' | 'product_name' | 'tag_name' | 'quantity_type' | 'created_by_user';
const SORT_KEY = 'inv.txSort';
const ORDER_KEY = 'inv.txOrder';

const SORT_KEYS: SortKey[] = ['created_at', 'quantity_change', 'sku', 'product_name', 'tag_name', 'quantity_type', 'created_by_user'];

function loadSort(): SortKey {
  const saved = (() => { try { return localStorage.getItem(SORT_KEY); } catch { return null; } })();
  return (saved && SORT_KEYS.includes(saved as SortKey)) ? (saved as SortKey) : 'created_at';
}

function loadOrder(): 'asc' | 'desc' {
  const saved = (() => { try { return localStorage.getItem(ORDER_KEY); } catch { return null; } })();
  return saved === 'asc' ? 'asc' : 'desc';
}

function saveSort(sort: SortKey, order: 'asc' | 'desc') {
  try {
    localStorage.setItem(SORT_KEY, sort);
    localStorage.setItem(ORDER_KEY, order);
  } catch { /* quota / private mode — ignore */ }
}

interface TransactionsPageProps {
  lang: Lang;
  tags: Tag[];
  onViewTransaction: (tx: Transaction) => void;
}

export function TransactionsPage({ lang, tags, onViewTransaction }: TransactionsPageProps) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Page, filters and sort live in the URL so refresh, back and shared links keep them.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const dirParam = searchParams.get('direction');
  const direction: '' | 'in' | 'out' = dirParam === 'in' || dirParam === 'out' ? dirParam : '';
  const quantityType = searchParams.get('quantity_type') || '';
  const tagId = searchParams.get('tag_id') || '';
  const sku = searchParams.get('sku') || '';
  const operator = searchParams.get('created_by_user') || '';
  const sortParam = searchParams.get('sort') as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : loadSort();
  const orderParam = searchParams.get('order');
  const order: 'asc' | 'desc' = orderParam === 'asc' || orderParam === 'desc' ? orderParam : loadOrder();
  const [exporting, setExporting] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(
    async (pageNum: number) => {
      // Only the latest request may update the table; earlier ones can resolve later.
      const requestId = ++latestRequest.current;
      setLoading(true);
      setError(null);
      try {
        const res = await listTransactions({
          page: pageNum,
          limit,
          from: from || undefined,
          to: to || undefined,
          direction: direction || undefined,
          quantity_type: quantityType || undefined,
          tag_id: tagId ? Number(tagId) : undefined,
          sku: sku || undefined,
          created_by_user: operator || undefined,
          sort,
          order,
        });
        if (requestId !== latestRequest.current) return;
        setRows(res.data || []);
        setTotal(res.pagination?.total || 0);
      } catch (err) {
        if (requestId !== latestRequest.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    },
    [from, to, direction, quantityType, tagId, sku, operator, sort, order],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  // A URL change changes `load`, so the effect above refetches with the new values.
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

  /** Changing a filter goes back to page 1. */
  const setFilter = (key: string, value: string) => updateParams({ [key]: value, page: '' });

  const setPage = (n: number) => updateParams({ page: n > 1 ? String(n) : '' });

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportTransactionsCsv({
        from: from || undefined,
        to: to || undefined,
        direction: direction || undefined,
        quantity_type: quantityType || undefined,
        tag_id: tagId ? Number(tagId) : undefined,
        sku: sku || undefined,
        created_by_user: operator || undefined,
        sort,
        order,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const toggleSort = (col: SortKey) => {
    let nextSort: SortKey;
    let nextOrder: 'asc' | 'desc';
    if (sort === col) {
      nextSort = sort;
      nextOrder = order === 'asc' ? 'desc' : 'asc';
    } else {
      nextSort = col;
      nextOrder = 'asc';
    }
    saveSort(nextSort, nextOrder);
    updateParams({ sort: nextSort, order: nextOrder, page: '' });
  };

  const sortArrow = (col: string): string => (sort === col ? (order === 'asc' ? ' ▲' : ' ▼') : '');


  const inputStyle: CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--border-2)',
    borderRadius: 4,
    font: '12px var(--sans)',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--ink)',
  };

  const thStyle: CSSProperties = { padding: '8px 10px', userSelect: 'none' };

  return (
    <div className="batch-flow">
      <div className="flow-head">
        <div>
          <h2>{lang === 'en' ? 'Transaction History' : lang.startsWith('zh') ? '出入庫歷史' : '取引履歴'}</h2>
          <div className="sub">
            {lang === 'en'
              ? 'Server-side paginated inbound/outbound history'
              : lang.startsWith('zh')
              ? '伺服器端分頁的進出庫歷史'
              : 'サーバーサイドページングの入出庫履歴'}
          </div>
        </div>
        <button
          className="btn-lg"
          onClick={() => void handleExport()}
          disabled={exporting}
          style={{ whiteSpace: 'nowrap' }}
        >
          {exporting
            ? (lang === 'en' ? 'Exporting…' : '匯出中…')
            : (lang === 'en' ? '⬇ Export CSV' : '⬇ 匯出 CSV')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--accent-2)', borderRadius: 6, color: 'var(--accent)', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div className="field">
            <label>{lang === 'en' ? 'From' : '起日'}</label>
            <input type="date" value={from} style={inputStyle} onChange={(e) => setFilter('from', e.target.value)} />
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'To' : '迄日'}</label>
            <input type="date" value={to} style={inputStyle} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Direction' : '方向'}</label>
            <select value={direction} style={inputStyle} onChange={(e) => setFilter('direction', e.target.value)}>
              <option value="">{lang === 'en' ? 'All' : '全部'}</option>
              <option value="in">{lang === 'en' ? 'Inbound' : '進貨'}</option>
              <option value="out">{lang === 'en' ? 'Outbound' : '出貨'}</option>
            </select>
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Type' : '帳別'}</label>
            <select value={quantityType} style={inputStyle} onChange={(e) => setFilter('quantity_type', e.target.value)}>
              <option value="">{lang === 'en' ? 'All' : '全部'}</option>
              <option value="accountable">{lang === 'en' ? 'Accountable' : '有帳'}</option>
              <option value="non_accountable">{lang === 'en' ? 'Non-accountable' : '無帳'}</option>
            </select>
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Tag' : '標籤'}</label>
            <select value={tagId} style={inputStyle} onChange={(e) => setFilter('tag_id', e.target.value)}>
              <option value="">{lang === 'en' ? 'All' : '全部'}</option>
              {tags.filter((tg) => TAGS_IN_USE.includes(tg.name)).map((tg) => (
                <option key={tg.id} value={tg.id}>{tagLabel(tg.name, lang)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>SKU</label>
            <input value={sku} placeholder="SKU" style={inputStyle} onChange={(e) => setFilter('sku', e.target.value)} />
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Operator' : '操作者'}</label>
            <input value={operator} style={inputStyle} onChange={(e) => setFilter('created_by_user', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-2)', color: 'var(--ink-2)' }}>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>
                {lang === 'en' ? 'Time' : '時間'}{sortArrow('created_at')}
              </th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('sku')}>SKU{sortArrow('sku')}</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('tag_name')}>
                {lang === 'en' ? 'Tag' : '標籤'}{sortArrow('tag_name')}
              </th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('quantity_type')}>
                {lang === 'en' ? 'Type' : '帳別'}{sortArrow('quantity_type')}
              </th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('quantity_change')}>
                {lang === 'en' ? 'Qty' : '數量'}{sortArrow('quantity_change')}
              </th>
              <th style={thStyle}>{lang === 'en' ? 'Before/After' : '異動前後'}</th>
              <th style={thStyle}>{lang === 'en' ? 'Source' : '來源'}</th>
              <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('created_by_user')}>
                {lang === 'en' ? 'Operator' : '操作者'}{sortArrow('created_by_user')}
              </th>
              <th style={thStyle}>{lang === 'en' ? 'Remarks' : '備註'}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>{lang === 'en' ? 'Loading…' : '載入中…'}</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'en' ? 'No transactions.' : '無交易紀錄。'}</td></tr>
            )}
            {!loading && rows.map((tx) => {
              const isIn = tx.quantity_change > 0;
              return (
                <tr
                  key={tx.id}
                  onClick={() => onViewTransaction(tx)}
                  style={{ borderBottom: '1px solid var(--border-2)', cursor: 'pointer' }}
                >
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDateTime(tx.created_at, lang)}</td>
                  <td style={{ padding: '8px 10px' }}>{tx.sku}</td>
                  <td style={{ padding: '8px 10px' }}>{tagLabel(tx.tag_name, lang)}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {tx.quantity_type === 'non_accountable'
                      ? (lang === 'en' ? 'Non-acct' : '無帳')
                      : (lang === 'en' ? 'Acct' : '有帳')}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: isIn ? 'var(--ok)' : 'var(--out)' }}>
                    {isIn ? '+' : ''}{tx.quantity_change}
                  </td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>
                    {tx.quantity_before != null || tx.quantity_after != null
                      ? `${tx.quantity_before ?? '—'} → ${tx.quantity_after ?? '—'}`
                      : '—'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {sourceShortLabel(tx.source, lang)}
                  </td>
                  <td style={{ padding: '8px 10px' }}>{tx.created_by_user || '-'}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--ink-2)' }}>{tx.remarks}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          {lang === 'en' ? `Total ${total} · Page ${page}/${totalPages}` : `共 ${total} 筆 · 第 ${page}/${totalPages} 頁`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            {lang === 'en' ? '← Prev' : '← 上一頁'}
          </button>
          <button className="btn ghost" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
            {lang === 'en' ? 'Next →' : '下一頁 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

const SOURCE_KEY: Record<string, string> = {
  manual: 'sourceManual',
  adjust: 'sourceAdjust',
  batch: 'sourceBatch',
  'ap-bulk': 'sourceApBulk',
  'ap-sell': 'sourceApSell',
  'ap-transfer': 'sourceApTransfer',
  'csv-import': 'sourceCsvImport',
  shipment: 'sourceShipment',
};

function sourceShortLabel(source: string | undefined, lang: Lang): string {
  if (!source) return '—';
  const t = L[lang];
  const key = SOURCE_KEY[source];
  if (key && key in t) return t[key];
  return source;
}
