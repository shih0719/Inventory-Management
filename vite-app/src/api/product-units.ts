import { api } from './client';
import type { ProductUnit } from '../types';

export async function listProductUnits(productId: number, status?: string): Promise<ProductUnit[]> {
  const res = await api.get<ProductUnit[]>('/api/product-units', {
    product_id: productId,
    limit: 1000,
    ...(status && { status }),
  });
  return res.data;
}

export async function bulkCreateUnits(
  productId: number,
  serialNumbers: string[],
): Promise<{ inserted: number; failed: number; errors: unknown[]; message: string }> {
  const res = await api.post<{ inserted: number; failed: number; errors: unknown[]; message: string }>(
    '/api/product-units/bulk',
    {
      product_id: productId,
      serial_numbers: serialNumbers,
    },
  );
  return res.data;
}

export async function bulkSellUnits(
  serialNumbers: string[],
  projectCase: string,
  soldTo?: string,
): Promise<{ sold: number; transactions_created: number; message: string }> {
  const res = await api.post<{ sold: number; transactions_created: number; message: string }>(
    '/api/product-units/bulk-sell',
    {
      serial_numbers: serialNumbers,
      project_case: projectCase,
      ...(soldTo && { sold_to: soldTo }),
    },
  );
  return res.data;
}
