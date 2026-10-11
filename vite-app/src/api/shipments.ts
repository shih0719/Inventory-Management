// src/api/shipments.ts
import { api, fetchWithAuth } from './client';
import type { Shipment, CreateShipmentInput } from '../types';

export interface ListShipmentsParams {
  limit?: number;
  offset?: number;
}

/** Fetch shipments list with pagination. */
export async function listShipments(params: ListShipmentsParams = {}) {
  return api.get<Shipment[]>('/api/shipments', {
    limit: 50,
    offset: 0,
    ...params,
  });
}

/** Fetch a single shipment with full transaction details. */
export async function getShipment(id: number) {
  const res = await api.get<Shipment>(`/api/shipments/${id}`);
  return res.data;
}

/** Create a new shipment and bind transactions. */
export async function createShipment(input: CreateShipmentInput) {
  const res = await api.post<Shipment>('/api/shipments', input);
  return res.data;
}

/** Download one shipment as .xlsx (sheets: 出貨明細, 序號表). */
export async function exportShipmentXlsx(id: number, shipmentNumber: string): Promise<void> {
  const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const res = await fetchWithAuth(`${BASE}/api/shipments/${id}/export`);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      message = json.error || json.message || message;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = `${shipmentNumber}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(objUrl);
    a.remove();
  }, 100);
}

/** Soft delete a shipment (transactions are unbound). */
export async function deleteShipment(id: number) {
  await api.del(`/api/shipments/${id}`);
}
