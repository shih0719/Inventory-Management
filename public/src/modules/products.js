import { state } from '../state.js';
import { mutations } from '../mutations.js';
import { openModal, closeModal } from './utils.js';

export async function loadProducts(page = 1) {
  mutations.SET_LOADING('products', true);
  try {
    const filters = state.products.filters;
    const params = new URLSearchParams({
      page,
      sku: filters.sku || '',
      name: filters.name || '',
      model: filters.model || '',
      lowStock: filters.lowStock ? 'true' : '',
      sortBy: filters.sortBy || ''
    });

    const response = await fetch(`/api/products?${params}`);
    const data = await response.json();

    // 轉換字段名：snake_case → camelCase
    const items = (data.data || data.items || []).map(product => ({
      ...product,
      accountable: product.accountable_quantity || product.accountable || 0,
      nonAccountable: product.non_accountable_quantity || product.nonAccountable || 0
    }));

    // 處理分頁資料（可能在不同的結構中）
    const pagination = data.pagination || data;
    const currentPage = pagination.page || data.page || 1;
    const totalPages = pagination.totalPages || data.totalPages || 1;
    const total = pagination.total || data.total || 0;

    mutations.SET_PRODUCTS(items);
    mutations.SET_PRODUCTS_PAGINATION(currentPage, totalPages, total);

    console.log(`✓ Loaded page ${currentPage}/${totalPages}, total: ${total} items`);
  } catch (error) {
    console.error('Error loading products:', error);
    mutations.SHOW_NOTIFICATION('Failed to load products', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

function sortProducts(items, sortBy) {
  const sorted = [...items];
  const [column, direction] = sortBy.includes('_') ? sortBy.split('_') : [sortBy, 'asc'];
  const isAsc = direction === 'asc';

  sorted.sort((a, b) => {
    let aVal, bVal;

    if (column === 'sku') {
      aVal = a.sku || '';
      bVal = b.sku || '';
    } else if (column === 'name') {
      aVal = a.name || '';
      bVal = b.name || '';
    } else if (column === 'accountable') {
      aVal = a.accountable || 0;
      bVal = b.accountable || 0;
    } else {
      return 0;
    }

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return isAsc ? -1 : 1;
    if (aVal > bVal) return isAsc ? 1 : -1;
    return 0;
  });

  return sorted;
}

export function renderProducts() {
  renderProductsTable();
  renderProductsCards();
  updateSortIndicators();
}

export function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  let items = [...state.products.items]; // 複製陣列，避免改變原數據

  // 客戶端排序
  const sortBy = state.products.filters.sortBy || '';
  if (sortBy) {
    items = sortProducts(items, sortBy);
  }

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No products found</td></tr>';
    return;
  }

  const rows = items.map(product => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-6 py-3">${product.sku}</td>
      <td class="px-6 py-3">${product.name}</td>
      <td class="px-6 py-3">${product.type || '-'}</td>
      <td class="px-6 py-3">${product.model || '-'}</td>
      <td class="px-6 py-3">${product.accountable || 0}</td>
      <td class="px-6 py-3">${product.nonAccountable || 0}</td>
      <td class="px-6 py-3 space-x-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.products.editProduct('${product.id}')">Edit</button>
        <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                onclick="__modules.products.deleteProduct('${product.id}', '${product.name}')">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = rows;
}

export function renderProductsCards() {
  const container = document.getElementById('products-cards');
  if (!container) return;

  const items = state.products.items;
  const cards = items.map(product => `
    <div class="border rounded p-4 shadow-sm hover:shadow-md transition bg-white">
      <div class="font-bold">${product.name}</div>
      <div class="text-sm text-gray-600">SKU: ${product.sku}</div>
      <div class="mt-2 space-y-1 text-sm">
        <div>Type: ${product.type || '-'}</div>
        <div>Model: ${product.model || '-'}</div>
        <div>Accountable: ${product.accountable || 0}</div>
        <div>Non-Accountable: ${product.nonAccountable || 0}</div>
      </div>
      <div class="mt-3 space-x-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.products.editProduct('${product.id}')">Edit</button>
        <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                onclick="__modules.products.deleteProduct('${product.id}', '${product.name}')">Delete</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = cards.length > 0
    ? cards
    : '<p class="text-center text-gray-500">No products found</p>';
}

export function renderPagination() {
  const container = document.getElementById('pagination-container');
  if (!container) return;

  // 更新總產品數
  const totalEl = document.getElementById('total-products');
  if (totalEl) {
    totalEl.textContent = state.products.totalCount || 0;
  }

  if (state.products.totalPages <= 1) {
    container.innerHTML = `
      <div class="flex justify-between items-center w-full">
        <div class="text-sm text-gray-600">
          共 <span class="font-semibold text-blue-600">${state.products.totalCount || 0}</span> 筆產品
        </div>
      </div>
    `;
    return;
  }

  const buttons = [];

  // 上一頁按鈕
  if (state.products.currentPage > 1) {
    buttons.push(`
      <button class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 transition"
              onclick="__modules.products.goToPage(${state.products.currentPage - 1})">
        ← 上一頁
      </button>
    `);
  }

  // 頁碼按鈕
  for (let i = 1; i <= state.products.totalPages; i++) {
    buttons.push(`
      <button class="px-3 py-1 rounded transition ${i === state.products.currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
              onclick="__modules.products.goToPage(${i})">
        ${i}
      </button>
    `);
  }

  // 下一頁按鈕
  if (state.products.currentPage < state.products.totalPages) {
    buttons.push(`
      <button class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 transition"
              onclick="__modules.products.goToPage(${state.products.currentPage + 1})">
        下一頁 →
      </button>
    `);
  }

  const pageInfo = `第 ${state.products.currentPage} / ${state.products.totalPages} 頁`;

  container.innerHTML = `
    <div class="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
      <div class="text-sm text-gray-600">
        共 <span class="font-semibold text-blue-600">${state.products.totalCount || 0}</span> 筆產品 | ${pageInfo}
      </div>
      <div id="pagination-buttons" class="flex gap-2">
        ${buttons.join('')}
      </div>
    </div>
  `;
}

export async function handleProductSubmit(e) {
  e.preventDefault();
  const form = e.target;

  // 詳細日誌：檢查表單中的實際值
  console.log('=== Form Submission ===');
  console.log('Form elements:', {
    id: document.getElementById('product-id')?.value,
    sku: document.getElementById('product-sku')?.value,
    name: document.getElementById('product-name')?.value,
    type: document.getElementById('product-type')?.value,
    model: document.getElementById('product-model')?.value,
    accountable: document.getElementById('product-accountable-qty')?.value,
    nonAccountable: document.getElementById('product-non-accountable-qty')?.value,
    minStock: document.getElementById('product-min-stock')?.value,
    trackSerial: document.getElementById('product-track-serial')?.checked
  });

  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const productId = data.id;

  console.log('FormData entries:', data);
  console.log('ProductId:', productId);

  try {
    mutations.SET_LOADING('products', true);

    if (productId) {
      // 編輯模式：更新產品信息（除了 sku）
      const payload = {
        name: data.name,
        type: data.type,
        model: data.model,
        accountable_quantity: parseInt(data.accountable_quantity || 0),
        non_accountable_quantity: parseInt(data.non_accountable_quantity || 0),
        min_stock: parseInt(data.min_stock || 0),
        track_serial: data.track_serial === 'on' || data.track_serial === true
      };

      console.log(`PUT /api/products/${productId}:`, payload);

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      console.log('PUT Response status:', response.status);
      console.log('PUT Response data:', responseData);

      if (!response.ok) {
        const errorMsg = responseData.message || responseData.error || 'Failed to update product';
        throw new Error(errorMsg);
      }

      mutations.SHOW_NOTIFICATION('Product updated successfully', 'success');
    } else {
      // 新增模式：建立新產品
      const payload = {
        sku: data.sku,
        name: data.name,
        type: data.type,
        model: data.model,
        accountable_quantity: parseInt(data.accountable_quantity || 0),
        non_accountable_quantity: parseInt(data.non_accountable_quantity || 0),
        min_stock: parseInt(data.min_stock || 0)
      };

      console.log('POST /api/products:', payload);

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      console.log('Response:', responseData);

      if (!response.ok) {
        const errorMsg = responseData.message || responseData.error || 'Failed to create product';
        throw new Error(errorMsg);
      }

      mutations.SHOW_NOTIFICATION('Product created successfully', 'success');
    }

    closeModal('product-modal');
    form.reset();
    await loadProducts();
    renderProducts();
  } catch (error) {
    console.error('Error submitting product:', error);
    mutations.SHOW_NOTIFICATION(error.message || 'Failed to save product', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export async function editProduct(id) {
  const product = state.products.items.find(p => String(p.id) === String(id));
  if (!product) {
    console.warn(`Product not found: ${id}`);
    return;
  }

  const form = document.getElementById('product-form');
  if (!form) {
    console.warn('Form not found');
    return;
  }

  try {
    document.getElementById('product-id').value = product.id || '';
    document.getElementById('product-sku').value = product.sku || '';
    document.getElementById('product-name').value = product.name || '';
    document.getElementById('product-type').value = product.type || '';
    document.getElementById('product-model').value = product.model || '';
    document.getElementById('product-accountable-qty').value = product.accountable || product.accountable_quantity || 0;
    document.getElementById('product-non-accountable-qty').value = product.nonAccountable || product.non_accountable_quantity || 0;
    document.getElementById('product-min-stock').value = product.minStock || product.min_stock || 0;
    document.getElementById('product-track-serial').checked = product.trackSerial || product.track_serial || false;

    console.log('Form populated:', {
      id: product.id,
      sku: product.sku,
      accountable: product.accountable || product.accountable_quantity,
      nonAccountable: product.nonAccountable || product.non_accountable_quantity
    });
  } catch (error) {
    console.error('Error populating form:', error);
    return;
  }

  const titleEl = document.getElementById('product-modal-title');
  if (titleEl) titleEl.textContent = '編輯產品';

  openModal('product-modal');
}

export async function deleteProduct(id, name) {
  if (!confirm(`Delete product "${name}"?`)) return;

  try {
    mutations.SET_LOADING('products', true);
    const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete product');

    mutations.REMOVE_PRODUCT(id);
    mutations.SHOW_NOTIFICATION('Product deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting product:', error);
    mutations.SHOW_NOTIFICATION('Failed to delete product', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export async function goToPage(pageNum) {
  await loadProducts(pageNum);
  renderProducts();
  renderPagination();
}

export async function applyProductFilters() {
  await loadProducts(1);
  renderProducts();
  renderPagination();
  console.log('✓ Filters applied, products rendered');
}

export async function setSortColumn(column) {
  const currentSort = state.products.filters.sortBy || '';

  // 如果點擊同一列，切換升序/降序；否則以升序開始
  let newSort;
  if (currentSort.startsWith(column)) {
    newSort = currentSort.includes('asc') ? `${column}_desc` : `${column}_asc`;
  } else {
    newSort = `${column}_asc`;
  }

  state.products.filters.sortBy = newSort;

  // 更新排序下拉框
  const sortSelect = document.getElementById('sort-by');
  if (sortSelect) sortSelect.value = newSort;

  await applyProductFilters();
  updateSortIndicators();
}

function updateSortIndicators() {
  const sortBy = state.products.filters.sortBy || '';

  // 清除所有指示符（若元素存在）
  const skuEl = document.getElementById('sort-sku');
  const nameEl = document.getElementById('sort-name');
  const accountableEl = document.getElementById('sort-accountable');

  if (skuEl) skuEl.textContent = '';
  if (nameEl) nameEl.textContent = '';
  if (accountableEl) accountableEl.textContent = '';

  // 根據當前排序顯示指示符
  if (sortBy.startsWith('sku') && skuEl) {
    skuEl.textContent = sortBy.includes('asc') ? '▲' : '▼';
  } else if (sortBy.startsWith('name') && nameEl) {
    nameEl.textContent = sortBy.includes('asc') ? '▲' : '▼';
  } else if (sortBy.startsWith('accountable') && accountableEl) {
    accountableEl.textContent = sortBy.includes('asc') ? '▲' : '▼';
  }
}
