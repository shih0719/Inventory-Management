import { useEffect, useState } from 'react';
import type { Shipment, Transaction } from '../../types';
import { L, tagLabel, type Lang } from '../../lib/i18n';
import { fmtTime } from '../../lib/format';
import { getShipment } from '../../api/shipments';

export interface ShipmentDetailModalProps {
  shipmentId: number;
  lang: Lang;
  onClose: () => void;
}

export function ShipmentDetailModal({ shipmentId, lang, onClose }: ShipmentDetailModalProps) {
  const t = L[lang];
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShipment = async () => {
      try {
        const s = await getShipment(shipmentId);
        setShipment(s);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shipment');
      } finally {
        setLoading(false);
      }
    };

    fetchShipment();
  }, [shipmentId]);

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

  if (error || !shipment) {
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{lang === 'en' ? 'Error' : lang === 'zh' ? '錯誤' : 'エラー'}</h3>
            <button className="close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <div style={{ color: 'var(--accent)', textAlign: 'center' }}>
              {error || (lang === 'en' ? 'Shipment not found' : lang === 'zh' ? '出貨單據不存在' : '配送が見つかりません')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const transactions = shipment.items_summary || [];
  const totalQuantity = transactions.reduce((sum, tx) => sum + tx.quantity_change, 0);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 800, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-head">
          <h3>{lang === 'en' ? 'Shipment Details' : lang === 'zh' ? '出貨單據詳情' : '配送の詳細'}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Shipment Number */}
          <div className="field" style={{ marginBottom: 16 }}>
            <label>{lang === 'en' ? 'Shipment #' : lang === 'zh' ? '出貨單據號' : '配送番号'}</label>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--mono)' }}>
              {shipment.shipment_number}
            </div>
          </div>

          {/* Customer & Project Case */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="field">
              <label>{lang === 'en' ? 'Customer' : lang === 'zh' ? '客戶' : '顧客'}</label>
              <div style={{ fontSize: 13 }}>{shipment.customer || '-'}</div>
            </div>
            <div className="field">
              <label>{lang === 'en' ? 'Project/Case' : lang === 'zh' ? '項目/案件' : 'プロジェクト/ケース'}</label>
              <div style={{ fontSize: 13 }}>{shipment.project_case || '-'}</div>
            </div>
          </div>

          {/* Date */}
          <div className="field" style={{ marginBottom: 24 }}>
            <label>{lang === 'en' ? 'Shipment Date' : lang === 'zh' ? '出貨日期' : '配送日'}</label>
            <div style={{ fontSize: 13 }}>{fmtTime(shipment.shipment_date, lang)}</div>
          </div>

          {/* Summary Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 24,
              padding: 12,
              background: 'var(--surface-2)',
              borderRadius: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {lang === 'en' ? 'Items' : lang === 'zh' ? '項目數' : 'アイテム数'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{transactions.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {lang === 'en' ? 'Total Qty' : lang === 'zh' ? '總數量' : '合計数量'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                {totalQuantity}
              </div>
            </div>
          </div>

          {/* Transaction Items */}
          <div style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', marginBottom: 12 }}>
              {lang === 'en' ? 'Items' : lang === 'zh' ? '項目清單' : 'アイテムリスト'}
            </label>

            {transactions.length > 0 ? (
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
                    {transactions.map((tx) => (
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
                {lang === 'en' ? 'No items' : lang === 'zh' ? '沒有項目' : 'アイテムがありません'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
