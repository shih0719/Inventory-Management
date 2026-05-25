import { useEffect, useState } from 'react';
import type { Batch, Transaction } from '../../types';
import { L, tagLabel, type Lang } from '../../lib/i18n';
import { fmtDateTime } from '../../lib/format';
import { getBatch } from '../../api/batches';

export interface BatchDetailModalProps {
  batchId: number;
  lang: Lang;
  onClose: () => void;
}

export function BatchDetailModal({ batchId, lang, onClose }: BatchDetailModalProps) {
  const t = L[lang];
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatch = async () => {
      try {
        const b = await getBatch(batchId);
        setBatch(b);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load batch');
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [batchId]);

  if (loading) {
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{lang === 'en' ? 'Loading...' : lang === 'zh' ? '載入中...' : '読み込み中...'}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{lang === 'en' ? 'Error' : lang === 'zh' ? '錯誤' : 'エラー'}</h3>
            <button className="close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div style={{ color: 'var(--accent)', textAlign: 'center' }}>
              {error || (lang === 'en' ? 'Batch not found' : lang === 'zh' ? '批次不存在' : 'バッチが見つかりません')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    pending: { bg: 'var(--surface-2)', color: 'var(--ink)' },
    processing: { bg: '#fef3c720', color: '#f59e0b' },
    completed: { bg: '#d1fae520', color: '#10b981' },
    failed: { bg: '#fee2e220', color: '#ef4444' },
  };

  const statusLabels: Record<string, Record<'en' | 'zh' | 'ja', string>> = {
    pending: { en: 'Pending', zh: '待處理', ja: '保留中' },
    processing: { en: 'Processing', zh: '處理中', ja: '処理中' },
    completed: { en: 'Completed', zh: '已完成', ja: '完了' },
    failed: { en: 'Failed', zh: '失敗', ja: '失敗' },
  };

  const statusColor = statusColors[batch.status] || statusColors.pending;
  const statusLabel = statusLabels[batch.status]?.[lang] || batch.status;

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 700, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-head">
          <h3>{lang === 'en' ? 'Batch Details' : lang === 'zh' ? '批次詳情' : 'バッチの詳細'}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Batch Info */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{lang === 'en' ? 'Batch Name' : lang === 'zh' ? '批次名稱' : 'バッチ名'}</label>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{batch.name}</div>
          </div>

          {/* Status */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{lang === 'en' ? 'Status' : lang === 'zh' ? '狀態' : 'ステータス'}</label>
            <span
              style={{
                display: 'inline-block',
                padding: '6px 12px',
                backgroundColor: statusColor.bg,
                color: statusColor.color,
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Created Date */}
          <div className="field" style={{ marginBottom: 24 }}>
            <label>{lang === 'en' ? 'Created' : lang === 'zh' ? '建立時間' : '作成日時'}</label>
            <div style={{ fontSize: 13 }}>{fmtDateTime(batch.created_at, lang)}</div>
          </div>

          {/* Transactions */}
          <div style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: 12 }}>
              {lang === 'en' ? 'Transactions' : lang === 'zh' ? '庫存異動' : '在庫異動'}
              <span style={{ color: 'var(--ink-2)', marginLeft: 8, fontSize: 12 }}>
                ({batch.transactions?.length || batch.transaction_count || 0})
              </span>
            </label>

            {batch.transactions && batch.transactions.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 12,
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                >
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>
                        {lang === 'en' ? 'Product' : lang === 'zh' ? '產品' : '製品'}
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>
                        {lang === 'en' ? 'Type' : lang === 'zh' ? '類型' : 'タイプ'}
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: 11 }}>
                        {lang === 'en' ? 'Qty' : lang === 'zh' ? '數量' : '数量'}
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>
                        {lang === 'en' ? 'Location' : lang === 'zh' ? '位置' : '場所'}
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>
                        {lang === 'en' ? 'Remarks' : lang === 'zh' ? '備註' : '備考'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 500 }}>{tx.product_name || tx.sku}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{tx.sku}</div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              backgroundColor: tx.quantity_change > 0 ? 'var(--ok-soft)' : 'var(--accent-soft)',
                              color: tx.quantity_change > 0 ? 'var(--ok)' : 'var(--accent)',
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {tagLabel(tx.tag_name, lang)}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                          <span style={{ color: tx.quantity_change > 0 ? 'var(--ok)' : 'var(--accent)' }}>
                            {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-2)' }}>
                          {tx.location_tag || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-2)' }}>
                          {tx.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-2)', fontSize: 12 }}>
                {lang === 'en' ? 'No transactions' : lang === 'zh' ? '沒有異動' : 'トランザクションがありません'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
