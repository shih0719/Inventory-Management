// src/api/shipments.ts
import { api } from './client';
import type { Shipment, CreateShipmentInput, UpdateShipmentInput } from '../types';

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

/** Fetch all shipments (paginated). */
export async function listAllShipments(): Promise<Shipment[]> {
  const limit = 100;
  let offset = 0;
  const all: Shipment[] = [];

  while (true) {
    const res = await listShipments({ limit, offset });
    if (!res.data || res.data.length === 0) break;
    all.push(...res.data);
    if (res.data.length < limit) break;
    offset += limit;
  }

  return all;
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

/** Update a shipment (can replace transactions and business fields). */
export async function updateShipment(id: number, patch: UpdateShipmentInput) {
  const res = await api.put<Shipment>(`/api/shipments/${id}`, patch);
  return res.data;
}

/** Soft delete a shipment (transactions are unbound). */
export async function deleteShipment(id: number) {
  await api.del(`/api/shipments/${id}`);
}
