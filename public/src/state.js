// 中央狀態管理
export const state = {
  // 產品模塊
  products: {
    items: [],
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    filters: {
      sku: '',
      name: '',
      model: '',
      tag: '',
      lowStock: false
    }
  },

  // 儲位模塊
  locations: {
    items: [],
    selectedId: null
  },

  // 庫存異動
  transactions: {
    items: [],
    filters: {
      sku: '',
      tag: '',
      type: '' // 'in' | 'out' | ''
    }
  },

  // 批次模塊
  batches: {
    items: [],
    currentBatch: null
  },

  // Webhook 模塊
  webhooks: {
    items: [],
    logs: []
  },

  // AP（序號品）模塊
  productUnits: {
    items: [],
    currentPage: 1,
    totalPages: 1,
    filters: {
      status: '',
      serial: '',
      projectCase: ''
    }
  },

  // 標籤（交易分類）
  tags: [],

  // UI 狀態
  ui: {
    modals: {
      productModal: false,
      transactionModal: false,
      historyModal: false,
      batchModal: false,
      batchesListModal: false,
      batchDetailsModal: false,
      allTransactionsModal: false,
      productLocationsModal: false,
      locationContentModal: false,
      locationQrcodeModal: false,
      cameraScanModal: false,
      webhooksModal: false,
      webhookFormModal: false,
      productUnitsModal: false,
      puEditModal: false
    },
    loading: {
      products: false,
      locations: false,
      transactions: false,
      webhooks: false
    },
    notifications: {
      message: '',
      type: '' // 'success' | 'error' | 'info'
    }
  }
};
