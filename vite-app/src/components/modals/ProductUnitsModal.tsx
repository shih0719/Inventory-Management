import { useEffect, useState } from 'react';
import type { Product, ProductUnit } from '../../types';
import { L, type Lang } from '../../lib/i18n';
import { listProductUnits, bulkSellUnits } from '../../api/product-units';
import { ApiError } from '../../api/client';
import { ConfirmModal } from './ConfirmModal';

export interface ProductUnitsModalProps {
  product: Product;
  lang: Lang;
  onClose: () => void;
  onConfirm: (soldUnits: Array<{ id: number; sold_to: string; project_case: string }>) => void;
}

export function ProductUnitsModal({
  product,
  lang,
  onClose,
  onConfirm,
}: ProductUnitsModalProps) {
  const t = L[lang];
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'input'>('list');
  const [selected, setSelected] = useState<number[]>([]);
  const [serialInput, setSerialInput] = useState('');
  const [soldTo, setSoldTo] = useState('');
  const [projectCase, setProjectCase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<{ type: 'success' | 'error'; count?: number; message?: string } | null>(null);
  const [pendingItems, setPendingItems] = useState<Array<{ id: number; serial_number: string; sold_to: string; project_case: string }> | null>(null);

  useEffect(() => {
    loadUnits();
  }, [product.id]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await listProductUnits(product.id, 'in_stock');
      setUnits(data);
    } catch (err) {
      console.error('Failed to load units:', err);
    } finally {
      setLoading(false);
    }
  };

  const availableUnits = units.filter((u) => u.status === 'in_stock');

  const serialList = serialInput
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const canSubmitList = selected.length > 0 && soldTo.trim() && projectCase.trim() && !submitting;
  const canSubmitInput = serialList.length > 0 && soldTo.trim() && projectCase.trim() && !submitting;
  const canSubmit = mode === 'list' ? canSubmitList : canSubmitInput;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let selectedSerials: string[] = [];
      let itemsToConfirm: Array<{ id: number; serial_number: string; sold_to: string; project_case: string }> = [];

      if (mode === 'list') {
        selectedSerials = units
          .filter((u) => selected.includes(u.id))
          .map((u) => u.serial_number);

        itemsToConfirm = selected.map((id) => {
          const unit = units.find((u) => u.id === id);
          return {
            id,
            serial_number: unit?.serial_number || '',
            sold_to: soldTo,
            project_case: projectCase,
          };
        });
      } else {
        selectedSerials = serialList;
        itemsToConfirm = serialList.map((sn) => ({
          id: 0,
          serial_number: sn,
          sold_to: soldTo,
          project_case: projectCase,
        }));
      }

      const response = await bulkSellUnits(selectedSerials, projectCase, soldTo);
      setPendingItems(itemsToConfirm);
      setResultModal({
        type: 'success',
        count: response.sold,
        message: response.message
      });
    } catch (err) {
      console.error('Failed to mark units as sold:', err);
      let errorMessage = lang === 'en' ? 'Failed to mark units as sold' : '標記出售失敗';

      if (err instanceof ApiError) {
        if (err.body && typeof err.body === 'object') {
          const body = err.body as any;
          // Try to extract from errors array (format: {success:false, errors:[{serial_number, reason}]})
          if (Array.isArray(body.errors) && body.errors.length > 0) {
            const errorList = body.errors
              .map((e: any) => `${e.serial_number || e.product_id || '?'}: ${e.reason || e.message || '未知錯誤'}`)
              .join('\n');
            errorMessage = errorList;
          } else if (body.error) {
            errorMessage = body.error;
          } else if (body.message) {
            errorMessage = body.message;
          } else {
            errorMessage = err.message;
          }
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setResultModal({ type: 'error', message: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResultConfirm = () => {
    if (resultModal?.type === 'success' && pendingItems) {
      onConfirm(pendingItems);
      onClose();
    }
    setResultModal(null);
    setPendingItems(null);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    setSelected(
      selected.length === availableUnits.length
        ? []
        : availableUnits.map((u) => u.id),
    );
  };

  const count = mode === 'list' ? selected.length : serialList.length;

  return (
    <>
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal" style={{ width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{lang === 'en' ? 'Select Units to Sell' : '選擇要出售的序號品'}</h3>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              {lang === 'en' ? 'Loading units...' : '載入中...'}
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  className={mode === 'list' ? 'on' : ''}
                  onClick={() => { setMode('list'); setSerialInput(''); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: mode === 'list' ? 'var(--ink)' : 'var(--surface)',
                    color: mode === 'list' ? 'var(--bg)' : 'var(--ink)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {lang === 'en' ? 'Select from List' : '從列表選擇'}
                </button>
                <button
                  className={mode === 'input' ? 'on' : ''}
                  onClick={() => { setMode('input'); setSelected([]); }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: mode === 'input' ? 'var(--ink)' : 'var(--surface)',
                    color: mode === 'input' ? 'var(--bg)' : 'var(--ink)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {lang === 'en' ? 'Manual Input' : '手動輸入'}
                </button>
              </div>

              {/* List mode */}
              {mode === 'list' && (
                <>
                  {availableUnits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-3)' }}>
                      {lang === 'en' ? 'No units in stock' : '無庫存中的序號品'}
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
                          {lang === 'en'
                            ? `Available: ${availableUnits.length} units`
                            : `可用: ${availableUnits.length} 個序號品`}
                        </div>
                        <button
                          onClick={toggleSelectAll}
                          className="btn ghost"
                          style={{ fontSize: 12 }}
                        >
                          {selected.length === availableUnits.length
                            ? lang === 'en'
                              ? 'Deselect All'
                              : '取消全選'
                            : lang === 'en'
                              ? 'Select All'
                              : '全選'}
                        </button>
                      </div>

                      <div
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          maxHeight: 200,
                          overflowY: 'auto',
                          marginBottom: 16,
                        }}
                      >
                        {availableUnits.map((unit) => (
                          <div
                            key={unit.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              borderBottom: '1px solid var(--border-2)',
                              cursor: 'pointer',
                              background: selected.includes(unit.id)
                                ? 'var(--surface-2)'
                                : 'transparent',
                            }}
                            onClick={() => toggleSelect(unit.id)}
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(unit.id)}
                              onChange={() => {}}
                              style={{ marginRight: 10 }}
                            />
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{unit.serial_number}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Input mode */}
              {mode === 'input' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ marginBottom: 8, display: 'block' }}>
                    {lang === 'en' ? 'Serial Numbers (one per line)' : '序號品 (一行一個)'}
                  </label>
                  <textarea
                    value={serialInput}
                    onChange={(e) => setSerialInput(e.target.value)}
                    placeholder={lang === 'en' ? 'SN-001\nSN-002\nSN-003' : 'SN-001\nSN-002\nSN-003'}
                    style={{
                      width: '100%',
                      minHeight: 150,
                      padding: '10px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                      lineHeight: 1.6,
                      resize: 'vertical',
                    }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      marginTop: 8,
                    }}
                  >
                    {lang === 'en'
                      ? `Ready to sell: ${serialList.length} unit${serialList.length !== 1 ? 's' : ''}`
                      : `準備出售: ${serialList.length} 個序號品`}
                  </div>
                </div>
              )}

              {/* Common fields */}
              <div className="field">
                <label>{lang === 'en' ? 'Sold To (Customer)' : '售予（客戶）'}</label>
                <input
                  type="text"
                  value={soldTo}
                  onChange={(e) => setSoldTo(e.target.value)}
                  placeholder={lang === 'en' ? 'Customer name' : '客戶名稱'}
                />
              </div>

              <div className="field">
                <label>{lang === 'en' ? 'Project Case' : '專案代碼'}</label>
                <input
                  type="text"
                  value={projectCase}
                  onChange={(e) => setProjectCase(e.target.value)}
                  placeholder={lang === 'en' ? 'Project code' : '專案代碼'}
                />
              </div>
            </>
          )}
        </div>

        {!loading && (mode === 'list' ? availableUnits.length > 0 : true) && (
          <div className="modal-foot">
            <div />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost" onClick={onClose}>
                {lang === 'en' ? 'Cancel' : '取消'}
              </button>
              <button
                className="btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={canSubmit ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
              >
                {submitting
                  ? lang === 'en'
                    ? 'Marking...'
                    : '標記中...'
                  : lang === 'en'
                    ? `Mark ${mode === 'list' ? selected.length : serialList.length} as Sold`
                    : `標記 ${mode === 'list' ? selected.length : serialList.length} 為已出售`}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {resultModal && (
        <ConfirmModal
          title={
            resultModal.type === 'success'
              ? lang === 'en'
                ? 'Marked as Sold'
                : '標記出售成功'
              : lang === 'en'
                ? 'Failed to Mark as Sold'
                : '標記出售失敗'
          }
          message={resultModal.message || (lang === 'en' ? 'An error occurred' : '發生錯誤')}
          confirmText={lang === 'en' ? 'OK' : '確認'}
          showCancel={false}
          isDangerous={resultModal.type === 'error'}
          lang={lang}
          onConfirm={handleResultConfirm}
          onCancel={() => {
            setResultModal(null);
            setPendingItems(null);
          }}
        />
      )}
    </>
  );
}
