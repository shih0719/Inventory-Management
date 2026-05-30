import { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser, type WarehouseUser } from '../api/users';
import { listWarehouses, type Warehouse } from '../api/warehouses';
import { ApiError } from '../api/client';
import type { Lang } from '../lib/i18n';

interface UsersPageProps {
  lang: Lang;
  onBack: () => void;
}

const texts = {
  en: {
    title: 'User Management',
    back: '← Back',
    username: 'Username',
    role: 'Role',
    provider: 'Provider',
    warehouses: 'Warehouses',
    createdAt: 'Created',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    addUser: 'Add User',
    password: 'Password',
    usernamePlaceholder: 'Username',
    passwordPlaceholder: 'Password',
    confirmDelete: 'Delete this user?',
    loadError: 'Failed to load users',
    noUsers: 'No users yet',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    duplicateUsername: 'Username already exists',
    invalidWarehouse: 'One or more warehouse IDs are invalid',
    allWarehouses: 'All warehouses',
    noWarehouses: '—',
  },
  zh: {
    title: '使用者管理',
    back: '← 返回',
    username: '使用者名稱',
    role: '角色',
    provider: '登入方式',
    warehouses: '所屬倉庫',
    createdAt: '建立時間',
    actions: '操作',
    edit: '編輯',
    delete: '刪除',
    save: '儲存',
    cancel: '取消',
    addUser: '新增使用者',
    password: '密碼',
    usernamePlaceholder: '使用者名稱',
    passwordPlaceholder: '密碼',
    confirmDelete: '確定刪除此使用者？',
    loadError: '無法載入使用者清單',
    noUsers: '尚無使用者',
    usernameRequired: '使用者名稱為必填',
    passwordRequired: '密碼為必填',
    duplicateUsername: '使用者名稱已存在',
    invalidWarehouse: '部分倉庫 ID 無效',
    allWarehouses: '所有倉庫',
    noWarehouses: '—',
  },
  ja: {
    title: 'ユーザー管理',
    back: '← 戻る',
    username: 'ユーザー名',
    role: 'ロール',
    provider: 'ログイン方法',
    warehouses: '所属倉庫',
    createdAt: '作成日時',
    actions: '操作',
    edit: '編集',
    delete: '削除',
    save: '保存',
    cancel: 'キャンセル',
    addUser: 'ユーザーを追加',
    password: 'パスワード',
    usernamePlaceholder: 'ユーザー名',
    passwordPlaceholder: 'パスワード',
    confirmDelete: 'このユーザーを削除しますか？',
    loadError: 'ユーザーの読み込みに失敗しました',
    noUsers: 'ユーザーがいません',
    usernameRequired: 'ユーザー名は必須です',
    passwordRequired: 'パスワードは必須です',
    duplicateUsername: 'そのユーザー名は既に使われています',
    invalidWarehouse: '無効な倉庫 ID が含まれています',
    allWarehouses: 'すべての倉庫',
    noWarehouses: '—',
  },
};

const roleColors: Record<string, { bg: string; color: string }> = {
  admin:   { bg: '#fef3c7', color: '#92400e' },
  manager: { bg: '#dbeafe', color: '#1e40af' },
  view:    { bg: '#f3f4f6', color: '#374151' },
};

const providerColors: Record<string, { bg: string; color: string }> = {
  local:     { bg: '#d1fae5', color: '#065f46' },
  microsoft: { bg: '#ede9fe', color: '#5b21b6' },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; color: string } }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 500,
      background: colors.bg,
      color: colors.color,
    }}>
      {label}
    </span>
  );
}

export function UsersPage({ lang, onBack }: UsersPageProps) {
  const t = texts[lang];

  const [users, setUsers] = useState<WarehouseUser[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState<string>('view');
  const [addWarehouseIds, setAddWarehouseIds] = useState<number[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<string>('view');
  const [editWarehouseIds, setEditWarehouseIds] = useState<number[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userData, warehouseData] = await Promise.all([listUsers(), listWarehouses()]);
      setUsers(userData);
      setWarehouses(warehouseData);
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const warehouseMap = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  const formatWarehouseIds = (ids: number[]) => {
    if (ids.length === 0) return t.noWarehouses;
    return ids.map((id) => warehouseMap[id] ?? `#${id}`).join(', ');
  };

  const handleApiError = (err: unknown, setErr: (msg: string) => void) => {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        setErr(t.duplicateUsername);
      } else if (err.status === 400) {
        setErr(t.invalidWarehouse);
      } else {
        setErr(err.message);
      }
    } else {
      setErr(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAdd = async () => {
    if (!addUsername.trim()) { setAddError(t.usernameRequired); return; }
    if (!addPassword.trim()) { setAddError(t.passwordRequired); return; }
    setAddSubmitting(true);
    setAddError(null);
    try {
      await createUser(addUsername.trim(), addPassword.trim(), addRole, addWarehouseIds);
      setAddUsername('');
      setAddPassword('');
      setAddRole('view');
      setAddWarehouseIds([]);
      await load();
    } catch (err) {
      handleApiError(err, setAddError);
    } finally {
      setAddSubmitting(false);
    }
  };

  const startEdit = (u: WarehouseUser) => {
    setEditId(u.id);
    setEditRole(u.role);
    setEditWarehouseIds([...u.warehouses]);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditError(null);
  };

  const handleSave = async () => {
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateUser(editId!, editRole, editWarehouseIds);
      setEditId(null);
      await load();
    } catch (err) {
      handleApiError(err, setEditError);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (u: WarehouseUser) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await deleteUser(u.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleWarehouse = (id: number, ids: number[], setIds: (v: number[]) => void) => {
    if (ids.includes(id)) {
      setIds(ids.filter((x) => x !== id));
    } else {
      setIds([...ids, id]);
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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
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

  const WarehouseCheckboxes = ({
    selectedIds,
    onChange,
  }: {
    selectedIds: number[];
    onChange: (ids: number[]) => void;
  }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
      {warehouses.map((w) => (
        <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selectedIds.includes(w.id)}
            onChange={() => toggleWarehouse(w.id, selectedIds, onChange)}
          />
          {w.name}
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <button className="btn ghost" onClick={onBack}>{t.back}</button>
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
            style={{ ...inputStyle, flex: '1 1 140px', minWidth: '100px' }}
            placeholder={t.usernamePlaceholder}
            value={addUsername}
            onChange={(e) => setAddUsername(e.target.value)}
          />
          <input
            type="password"
            style={{ ...inputStyle, flex: '1 1 140px', minWidth: '100px' }}
            placeholder={t.passwordPlaceholder}
            value={addPassword}
            onChange={(e) => setAddPassword(e.target.value)}
          />
          <select
            style={{ ...selectStyle, flex: '0 0 auto' }}
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
          >
            <option value="admin">admin</option>
            <option value="manager">manager</option>
            <option value="view">view</option>
          </select>
          <button style={btnStyle('primary')} onClick={() => void handleAdd()} disabled={addSubmitting}>
            {t.addUser}
          </button>
        </div>
        {warehouses.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--ink-2)', marginBottom: '4px' }}>{t.warehouses}</div>
            <WarehouseCheckboxes selectedIds={addWarehouseIds} onChange={setAddWarehouseIds} />
          </div>
        )}
        {addError && <div style={{ marginTop: '8px', fontSize: '13px', color: '#dc2626' }}>{addError}</div>}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-2)' }}>Loading...</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-2)' }}>{t.noUsers}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {[t.username, t.role, t.provider, t.warehouses, t.actions].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '13px', color: 'var(--ink-1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) =>
                editId === u.id ? (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 500 }}>{u.username}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <select
                        style={selectStyle}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        autoFocus
                      >
                        <option value="admin">admin</option>
                        <option value="manager">manager</option>
                        <option value="view">view</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--ink-2)' }}>
                      <Badge label={u.provider} colors={providerColors[u.provider] ?? { bg: '#f3f4f6', color: '#374151' }} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {warehouses.length > 0 && (
                        <WarehouseCheckboxes selectedIds={editWarehouseIds} onChange={setEditWarehouseIds} />
                      )}
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
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{u.username}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge label={u.role} colors={roleColors[u.role] ?? { bg: '#f3f4f6', color: '#374151' }} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge label={u.provider} colors={providerColors[u.provider] ?? { bg: '#f3f4f6', color: '#374151' }} />
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--ink-2)' }}>
                      {formatWarehouseIds(u.warehouses)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={btnStyle('ghost')} onClick={() => startEdit(u)}>{t.edit}</button>
                        <button style={btnStyle('danger')} onClick={() => void handleDelete(u)}>{t.delete}</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
