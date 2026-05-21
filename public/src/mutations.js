import { state } from './state.js';

// 所有狀態修改必須通過此處的 mutations 函數
// 命名規範：大寫 + 單數形式（ADD_PRODUCT 而非 ADD_PRODUCTS）

export const mutations = {
  // ========== Products ==========
  SET_PRODUCTS(items) {
    state.products.items = items;
  },
  ADD_PRODUCT(product) {
    state.products.items.push(product);
  },
  UPDATE_PRODUCT(id, product) {
    const idx = state.products.items.findIndex(p => p.id === id);
    if (idx >= 0) state.products.items[idx] = product;
  },
  REMOVE_PRODUCT(id) {
    state.products.items = state.products.items.filter(p => p.id !== id);
  },
  SET_PRODUCTS_PAGINATION(page, totalPages, total) {
    state.products.currentPage = page;
    state.products.totalPages = totalPages;
    state.products.totalCount = total;
  },
  SET_PRODUCTS_FILTERS(filters) {
    state.products.filters = { ...state.products.filters, ...filters };
  },

  // ========== Locations ==========
  SET_LOCATIONS(items) {
    state.locations.items = items;
  },
  ADD_LOCATION(location) {
    state.locations.items.push(location);
  },
  UPDATE_LOCATION(id, location) {
    const idx = state.locations.items.findIndex(l => l.id === id);
    if (idx >= 0) state.locations.items[idx] = location;
  },

  // ========== Transactions ==========
  SET_TRANSACTIONS(items) {
    state.transactions.items = items;
  },
  ADD_TRANSACTION(transaction) {
    state.transactions.items.push(transaction);
  },
  SET_TRANSACTIONS_FILTERS(filters) {
    state.transactions.filters = { ...state.transactions.filters, ...filters };
  },

  // ========== Batches ==========
  SET_BATCHES(items) {
    state.batches.items = items;
  },
  SET_CURRENT_BATCH(batch) {
    state.batches.currentBatch = batch;
  },

  // ========== Webhooks ==========
  SET_WEBHOOKS(items) {
    state.webhooks.items = items;
  },
  ADD_WEBHOOK(webhook) {
    state.webhooks.items.push(webhook);
  },
  UPDATE_WEBHOOK(id, webhook) {
    const idx = state.webhooks.items.findIndex(w => w.id === id);
    if (idx >= 0) state.webhooks.items[idx] = webhook;
  },
  REMOVE_WEBHOOK(id) {
    state.webhooks.items = state.webhooks.items.filter(w => w.id !== id);
  },
  SET_WEBHOOK_LOGS(logs) {
    state.webhooks.logs = logs;
  },

  // ========== Product Units (AP) ==========
  SET_PRODUCT_UNITS(items) {
    state.productUnits.items = items;
  },
  ADD_PRODUCT_UNIT(unit) {
    state.productUnits.items.push(unit);
  },
  UPDATE_PRODUCT_UNIT(id, unit) {
    const idx = state.productUnits.items.findIndex(u => u.id === id);
    if (idx >= 0) state.productUnits.items[idx] = unit;
  },
  SET_PRODUCT_UNITS_PAGINATION(page, totalPages) {
    state.productUnits.currentPage = page;
    state.productUnits.totalPages = totalPages;
  },

  // ========== Tags ==========
  SET_TAGS(items) {
    state.tags = items;
  },

  // ========== UI: Modals ==========
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

  // ========== UI: Loading ==========
  SET_LOADING(key, value) {
    if (key in state.ui.loading) {
      state.ui.loading[key] = value;
    }
  },

  // ========== UI: Notifications ==========
  SHOW_NOTIFICATION(message, type = 'info') {
    state.ui.notifications = { message, type };
  },
  CLEAR_NOTIFICATION() {
    state.ui.notifications = { message: '', type: '' };
  }
};
