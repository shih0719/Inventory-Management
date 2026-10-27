import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { LoginPage } from './components/LoginPage';
import { WarehouseSelector } from './components/WarehouseSelector';
import { Topbar } from './components/Topbar';
import { AppContent } from './components/AppContent';
import { useAppState } from './hooks/useAppState';
import { useAppHandlers } from './hooks/useAppHandlers';
import { useAppHelpers } from './hooks/useAppHelpers';
import { getTourSteps } from './lib/tourConfig';
import { L } from './lib/i18n';
import { pathForView, viewFromPath, type View } from './lib/routes';
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
    modal,
    setModal,
    bootState,
    bootError,
    loadAll,
  } = appState;

  const t = L[lang];

  // Navigation — the URL decides which page is shown.
  const location = useLocation();
  const navigate = useNavigate();
  const matchedView = viewFromPath(location.pathname);
  const view: View = matchedView ?? { kind: 'dashboard' };
  const navigateTo = useCallback(
    (newView: View) => navigate(pathForView(newView)),
    [navigate],
  );

  const openPicker = useCallback((onPick: (p: any) => void) => {
    setModal({ kind: 'picker', onPick });
  }, [setModal]);

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
    loadAll,
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
          if (location.pathname === '/login') {
            navigate('/', { replace: true });
          }
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

  if (!matchedView) return <Navigate to="/" replace />;

  return (
    <div className="app-shell">
      <Topbar
        lang={lang}
        currentView={view.kind}
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
          onTransactions={() => navigateTo({ kind: 'transactions' })}
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
        onLoadAll={loadAll}
        onAdjustProduct={handleAdjustProduct}
        onBatchSubmit={handleBatchSubmit}
        onQuickOutbound={() => navigateTo({ kind: 'batch', batchKind: 'outbound' })}
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
