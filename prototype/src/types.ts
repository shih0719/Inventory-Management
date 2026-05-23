// 产品类型
export interface Product {
  id: number;
  sku: string;
  name: string;
  type: 'normal' | 'ap';
  model: string;
  accountable_quantity: number;
  non_accountable_quantity: number;
  min_stock: number;
  ap_in_stock_count: number;
}

// 库存异动类型
export interface Transaction {
  id: number;
  product_id: number;
  sku: string;
  quantity_change: number;
  quantity_type: 'accountable' | 'non_accountable';
  tag_id: number;
  tag_name: string;
  location_tag: string | null;
  remarks: string;
  created_at: string;
  batch_name?: string;
}

// 标签类型
export interface Tag {
  id: number;
  name: string;
  description: string;
  descriptionEn: string;
}

// 位置类型
export interface Location {
  id: number;
  tag: string;
  location_name: string;
}

// 批次项目
export interface BatchItem {
  product_id: number;
  quantity_change: number;
  quantity_type: 'accountable' | 'non_accountable';
  tag_id: number;
  location_tag?: string;
  remarks?: string;
}

// 批次请求
export interface BatchRequest {
  name: string;
  items: BatchItem[];
  tagId: number;
  locationTag?: string;
}

// Toast 通知
export interface ToastMessage {
  id: number;
  text: string;
  kind?: 'info' | 'alert';
  duration?: number;
  onUndo?: () => void;
}

// 国际化类型
export type Language = 'en' | 'zh';

export interface I18nStrings {
  appName: string;
  search: string;
  inbound: string;
  outbound: string;
  [key: string]: string;
}
