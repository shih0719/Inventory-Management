// src/components/TransactionsPage.tsx
// Dedicated transaction history page with server-side pagination & filters.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { Transaction, Tag, Lang } from '../types';
import { listTransactions } from '../api/transactions';
import { tagLabel } from '../lib/i18n';
import { fmtDateTime } from '../lib/format';

interface TransactionsPageProps {
  lang: Lang;
  tags: Tag[];
  onViewTransaction: (tx: Transaction) => void;
}

export function TransactionsPage({ lang, tags, onViewTransaction }: TransactionsPageProps) {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [direction, setDirection] = useState<'' | 'in' | 'out'>('');
  const [quantityType, setQuantityType] = useState('');
  const [tagId, setTagId] = useState('');
  const [sku, setSku] = useState('');
  const [operator, setOperator] = useState('');

  const load = useCallback(
    async (pageNum: number) => {
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
        });
        setRows(res.data || []);
        setTotal(res.pagination?.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    },
    [from, to, direction, quantityType, tagId, sku, operator],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const resetAndSearch = () => {
    setPage(1);
    // trigger reload through effect (page already 1 -> force via load)
    void load(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const inputStyle: CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--border-2)',
    borderRadius: 4,
    font: '12px var(--sans)',
    backgroundColor: 'var(--surface-2)',
    color: 'var(--ink)',
  };

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
            <input type="date" value={from} style={inputStyle} onChange={(e) => { setFrom(e.target.value); resetAndSearch(); }} />
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'To' : '迄日'}</label>
            <input type="date" value={to} style={inputStyle} onChange={(e) => { setTo(e.target.value); resetAndSearch(); }} />
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Direction' : '方向'}</label>
            <select value={direction} style={inputStyle} onChange={(e) => { setDirection(e.target.value as '' | 'in' | 'out'); resetAndSearch(); }}>
              <option value="">{lang === 'en' ? 'All' : '全部'}</option>
              <option value="in">{lang === 'en' ? 'Inbound' : '進貨'}</option>
              <option value="out">{lang === 'en' ? 'Outbound' : '出貨'}</option>
            </select>
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Type' : '帳別'}</label>
            <select value={quantityType} style={inputStyle} onChange={(e) => { setQuantityType(e.target.value); resetAndSearch(); }}>
              <option value="">{lang === 'en' ? 'All' : '全部'}</option>
              <option value="accountable">{lang === 'en' ? 'Accountable' : '有帳'}</option>
              <option value="non_accountable">{lang === 'en' ? 'Non-accountable' : '無帳'}</option>
            </select>
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Tag' : '標籤'}</label>
            <select value={tagId} style={inputStyle} onChange={(e) => { setTagId(e.target.value); resetAndSearch(); }}>
              <option value="">{lang === 'en' ? 'All' : '全部'}</option>
              {tags.map((tg) => (
                <option key={tg.id} value={tg.id}>{tagLabel(tg.name, lang)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>SKU</label>
            <input value={sku} placeholder="SKU" style={inputStyle} onChange={(e) => { setSku(e.target.value); resetAndSearch(); }} />
          </div>
          <div className="field">
            <label>{lang === 'en' ? 'Operator' : '操作者'}</label>
            <input value={operator} style={inputStyle} onChange={(e) => { setOperator(e.target.value); resetAndSearch(); }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card panel" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-2)', color: 'var(--ink-2)' }}>
              <th style={{ padding: '8px 10px' }}>{lang === 'en' ? 'Time' : '時間'}</th>
              <th style={{ padding: '8px 10px' }}>SKU</th>
              <th style={{ padding: '8px 10px' }}>{lang === 'en' ? 'Tag' : '標籤'}</th>
              <th style={{ padding: '8px 10px' }}>{lang === 'en' ? 'Type' : '帳別'}</th>
              <th style={{ padding: '8px 10px' }}>{lang === 'en' ? 'Qty' : '數量'}</th>
              <th style={{ padding: '8px 10px' }}>{lang === 'en' ? 'Operator' : '操作者'}</th>
              <th style={{ padding: '8px 10px' }}>{lang === 'en' ? 'Remarks' : '備註'}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)' }}>{lang === 'en' ? 'Loading…' : '載入中…'}</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>{lang === 'en' ? 'No transactions.' : '無交易紀錄。'}</td></tr>
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
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: isIn ? 'var(--ok)' : 'var(--accent)' }}>
                    {isIn ? '+' : ''}{tx.quantity_change}
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
          <button className="btn ghost" disabled={page <= 1 || loading} onClick={() => { setPage((p) => Math.max(1, p - 1)); }}>
            {lang === 'en' ? '← Prev' : '← 上一頁'}
          </button>
          <button className="btn ghost" disabled={page >= totalPages || loading} onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); }}>
            {lang === 'en' ? 'Next →' : '下一頁 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
