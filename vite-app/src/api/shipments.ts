// src/api/shipments.ts
import { api } from './client';
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

/** Soft delete a shipment (transactions are unbound). */
export async function deleteShipment(id: number) {
  await api.del(`/api/shipments/${id}`);
}
