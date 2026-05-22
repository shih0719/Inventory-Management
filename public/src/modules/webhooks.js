import { state } from '../state.js';
import { mutations } from '../mutations.js';
import { openModal, closeModal } from './utils.js';

export async function loadWebhooks() {
  try {
    mutations.SET_LOADING('webhooks', true);
    const response = await fetch('/api/webhooks');
    const data = await response.json();
    const items = Array.isArray(data) ? data : (data.data || data.webhooks || []);

    mutations.SET_WEBHOOKS(items);
    renderWebhooksList();
  } catch (error) {
    console.error('Error loading webhooks:', error);
    mutations.SHOW_NOTIFICATION('Failed to load webhooks', 'error');
  } finally {
    mutations.SET_LOADING('webhooks', false);
  }
}

export function openWebhooksModal() {
  openModal('webhooks-modal');
  loadWebhooks();
}

export function openWebhookFormModal(webhookId) {
  openModal('webhook-form-modal');

  if (webhookId) {
    const webhook = state.webhooks.items.find(w => w.id === webhookId);
    if (webhook) {
      document.getElementById('webhook-id').value = webhook.id;
      document.getElementById('webhook-name').value = webhook.name || '';
      document.getElementById('webhook-url').value = webhook.url || '';
      document.getElementById('webhook-is-active').checked = webhook.is_active || false;

      // 设置选中的事件
      document.querySelectorAll('.webhook-event').forEach(checkbox => {
        checkbox.checked = webhook.events && webhook.events.includes(checkbox.value);
      });
    }
  } else {
    document.getElementById('webhook-form').reset();
  }
}

export async function handleWebhookSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const webhookId = formData.get('id');

  try {
    // 收集选中的事件
    const events = [];
    document.querySelectorAll('.webhook-event:checked').forEach(checkbox => {
      events.push(checkbox.value);
    });

    const payload = {
      name: formData.get('name'),
      url: formData.get('url'),
      events: events,
      is_active: document.getElementById('webhook-is-active').checked ? 1 : 0
    };

    console.log('Webhook payload:', payload);

    const response = await fetch(
      webhookId ? `/api/webhooks/${webhookId}` : '/api/webhooks',
      {
        method: webhookId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) throw new Error('Failed to save webhook');

    const webhook = await response.json();
    if (webhookId) {
      mutations.UPDATE_WEBHOOK(webhookId, webhook);
    } else {
      mutations.ADD_WEBHOOK(webhook);
    }

    mutations.SHOW_NOTIFICATION('Webhook saved successfully', 'success');
    closeModal('webhook-form-modal');
    form.reset();
    await loadWebhooks();
    renderWebhooksList();
  } catch (error) {
    console.error('Error submitting webhook:', error);
    mutations.SHOW_NOTIFICATION('Failed to save webhook', 'error');
  }
}

export async function deleteWebhook(webhookId) {
  if (!confirm('確定要刪除此 Webhook 訂閱嗎？')) return;

  try {
    const response = await fetch(`/api/webhooks/${webhookId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete webhook');

    mutations.SHOW_NOTIFICATION('Webhook 已刪除', 'success');
    await loadWebhooks();
    renderWebhooksList();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    mutations.SHOW_NOTIFICATION('刪除失敗', 'error');
  }
}

export async function testWebhookPush(webhookId) {
  try {
    const response = await fetch(`/api/webhooks/${webhookId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok) {
      mutations.SHOW_NOTIFICATION('測試推送已發送，請檢查接收端', 'success');
    } else {
      const errorMsg = data.message || data.error || '測試推送失敗';
      mutations.SHOW_NOTIFICATION(errorMsg, 'error');
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    mutations.SHOW_NOTIFICATION('測試推送失敗', 'error');
  }
}

export function renderWebhooksList() {
  const container = document.getElementById('webhooks-list');
  if (!container) return;

  const items = state.webhooks.items;
  if (items.length === 0) {
    container.innerHTML = '<p class="p-4 text-center text-gray-500">No webhooks configured</p>';
    return;
  }

  const rows = items.map(webhook => {
    const eventsList = Array.isArray(webhook.events) ? webhook.events.join(', ') : webhook.event || '-';
    const isActive = webhook.is_active || webhook.enabled;
    return `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-2 text-sm">${webhook.name || '-'}</td>
      <td class="px-4 py-2 text-sm">${webhook.url}</td>
      <td class="px-4 py-2 text-sm">${eventsList}</td>
      <td class="px-4 py-2">
        <span class="px-2 py-1 rounded text-white text-sm ${isActive ? 'bg-green-500' : 'bg-gray-400'}">
          ${isActive ? '啟用' : '停用'}
        </span>
      </td>
      <td class="px-4 py-2 space-x-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.webhooks.openWebhookFormModal('${webhook.id}')">編輯</button>
        <button class="px-2 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                onclick="__modules.webhooks.testWebhookPush('${webhook.id}')">測試推送</button>
        <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                onclick="__modules.webhooks.deleteWebhook('${webhook.id}')">刪除</button>
      </td>
    </tr>
  `;
  }).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">名稱</th>
          <th class="px-4 py-2 text-left">URL</th>
          <th class="px-4 py-2 text-left">事件</th>
          <th class="px-4 py-2 text-left">狀態</th>
          <th class="px-4 py-2">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function renderWebhookLogs() {
  const container = document.getElementById('webhook-logs-container');
  if (!container) return;

  const logs = state.webhooks.logs;
  const rows = (Array.isArray(logs) ? logs : []).map(log => `
    <tr class="border-b">
      <td class="px-4 py-2">${new Date(log.timestamp).toLocaleString()}</td>
      <td class="px-4 py-2">${log.statusCode}</td>
      <td class="px-4 py-2">${log.responseTime}ms</td>
      <td class="px-4 py-2">
        <span class="px-2 py-1 rounded text-white text-sm ${log.statusCode >= 200 && log.statusCode < 300 ? 'bg-green-500' : 'bg-red-500'}">
          ${log.statusCode >= 200 && log.statusCode < 300 ? 'Success' : 'Failed'}
        </span>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border text-sm">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">Timestamp</th>
          <th class="px-4 py-2 text-left">Status</th>
          <th class="px-4 py-2 text-left">Response Time</th>
          <th class="px-4 py-2">Result</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
