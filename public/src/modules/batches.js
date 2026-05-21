import { state } from '../state.js';
import { mutations } from '../mutations.js';

export function openBatchModal() {
  mutations.SET_CURRENT_BATCH(null);
  const form = document.getElementById('batchForm');
  if (form) form.reset();

  const container = document.getElementById('batch-items-container');
  if (container) container.innerHTML = '';

  mutations.OPEN_MODAL('batchModal');
}

export function addBatchItem() {
  if (!state.batches.currentBatch) {
    state.batches.currentBatch = {
      items: [],
      timestamp: new Date().toISOString()
    };
  }

  const itemIndex = state.batches.currentBatch.items.length;
  const batchItemForm = document.getElementById('batch-item-form');
  if (!batchItemForm) return;

  const container = document.getElementById('batch-items-container');
  if (!container) return;

  const itemHTML = `
    <div class="border p-3 rounded mb-3 batch-item" data-index="${itemIndex}">
      <div class="flex justify-between items-center mb-2">
        <span class="font-bold">Item ${itemIndex + 1}</span>
        <button type="button" class="text-red-500 hover:text-red-700"
                onclick="__modules.batches.removeBatchItem(${itemIndex})">Remove</button>
      </div>
      <input type="hidden" name="batch_item_id" value="${itemIndex}">
      <div class="grid grid-cols-2 gap-2">
        <input type="text" name="item_sku" placeholder="SKU" class="px-2 py-1 border rounded">
        <input type="text" name="item_product_name" placeholder="Product Name" class="px-2 py-1 border rounded">
        <input type="number" name="item_accountable" placeholder="Accountable" class="px-2 py-1 border rounded">
        <input type="number" name="item_non_accountable" placeholder="Non-Accountable" class="px-2 py-1 border rounded">
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', itemHTML);
}

export async function searchBatchProducts(query) {
  if (!query || query.length < 2) return;

  try {
    const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
    const results = await response.json();

    const container = document.getElementById('batch-search-results');
    if (!container) return;

    const html = results.map(product => `
      <div class="border p-2 rounded cursor-pointer hover:bg-blue-50"
           onclick="__modules.batches.selectBatchProduct('${product.id}', '${product.name}', ${product.accountable}, ${product.nonAccountable}, '${product.sku}')">
        <div class="font-bold">${product.sku} - ${product.name}</div>
        <div class="text-sm text-gray-600">A: ${product.accountable}, NA: ${product.nonAccountable}</div>
      </div>
    `).join('');

    container.innerHTML = html || '<p class="text-gray-500">No results found</p>';
  } catch (error) {
    console.error('Error searching batch products:', error);
  }
}

export function selectBatchProduct(id, name, accountable, nonAccountable, sku, itemIndex) {
  if (!state.batches.currentBatch) return;

  const itemInputs = document.querySelectorAll('.batch-item input');
  if (itemIndex !== undefined && itemIndex < itemInputs.length) {
    const itemForm = document.querySelector(`.batch-item[data-index="${itemIndex}"]`);
    if (itemForm) {
      itemForm.querySelector('[name="item_sku"]').value = sku;
      itemForm.querySelector('[name="item_product_name"]').value = name;
    }
  }

  const searchResults = document.getElementById('batch-search-results');
  if (searchResults) searchResults.innerHTML = '';
}

export function removeBatchItem(index) {
  if (!state.batches.currentBatch) return;

  const itemElement = document.querySelector(`.batch-item[data-index="${index}"]`);
  if (itemElement) itemElement.remove();
}

export async function handleBatchSubmit(e) {
  e.preventDefault();
  const form = e.target;

  try {
    mutations.SET_LOADING('transactions', true);

    const items = [];
    document.querySelectorAll('.batch-item').forEach((element, idx) => {
      items.push({
        sku: element.querySelector('[name="item_sku"]').value,
        productName: element.querySelector('[name="item_product_name"]').value,
        accountable: parseInt(element.querySelector('[name="item_accountable"]').value || 0),
        nonAccountable: parseInt(element.querySelector('[name="item_non_accountable"]').value || 0)
      });
    });

    const payload = {
      batchNumber: form.elements['batchNumber'].value,
      tag: form.elements['tag'].value,
      remarks: form.elements['remarks'].value,
      items
    };

    const response = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to create batch');

    mutations.SHOW_NOTIFICATION('Batch created successfully', 'success');
    mutations.CLOSE_MODAL('batchModal');
    form.reset();
    await loadBatchesList();
  } catch (error) {
    console.error('Error submitting batch:', error);
    mutations.SHOW_NOTIFICATION('Failed to create batch', 'error');
  } finally {
    mutations.SET_LOADING('transactions', false);
  }
}

export async function openBatchesListModal() {
  mutations.OPEN_MODAL('batchesListModal');
  await loadBatchesList();
}

export async function loadBatchesList() {
  try {
    const response = await fetch('/api/batches');
    const data = await response.json();
    const batches = Array.isArray(data) ? data : (data.data || data.batches || []);

    mutations.SET_BATCHES(batches);
    renderBatchesList(batches);
  } catch (error) {
    console.error('Error loading batches:', error);
    mutations.SHOW_NOTIFICATION('Failed to load batches', 'error');
  }
}

export function renderBatchesList(batches) {
  const container = document.getElementById('batches-list-container');
  if (!container) return;

  const rows = batches.map(batch => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-2">${batch.batchNumber}</td>
      <td class="px-4 py-2">${batch.tag || '-'}</td>
      <td class="px-4 py-2">${batch.items ? batch.items.length : 0}</td>
      <td class="px-4 py-2 text-sm text-gray-600">${new Date(batch.createdAt).toLocaleDateString()}</td>
      <td class="px-4 py-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.batches.viewBatchDetails('${batch.id}')">View</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">Batch Number</th>
          <th class="px-4 py-2 text-left">Tag</th>
          <th class="px-4 py-2 text-center">Items</th>
          <th class="px-4 py-2 text-left">Created</th>
          <th class="px-4 py-2">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function viewBatchDetails(batchId) {
  mutations.OPEN_MODAL('batchDetailsModal');

  try {
    const response = await fetch(`/api/batches/${batchId}`);
    const batch = await response.json();

    const container = document.getElementById('batch-details-container');
    if (!container) return;

    const itemsHtml = (batch.items || []).map(item => `
      <tr class="border-b">
        <td class="px-4 py-2">${item.sku}</td>
        <td class="px-4 py-2">${item.productName}</td>
        <td class="px-4 py-2 text-right">${item.accountable}</td>
        <td class="px-4 py-2 text-right">${item.nonAccountable}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div class="mb-4">
        <p><strong>Batch Number:</strong> ${batch.batchNumber}</p>
        <p><strong>Tag:</strong> ${batch.tag || '-'}</p>
        <p><strong>Created:</strong> ${new Date(batch.createdAt).toLocaleString()}</p>
      </div>
      <table class="w-full border-collapse border">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-4 py-2 text-left">SKU</th>
            <th class="px-4 py-2 text-left">Product</th>
            <th class="px-4 py-2 text-right">Accountable</th>
            <th class="px-4 py-2 text-right">Non-Accountable</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading batch details:', error);
    mutations.SHOW_NOTIFICATION('Failed to load batch details', 'error');
  }
}
