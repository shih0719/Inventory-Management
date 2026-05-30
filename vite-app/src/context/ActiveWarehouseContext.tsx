import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ActiveWarehouse {
  id: number;
  name: string;
}

interface ActiveWarehouseContextValue {
  activeWarehouse: ActiveWarehouse | null;
  setActiveWarehouse: (wh: ActiveWarehouse | null) => void;
  clearWarehouse: () => void;
}

const ActiveWarehouseContext = createContext<ActiveWarehouseContextValue | null>(null);

export function ActiveWarehouseProvider({ children }: { children: ReactNode }) {
  const [activeWarehouse, setActiveWarehouseState] = useState<ActiveWarehouse | null>(null);

  const setActiveWarehouse = useCallback((wh: ActiveWarehouse | null) => {
    setActiveWarehouseState(wh);
    if (wh) {
      localStorage.setItem('inv.warehouseId', String(wh.id));
      localStorage.setItem('inv.warehouseName', wh.name);
    } else {
      localStorage.removeItem('inv.warehouseId');
      localStorage.removeItem('inv.warehouseName');
    }
  }, []);

  const clearWarehouse = useCallback(() => {
    setActiveWarehouseState(null);
    localStorage.removeItem('inv.warehouseId');
    localStorage.removeItem('inv.warehouseName');
  }, []);

  return (
    <ActiveWarehouseContext.Provider value={{ activeWarehouse, setActiveWarehouse, clearWarehouse }}>
      {children}
    </ActiveWarehouseContext.Provider>
  );
}

export function useActiveWarehouse() {
  const ctx = useContext(ActiveWarehouseContext);
  if (!ctx) throw new Error('useActiveWarehouse must be used within ActiveWarehouseProvider');
  return ctx;
}

export function getActiveWarehouseId(): number | null {
  try {
    const id = localStorage.getItem('inv.warehouseId');
    return id ? parseInt(id, 10) : null;
  } catch {
    return null;
  }
}
