import React, { useState, useMemo } from 'react';
import type { Product, Lang } from '../types';
import { createProduct, updateProduct, deleteProduct } from '../api/products';
import { ApiError } from '../api/client';
import { ConfirmModal } from './modals/ConfirmModal';

interface EditProductsPageProps {
  products: Product[];
  lang: Lang;
  onRefetchProducts: () => Promise<void>;
  onShowToast: (text: string) => void;
}

const NEW_PRODUCT_ID = 'NEW';

export function EditProductsPage({ products, lang, onRefetchProducts, onShowToast }: EditProductsPageProps) {
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [draft, setDraft] = useState<Partial<Product>>({});
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const texts = {
    en: {
      title: 'Manage Products',
      subtitle: 'Create, edit, and manage product information',
      search: 'Search by SKU or name...',
      sku: 'SKU',
      name: 'Name',
      model: 'Model',
      type: 'Type',
      minStock: 'Min Stock',
      trackSerial: 'Track Serial',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      add: 'Add Product',
      deleteConfirm: 'Are you sure you want to delete this product?',
      normal: 'Normal',
      ap: 'AP',
      yes: 'Yes',
      no: 'No',
      deleteSuccess: 'Product deleted successfully',
      createSuccess: 'Product created successfully',
      updateSuccess: 'Product updated successfully',
      error: 'An error occurred. Please try again.',
      requiredField: 'SKU and Name are required',
    },
    zh: {
      title: '產品管理',
      subtitle: '建立、編輯和管理產品資訊',
      search: '按 SKU 或名稱搜尋...',
      sku: 'SKU',
      name: '名稱',
      model: '型號',
      type: '類型',
      minStock: '最低庫存',
      trackSerial: '追蹤序號',
      edit: '編輯',
      delete: '刪除',
      save: '保存',
      cancel: '取消',
      add: '新增產品',
      deleteConfirm: '確定要刪除此產品嗎?',
      normal: '普通',
      ap: 'AP',
      yes: '是',
      no: '否',
      deleteSuccess: '產品已成功刪除',
      createSuccess: '產品已成功建立',
      updateSuccess: '產品已成功更新',
      error: '發生錯誤，請重試',
      requiredField: '需要 SKU 和名稱',
    },
    ja: {
      title: '商品管理',
      subtitle: '商品情報を作成、編集、管理',
      search: 'SKU または名前で検索...',
      sku: 'SKU',
      name: '名前',
      model: 'モデル',
      type: 'タイプ',
      minStock: '最小在庫',
      trackSerial: 'シリアル追跡',
      edit: '編集',
      delete: '削除',
      save: '保存',
      cancel: 'キャンセル',
      add: '商品追加',
      deleteConfirm: 'この商品を削除してもよろしいですか?',
      normal: '通常',
      ap: 'AP',
      yes: 'はい',
      no: 'いいえ',
      deleteSuccess: '商品が正常に削除されました',
      createSuccess: '商品が正常に作成されました',
      updateSuccess: '商品が正常に更新されました',
      error: 'エラーが発生しました。もう一度お試しください',
      requiredField: 'SKU と名前は必須です',
    },
  };

  const t = texts[lang as keyof typeof texts] || texts.en;

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [products, search]);

  const handleAddNew = () => {
    setEditingId(NEW_PRODUCT_ID);
    setIsCreating(true);
    setDraft({ min_stock: 0, track_serial: false });
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setIsCreating(false);
    setDraft(product);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setDraft({});
  };

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      // 優先使用 error message
      if (err.message) {
        return err.message;
      }
      // 嘗試從 body 中提取錯誤訊息
      if (err.body && typeof err.body === 'object') {
        const body = err.body as any;
        if (body.error) return String(body.error);
        if (body.message) return String(body.message);
      }
      return t.error;
    }
    if (err instanceof Error) {
      return err.message || t.error;
    }
    return t.error;
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!draft.sku || !draft.name) {
      onShowToast(t.requiredField);
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        await createProduct(draft as Omit<Product, 'id' | 'created_at' | 'updated_at' | 'ap_in_stock_count'>);
        onShowToast(t.createSuccess);
      } else {
        await updateProduct(editingId as number, draft);
        onShowToast(t.updateSuccess);
      }
      await onRefetchProducts();
      setEditingId(null);
      setIsCreating(false);
      setDraft({});
    } catch (err) {
      onShowToast(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleting(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteProduct(deleting);
      setDeleting(null);
      onShowToast(t.deleteSuccess);
      await onRefetchProducts();
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setDeleting(null);
      onShowToast(errorMsg);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid var(--border-2)',
    borderRadius: '6px',
    font: '500 13px var(--sans)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    fontFamily: 'inherit',
  };

  return (
    <div className="locations-page">
      <div className="flow-head" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{t.title}</h2>
          <div className="sub">{t.subtitle}</div>
        </div>
        <button
          className="btn-lg primary"
          onClick={handleAddNew}
          disabled={editingId === NEW_PRODUCT_ID}
        >
          + {t.add}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        <input
          type="text"
          placeholder={t.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...inputStyle,
            width: '100%',
          }}
        />

        <div className="card panel" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <h3>
            <span>Products</span>
            <span className="pill">{filtered.length + (isCreating ? 1 : 0)}</span>
          </h3>

          {filtered.length === 0 && !isCreating ? (
            <div style={{ padding: '24px 8px', color: 'var(--ink-3)', fontSize: 12, textAlign: 'center' }}>
              No products found
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                fontFamily: 'var(--sans)',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.sku}
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.name}
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.model}
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.minStock}
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t.trackSerial}
                  </th>
                  <th
                    style={{
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isCreating && editingId === NEW_PRODUCT_ID && (
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--ok-soft)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="text"
                        value={draft.sku || ''}
                        onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
                        autoFocus
                        placeholder="SKU"
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="text"
                        value={draft.name || ''}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder="Name"
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="text"
                        value={draft.model || ''}
                        onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                        placeholder="Model"
                        style={{ ...inputStyle, width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={draft.min_stock || 0}
                        onChange={(e) => setDraft({ ...draft, min_stock: parseInt(e.target.value) || 0 })}
                        min="0"
                        style={{ ...inputStyle, width: 70 }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={draft.track_serial || false}
                        onChange={(e) => setDraft({ ...draft, track_serial: e.target.checked })}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-lg"
                        style={{ fontSize: 12, padding: '5px 10px', marginRight: 4 }}
                      >
                        {t.save}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="btn-lg"
                        style={{ fontSize: 12, padding: '5px 10px' }}
                      >
                        {t.cancel}
                      </button>
                    </td>
                  </tr>
                )}
                {filtered.map((product) => (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {editingId === product.id ? (
                      <>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="text"
                            value={draft.sku || ''}
                            onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
                            style={{ ...inputStyle, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="text"
                            value={draft.name || ''}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            style={{ ...inputStyle, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="text"
                            value={draft.model || ''}
                            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                            style={{ ...inputStyle, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={draft.min_stock || 0}
                            onChange={(e) => setDraft({ ...draft, min_stock: parseInt(e.target.value) || 0 })}
                            min="0"
                            style={{ ...inputStyle, width: 70 }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={draft.track_serial || false}
                            onChange={(e) => setDraft({ ...draft, track_serial: e.target.checked })}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-lg"
                            style={{ fontSize: 12, padding: '5px 10px', marginRight: 4 }}
                          >
                            {t.save}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="btn-lg"
                            style={{ fontSize: 12, padding: '5px 10px' }}
                          >
                            {t.cancel}
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '10px 12px' }} className="sku">
                          {product.sku}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{product.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--ink-3)', fontSize: 11 }}>{product.model}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                          {product.min_stock}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {product.track_serial ? '✓' : ''}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleEdit(product)}
                            className="btn-lg"
                            style={{ fontSize: 12, padding: '5px 10px', marginRight: 4 }}
                          >
                            {t.edit}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(product.id)}
                            className="btn-lg"
                            style={{
                              fontSize: 12,
                              padding: '5px 10px',
                              backgroundColor: 'var(--accent)',
                              color: 'white',
                              border: '1px solid var(--accent)',
                            }}
                          >
                            {t.delete}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {deleting !== null && (
        <ConfirmModal
          title="Delete Product"
          message={t.deleteConfirm}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleting(null)}
          isDangerous
          lang={lang}
        />
      )}
    </div>
  );
}
