import { state } from './state.js';

// 工廠函數：生成標準 CRUD mutations
// setName: 複數形式 (SET_PRODUCTS), itemName: 單數形式 (PRODUCT)
function createListMutations(setName, itemName, statePath) {
  return {
    [`SET_${setName}`](items) {
      statePath.items = items;
    },
    [`ADD_${itemName}`](item) {
      statePath.items.push(item);
    },
    [`UPDATE_${itemName}`](id, item) {
      const idx = statePath.items.findIndex(p => p.id === id);
      if (idx >= 0) statePath.items[idx] = item;
    },
    [`REMOVE_${itemName}`](id) {
      statePath.items = statePath.items.filter(p => p.id !== id);
    }
  };
}

// 工廠函數：生成 pagination mutations
function createPaginationMutations(moduleName, statePath) {
  const ACTION_PREFIX = moduleName.toUpperCase();
  return {
    [`SET_${ACTION_PREFIX}_PAGINATION`](page, totalPages, total) {
      statePath.currentPage = page;
      statePath.totalPages = totalPages;
      if (total !== undefined) statePath.totalCount = total;
    }
  };
}

// 工廠函數：生成 filter mutations
function createFilterMutations(moduleName, statePath) {
  const ACTION_PREFIX = moduleName.toUpperCase();
  return {
    [`SET_${ACTION_PREFIX}_FILTERS`](filters) {
      statePath.filters = { ...statePath.filters, ...filters };
    }
  };
}

// UI 操作 mutations（集中管理所有 UI 狀態）
const uiMutations = {
  // Modals
  OPEN_MODAL(modalName) {
    if (modalName in state.ui.modals) {
      state.ui.modals[modalName] = true;
    }
  },
  CLOSE_MODAL(modalName) {
    if (modalName in state.ui.modals) {
      state.ui.modals[modalName] = false;
    }
  },
  TOGGLE_MODAL(modalName) {
    if (modalName in state.ui.modals) {
      state.ui.modals[modalName] = !state.ui.modals[modalName];
    }
  },

  // Loading
  SET_LOADING(key, value) {
    if (key in state.ui.loading) {
      state.ui.loading[key] = value;
    }
  },

  // Notifications
  SHOW_NOTIFICATION(message, type = 'info') {
    state.ui.notifications = { message, type };

    if (state.ui.notifications.timeoutId) {
      clearTimeout(state.ui.notifications.timeoutId);
    }
    state.ui.notifications.timeoutId = setTimeout(() => {
      this.CLEAR_NOTIFICATION();
    }, 3000);
  },
  CLEAR_NOTIFICATION() {
    if (state.ui.notifications.timeoutId) {
      clearTimeout(state.ui.notifications.timeoutId);
    }
    state.ui.notifications = { message: '', type: '', timeoutId: null };
  }
};

// 特殊 mutations（無法用工廠函數生成的）
const specialMutations = {
  SET_TAGS(items) {
    state.tags = items;
  },
  SET_CURRENT_BATCH(batch) {
    state.batches.currentBatch = batch;
  },
  SET_WEBHOOK_LOGS(logs) {
    state.webhooks.logs = logs;
  }
};

// 組合所有 mutations
export const mutations = {
  ...createListMutations('PRODUCTS', 'PRODUCT', state.products),
  ...createPaginationMutations('PRODUCTS', state.products),
  ...createFilterMutations('PRODUCTS', state.products),

  ...createListMutations('LOCATIONS', 'LOCATION', state.locations),

  ...createListMutations('TRANSACTIONS', 'TRANSACTION', state.transactions),
  ...createFilterMutations('TRANSACTIONS', state.transactions),

  ...createListMutations('BATCHES', 'BATCH', state.batches),

  ...createListMutations('WEBHOOKS', 'WEBHOOK', state.webhooks),

  ...createListMutations('PRODUCT_UNITS', 'PRODUCT_UNIT', state.productUnits),
  ...createPaginationMutations('PRODUCT_UNITS', state.productUnits),
  ...createFilterMutations('PRODUCT_UNITS', state.productUnits),

  ...uiMutations,
  ...specialMutations
};
