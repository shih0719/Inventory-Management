import React from 'react';
import type { Product, Lang, ToastState } from '../types';
import { ProductCombobox } from './ProductCombobox';
import { Dropdown, DropdownItem } from './Dropdown';

interface TopbarProps {
  lang: Lang;
  products: Product[];
  recentSkus: string[];
  bootState: 'loading' | 'ready' | 'error';
  canWrite: boolean;
  isAdmin: boolean;
  activeWarehouse: { id: number; name: string } | null;
  currentUser: { username: string; provider: string } | null;
  onLogoClick: () => void;
  onInbound: () => void;
  onOutbound: () => void;
  onAPProducts: () => void;
  onEditProducts: () => void;
  onShipments: () => void;
  onReports: () => void;
  onAuditLogs: () => void;
  onUsers: () => void;
  onWarehouses: () => void;
  onBackupSettings: () => void;
  onImportClick: () => void;
  onExport: () => void;
  onLanguageChange: (lang: Lang) => void;
  onSwitchWarehouse: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onProductPick: (id: number | '', product: Product | null) => void;
  onOpenPicker: (callback: (p: Product) => void) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  t: Record<string, string>;
}

export function Topbar({
  lang,
  products,
  recentSkus,
  bootState,
  canWrite,
  isAdmin,
  activeWarehouse,
  currentUser,
  onLogoClick,
  onInbound,
  onOutbound,
  onAPProducts,
  onEditProducts,
  onShipments,
  onReports,
  onAuditLogs,
  onUsers,
  onWarehouses,
  onBackupSettings,
  onImportClick,
  onExport,
  onLanguageChange,
  onSwitchWarehouse,
  onChangePassword,
  onLogout,
  onProductPick,
  onOpenPicker,
  fileInputRef,
  onImportFile,
  t,
}: TopbarProps) {
  return (
    <div className="tb">
      <button
        className="logo"
        onClick={onLogoClick}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span className="mark">S</span>
        {t.appName}
      </button>

      <div style={{ flex: 1, maxWidth: 340, minWidth: 180 }}>
        <ProductCombobox
          products={products}
          recentSkus={recentSkus}
          value=""
          onChange={onProductPick}
          onOpenPicker={() =>
            onOpenPicker((p) => {
              onProductPick('', p);
            })
          }
          lang={lang}
          variant="topbar"
          placeholder={t.search}
        />
      </div>

      {canWrite && (
        <button
          className="btn"
          onClick={onInbound}
          disabled={bootState !== 'ready'}
        >
          <span style={{ color: 'var(--ok)', fontWeight: 700 }}>↑</span> {t.inbound}
        </button>
      )}

      {canWrite && (
        <button
          className="btn"
          onClick={onOutbound}
          disabled={bootState !== 'ready'}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>↓</span> {t.outbound}
        </button>
      )}

      <div className="tb-divider" />

      <Dropdown
        trigger={lang === 'en' ? 'Manage' : lang.startsWith('zh') ? '管理' : '管理'}
        disabled={bootState !== 'ready'}
      >
        <DropdownItem onClick={onAPProducts} disabled={bootState !== 'ready'}>
          🏷 {lang === 'en' ? 'AP Products' : lang.startsWith('zh') ? 'AP 序號品' : 'AP商品'}
        </DropdownItem>
        {isAdmin && (
          <DropdownItem onClick={onEditProducts} disabled={bootState !== 'ready'}>
            ✏️ {lang === 'en' ? 'Manage Products' : lang.startsWith('zh') ? '產品管理' : '商品管理'}
          </DropdownItem>
        )}
        <DropdownItem onClick={onShipments} disabled={bootState !== 'ready'}>
          📦 {lang === 'en' ? 'Shipments' : lang.startsWith('zh') ? '出貨單據' : '配送'}
        </DropdownItem>
        <DropdownItem onClick={onReports} disabled={bootState !== 'ready'}>
          📊 {lang === 'en' ? 'Inventory Report' : lang.startsWith('zh') ? '庫存報表' : '在庫レポート'}
        </DropdownItem>
        {isAdmin && (
          <DropdownItem onClick={onAuditLogs} disabled={bootState !== 'ready'}>
            📋 {lang === 'en' ? 'Audit Logs' : lang.startsWith('zh') ? '操作日誌' : '操作ログ'}
          </DropdownItem>
        )}
        {isAdmin && (
          <DropdownItem onClick={onUsers} disabled={bootState !== 'ready'}>
            👥 {lang === 'en' ? 'Users' : lang.startsWith('zh') ? '使用者管理' : 'ユーザー管理'}
          </DropdownItem>
        )}
        {isAdmin && (
          <DropdownItem onClick={onWarehouses} disabled={bootState !== 'ready'}>
            🏭 {lang === 'en' ? 'Warehouses' : lang.startsWith('zh') ? '倉庫管理' : '倉庫管理'}
          </DropdownItem>
        )}
        {isAdmin && (
          <DropdownItem onClick={onBackupSettings} disabled={bootState !== 'ready'}>
            💾 {lang === 'en' ? 'Backup Settings' : lang.startsWith('zh') ? '備份設定' : 'バックアップ設定'}
          </DropdownItem>
        )}
      </Dropdown>

      <div className="tb-divider" />

      {canWrite && (
        <button className="btn ghost" onClick={onImportClick} title={t.importCsv}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>⤴</span>
          <span>CSV</span>
        </button>
      )}
      <button className="btn ghost" onClick={onExport} title={t.exportCsv}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>⤵</span>
        <span>CSV</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />

      <div className="tb-divider" />

      <Dropdown trigger={<span style={{ fontSize: 14 }}>🌐</span>} align="right">
        {(['en', 'zh', 'zh-cn', 'ja'] as const).map((l) => (
          <DropdownItem key={l} onClick={() => onLanguageChange(l)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-3)', minWidth: 28 }}>
                {l === 'en' ? 'EN' : l === 'zh' ? '繁' : l === 'zh-cn' ? '简' : 'JP'}
              </span>
              <span>{l === 'en' ? 'English' : l === 'zh' ? '繁體中文' : l === 'zh-cn' ? '简体中文' : '日本語'}</span>
              {lang === l && <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>✓</span>}
            </span>
          </DropdownItem>
        ))}
      </Dropdown>

      {activeWarehouse && (
        <button
          className="btn ghost"
          onClick={onSwitchWarehouse}
          title={lang === 'en' ? 'Switch warehouse' : lang.startsWith('zh') ? '切換倉庫' : '倉庫を切り替え'}
          style={{ fontSize: 12, gap: 4 }}
        >
          🏭{' '}
          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeWarehouse.name}
          </span>
        </button>
      )}

      <Dropdown trigger={currentUser?.username?.[0]?.toUpperCase() || 'A'} align="right">
        <DropdownItem disabled>{currentUser?.username}</DropdownItem>
        {currentUser?.provider === 'local' && (
          <DropdownItem onClick={onChangePassword}>
            {lang === 'en' ? 'Change Password' : lang.startsWith('zh') ? '修改密碼' : 'パスワード変更'}
          </DropdownItem>
        )}
        <DropdownItem onClick={onLogout}>
          {lang === 'en' ? 'Sign out' : lang.startsWith('zh') ? '登出' : 'ログアウト'}
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
