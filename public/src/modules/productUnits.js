import { state } from '../state.js';
import { mutations } from '../mutations.js';

export async function loadProductUnits(page = 1) {
  try {
    mutations.SET_LOADING('products', true);
    const filters = state.productUnits.filters;
    const params = new URLSearchParams({
      page,
      status: filters.status || '',
      serial: filters.serial || '',
      projectCase: filters.projectCase || ''
    });

    const response = await fetch(`/api/product-units?${params}`);
    const data = await response.json();

    mutations.SET_PRODUCT_UNITS(data.items || []);
    mutations.SET_PRODUCT_UNITS_PAGINATION(data.page, data.totalPages);
  } catch (error) {
    console.error('Error loading product units:', error);
    mutations.SHOW_NOTIFICATION('Failed to load product units', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export function renderProductUnits() {
  const container = document.getElementById('product-units-table-container');
  if (!container) return;

  const items = state.productUnits.items;
  if (items.length === 0) {
    container.innerHTML = '<p class="p-4 text-center text-gray-500">No product units found</p>';
    return;
  }

  const rows = items.map(unit => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-2">${unit.serial}</td>
      <td class="px-4 py-2">${unit.productName}</td>
      <td class="px-4 py-2">${unit.projectCase || '-'}</td>
      <td class="px-4 py-2">
        <span class="px-2 py-1 rounded text-white text-sm ${unit.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}">
          ${unit.status || 'pending'}
        </span>
      </td>
      <td class="px-4 py-2 space-x-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.productUnits.editProductUnit('${unit.id}')">Edit</button>
        <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                onclick="__modules.productUnits.deleteProductUnit('${unit.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">Serial</th>
          <th class="px-4 py-2 text-left">Product</th>
          <th class="px-4 py-2 text-left">Project Case</th>
          <th class="px-4 py-2 text-left">Status</th>
          <th class="px-4 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderProductUnitsPagination() {
  const container = document.getElementById('product-units-pagination-container');
  if (!container || state.productUnits.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const buttons = [];
  for (let i = 1; i <= state.productUnits.totalPages; i++) {
    buttons.push(`
      <button class="px-3 py-1 rounded ${i === state.productUnits.currentPage ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
              onclick="__modules.productUnits.loadProductUnits(${i})">
        ${i}
      </button>
    `);
  }

  container.innerHTML = `<div class="flex gap-2">${buttons.join('')}</div>`;
}

export function openProductUnitsModal() {
  mutations.OPEN_MODAL('productUnitsModal');
  loadProductUnits();
}

export async function handleProductUnitSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  try {
    mutations.SET_LOADING('products', true);
    const payload = Object.fromEntries(formData);

    const response = await fetch('/api/product-units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to save product unit');

    const unit = await response.json();
    mutations.ADD_PRODUCT_UNIT(unit);
    mutations.SHOW_NOTIFICATION('Product unit saved successfully', 'success');
    mutations.CLOSE_MODAL('puEditModal');
    form.reset();
  } catch (error) {
    console.error('Error submitting product unit:', error);
    mutations.SHOW_NOTIFICATION('Failed to save product unit', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}

export function editProductUnit(unitId) {
  const unit = state.productUnits.items.find(u => u.id === unitId);
  if (!unit) return;

  const form = document.getElementById('productUnitForm');
  if (form) {
    form.elements['serial'].value = unit.serial;
    form.elements['productId'].value = unit.productId;
    form.elements['status'].value = unit.status;
    form.elements['projectCase'].value = unit.projectCase || '';
  }

  mutations.OPEN_MODAL('puEditModal');
}

export async function deleteProductUnit(unitId) {
  if (!confirm('Delete this product unit?')) return;

  try {
    mutations.SET_LOADING('products', true);
    const response = await fetch(`/api/product-units/${unitId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete product unit');

    const idx = state.productUnits.items.findIndex(u => u.id === unitId);
    if (idx >= 0) {
      state.productUnits.items.splice(idx, 1);
    }

    mutations.SHOW_NOTIFICATION('Product unit deleted successfully', 'success');
    renderProductUnits();
  } catch (error) {
    console.error('Error deleting product unit:', error);
    mutations.SHOW_NOTIFICATION('Failed to delete product unit', 'error');
  } finally {
    mutations.SET_LOADING('products', false);
  }
}
