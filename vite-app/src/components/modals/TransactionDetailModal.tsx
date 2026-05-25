import { useEffect, useState } from 'react';
import type { Transaction } from '../../types';
import { L, tagLabel, type Lang } from '../../lib/i18n';
import { fmtDateTime } from '../../lib/format';
import { getTransaction } from '../../api/transactions';

export interface TransactionDetailModalProps {
  transactionId: number;
  lang: Lang;
  onClose: () => void;
}

export function TransactionDetailModal({ transactionId, lang, onClose }: TransactionDetailModalProps) {
  const t = L[lang];
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const tx = await getTransaction(transactionId);
        setTransaction(tx);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{lang === 'en' ? 'Loading...' : '載入中...'}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{lang === 'en' ? 'Error' : '錯誤'}</h3>
            <button className="close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div style={{ color: 'var(--accent)', textAlign: 'center' }}>
              {error || (lang === 'en' ? 'Transaction not found' : '交易不存在')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isInbound = transaction.quantity_change > 0;

  const handleCopySerials = () => {
    if (!transaction.product_units || transaction.product_units.length === 0) return;
    const serials = transaction.product_units.map((u) => u.serial_number).join('\n');
    navigator.clipboard.writeText(serials).then(() => {
      // Optional: show a brief toast/notification
      alert(lang === 'en' ? 'Copied!' : '已複製');
    });
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 600 }}>
        <div className="modal-head">
          <h3>{lang === 'en' ? 'Transaction Details' : '交易詳情'}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Product Info */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{lang === 'en' ? 'Product' : '產品'}</label>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              {transaction.product_name || transaction.sku}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {transaction.sku}
            </div>
          </div>

          {/* Type & Tag */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{lang === 'en' ? 'Transaction Type' : '交易類型'}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 8px',
                  backgroundColor: isInbound ? 'var(--ok-soft)' : 'var(--accent-soft)',
                  color: isInbound ? 'var(--ok)' : 'var(--accent)',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {tagLabel(transaction.tag_name, lang)}
              </span>
              {transaction.product_type === 'ap' && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  AP
                </span>
              )}
            </div>
          </div>

          {/* Quantity */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{lang === 'en' ? 'Quantity Change' : '數量變化'}</label>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: isInbound ? 'var(--ok)' : 'var(--accent)',
              }}
            >
              {isInbound ? '+' : ''}{transaction.quantity_change}
            </div>
          </div>

          {/* Date */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{lang === 'en' ? 'Created' : '建立時間'}</label>
            <div style={{ fontSize: 13 }}>{fmtDateTime(transaction.created_at, lang)}</div>
          </div>

          {/* Serial Numbers */}
          {transaction.product_type === 'ap' && transaction.product_units && transaction.product_units.length > 0 && (
            <div className="field" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ marginBottom: 0 }}>
                  {lang === 'en' ? 'Serial Numbers' : '序號品'} ({transaction.product_units.length})
                </label>
                <button
                  onClick={handleCopySerials}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    backgroundColor: 'var(--ok)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {lang === 'en' ? '📋 Copy' : '📋 複製'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {transaction.product_units.map((unit) => (
                  <div
                    key={unit.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      backgroundColor: 'var(--surface-2)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>
                      {unit.serial_number}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        backgroundColor: unit.status === 'sold' ? 'var(--accent-soft)' : 'var(--ok-soft)',
                        color: unit.status === 'sold' ? 'var(--accent)' : 'var(--ok)',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {unit.status === 'in_stock'
                        ? (lang === 'en' ? 'In Stock' : '庫存')
                        : unit.status === 'sold'
                        ? (lang === 'en' ? 'Sold' : '已售')
                        : (lang === 'en' ? 'Returned' : '退回')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {transaction.remarks && (
            <div className="field">
              <label>{lang === 'en' ? 'Remarks' : '備註'}</label>
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontStyle: 'italic',
                  color: 'var(--ink-2)',
                  marginTop: 6,
                }}
              >
                {transaction.remarks}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button
            className="btn"
            onClick={onClose}
            style={{ marginLeft: 'auto' }}
          >
            {lang === 'en' ? 'Close' : '關閉'}
          </button>
        </div>
      </div>
    </div>
  );
}
