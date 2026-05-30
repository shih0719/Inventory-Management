import { api } from './client';

export interface InventoryProduct {
  sku: string;
  name: string;
  type: string;
  model: string;
  accountable_quantity: number;
  non_accountable_quantity: number;
  min_stock: number;
}

export interface InventoryReportData {
  products: InventoryProduct[];
  summary: {
    total: number;
    low_stock_count: number;
    low_stock_items: InventoryProduct[];
  };
}

export async function getInventoryReport(): Promise<InventoryReportData> {
  const { data } = await api.get<InventoryReportData>('/api/reports/inventory');
  return data;
}
