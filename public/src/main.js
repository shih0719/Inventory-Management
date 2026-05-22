// 應用入口
import { state } from './state.js';
import { mutations } from './mutations.js';
import { i18n } from './i18n.js';
import './styles/main.css';

// 導入所有業務模塊
import * as productsModule from './modules/products.js';
import * as locationsModule from './modules/locations.js';
import * as transactionsModule from './modules/transactions.js';
import * as batchesModule from './modules/batches.js';
import * as webhooksModule from './modules/webhooks.js';
import * as productUnitsModule from './modules/productUnits.js';
import * as csvModule from './modules/csvImportExport.js';
import * as utilsModule from './modules/utils.js';

// 全局導出（便於除錯和舊代碼過渡）
window.__appState = state;
window.__mutations = mutations;
window.__modules = {
  products: productsModule,
  locations: locationsModule,
  transactions: transactionsModule,
  batches: batchesModule,
  webhooks: webhooksModule,
  productUnits: productUnitsModule,
  csv: csvModule,
  utils: utilsModule
};

// 初始化應用
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ 應用初始化開始');

  try {
    // 0. 初始化國際化（必須首先執行）
    await i18n.init();
    setupLanguageSwitcher();

    // 1. 初始化 UI（全局監聽器、表單驗證等）
    utilsModule.initializeUI();

    // 3. 加載儲位
    await locationsModule.loadLocations();
    locationsModule.renderLocationsTable();
    console.log('✓ Locations loaded');

    // 4. 加載產品
    await productsModule.loadProducts();
    productsModule.renderProducts();
    productsModule.renderPagination();
    console.log('✓ Products loaded');

    // 5. 加載所有異動
    await transactionsModule.loadAllTransactions();
    console.log('✓ Transactions loaded');

    // 6. 加載批次
    await batchesModule.loadBatchesList();
    console.log('✓ Batches loaded');

    // 7. 加載 Webhooks
    await webhooksModule.loadWebhooks();
    console.log('✓ Webhooks loaded');

    // 8. 加載序號品
    await productUnitsModule.loadProductUnits();
    console.log('✓ Product units loaded');

    // 9. 綁定事件監聽器
    setupEventListeners();
    console.log('✓ Event listeners bound');

    console.log('✅ 應用初始化完成');
  } catch (error) {
    console.error('❌ 應用初始化失敗:', error);
    utilsModule.showNotification('Failed to initialize application', 'error');
  }
});

function setupEventListeners() {
  // 根據當前頁面判斷要綁定的事件
  const currentPath = window.location.pathname;
  const isProductsPage = currentPath.includes('products.html') || currentPath === '/';
  const isBatchesPage = currentPath.includes('batches.html');
  const isWebhooksPage = currentPath.includes('webhooks.html');
  const isLocationsPage = currentPath.includes('locations.html');

  // ===== 產品頁面事件 =====
  if (isProductsPage) {
    const productSearchBtn = document.getElementById('product-search-btn');
    if (productSearchBtn) {
      productSearchBtn.addEventListener('click', () => {
        productsModule.applyProductFilters();
      });
    }

    const filterSkuInput = document.getElementById('filter-sku');
    if (filterSkuInput) {
      filterSkuInput.addEventListener('input', utilsModule.debounce(() => {
        mutations.SET_PRODUCTS_FILTERS({ sku: filterSkuInput.value });
      }, 300));
    }

    const filterNameInput = document.getElementById('filter-name');
    if (filterNameInput) {
      filterNameInput.addEventListener('input', utilsModule.debounce(() => {
        mutations.SET_PRODUCTS_FILTERS({ name: filterNameInput.value });
      }, 300));
    }

    const filterModelInput = document.getElementById('filter-model');
    if (filterModelInput) {
      filterModelInput.addEventListener('input', utilsModule.debounce(() => {
        mutations.SET_PRODUCTS_FILTERS({ model: filterModelInput.value });
      }, 300));
    }

    const filterLowStockCheckbox = document.getElementById('filter-low-stock');
    if (filterLowStockCheckbox) {
      filterLowStockCheckbox.addEventListener('change', () => {
        mutations.SET_PRODUCTS_FILTERS({ lowStock: filterLowStockCheckbox.checked });
      });
    }

    const sortBySelect = document.getElementById('sort-by');
    if (sortBySelect) {
      sortBySelect.addEventListener('change', () => {
        mutations.SET_PRODUCTS_FILTERS({ sortBy: sortBySelect.value });
        productsModule.applyProductFilters();
      });
    }

    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => {
        const form = document.getElementById('product-form');
        if (form) form.reset();
        const titleEl = document.getElementById('product-modal-title');
        if (titleEl) titleEl.textContent = '新增產品';
        utilsModule.openModal('product-modal');
      });
    }

    const batchTransactionBtn = document.getElementById('batch-transaction-btn');
    if (batchTransactionBtn) {
      batchTransactionBtn.addEventListener('click', () => {
        utilsModule.openModal('batch-modal');
      });
    }
  }

  // CSV 導入導出
  const csvImportInput = document.getElementById('csv-import-input');
  if (csvImportInput) {
    csvImportInput.addEventListener('change', (e) => csvModule.handleCSVImport(e));
  }

  const csvExportBtn = document.getElementById('csv-export-btn');
  if (csvExportBtn) {
    csvExportBtn.addEventListener('click', () => csvModule.handleCSVExport());
  }

  const csvTemplateBtn = document.getElementById('csv-template-btn');
  if (csvTemplateBtn) {
    csvTemplateBtn.addEventListener('click', () => csvModule.handleCSVTemplateDownload());
  }

  // 產品表單
  const productForm = document.getElementById('product-form');
  if (productForm) {
    productForm.addEventListener('submit', (e) => productsModule.handleProductSubmit(e));
  }

  // 產品模態框取消按鈕
  const productModalCancel = document.getElementById('product-modal-cancel');
  if (productModalCancel) {
    productModalCancel.addEventListener('click', () => utilsModule.closeModal('product-modal'));
  }

  // 異動表單
  const transactionForm = document.getElementById('transaction-form');
  if (transactionForm) {
    transactionForm.addEventListener('submit', (e) => transactionsModule.handleTransactionSubmit(e));
  }

  // ===== 批次頁面事件 =====
  if (isBatchesPage) {
    const batchForm = document.getElementById('batch-form');
    if (batchForm) {
      batchForm.addEventListener('submit', (e) => batchesModule.handleBatchSubmit(e));
    }

    const batchModalCancel = document.getElementById('batch-modal-cancel');
    if (batchModalCancel) {
      batchModalCancel.addEventListener('click', () => utilsModule.closeModal('batch-modal'));
    }

    const addBatchItemBtn = document.getElementById('add-batch-item-btn');
    if (addBatchItemBtn) {
      addBatchItemBtn.addEventListener('click', () => batchesModule.addBatchItem());
    }

    const batchProductSearchInput = document.getElementById('batch-product-search-input');
    if (batchProductSearchInput) {
      batchProductSearchInput.addEventListener('input', utilsModule.debounce(() => {
        batchesModule.searchBatchProducts(batchProductSearchInput.value);
      }, 300));
    }

    const batchProductSearchCancel = document.getElementById('batch-product-search-cancel');
    if (batchProductSearchCancel) {
      batchProductSearchCancel.addEventListener('click', () => utilsModule.closeModal('batch-product-search-modal'));
    }
  }

  // ===== Webhook 頁面事件 =====
  if (isWebhooksPage) {
    const webhookAddBtn = document.getElementById('webhook-add-btn');
    if (webhookAddBtn) {
      webhookAddBtn.addEventListener('click', () => webhooksModule.openWebhookFormModal());
    }

    const webhookForm = document.getElementById('webhook-form');
    if (webhookForm) {
      webhookForm.addEventListener('submit', (e) => webhooksModule.handleWebhookSubmit(e));
    }

    const webhookFormCancel = document.getElementById('webhook-form-cancel');
    if (webhookFormCancel) {
      webhookFormCancel.addEventListener('click', () => utilsModule.closeModal('webhook-form-modal'));
    }
  }

  // ===== 儲位頁面事件 =====
  if (isLocationsPage) {
    const locationCreateForm = document.getElementById('location-create-form');
    if (locationCreateForm) {
      locationCreateForm.addEventListener('submit', (e) => locationsModule.handleLocationCreate(e));
    }

    const locationScanForm = document.getElementById('location-scan-form');
    if (locationScanForm) {
      locationScanForm.addEventListener('submit', (e) => e.preventDefault());
    }

    const openCameraBtn = document.getElementById('open-camera-btn');
    if (openCameraBtn) {
      openCameraBtn.addEventListener('click', () => utilsModule.openModal('camera-scan-modal'));
    }
  }

  // 所有模態框關閉按鈕（通用處理）
  document.querySelectorAll('[id$="-modal-close"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.target.id.replace('-close', '');
      utilsModule.closeModal(modalId);
    });
  });

  // 批次詳情拖拉分隔線
  const splitter = document.getElementById('batch-splitter');
  const infoPanel = document.getElementById('batch-info-panel');
  if (splitter && infoPanel) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const delta = e.clientY - startY;
      const newHeight = Math.max(80, startHeight + delta);
      infoPanel.style.height = newHeight + 'px';
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    splitter.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = infoPanel.offsetHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
  }

  console.log('✓ All event listeners bound');
}

function setupLanguageSwitcher() {
  const langToggle = document.getElementById('lang-toggle');
  const langMenu = document.getElementById('lang-menu');

  if (!langToggle || !langMenu) return;

  // 切換菜單顯示/隱藏
  langToggle.addEventListener('click', () => {
    langMenu.classList.toggle('hidden');
  });

  // 語言選擇
  langMenu.querySelectorAll('button[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      i18n.setLanguage(lang);
    });
  });

  // 點擊外部關閉菜單
  document.addEventListener('click', (e) => {
    if (!langToggle.contains(e.target) && !langMenu.contains(e.target)) {
      langMenu.classList.add('hidden');
    }
  });

  console.log('✓ Language switcher bound');
}
