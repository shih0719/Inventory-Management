// 應用入口
import { state } from './state.js';
import { mutations } from './mutations.js';
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
    // 1. 初始化 UI（全局監聽器、表單驗證等）
    utilsModule.initializeUI();

    // 2. 加載標籤
    const tagsResponse = await fetch('/api/tags');
    const tagsData = await tagsResponse.json();
    const tags = Array.isArray(tagsData) ? tagsData : (tagsData.data || tagsData.tags || []);
    mutations.SET_TAGS(tags);
    console.log('✓ Tags loaded');

    // 3. 加載儲位
    await locationsModule.loadLocations();
    console.log('✓ Locations loaded');

    // 4. 加載產品
    await productsModule.loadProducts();
    productsModule.renderProducts();
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
  // 產品模組
  const productSearchBtn = document.getElementById('product-search-btn');
  if (productSearchBtn) {
    productSearchBtn.addEventListener('click', () => {
      productsModule.applyProductFilters();
    });
  }

  const productSkuInput = document.getElementById('product-sku-filter');
  if (productSkuInput) {
    productSkuInput.addEventListener('input', utilsModule.debounce(() => {
      mutations.SET_PRODUCTS_FILTERS({ sku: productSkuInput.value });
    }, 300));
  }

  const productNameInput = document.getElementById('product-name-filter');
  if (productNameInput) {
    productNameInput.addEventListener('input', utilsModule.debounce(() => {
      mutations.SET_PRODUCTS_FILTERS({ name: productNameInput.value });
    }, 300));
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
  const productForm = document.getElementById('productForm');
  if (productForm) {
    productForm.addEventListener('submit', (e) => productsModule.handleProductSubmit(e));
  }

  // 異動表單
  const transactionForm = document.getElementById('transactionForm');
  if (transactionForm) {
    transactionForm.addEventListener('submit', (e) => transactionsModule.handleTransactionSubmit(e));
  }

  // 批次表單
  const batchForm = document.getElementById('batchForm');
  if (batchForm) {
    batchForm.addEventListener('submit', (e) => batchesModule.handleBatchSubmit(e));
  }

  // Webhook 表單
  const webhookForm = document.getElementById('webhookForm');
  if (webhookForm) {
    webhookForm.addEventListener('submit', (e) => webhooksModule.handleWebhookSubmit(e));
  }

  // 序號品表單
  const productUnitForm = document.getElementById('productUnitForm');
  if (productUnitForm) {
    productUnitForm.addEventListener('submit', (e) => productUnitsModule.handleProductUnitSubmit(e));
  }

  // 儲位建立表單
  const locationForm = document.getElementById('locationForm');
  if (locationForm) {
    locationForm.addEventListener('submit', (e) => locationsModule.handleLocationCreate(e));
  }

  console.log('✓ All event listeners bound');
}
