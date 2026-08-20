import React from 'react';
import type { Product, Transaction, Tag, Lang, ToastState } from '../types';
import { Dashboard } from './Dashboard';
import { BatchFlow, type BatchSubmitPayload } from './BatchFlow';
import { APProductsPage } from './APProductsPage';
import { EditProductsPage } from './EditProductsPage';
import { ShipmentsPage } from './ShipmentsPage';
import { TransactionsPage } from './TransactionsPage';
import { AuditLogsPage } from './AuditLogsPage';
import { ReportsPage } from './ReportsPage';
import { WarehousesPage } from './WarehousesPage';
import { UsersPage } from './UsersPage';
import { BackupSettingsPage } from './BackupSettingsPage';
import { AdjustStockModal } from './modals/AdjustStockModal';
import { ProductPickerModal } from './modals/ProductPickerModal';
import { APProductModal } from './modals/APProductModal';
import { TransactionDetailModal } from './modals/TransactionDetailModal';
import { BatchDetailModal } from './modals/BatchDetailModal';
import { ShipmentDetailModal } from './modals/ShipmentDetailModal';
import { ChangePasswordModal } from './modals/ChangePasswordModal';
import { CreateProductModal } from './modals/CreateProductModal';
import { Toast } from './Toast';
import { Tour, type TourStep } from './Tour';

type View =
  | { kind: 'dashboard' }
  | { kind: 'batch'; batchKind: 'inbound' | 'outbound' }
  | { kind: 'ap-products' }
  | { kind: 'edit-products' }
  | { kind: 'shipments' }
    | { kind: 'transactions' }
  | { kind: 'audit-logs' }
  | { kind: 'reports' }
  | { kind: 'warehouses' }
  | { kind: 'users' }
  | { kind: 'backup-settings' };

type Modal =
  | null
  | { kind: 'adjust'; product: Product }
  | { kind: 'picker'; onPick: (p: Product) => void }
  | { kind: 'ap-product'; product: Product }
  | { kind: 'transaction-detail'; transactionId: number }
  | { kind: 'batch-detail'; batchId: number }
  | { kind: 'shipment-detail'; shipmentId: number }
  | { kind: 'change-password' }
  | { kind: 'create-product' };

interface AppContentProps {
  view: View;
  modal: Modal;
  bootState: 'loading' | 'ready' | 'error';
  bootError: string | null;
  products: Product[];
  transactions: Transaction[];
  tags: Tag[];
  recentSkus: string[];
  toast: ToastState | null;
  lang: Lang;
  t: Record<string, string>;
  isAdmin: boolean;
  onSetModal: (modal: Modal) => void;
  onLoadAll: () => Promise<void>;
  onAdjustProduct: (product: Product) => void;
  onBatchSubmit: (payload: BatchSubmitPayload) => Promise<void>;
  onAdjustSubmit: (input: any) => Promise<void>;
  onAdjustTopbar: (id: number | '', product: Product | null) => void;
  onOpenPicker: (callback: (p: Product) => void) => void;
  onTrackRecent: (product: Product | null | undefined) => void;
  onRefetchProducts: () => Promise<void>;
  onRefetchTransactions: () => Promise<void>;
  onShowToast: (text: string, opts?: Partial<ToastState>) => void;
  onDismissToast: (id: number) => void;
  tourSteps: TourStep[];
  canWrite: boolean;
  onImportClick: () => void;
  onExport: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AppContent({
  view,
  modal,
  bootState,
  bootError,
  products,
  transactions,
  tags,
  recentSkus,
  toast,
  lang,
  t,
  isAdmin,
  onSetModal,
  onLoadAll,
  onAdjustProduct,
  onBatchSubmit,
  onAdjustSubmit,
  onAdjustTopbar,
  onOpenPicker,
  onTrackRecent,
  onRefetchProducts,
  onRefetchTransactions,
  onShowToast,
  onDismissToast,
  tourSteps,
  canWrite,
  onImportClick,
  onExport,
  fileInputRef,
  onImportFile,
}: AppContentProps) {
  if (bootState === 'loading') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
        {t.loading}
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--accent)',
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>{t.loadFailed}</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--mono)' }}>{bootError}</div>
        <button className="btn-lg" onClick={() => void onLoadAll()}>
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <>
      {view.kind === 'dashboard' && (
        <Dashboard
          products={products}
          transactions={transactions}
          lang={lang}
          onAdjustProduct={onAdjustProduct}
          onManageAPProduct={(product) => onSetModal({ kind: 'ap-product', product })}
          onViewTransaction={(tx) => onSetModal({ kind: 'transaction-detail', transactionId: tx.id })}
        />
      )}
      {view.kind === 'batch' && (
        <BatchFlow
          kind={view.batchKind}
          products={products}
          tags={tags}
          recentSkus={recentSkus}
          lang={lang}
          onSubmit={onBatchSubmit}
          onOpenPicker={onOpenPicker}
          onPickProduct={onTrackRecent}
        />
      )}
      {view.kind === 'ap-products' && (
        <APProductsPage
          products={products}
          lang={lang}
          onSelectProduct={(product) => onSetModal({ kind: 'ap-product', product })}
          onRefresh={() => void onRefetchProducts()}
        />
      )}
      {view.kind === 'edit-products' && isAdmin && (
        <EditProductsPage
          products={products}
          lang={lang}
          onRefetchProducts={onRefetchProducts}
          onShowToast={onShowToast}
        />
      )}
      {view.kind === 'edit-products' && !isAdmin && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
          {lang === 'en'
            ? 'You do not have permission to access this page'
            : lang.startsWith('zh')
            ? '您沒有權限訪問此頁面'
            : 'このページにアクセスする権限がありません'}
        </div>
      )}
      {view.kind === 'shipments' && <ShipmentsPage lang={lang} />}
        {view.kind === 'transactions' && (
          <TransactionsPage
            lang={lang}
            tags={tags}
            onViewTransaction={(tx) => onSetModal({ kind: 'transaction-detail', transactionId: tx.id })}
          />
        )}
      {view.kind === 'reports' && (
        <ReportsPage
          lang={lang}
          canWrite={canWrite}
          onImportClick={onImportClick}
          onExport={onExport}
          fileInputRef={fileInputRef}
          onImportFile={onImportFile}
        />
      )}
      {view.kind === 'audit-logs' && (
        <AuditLogsPage
          lang={lang}
          onResourceClick={(resourceType, resourceId) => {
            if (resourceType === 'transaction') {
              onSetModal({ kind: 'transaction-detail', transactionId: resourceId });
            } else if (resourceType === 'batch') {
              onSetModal({ kind: 'batch-detail', batchId: resourceId });
            } else if (resourceType === 'shipment') {
              onSetModal({ kind: 'shipment-detail', shipmentId: resourceId });
            } else if (resourceType === 'product') {
              const product = products.find((p) => p.id === resourceId);
              if (product) {
                onSetModal({ kind: 'adjust', product });
              } else {
                onShowToast(
                  `${lang === 'en' ? 'Product not found' : lang.startsWith('zh') ? '產品未找到' : '製品が見つかりません'}`,
                  { kind: 'alert' },
                );
              }
            }
          }}
        />
      )}
      {view.kind === 'warehouses' && <WarehousesPage lang={lang} />}
      {view.kind === 'users' && <UsersPage lang={lang} />}
      {view.kind === 'backup-settings' && <BackupSettingsPage lang={lang} />}

      {modal && modal.kind === 'adjust' && (
        <AdjustStockModal
          product={modal.product}
          tags={tags}
          lang={lang}
          onClose={() => onSetModal(null)}
          onSubmit={onAdjustSubmit}
        />
      )}
      {modal && modal.kind === 'picker' && (
        <ProductPickerModal
          products={products}
          lang={lang}
          onClose={() => onSetModal(null)}
          onPick={(p) => {
            const cb = modal.onPick;
            onSetModal(null);
            cb?.(p);
          }}
        />
      )}
      {modal && modal.kind === 'ap-product' && (
        <APProductModal
          product={modal.product}
          lang={lang}
          onClose={() => onSetModal(null)}
          onProductUpdated={onRefetchProducts}
        />
      )}
      {modal && modal.kind === 'transaction-detail' && (
        <TransactionDetailModal
          transactionId={modal.transactionId}
          lang={lang}
          onClose={() => onSetModal(null)}
        />
      )}
      {modal && modal.kind === 'batch-detail' && (
        <BatchDetailModal
          batchId={modal.batchId}
          lang={lang}
          onClose={() => onSetModal(null)}
        />
      )}
      {modal && modal.kind === 'shipment-detail' && (
        <ShipmentDetailModal
          shipmentId={modal.shipmentId}
          lang={lang}
          onClose={() => onSetModal(null)}
        />
      )}
      {modal && modal.kind === 'change-password' && (
        <ChangePasswordModal
          lang={lang}
          onClose={() => onSetModal(null)}
          onSuccess={() => {
            onSetModal(null);
            onShowToast(
              lang.startsWith('zh') ? '密碼已更新' : lang === 'ja' ? 'パスワードを変更しました' : 'Password updated',
            );
          }}
        />
      )}
      {modal && modal.kind === 'create-product' && (
        <CreateProductModal
          lang={lang}
          onClose={() => onSetModal(null)}
          onCreated={() => {
            void onRefetchProducts();
            onShowToast(
              lang.startsWith('zh') ? '產品已建立' : lang === 'ja' ? '商品を作成しました' : 'Product created',
            );
          }}
        />
      )}

      {toast && (
        <div className="toast-stack">
          <Toast toast={toast} onDismiss={onDismissToast} />
        </div>
      )}

      {bootState === 'ready' && <Tour steps={tourSteps} />}
    </>
  );
}
