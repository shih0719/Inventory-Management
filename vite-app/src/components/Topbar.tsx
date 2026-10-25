import { useEffect, useState } from 'react';
import type { Product, Lang } from '../types';
import { ProductCombobox } from './ProductCombobox';
import { Dropdown, DropdownItem } from './Dropdown';

interface TopbarProps {
  lang: Lang;
  /** Current view kind — highlights the active item in the mobile menu and hides the bottom action bar inside batch flows. */
  currentView: string;
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
    onTransactions: () => void;
  onReports: () => void;
  onAuditLogs: () => void;
  onUsers: () => void;
  onWarehouses: () => void;
  onBackupSettings: () => void;
  onLanguageChange: (lang: Lang) => void;
  onSwitchWarehouse: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onProductPick: (id: number | '', product: Product | null) => void;
  onOpenPicker: (callback: (p: Product) => void) => void;
  t: Record<string, string>;
}

const LANG_OPTIONS: { code: Lang; short: string; label: string }[] = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'zh', short: '繁', label: '繁體中文' },
  { code: 'zh-cn', short: '简', label: '简体中文' },
  { code: 'ja', short: 'JP', label: '日本語' },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Topbar({
  lang,
  currentView,
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
    onTransactions,
  onReports,
  onAuditLogs,
  onUsers,
  onWarehouses,
  onBackupSettings,
  onLanguageChange,
  onSwitchWarehouse,
  onChangePassword,
  onLogout,
  onProductPick,
  onOpenPicker,
  t,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ready = bootState === 'ready';
  const tx = (en: string, zh: string, ja: string) => (lang === 'en' ? en : lang.startsWith('zh') ? zh : ja);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Close the sheet first so navigation never lands behind an open overlay.
  const go = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const navItems = [
    { view: 'dashboard', label: tx('Dashboard', '總覽', 'ダッシュボード'), onClick: onLogoClick, show: true },
    { view: 'reports', label: tx('Inventory Report', '庫存報表', '在庫レポート'), onClick: onReports, show: true },
    { view: 'transactions', label: tx('History', '交易歷史', '履歴'), onClick: onTransactions, show: true },
    { view: 'ap-products', label: tx('AP Products', 'AP 序號品', 'AP商品'), onClick: onAPProducts, show: true },
    { view: 'shipments', label: tx('Shipments', '出貨單據', '配送'), onClick: onShipments, show: true },
    { view: 'edit-products', label: tx('Manage Products', '產品管理', '商品管理'), onClick: onEditProducts, show: isAdmin },
    { view: 'audit-logs', label: tx('Audit Logs', '操作日誌', '操作ログ'), onClick: onAuditLogs, show: isAdmin },
    { view: 'users', label: tx('Users', '使用者管理', 'ユーザー管理'), onClick: onUsers, show: isAdmin },
    { view: 'warehouses', label: tx('Warehouses', '倉庫管理', '倉庫管理'), onClick: onWarehouses, show: isAdmin },
    { view: 'backup-settings', label: tx('Backup Settings', '備份設定', 'バックアップ設定'), onClick: onBackupSettings, show: isAdmin },
  ].filter((i) => i.show);

  return (
    <>
    <div className={'tb' + (currentView === 'batch' ? ' tb--batch' : '')}>
      <button
        className="logo"
        onClick={onLogoClick}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span className="mark">S</span>
        {t.appName}
      </button>

      <div className="tb-search">
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

      <div className="tb-desk">
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
          <span style={{ color: 'var(--out)', fontWeight: 700 }}>↓</span> {t.outbound}
        </button>
      )}

      <div className="tb-divider" />

      <button
        className="btn ghost"
        onClick={onReports}
        disabled={bootState !== 'ready'}
      >
        📊 {lang === 'en' ? 'Inventory Report' : lang.startsWith('zh') ? '庫存報表' : '在庫レポート'}
      </button>

        <button
          className="btn ghost"
          onClick={onTransactions}
          disabled={bootState !== 'ready'}
        >
          🕘 {lang === 'en' ? 'History' : lang.startsWith('zh') ? '交易歷史' : '履歴'}
        </button>

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

      {activeWarehouse && (
        <button
          className="tb-wh"
          onClick={onSwitchWarehouse}
          aria-label={tx('Switch warehouse', '切換倉庫', '倉庫を切り替え')}
        >
          {activeWarehouse.name}
        </button>
      )}
      <button
        className="tb-menu-btn"
        onClick={() => setMenuOpen(true)}
        aria-label={tx('Menu', '選單', 'メニュー')}
        aria-expanded={menuOpen}
      >
        <MenuIcon />
      </button>
    </div>

    {canWrite && currentView !== 'batch' && (
      <nav className="mobile-actions" aria-label={tx('Stock actions', '庫存動作', '在庫操作')}>
        <button className="btn-lg" onClick={onInbound} disabled={!ready}>
          <span className="dir in" aria-hidden="true">↑</span>
          {tx('Inbound', '進貨', '入庫')}
        </button>
        <button className="btn-lg" onClick={onOutbound} disabled={!ready}>
          <span className="dir out" aria-hidden="true">↓</span>
          {tx('Outbound', '出貨', '出庫')}
        </button>
      </nav>
    )}

    {menuOpen && (
      <div className="sheet-scrim" onClick={() => setMenuOpen(false)}>
        <aside
          className="nav-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={tx('Menu', '選單', 'メニュー')}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="nav-sheet-head">
            <div className="nav-sheet-who">
              <span className="avatar">{currentUser?.username?.[0]?.toUpperCase() || 'A'}</span>
              <div>
                <div className="nav-sheet-user">{currentUser?.username}</div>
                {activeWarehouse && <div className="nav-sheet-wh">{activeWarehouse.name}</div>}
              </div>
            </div>
            <button className="nav-sheet-close" onClick={() => setMenuOpen(false)} aria-label={tx('Close', '關閉', '閉じる')}>
              ✕
            </button>
          </div>

          <div className="nav-sheet-body">
            <div className="nav-sheet-group">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={'nav-sheet-item' + (currentView === item.view ? ' on' : '')}
                  aria-current={currentView === item.view ? 'page' : undefined}
                  onClick={go(item.onClick)}
                  disabled={!ready}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="nav-sheet-group">
              <div className="nav-sheet-label">{tx('Language', '語言', '言語')}</div>
              <div className="nav-sheet-langs">
                {LANG_OPTIONS.map((l) => (
                  <button
                    key={l.code}
                    className={lang === l.code ? 'on' : ''}
                    aria-pressed={lang === l.code}
                    onClick={() => onLanguageChange(l.code)}
                    title={l.label}
                  >
                    {l.short}
                  </button>
                ))}
              </div>
            </div>

            <div className="nav-sheet-group">
              {activeWarehouse && (
                <button className="nav-sheet-item" onClick={go(onSwitchWarehouse)}>
                  {tx('Switch warehouse', '切換倉庫', '倉庫を切り替え')}
                </button>
              )}
              {currentUser?.provider === 'local' && (
                <button className="nav-sheet-item" onClick={go(onChangePassword)}>
                  {tx('Change Password', '修改密碼', 'パスワード変更')}
                </button>
              )}
              <button className="nav-sheet-item danger" onClick={go(onLogout)}>
                {tx('Sign out', '登出', 'ログアウト')}
              </button>
            </div>
          </div>
        </aside>
      </div>
    )}
    </>
  );
}
