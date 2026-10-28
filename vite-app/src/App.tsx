import { useCallback, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { LoginPage } from './components/LoginPage';
import { WarehouseSelector } from './components/WarehouseSelector';
import { Topbar } from './components/Topbar';
import { AppContent } from './components/AppContent';
import { useSession } from './hooks/useSession';
import { useLang } from './hooks/useLang';
import { useToast } from './hooks/useToast';
import { useInventory } from './hooks/useInventory';
import { useAppHandlers } from './hooks/useAppHandlers';
import { L } from './lib/i18n';
import { pathForView, viewFromPath, type View } from './lib/routes';
import type { Modal } from './types';

export function App() {
  const [lang, setLang] = useLang();
  const session = useSession();
  const { currentUser, isAuthenticated, activeWarehouse } = session;
  const toasts = useToast(lang);
  const inventory = useInventory(lang, isAuthenticated ? activeWarehouse?.id ?? null : null, toasts.showToast);
  const [modal, setModal] = useState<Modal>(null);

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
  }, []);

  const handleSwitchWarehouse = useCallback(() => {
    session.leaveWarehouse();
    navigateTo({ kind: 'dashboard' });
  }, [session.leaveWarehouse, navigateTo]);

  const {
    handleAdjustProduct,
    handleAdjustSubmit,
    handleBatchSubmit,
    handleTopbarPick,
    handleExport,
    handleImportClick,
    handleImportFile,
    fileInputRef,
  } = useAppHandlers({ lang, inventory, showToast: toasts.showToast, setModal, navigateTo });

  const canWrite = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';

  // ---- Render ----

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          session.login(user);
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
        // Stay on the current URL so a deep link survives picking a warehouse.
        onSelect={session.selectWarehouse}
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
        products={inventory.products}
        recentSkus={inventory.recentSkus}
        bootState={inventory.bootState}
        canWrite={canWrite}
        isAdmin={isAdmin}
        activeWarehouse={activeWarehouse}
        currentUser={currentUser}
        onNavigate={navigateTo}
        onLanguageChange={setLang}
        onSwitchWarehouse={handleSwitchWarehouse}
        onChangePassword={() => setModal({ kind: 'change-password' })}
        onLogout={session.logout}
        onProductPick={handleTopbarPick}
        onOpenPicker={openPicker}
        t={t}
      />
      <AppContent
        view={view}
        modal={modal}
        inventory={inventory}
        toasts={toasts}
        lang={lang}
        t={t}
        isAdmin={isAdmin}
        onSetModal={setModal}
        onAdjustProduct={handleAdjustProduct}
        onBatchSubmit={handleBatchSubmit}
        onQuickOutbound={() => navigateTo({ kind: 'batch', batchKind: 'outbound' })}
        onAdjustSubmit={handleAdjustSubmit}
        onAdjustTopbar={handleTopbarPick}
        onOpenPicker={openPicker}
        canWrite={canWrite}
        onImportClick={handleImportClick}
        onExport={handleExport}
        fileInputRef={fileInputRef}
        onImportFile={handleImportFile}
      />
    </div>
  );
}
