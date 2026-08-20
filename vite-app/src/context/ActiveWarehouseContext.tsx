export interface ActiveWarehouse {
  id: number;
  name: string;
}

export function getActiveWarehouseId(): number | null {
  try {
    const id = localStorage.getItem('inv.warehouseId');
    return id ? parseInt(id, 10) : null;
  } catch {
    return null;
  }
}
