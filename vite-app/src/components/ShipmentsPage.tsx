import { useState, useEffect } from 'react';
import type { Shipment, Transaction } from '../types';
import {
  listShipments,
  getShipment,
  createShipment,
  updateShipment,
  deleteShipment,
} from '../api/shipments';
import { listTransactions } from '../api/transactions';
import { ConfirmModal } from './modals/ConfirmModal';

export interface ShipmentsPageProps {
  onBack: () => void;
  lang?: 'en' | 'zh';
}

export function ShipmentsPage({ onBack, lang = 'en' }: ShipmentsPageProps) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form fields
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>([]);
  const [customer, setCustomer] = useState('');
  const [projectCase, setProjectCase] = useState('');
  const [shipmentDate, setShipmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    loadShipments();
    loadTransactions();
  }, []);

  const loadShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listShipments();
      setShipments(res.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await listTransactions({ limit: 500 });
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTransactionIds.length === 0) {
      setError('Please select at least one transaction');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newShipment = await createShipment({
        transaction_ids: selectedTransactionIds,
        customer: customer || undefined,
        project_case: projectCase || undefined,
        shipment_date: shipmentDate || undefined,
      });
      setShipments([...shipments, newShipment]);
      resetForm();
      setIsCreating(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShipment = async (shipment: Shipment) => {
    try {
      setLoading(true);
      setError(null);
      const full = await getShipment(shipment.id);
      setSelectedShipment(full);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShipment = (id: number) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirm === null) return;
    const id = deleteConfirm;
    setDeleteConfirm(null);

    try {
      setLoading(true);
      setError(null);
      await deleteShipment(id);
      setShipments(shipments.filter((s) => s.id !== id));
      setSelectedShipment(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedTransactionIds([]);
    setCustomer('');
    setProjectCase('');
    setShipmentDate(new Date().toISOString().split('T')[0]);
  };

  // Get unbound transactions (not in any shipment or in the selected one being edited)
  const availableTransactions = transactions.filter((tx) => {
    const isAlreadyBound = shipments.some((s) => (s.transaction_ids || []).includes(tx.id));
    return !isAlreadyBound;
  });

  return (
    <div className="batch-flow">
      <div className="flow-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="back" onClick={onBack}>
            {lang === 'en' ? '← Back' : '← 返回'}
          </button>
          <div>
            <h2>{lang === 'en' ? 'Shipments' : '出貨單據'}</h2>
            <div className="sub">
              {lang === 'en'
                ? 'Group transactions into shipments'
                : '將異動分組為出貨單據'}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--accent-2)', borderRadius: 6, color: 'var(--accent)', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left: Shipments List */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {lang === 'en' ? 'Shipments' : '清單'} ({shipments.length})
            </span>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="btn ghost"
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {isCreating ? (lang === 'en' ? 'Cancel' : '取消') : (lang === 'en' ? '+ New' : '新增')}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: 8 }}>
            {shipments.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectShipment(s)}
                style={{
                  padding: '10px 12px',
                  border: selectedShipment?.id === s.id ? '1px solid var(--ok)' : '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedShipment?.id === s.id ? 'var(--surface-2)' : 'transparent',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.shipment_number}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 2 }}>
                  {s.customer || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {s.transaction_count || 0} {lang === 'en' ? 'txns' : '筆異動'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Create or Details */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
          {isCreating ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                {lang === 'en' ? 'New Shipment' : '新增出貨單'}
              </div>
              <form onSubmit={handleCreateShipment} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    {lang === 'en' ? 'Shipment date' : '出貨日期'}
                  </label>
                  <input
                    type="date"
                    value={shipmentDate}
                    onChange={(e) => setShipmentDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    {lang === 'en' ? 'Customer (optional)' : '客戶 (選填)'}
                  </label>
                  <input
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder={lang === 'en' ? 'Customer name' : '客戶名稱'}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    {lang === 'en' ? 'Project (optional)' : '案件 (選填)'}
                  </label>
                  <input
                    type="text"
                    value={projectCase}
                    onChange={(e) => setProjectCase(e.target.value)}
                    placeholder={lang === 'en' ? 'Project case' : '案件編號'}
                  />
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                    {lang === 'en' ? 'Transactions' : '選擇異動'} ({selectedTransactionIds.length})
                  </label>
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4, padding: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {availableTransactions.length === 0 ? (
                      <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                        {lang === 'en' ? 'No transactions available' : '沒有可用的異動'}
                      </div>
                    ) : (
                      availableTransactions.map((tx) => (
                        <label key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedTransactionIds.includes(tx.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTransactionIds([...selectedTransactionIds, tx.id]);
                              } else {
                                setSelectedTransactionIds(
                                  selectedTransactionIds.filter((id) => id !== tx.id)
                                );
                              }
                            }}
                          />
                          <span>
                            [{tx.sku}] {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || selectedTransactionIds.length === 0}
                  className="btn"
                  style={{ marginTop: 'auto' }}
                >
                  {loading ? (lang === 'en' ? 'Creating...' : '建立中...') : (lang === 'en' ? 'Create shipment' : '建立出貨單')}
                </button>
              </form>
            </>
          ) : selectedShipment ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                {selectedShipment.shipment_number}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                    {lang === 'en' ? 'Shipment date' : '出貨日期'}
                  </div>
                  <div style={{ fontWeight: 500 }}>{selectedShipment.shipment_date}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                    {lang === 'en' ? 'Customer' : '客戶'}
                  </div>
                  <div style={{ fontWeight: 500 }}>{selectedShipment.customer || '—'}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                    {lang === 'en' ? 'Project' : '案件'}
                  </div>
                  <div style={{ fontWeight: 500 }}>{selectedShipment.project_case || '—'}</div>
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>
                    {lang === 'en' ? 'Transactions' : '異動明細'}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4, padding: 8, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedShipment.items_summary?.map((tx) => (
                      <div key={tx.id} style={{ color: 'var(--ink-2)' }}>
                        [{tx.sku}] {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change} — {tx.tag_name}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteShipment(selectedShipment.id)}
                  className="btn"
                  style={{ background: 'var(--accent)', color: 'var(--surface)' }}
                >
                  {lang === 'en' ? 'Delete' : '刪除出貨單'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              {lang === 'en' ? 'Select a shipment or create new' : '選擇出貨單或建立新的'}
            </div>
          )}
        </div>
      </div>

      {deleteConfirm !== null && (
        <ConfirmModal
          title={lang === 'en' ? 'Confirm Delete' : '確認刪除'}
          message={lang === 'en' ? 'Delete this shipment? Related transaction records will be preserved.' : '確認刪除此出貨單？相關異動記錄將被保留。'}
          isDangerous
          lang={lang}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
