import { state } from '../state.js';
import { mutations } from '../mutations.js';

export async function loadProducts(page = 1) {
  mutations.SET_LOADING('products', true);
  try {
    const filters = state.products.filters;
    const params = new URLSearchParams({
      page,
      sku: filters.sku || '',
      name: filters.name || '',
      model: filters.model || '',
      tag: filters.tag || '',
      lowStock: filters.lowStock ? 'true' : ''
    });

    const response = await fetch(`/api/products?${params}`);
    const data = await response.json();

    // 轉換字段名：snake_case → camelCase
    const items = (data.data || data.items || []).map(product => ({
      ...product,
      accountable: product.accountable_quantity || product.accountable || 0,
      nonAccountable: product.non_accountable_quantity || product.nonAccountable || 0
    }));

    mutations.SET_PRODUCTS(items);
    mutations.SET_PRODUCTS_PAGINATION(data.page, data.totalPages, data.total);
  } catch (error) {
    console.error('Error loading products:', error);
    mutations.SHOW_NOTIFICATION('Failed to load products', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export function renderProducts() {
  renderProductsTable();
  renderProductsCards();
}

export function renderProductsTable() {
  const tbody = document.getElementById('products-table-body');
  if (!tbody) return;

  const items = state.products.items;
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
  if (!container || state.products.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const buttons = [];
  for (let i = 1; i <= state.products.totalPages; i++) {
    buttons.push(`
      <button class="px-3 py-1 rounded ${i === state.products.currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
              onclick="__modules.products.loadProducts(${i})">
        ${i}
      </button>
    `);
  }

  container.innerHTML = `<div class="flex gap-2">${buttons.join('')}</div>`;
}

export async function handleProductSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  try {
    mutations.SET_LOADING('products', true);
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData))
    });

    if (!response.ok) throw new Error('Failed to save product');

    mutations.SHOW_NOTIFICATION('Product saved successfully', 'success');
    mutations.CLOSE_MODAL('productModal');
    form.reset();
    await loadProducts();
  } catch (error) {
    console.error('Error submitting product:', error);
    mutations.SHOW_NOTIFICATION('Failed to save product', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export async function editProduct(id) {
  const product = state.products.items.find(p => p.id === id);
  if (!product) return;

  const form = document.getElementById('productForm');
  if (form) {
    form.elements['name'].value = product.name;
    form.elements['sku'].value = product.sku;
    form.elements['model'].value = product.model || '';
    // Set other fields as needed
  }

  mutations.OPEN_MODAL('productModal');
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

export function applyProductFilters() {
  loadProducts(1);
  renderPagination();
}
