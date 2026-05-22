import { state } from '../state.js';
import { mutations } from '../mutations.js';
import { openModal } from './utils.js';

export async function loadLocations() {
  mutations.SET_LOADING('locations', true);
  try {
    const response = await fetch('/api/locations');
    const data = await response.json();
    const items = Array.isArray(data) ? data : (data.data || data.locations || []);
    mutations.SET_LOCATIONS(items);
    populateLocationSelectors();
  } catch (error) {
    console.error('Error loading locations:', error);
    mutations.SHOW_NOTIFICATION('Failed to load locations', 'error');
  } finally {
    mutations.SET_LOADING('locations', false);
  }
}

export function populateLocationSelectors() {
  const selectors = document.querySelectorAll('[data-locations-select]');
  const options = state.locations.items
    .map(loc => `<option value="${loc.id}">${loc.name}</option>`)
    .join('');

  selectors.forEach(select => {
    const currentValue = select.value;
    select.innerHTML = `<option value="">-- Select Location --</option>${options}`;
    if (currentValue) select.value = currentValue;
  });
}

export function renderLocationsTable() {
  const tbody = document.getElementById('locations-table-body');
  if (!tbody) return;

  const items = state.locations.items;
  const rows = items.map(location => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-3">${location.name || '-'}</td>
      <td class="px-6 py-3">${location.description || '-'}</td>
      <td class="px-6 py-3">${location.createdAt ? new Date(location.createdAt).toLocaleDateString() : '-'}</td>
      <td class="px-6 py-3 space-x-2">
        <button class="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
                onclick="__modules.locations.openLocationContentModal('${location.name}')">View</button>
        <button class="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition"
                onclick="__modules.locations.openQRCodeModal('${location.name}')">QR Code</button>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = rows || '<tr><td colspan="4" class="px-6 py-3 text-center text-gray-500">No locations found</td></tr>';
}

export async function handleLocationCreate(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  try {
    const response = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData))
    });

    if (!response.ok) throw new Error('Failed to create location');

    mutations.SHOW_NOTIFICATION('Location created successfully', 'success');
    form.reset();
    await loadLocations();
    renderLocationsTable();
  } catch (error) {
    console.error('Error creating location:', error);
    mutations.SHOW_NOTIFICATION('Failed to create location', 'error');
  }
}

export async function openLocationContentModal(locationName) {
  openModal('location-content-modal');

  try {
    const response = await fetch(`/api/locations/${locationName}/content`);
    if (!response.ok) throw new Error('Failed to load location contents');

    const data = await response.json();
    const contents = data.data?.products || [];

    const tbody = document.getElementById('lc-modal-table-body');
    if (!tbody) return;

    const locationNameEl = document.getElementById('lc-modal-location-name');
    const locationDescEl = document.getElementById('lc-modal-location-desc');

    if (locationNameEl && data.data?.location) {
      locationNameEl.textContent = data.data.location.name;
    }
    if (locationDescEl && data.data?.location) {
      locationDescEl.textContent = data.data.location.description || '-';
    }

    const rows = contents.map(item => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3">${item.sku || '-'}</td>
        <td class="px-4 py-3">${item.name || item.productName || '-'}</td>
        <td class="px-4 py-3">${item.type || '-'}</td>
        <td class="px-4 py-3">${item.model || '-'}</td>
        <td class="px-4 py-3">
          <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition"
                  onclick="__modules.locations.unassignLocation('${locationName}', '${item.id}')">Remove</button>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="5" class="px-4 py-3 text-center text-gray-500">No products in this location</td></tr>';
  } catch (error) {
    console.error('Error loading location contents:', error);
    mutations.SHOW_NOTIFICATION('Failed to load location contents', 'error');
  }
}

export async function unassignLocation(locationName, productId) {
  if (!confirm(`Remove this product from location?`)) return;

  try {
    const response = await fetch(`/api/locations/${locationName}/products/${productId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to unassign product');

    mutations.SHOW_NOTIFICATION('Product removed successfully', 'success');
    await openLocationContentModal(locationName);
  } catch (error) {
    console.error('Error removing product:', error);
    mutations.SHOW_NOTIFICATION('Failed to remove product', 'error');
  }
}

export async function openProductLocationsModal(productId, sku, name) {
  mutations.OPEN_MODAL('productLocationsModal');

  try {
    const response = await fetch(`/api/products/${productId}/locations`);
    const locations = await response.json();

    const container = document.getElementById('product-locations-container');
    if (!container) return;

    const html = locations.map(loc => `
      <div class="border p-3 rounded flex justify-between items-center">
        <div class="font-bold">${loc.name}</div>
        <div class="text-sm text-gray-600">${loc.quantity} units</div>
      </div>
    `).join('');

    container.innerHTML = html || '<p class="text-gray-500">No locations assigned</p>';
  } catch (error) {
    console.error('Error loading product locations:', error);
  }
}

export function openQRCodeModal(locationName) {
  openModal('location-qrcode-modal');

  const qrNameEl = document.getElementById('qr-modal-location-name');
  if (qrNameEl) {
    qrNameEl.textContent = locationName;
  }

  const qrcodeContainer = document.getElementById('qrcode-container');
  if (qrcodeContainer) {
    qrcodeContainer.innerHTML = '';
    new QRCode(qrcodeContainer, {
      text: `${window.location.origin}/locations.html?search=${encodeURIComponent(locationName)}`,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}
