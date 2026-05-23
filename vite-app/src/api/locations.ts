// src/api/locations.ts
import { api } from './client';
import type { Location } from '../types';

export async function listLocations(): Promise<Location[]> {
  const res = await api.get<Location[]>('/api/locations');
  return res.data;
}

export async function createLocation(input: { tag: string; location_name: string }) {
  const res = await api.post<Location>('/api/locations', input);
  return res.data;
}

export interface LocationContent {
  location_tag: string;
  products: Array<{
    product_id: number;
    sku: string;
    name: string;
    quantity: number;
  }>;
}

export async function getLocationContent(tag: string): Promise<LocationContent> {
  const res = await api.get<LocationContent>(`/api/locations/${encodeURIComponent(tag)}/content`);
  return res.data;
}
