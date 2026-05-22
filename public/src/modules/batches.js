import { state } from '../state.js';
import { mutations } from '../mutations.js';
import { openModal, closeModal } from './utils.js';

export function openBatchModal() {
  mutations.SET_CURRENT_BATCH(null);
  const form = document.getElementById('batchForm');
  if (form) form.reset();

  const container = document.getElementById('batch-items-container');
  if (container) container.innerHTML = '';

  openModal('batch-modal');
}

export function addBatchItem() {
  openModal('batch-product-search-modal');
}

export async function searchBatchProducts(query) {
  if (!query) {
    document.getElementById('batch-product-search-results').innerHTML = '<p class="text-center text-gray-500 py-8">輸入關鍵字搜尋產品</p>';
    return;
  }

  try {
    const response = await fetch(`/api/products?sku=${encodeURIComponent(query)}&name=${encodeURIComponent(query)}&page=1`);
    const data = await response.json();

    const items = Array.isArray(data) ? data : (data.data || data.items || []);
    const container = document.getElementById('batch-product-search-results');

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-500 py-8">無搜尋結果</p>';
      return;
    }

    const html = items.map(product => `
      <div class="border p-3 rounded cursor-pointer hover:bg-blue-50 transition"
           onclick="__modules.batches.selectBatchProductItem('${product.id}', '${product.sku}', '${product.name}', ${product.accountable || 0}, ${product.nonAccountable || 0})">
        <div class="font-bold text-sm">${product.sku} - ${product.name}</div>
        <div class="text-xs text-gray-600 mt-1">
          <span title="有帳庫存：已核對並記錄的庫存">有帳: ${product.accountable || 0}</span> |
          <span title="無帳庫存：未核對或臨時庫存">無帳: ${product.nonAccountable || 0}</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  } catch (error) {
    console.error('Error searching batch products:', error);
  }
}

export function selectBatchProductItem(id, sku, name, accountable, nonAccountable) {
  const container = document.getElementById('batch-items-container');
  if (!container) return;

  const itemIndex = container.querySelectorAll('.batch-item').length;

  const itemHTML = `
    <div class="border p-3 rounded mb-3 batch-item bg-blue-50" data-index="${itemIndex}">
      <div class="flex justify-between items-center mb-2">
        <span class="font-bold">Item ${itemIndex + 1}</span>
        <button type="button" class="text-red-500 hover:text-red-700 text-sm"
                onclick="__modules.batches.removeBatchItem(${itemIndex})">移除</button>
      </div>
      <input type="hidden" name="product_id" value="${id}">
      <input type="hidden" name="quantity_type" value="accountable">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <div>
          <label class="text-xs text-gray-600 font-medium">SKU</label>
          <input type="text" name="item_sku" value="${sku}" class="w-full px-2 py-1 border rounded text-sm bg-white" readonly>
        </div>
        <div>
          <label class="text-xs text-gray-600 font-medium">產品名稱</label>
          <input type="text" name="item_product_name" value="${name}" class="w-full px-2 py-1 border rounded text-sm bg-white" readonly>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label class="text-xs text-gray-600 font-medium" title="已核對並記錄的庫存">有帳庫存變化 📋</label>
          <input type="number" name="quantity_change" class="w-full px-2 py-1 border rounded text-sm" value="0">
        </div>
        <div>
          <label class="text-xs text-gray-600 font-medium" title="未核對或臨時庫存">無帳庫存 ⚠️</label>
          <input type="number" name="item_non_accountable" class="w-full px-2 py-1 border rounded text-sm" value="${nonAccountable}" min="0">
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', itemHTML);
  closeModal('batch-product-search-modal');
}

export function removeBatchItem(index) {
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
        product_id: element.querySelector('[name="product_id"]').value,
        quantity_change: parseInt(element.querySelector('[name="quantity_change"]').value || 0),
        quantity_type: element.querySelector('[name="quantity_type"]').value
      });
    });

    const payload = {
      tag_id: 'default',
      description: document.getElementById('batch-description')?.value || '',
      items
    };

    console.log('Submitting batch:', JSON.stringify(payload, null, 2));

    const response = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log('Response:', responseData);

    if (!response.ok) {
      const errorMsg = responseData.message || responseData.error || 'Failed to create batch';
      throw new Error(errorMsg);
    }

    mutations.SHOW_NOTIFICATION('Batch created successfully', 'success');
    closeModal('batch-modal');
    form.reset();
    await loadBatchesList();
  } catch (error) {
    console.error('Error submitting batch:', error);
    mutations.SHOW_NOTIFICATION(error.message || 'Failed to create batch', 'error');
  } finally {
    mutations.SET_LOADING('transactions', false);
  }
}

export async function openBatchesListModal() {
  openModal('batches-list-modal');
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
  const container = document.getElementById('batches-table-body');
  if (!container) return;

  if (!batches || batches.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-center text-gray-500">沒有批次資料</td></tr>`;
    return;
  }

  const rows = batches.map(batch => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-3 text-sm">${batch.name || batch.batchNumber || '-'}</td>
      <td class="px-4 py-3 text-sm">${batch.description || '-'}</td>
      <td class="px-4 py-3 text-sm text-center">${batch.items ? batch.items.length : batch.transaction_count || 0}</td>
      <td class="px-4 py-3 text-sm text-center">0</td>
      <td class="px-4 py-3 text-sm text-center">0</td>
      <td class="px-4 py-3 text-sm">${batch.created_at ? new Date(batch.created_at).toLocaleString('zh-TW') : '-'}</td>
      <td class="px-4 py-3 text-sm">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.batches.viewBatchDetails('${batch.id}')">查看詳情</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = rows;
}

export async function viewBatchDetails(batchId) {
  openModal('batch-details-modal');

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
