import { state } from '../state.js';
import { mutations } from '../mutations.js';

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
  const container = document.getElementById('locations-table-container');
  if (!container) return;

  const items = state.locations.items;
  if (items.length === 0) {
    container.innerHTML = '<p class="p-4 text-center text-gray-500">No locations found</p>';
    return;
  }

  const rows = items.map(location => `
    <tr class="border-b hover:bg-gray-50">
      <td class="px-4 py-2">${location.name}</td>
      <td class="px-4 py-2">${location.description || '-'}</td>
      <td class="px-4 py-2 space-x-2">
        <button class="px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                onclick="__modules.locations.openLocationContentModal('${location.id}')">View</button>
        <button class="px-2 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                onclick="__modules.locations.openQRCodeModal('${location.id}')">QR Code</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="w-full border-collapse border">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-4 py-2 text-left">Name</th>
          <th class="px-4 py-2 text-left">Description</th>
          <th class="px-4 py-2 text-left">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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
  } catch (error) {
    console.error('Error creating location:', error);
    mutations.SHOW_NOTIFICATION('Failed to create location', 'error');
  }
}

export async function openLocationContentModal(locationId) {
  mutations.OPEN_MODAL('locationContentModal');

  try {
    const response = await fetch(`/api/locations/${locationId}/contents`);
    const contents = await response.json();

    const container = document.getElementById('location-contents-container');
    if (!container) return;

    const rows = contents.map(item => `
      <tr class="border-b">
        <td class="px-4 py-2">${item.sku}</td>
        <td class="px-4 py-2">${item.productName}</td>
        <td class="px-4 py-2 text-right">${item.quantity}</td>
        <td class="px-4 py-2">
          <button class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  onclick="__modules.locations.unassignLocation('${item.locationName}', '${item.productId}', '${item.sku}')">Remove</button>
        </td>
      </tr>
    `).join('');

    container.innerHTML = `
      <table class="w-full border-collapse border">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-4 py-2 text-left">SKU</th>
            <th class="px-4 py-2 text-left">Product</th>
            <th class="px-4 py-2 text-right">Quantity</th>
            <th class="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error loading location contents:', error);
    mutations.SHOW_NOTIFICATION('Failed to load location contents', 'error');
  }
}

export async function unassignLocation(locationName, productId, sku) {
  if (!confirm(`Unassign product from ${locationName}?`)) return;

  try {
    const response = await fetch('/api/location-assignments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationName, productId })
    });

    if (!response.ok) throw new Error('Failed to unassign location');

    mutations.SHOW_NOTIFICATION('Product unassigned successfully', 'success');
    await openLocationContentModal(productId);
  } catch (error) {
    console.error('Error unassigning location:', error);
    mutations.SHOW_NOTIFICATION('Failed to unassign location', 'error');
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

export function openQRCodeModal(locationId) {
  mutations.OPEN_MODAL('locationQrcodeModal');
  // Generate or fetch QR code for location
}
