import { useEffect, useState } from 'react';
import { listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, type Warehouse } from '../api/warehouses';
import { ApiError } from '../api/client';
import type { Lang } from '../lib/i18n';

interface WarehousesPageProps {
  lang: Lang;
}

const texts = {
  en: {
    title: 'Warehouses',
    back: '← Back',
    name: 'Name',
    description: 'Description',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    add: 'Add Warehouse',
    namePlaceholder: 'Warehouse name',
    descPlaceholder: 'Description (optional)',
    confirmDelete: 'Delete this warehouse?',
    loadError: 'Failed to load warehouses',
    noWarehouses: 'No warehouses yet',
    nameRequired: 'Name is required',
    duplicateName: 'A warehouse with that name already exists',
  },
  zh: {
    title: '倉庫管理',
    back: '← 返回',
    name: '名稱',
    description: '描述',
    actions: '操作',
    edit: '編輯',
    delete: '刪除',
    save: '儲存',
    cancel: '取消',
    add: '新增倉庫',
    namePlaceholder: '倉庫名稱',
    descPlaceholder: '描述（選填）',
    confirmDelete: '確定刪除此倉庫？',
    loadError: '無法載入倉庫清單',
    noWarehouses: '尚無倉庫',
    nameRequired: '名稱為必填',
    duplicateName: '已有同名倉庫',
  },
  ja: {
    title: '倉庫管理',
    back: '← 戻る',
    name: '名前',
    description: '説明',
    actions: '操作',
    edit: '編集',
    delete: '削除',
    save: '保存',
    cancel: 'キャンセル',
    add: '倉庫を追加',
    namePlaceholder: '倉庫名',
    descPlaceholder: '説明（任意）',
    confirmDelete: 'この倉庫を削除しますか？',
    loadError: '倉庫の読み込みに失敗しました',
    noWarehouses: '倉庫がありません',
    nameRequired: '名前は必須です',
    duplicateName: '同名の倉庫が既に存在します',
  },
};

export function WarehousesPage({ lang }: WarehousesPageProps) {
  const t = texts[lang];

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listWarehouses();
      setWarehouses(data);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAdd = async () => {
    if (!addName.trim()) {
      setAddError(t.nameRequired);
      return;
    }
    setAddSubmitting(true);
    setAddError(null);
    try {
      await createWarehouse(addName.trim(), addDesc.trim() || undefined);
      setAddName('');
      setAddDesc('');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAddError(t.duplicateName);
      } else {
        setAddError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  const startEdit = (w: Warehouse) => {
    setEditId(w.id);
    setEditName(w.name);
    setEditDesc(w.description ?? '');
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditError(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setEditError(t.nameRequired);
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateWarehouse(editId!, editName.trim(), editDesc.trim() || undefined);
      setEditId(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEditError(t.duplicateName);
      } else {
        setEditError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (w: Warehouse) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await deleteWarehouse(w.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '13px',
    background: 'var(--surface)',
    color: 'var(--ink)',
    outline: 'none',
  };

  const btnStyle = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '13px',
      cursor: 'pointer',
      border: '1px solid transparent',
      fontFamily: 'inherit',
    };
    if (variant === 'primary') return { ...base, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' };
    if (variant === 'danger') return { ...base, background: 'transparent', color: '#ef4444', borderColor: '#fecaca' };
    return { ...base, background: 'transparent', color: 'var(--ink)', borderColor: 'var(--border)' };
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, flex: 1 }}>{t.title}</h1>
        <div style={{ width: 80 }} />
      </div>

      {/* Load error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '16px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Add form */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <input
            style={{ ...inputStyle, flex: '1 1 160px', minWidth: '120px' }}
            placeholder={t.namePlaceholder}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
          />
          <input
            style={{ ...inputStyle, flex: '2 1 220px', minWidth: '140px' }}
            placeholder={t.descPlaceholder}
            value={addDesc}
            onChange={(e) => setAddDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
          />
          <button style={btnStyle('primary')} onClick={() => void handleAdd()} disabled={addSubmitting}>
            {t.add}
          </button>
        </div>
        {addError && <div style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626' }}>{addError}</div>}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-2)' }}>Loading...</div>
      ) : warehouses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-2)' }}>{t.noWarehouses}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {[t.name, t.description, t.actions].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: 'var(--ink-1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                editId === w.id ? (
                  <tr key={w.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <input
                        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <input
                        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                      />
                      {editError && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{editError}</div>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={btnStyle('primary')} onClick={() => void handleSave()} disabled={editSubmitting}>{t.save}</button>
                        <button style={btnStyle('ghost')} onClick={cancelEdit}>{t.cancel}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{w.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--ink-2)' }}>{w.description ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={btnStyle('ghost')} onClick={() => startEdit(w)}>{t.edit}</button>
                        <button style={btnStyle('danger')} onClick={() => void handleDelete(w)}>{t.delete}</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
