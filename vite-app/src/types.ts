// ---- Core domain types (matches the backend API shape) ---------------------

export type ProductType = 'normal' | 'ap';

export interface Product {
  id: number;
  sku: string;
  name: string;
  type: ProductType;
  model: string;
  accountable_quantity: number;
  non_accountable_quantity: number;
  min_stock: number;
  track_serial?: boolean;
  /** Only present on list responses for AP products. Defaults to 0 if missing. */
  ap_in_stock_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type QuantityType = 'accountable' | 'non_accountable';

export interface Transaction {
  id: number;
  product_id: number;
  sku: string;
  quantity_change: number;
  quantity_type: QuantityType;
  tag_id: number;
  tag_name: string;
  /** API field — integer id (preferred for writes). */
  location_id?: number | null;
  /** Display-friendly location tag string ("A-01"); resolved client-side when only id is returned. */
  location_tag?: string | null;
  remarks: string;
  created_at: string;
  batch_name?: string;
}

export interface Tag {
  id: number;
  name: string;
  description: string;
}

export interface Location {
  id: number;
  name: string;
  description: string;
  created_at?: string;
}

export interface Batch {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_count?: number;
  transactions?: Transaction[];
  created_at: string;
}

export type ProductUnitStatus = 'in_stock' | 'sold' | 'returned';

export interface ProductUnit {
  id: number;
  product_id: number;
  serial_number: string;
  status: ProductUnitStatus;
  sold_to?: string | null;
  project_case?: string | null;
  created_at: string;
}

// ---- API envelope + pagination ---------------------------------------------

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiOk<T> {
  success: true;
  data: T;
  pagination?: Pagination;
  message?: string;
}

export interface ApiErr {
  success: false;
  error?: string;
  message?: string;
  data?: unknown;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ---- Request bodies --------------------------------------------------------

export interface CreateTransactionInput {
  product_id: number;
  quantity_change: number;
  quantity_type: QuantityType;
  tag_id: number;
  location_id?: number | null;
  remarks?: string;
}

export interface CreateBatchItem {
  product_id: number;
  quantity_change: number;
  quantity_type: QuantityType;
  location_id?: number | null;
  remarks?: string;
}

export interface CreateBatchInput {
  name: string;
  tag_id: number;
  description?: string;
  items: CreateBatchItem[];
}

export interface CreateBatchResult {
  batch_id: number;
  batch_number: string;
  processed_items: Array<{
    product_id: number;
    product_name: string;
    quantity_type: QuantityType;
    quantity_change: number;
  }>;
}
