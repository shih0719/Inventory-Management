import { state } from '../state.js';
import { mutations } from '../mutations.js';

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
  mutations.OPEN_MODAL('webhooksModal');
  loadWebhooks();
}

export function openWebhookFormModal(webhookId) {
  mutations.OPEN_MODAL('webhookFormModal');

  if (webhookId) {
    const webhook = state.webhooks.items.find(w => w.id === webhookId);
    if (webhook) {
      const form = document.getElementById('webhookForm');
      if (form) {
        form.elements['url'].value = webhook.url;
        form.elements['event'].value = webhook.event;
        form.elements['enabled'].checked = webhook.enabled;
        form.elements['webhookId'].value = webhookId;
      }
    }
  } else {
    const form = document.getElementById('webhookForm');
    if (form) form.reset();
  }
}

export async function handleWebhookSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const webhookId = formData.get('webhookId');

  try {
    const payload = {
      url: formData.get('url'),
      event: formData.get('event'),
      enabled: formData.get('enabled') === 'on'
    };

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
    mutations.CLOSE_MODAL('webhookFormModal');
    form.reset();
    renderWebhooksList();
  } catch (error) {
    console.error('Error submitting webhook:', error);
    mutations.SHOW_NOTIFICATION('Failed to save webhook', 'error');
  }
}

export async function deleteWebhook(webhookId) {
  if (!confirm('Delete this webhook?')) return;

  try {
    const response = await fetch(`/api/webhooks/${webhookId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete webhook');

    mutations.REMOVE_WEBHOOK(webhookId);
    mutations.SHOW_NOTIFICATION('Webhook deleted successfully', 'success');
    renderWebhooksList();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    mutations.SHOW_NOTIFICATION('Failed to delete webhook', 'error');
  }
}

export async function viewWebhookLogs(webhookId) {
  try {
    const response = await fetch(`/api/webhooks/${webhookId}/logs`);
    const logs = await response.json();

    mutations.SET_WEBHOOK_LOGS(logs);
    renderWebhookLogs();
  } catch (error) {
    console.error('Error loading webhook logs:', error);
    mutations.SHOW_NOTIFICATION('Failed to load webhook logs', 'error');
  }
}

export function renderWebhooksList() {
  const container = document.getElementById('webhooks-list-container');
  if (!container) return;

  const items = state.webhooks.items;
  if (items.length === 0) {
    container.innerHTML = '<p class="p-4 text-center text-gray-500">No webhooks configured</p>';
    return;
  }

  const rows = items.map(webhook => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-2">${webhook.url}</td>
      <td class="px-4 py-2">${webhook.event}</td>
      <td class="px-4 py-2">
        <span class="px-2 py-1 rounded text-white text-sm ${webhook.enabled ? 'bg-green-500' : 'bg-gray-400'}">
          ${webhook.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </td>
      <td class="px-4 py-2 space-x-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.webhooks.openWebhookFormModal('${webhook.id}')">Edit</button>
        <button class="px-2 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                onclick="__modules.webhooks.viewWebhookLogs('${webhook.id}')">Logs</button>
        <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                onclick="__modules.webhooks.deleteWebhook('${webhook.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">URL</th>
          <th class="px-4 py-2 text-left">Event</th>
          <th class="px-4 py-2 text-left">Status</th>
          <th class="px-4 py-2">Actions</th>
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
