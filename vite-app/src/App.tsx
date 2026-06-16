import { useCallback } from 'react';
import type { Lang } from './lib/i18n';
import { LoginPage } from './components/LoginPage';
import { WarehouseSelector } from './components/WarehouseSelector';
import { Topbar } from './components/Topbar';
import { AppContent } from './components/AppContent';
import { useAppState } from './hooks/useAppState';
import { useAppHandlers } from './hooks/useAppHandlers';
import { useAppHelpers } from './hooks/useAppHelpers';
import { getTourSteps } from './lib/tourConfig';
import { L } from './lib/i18n';
import './styles/tour.css';

export function App() {
  const appState = useAppState();
  const {
    lang,
    setLang,
    currentUser,
    setCurrentUser,
    isAuthenticated,
    setIsAuthenticated,
    activeWarehouse,
    setActiveWarehouse,
    products,
    transactions,
    tags,
    recentSkus,
    view,
    setView,
    viewHistory,
    setViewHistory,
    modal,
    setModal,
    bootState,
    bootError,
  } = appState;

  const t = L[lang];

  // Navigation
  const navigateTo = useCallback(
    (newView: Parameters<typeof setView>[0]) => {
      setViewHistory((prev) => [...prev, view]);
      setView(newView);
      window.history.pushState({}, '');
    },
    [view, setView, setViewHistory],
  );

  const openPicker = useCallback((onPick: (p: any) => void) => {
    setModal({ kind: 'picker', onPick });
  }, [setModal]);

  const loadAll = useCallback(async () => {
    const state = appState;
    state.setBootState?.('loading');
    // loadAll is already handled in useAppState hook
  }, [appState]);

  const { trackRecent, showToast, dismissToast, refetchProducts, refetchTransactions, adjustTag } = useAppHelpers(
    lang,
    products,
    tags,
    appState.setRecentSkus,
    appState.setToast,
    appState.setProducts,
    appState.setTransactions,
  );

  const {
    handleAdjustProduct,
    handleAdjustSubmit,
    handleBatchSubmit,
    handleTopbarPick,
    handleLogout,
    handleWarehouseSelect,
    handleSwitchWarehouse,
    handleExport,
    handleImportClick,
    handleImportFile,
    fileInputRef,
  } = useAppHandlers(
    lang,
    products,
    tags,
    setModal,
    setView,
    setIsAuthenticated,
    setCurrentUser,
    setActiveWarehouse,
    appState.setProducts,
    appState.setTransactions,
    trackRecent,
    showToast,
    refetchProducts,
    refetchTransactions,
    adjustTag,
    navigateTo,
    async () => {
      appState.setBootState?.('loading');
    },
  );

  const canWrite = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';
  const tourSteps = getTourSteps(view.kind, lang);

  // ---- Render ----

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }}
        lang={lang}
      />
    );
  }

  if (!activeWarehouse) {
    return (
      <WarehouseSelector
        userWarehouseIds={currentUser?.warehouses ?? []}
        onSelect={handleWarehouseSelect}
        lang={lang}
      />
    );
  }

  return (
    <div className="app-shell">
      <Topbar
        lang={lang}
        products={products}
        recentSkus={recentSkus}
        bootState={bootState}
        canWrite={canWrite}
        isAdmin={isAdmin}
        activeWarehouse={activeWarehouse}
        currentUser={currentUser}
        onLogoClick={() => navigateTo({ kind: 'dashboard' })}
        onInbound={() => navigateTo({ kind: 'batch', batchKind: 'inbound' })}
        onOutbound={() => navigateTo({ kind: 'batch', batchKind: 'outbound' })}
        onAPProducts={() => navigateTo({ kind: 'ap-products' })}
        onEditProducts={() => navigateTo({ kind: 'edit-products' })}
        onShipments={() => navigateTo({ kind: 'shipments' })}
        onReports={() => navigateTo({ kind: 'reports' })}
        onAuditLogs={() => navigateTo({ kind: 'audit-logs' })}
        onUsers={() => navigateTo({ kind: 'users' })}
        onWarehouses={() => navigateTo({ kind: 'warehouses' })}
        onBackupSettings={() => navigateTo({ kind: 'backup-settings' })}
        onLanguageChange={setLang}
        onSwitchWarehouse={handleSwitchWarehouse}
        onChangePassword={() => setModal({ kind: 'change-password' })}
        onLogout={handleLogout}
        onProductPick={handleTopbarPick}
        onOpenPicker={openPicker}
        t={t}
      />
      <AppContent
        view={view}
        modal={modal}
        bootState={bootState}
        bootError={bootError}
        products={products}
        transactions={transactions}
        tags={tags}
        recentSkus={recentSkus}
        toast={appState.toast}
        lang={lang}
        t={t}
        isAdmin={isAdmin}
        onSetModal={setModal}
        onLoadAll={async () => {}}
        onAdjustProduct={handleAdjustProduct}
        onBatchSubmit={handleBatchSubmit}
        onAdjustSubmit={handleAdjustSubmit}
        onAdjustTopbar={handleTopbarPick}
        onOpenPicker={openPicker}
        onTrackRecent={trackRecent}
        onRefetchProducts={refetchProducts}
        onRefetchTransactions={refetchTransactions}
        onShowToast={showToast}
        onDismissToast={dismissToast}
        tourSteps={tourSteps}
        canWrite={canWrite}
        onImportClick={handleImportClick}
        onExport={handleExport}
        fileInputRef={fileInputRef}
        onImportFile={handleImportFile}
      />
    </div>
  );
}
