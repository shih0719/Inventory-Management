import { state } from '../state.js';
import { mutations } from '../mutations.js';

export function populateAllTransTagFilter() {
  const select = document.getElementById('all-transactions-tag-filter');
  if (!select) return;

  const tags = state.tags;
  const options = tags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
  select.innerHTML = `<option value="">-- All Tags --</option>${options}`;
}

export function openTransactionModal(productId, productName, accountableQty, nonAccountableQty) {
  const form = document.getElementById('transactionForm');
  if (form) {
    form.elements['productId'].value = productId;
    form.elements['productName'].value = productName;
    form.elements['currentAccountable'].value = accountableQty;
    form.elements['currentNonAccountable'].value = nonAccountableQty;
  }

  mutations.OPEN_MODAL('transactionModal');
}

export async function handleTransactionSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  try {
    mutations.SET_LOADING('transactions', true);
    const payload = {
      productId: formData.get('productId'),
      type: formData.get('type'),
      quantity: parseInt(formData.get('quantity')),
      quantityType: formData.get('quantityType'),
      tag: formData.get('tag'),
      remarks: formData.get('remarks')
    };

    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to create transaction');

    mutations.SHOW_NOTIFICATION('Transaction recorded successfully', 'success');
    mutations.CLOSE_MODAL('transactionModal');
    form.reset();
    await loadAllTransactions();
  } catch (error) {
    console.error('Error submitting transaction:', error);
    mutations.SHOW_NOTIFICATION('Failed to create transaction', 'error');
  } finally {
    mutations.SET_LOADING('transactions', false);
  }
}

export async function openHistoryModal(productId, productName, productSku) {
  mutations.OPEN_MODAL('historyModal');

  try {
    mutations.SET_LOADING('transactions', true);
    const response = await fetch(`/api/transactions?productId=${productId}`);
    const transactions = await response.json();

    renderHistory(transactions);
  } catch (error) {
    console.error('Error loading transaction history:', error);
    mutations.SHOW_NOTIFICATION('Failed to load transaction history', 'error');
  } finally {
    mutations.SET_LOADING('transactions', false);
  }
}

export function renderHistory(transactions) {
  const container = document.getElementById('history-table-container');
  if (!container) return;

  const rows = (Array.isArray(transactions) ? transactions : []).map(tx => `
    <tr class="border-b">
      <td class="px-4 py-2">${formatDateTime(tx.timestamp)}</td>
      <td class="px-4 py-2">${tx.type === 'in' ? '✓ In' : '✗ Out'}</td>
      <td class="px-4 py-2 text-right">${tx.quantity}</td>
      <td class="px-4 py-2">${tx.quantityType}</td>
      <td class="px-4 py-2">${tx.tag || '-'}</td>
      <td class="px-4 py-2 text-sm text-gray-600">${tx.remarks || '-'}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border text-sm">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">Timestamp</th>
          <th class="px-4 py-2 text-left">Type</th>
          <th class="px-4 py-2 text-right">Qty</th>
          <th class="px-4 py-2 text-left">Type</th>
          <th class="px-4 py-2 text-left">Tag</th>
          <th class="px-4 py-2 text-left">Remarks</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function openAllTransactionsModal() {
  mutations.OPEN_MODAL('allTransactionsModal');
  await loadAllTransactions();
}

export async function loadAllTransactions() {
  try {
    mutations.SET_LOADING('transactions', true);
    const filters = state.transactions.filters;
    const params = new URLSearchParams({
      sku: filters.sku || '',
      tag: filters.tag || '',
      type: filters.type || ''
    });

    const response = await fetch(`/api/transactions?${params}`);
    const data = await response.json();
    const transactions = Array.isArray(data) ? data : (data.data || data.transactions || []);

    mutations.SET_TRANSACTIONS(transactions);
    renderAllTransactions(transactions);
  } catch (error) {
    console.error('Error loading transactions:', error);
    mutations.SHOW_NOTIFICATION('Failed to load transactions', 'error');
  } finally {
    mutations.SET_LOADING('transactions', false);
  }
}

export function renderAllTransactions(transactions) {
  const container = document.getElementById('all-transactions-table-container');
  if (!container) return;

  const rows = (Array.isArray(transactions) ? transactions : []).map(tx => `
    <tr class="border-b">
      <td class="px-4 py-2">${tx.sku}</td>
      <td class="px-4 py-2">${tx.productName}</td>
      <td class="px-4 py-2">${formatDateTime(tx.timestamp)}</td>
      <td class="px-4 py-2 text-center">${tx.type === 'in' ? '✓' : '✗'}</td>
      <td class="px-4 py-2 text-right">${tx.quantity}</td>
      <td class="px-4 py-2">${tx.quantityType}</td>
      <td class="px-4 py-2">${tx.tag || '-'}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border text-sm">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">SKU</th>
          <th class="px-4 py-2 text-left">Product</th>
          <th class="px-4 py-2 text-left">Timestamp</th>
          <th class="px-4 py-2 text-center">Type</th>
          <th class="px-4 py-2 text-right">Qty</th>
          <th class="px-4 py-2 text-left">Type</th>
          <th class="px-4 py-2 text-left">Tag</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
