import { api, localizeErrorList } from './client';
import type { ProductUnit, SerialLookup } from '../types';

export async function listProductUnits(productId: number, status?: string): Promise<ProductUnit[]> {
  const res = await api.get<ProductUnit[]>('/api/product-units', {
    product_id: productId,
    limit: 1000,
    ...(status && { status }),
  });
  return res.data;
}

/**
 * The units belong to the product's warehouse, which must be the current one.
 * Partial success resolves; `errors` are the failed serials as text in the UI language.
 */
export async function bulkCreateUnits(
  productId: number,
  serialNumbers: string[],
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const res = await api.post<{ inserted: number; failed: number; errors: unknown[] }>(
    '/api/product-units/bulk',
    { product_id: productId, serial_numbers: serialNumbers },
  );
  return { ...res.data, errors: localizeErrorList(res.data.errors) as string[] };
}

export async function transferUnits(
  serialNumbers: string[],
  targetWarehouseId: number,
): Promise<{ transferred: number }> {
  const res = await api.post<{ transferred: number }>('/api/product-units/transfer', {
    serial_numbers: serialNumbers,
    target_warehouse_id: targetWarehouseId,
  });
  return res.data;
}

/** Exact serial lookup in the current warehouse. Throws ApiError(404) when not found. */
export async function lookupSerial(serial: string): Promise<SerialLookup> {
  const res = await api.get<SerialLookup>(`/api/product-units/lookup/${encodeURIComponent(serial.trim())}`);
  return res.data;
}
