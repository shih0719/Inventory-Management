// src/api/locations.ts
import { api } from './client';
import type { Location } from '../types';

export async function listLocations(): Promise<Location[]> {
  const res = await api.get<Location[]>('/api/locations');
  return res.data;
}

export async function createLocation(input: { name: string; description: string }) {
  const res = await api.post<Location>('/api/locations', input);
  return res.data;
}

export interface LocationContent {
  location: Location;
  products: Array<{
    id: number;
    sku: string;
    name: string;
    type: 'normal' | 'ap';
    model: string;
    accountable_quantity: number;
    non_accountable_quantity: number;
    min_stock: number;
    is_deleted: number;
    created_at?: string;
    updated_at?: string;
  }>;
}

export async function getLocationContent(name: string): Promise<LocationContent> {
  const res = await api.get<LocationContent>(`/api/locations/${encodeURIComponent(name)}/content`);
  return res.data;
}

export async function removeProductFromLocation(name: string, productId: number) {
  const res = await api.del(`/api/locations/${encodeURIComponent(name)}/products/${productId}`);
  return res.data;
}

export async function assignProductToLocation(name: string, productId: number) {
  const res = await api.post(`/api/locations/${encodeURIComponent(name)}/products`, { product_id: productId });
  return res.data;
}

export async function deleteLocation(name: string) {
  const res = await api.del(`/api/locations/${encodeURIComponent(name)}`);
  return res.data;
}
