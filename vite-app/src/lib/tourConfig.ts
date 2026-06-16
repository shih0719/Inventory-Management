import type { TourStep } from '../components/Tour';
import type { Lang } from './i18n';

// 報表頁面導覽
const reportsTourSteps = (lang: Lang): TourStep[] => [
  {
    id: 'report-title',
    title: lang === 'en' ? 'Inventory Report' : lang.startsWith('zh') ? '庫存報表' : '在庫レポート',
    description: lang === 'en'
      ? 'This page shows all your inventory data at a glance. Let\'s explore the key metrics.'
      : lang.startsWith('zh')
      ? '此頁面一覽顯示所有庫存數據。讓我們探索關鍵指標。'
      : 'すべての在庫データを一目で確認できます。',
    selector: '.flow-head h2',
    position: 'bottom',
  },
  {
    id: 'total-products',
    title: lang === 'en' ? 'Total Products' : lang.startsWith('zh') ? '產品總數' : '総製品数',
    description: lang === 'en'
      ? 'Shows the total number of products in this warehouse.'
      : lang.startsWith('zh')
      ? '顯示此倉庫中的產品總數。'
      : 'この倉庫の総製品数を表示します。',
    selector: '.kpis .kpi:first-child',
    position: 'bottom',
  },
  {
    id: 'low-stock',
    title: lang === 'en' ? 'Low Stock Alert' : lang.startsWith('zh') ? '低庫存警示' : '在庫不足アラート',
    description: lang === 'en'
      ? 'Number of products below minimum stock level. Red means there are items to reorder.'
      : lang.startsWith('zh')
      ? '低於最小庫存水位的產品數量。紅色表示需要補貨的項目。'
      : '最低在庫より少ない製品数を表示します。',
    selector: '.kpis .kpi:nth-child(2)',
    position: 'bottom',
  },
  {
    id: 'stock-summary',
    title: lang === 'en' ? 'Stock Summary' : lang.startsWith('zh') ? '庫存摘要' : '在庫サマリー',
    description: lang === 'en'
      ? 'If there are low stock items, they are listed here with current vs minimum quantities.'
      : lang.startsWith('zh')
      ? '如果有低庫存項目，會列在此處顯示當前數量與最低數量的對比。'
      : '低在庫アイテムの詳細が表示されます。',
    selector: '.card.alert, .card[style*="--ok"]',
    position: 'bottom',
  },
  {
    id: 'inventory-table',
    title: lang === 'en' ? 'Full Inventory Table' : lang.startsWith('zh') ? '完整庫存表' : '在庫テーブル',
    description: lang === 'en'
      ? 'Detailed breakdown of all products. Columns show: SKU, Name, Type, Accountable Qty, Non-Accountable Qty, and Min Stock level.'
      : lang.startsWith('zh')
      ? '所有產品的詳細清單。欄位顯示：SKU、名稱、類型、有帳數量、無帳數量和最低庫存。'
      : 'すべての製品の詳細情報を表示します。',
    selector: '.picker-table',
    position: 'top',
  },
  {
    id: 'report-end',
    title: lang === 'en' ? 'Export & Track' : lang.startsWith('zh') ? '導出與追蹤' : 'エクスポート',
    description: lang === 'en'
      ? 'Use the Manage menu to export reports or track products. Use the top search bar to find specific items quickly.'
      : lang.startsWith('zh')
      ? '使用「管理」菜單導出報表或追蹤產品。使用頂部搜尋欄快速查找特定項目。'
      : '管理メニューを使用してエクスポートできます。',
    selector: '.tb-divider:nth-of-type(2)',
    position: 'bottom',
  },
];

// 儀表板導覽
const dashboardTourSteps = (lang: Lang): TourStep[] => [
  {
    id: 'welcome',
    title: lang === 'en' ? 'Welcome to Inventory System' : lang.startsWith('zh') ? '歡迎使用庫存系統' : 'ようこそ',
    description: lang === 'en'
      ? 'Click the guide button to learn the main features.'
      : lang.startsWith('zh')
      ? '點擊導覽按鈕了解主要功能。'
      : 'ガイドボタンをクリックしてください。',
    selector: '.tb',
    position: 'bottom',
  },
  {
    id: 'dashboard',
    title: lang === 'en' ? 'Dashboard' : lang.startsWith('zh') ? '儀表板' : 'ダッシュボード',
    description: lang === 'en'
      ? 'View your inventory overview, transactions, and warehouse info.'
      : lang.startsWith('zh')
      ? '查看庫存概覽、交易和倉庫信息。'
      : '在庫概要を表示します。',
    selector: '.dashboard-main',
    position: 'bottom',
  },
];

// 批次流程導覽
const batchTourSteps = (lang: Lang): TourStep[] => [
  {
    id: 'batch-intro',
    title: lang === 'en' ? 'Create Batch' : lang.startsWith('zh') ? '建立批次' : 'バッチ作成',
    description: lang === 'en'
      ? 'Add multiple inventory items at once using batches. Choose inbound (receive) or outbound (ship).'
      : lang.startsWith('zh')
      ? '使用批次一次添加多個庫存項目。選擇入庫（接收）或出庫（出貨）。'
      : 'バッチで複数の項目を一度に追加できます。',
    selector: '.batch-flow',
    position: 'bottom',
  },
];

/**
 * 根據當前視圖返回相應的導覽步驟
 */
export function getTourSteps(
  viewKind: string,
  lang: Lang,
): TourStep[] {
  switch (viewKind) {
    case 'reports':
      return reportsTourSteps(lang);
    case 'batch':
      return batchTourSteps(lang);
    case 'dashboard':
    default:
      return dashboardTourSteps(lang);
  }
}
