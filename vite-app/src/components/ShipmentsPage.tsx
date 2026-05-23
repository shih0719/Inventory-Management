import { useState, useEffect } from 'react';
import type { Shipment, Transaction } from '../types';
import {
  listShipments,
  getShipment,
  createShipment,
  updateShipment,
  deleteShipment,
} from '../api/shipments';
import { listAllTransactions } from '../api/transactions';
import { ConfirmModal } from './modals/ConfirmModal';

export interface ShipmentsPageProps {
  onBack: () => void;
}

export function ShipmentsPage({ onBack }: ShipmentsPageProps) {
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
      if (res.success) {
        setShipments(res.data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const txns = await listAllTransactions();
      setTransactions(txns);
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
    const isAlreadyBound = shipments.some((s) => s.transaction_ids.includes(tx.id));
    return !isAlreadyBound;
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">出貨單據</h1>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          返回
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Shipments List */}
        <div className="col-span-1 border-r">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">清單</h2>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              {isCreating ? '取消' : '新增'}
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {shipments.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectShipment(s)}
                className={`p-3 border rounded cursor-pointer ${
                  selectedShipment?.id === s.id
                    ? 'bg-blue-100 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-semibold">{s.shipment_number}</div>
                <div className="text-sm text-gray-600">{s.customer || '—'}</div>
                <div className="text-xs text-gray-500">
                  {s.transaction_count || 0} 筆異動
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Create Form */}
        {isCreating && (
          <div className="col-span-1 border-r">
            <h2 className="text-lg font-semibold mb-4">新增出貨單</h2>
            <form onSubmit={handleCreateShipment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">出貨日期</label>
                <input
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">客戶</label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="客戶名稱"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">案件</label>
                <input
                  type="text"
                  value={projectCase}
                  onChange={(e) => setProjectCase(e.target.value)}
                  placeholder="案件編號"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  選擇異動 ({selectedTransactionIds.length})
                </label>
                <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-2">
                  {availableTransactions.map((tx) => (
                    <label key={tx.id} className="flex items-center gap-2 text-sm">
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
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {loading ? '建立中...' : '建立出貨單'}
              </button>
            </form>
          </div>
        )}

        {/* Right: Selected Shipment Details */}
        {selectedShipment && !isCreating && (
          <div className="col-span-1">
            <h2 className="text-lg font-semibold mb-4">{selectedShipment.shipment_number}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">出貨日期</label>
                <div className="font-semibold">{selectedShipment.shipment_date}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">客戶</label>
                <div className="font-semibold">{selectedShipment.customer || '—'}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">案件</label>
                <div className="font-semibold">{selectedShipment.project_case || '—'}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">異動明細</label>
                <div className="border rounded p-2 max-h-40 overflow-y-auto text-sm space-y-1">
                  {selectedShipment.items_summary?.map((tx) => (
                    <div key={tx.id} className="text-gray-600">
                      [{tx.sku}] {tx.quantity_change > 0 ? '+' : ''}{tx.quantity_change} —{' '}
                      {tx.tag_name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <button
                  onClick={() => handleDeleteShipment(selectedShipment.id)}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  刪除出貨單
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        title="確認刪除"
        message="確認刪除此出貨單？相關異動記錄將被保留。"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
