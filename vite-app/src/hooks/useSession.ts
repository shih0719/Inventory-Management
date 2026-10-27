import { useCallback, useEffect, useState } from 'react';
import type { User } from '../types';
import type { ActiveWarehouse } from '../context/ActiveWarehouseContext';
import { getActiveWarehouseId } from '../context/ActiveWarehouseContext';
import { getToken, onTokenChange } from '../api/client';
import { getCurrentUser, logout as apiLogout } from '../api/auth';

const WAREHOUSE_ID_KEY = 'inv.warehouseId';
const WAREHOUSE_NAME_KEY = 'inv.warehouseName';

function loadWarehouse(): ActiveWarehouse | null {
  const id = getActiveWarehouseId();
  try {
    const name = localStorage.getItem(WAREHOUSE_NAME_KEY);
    return id && name ? { id, name } : null;
  } catch {
    return null;
  }
}

function saveWarehouse(wh: ActiveWarehouse | null) {
  try {
    if (wh) {
      localStorage.setItem(WAREHOUSE_ID_KEY, String(wh.id));
      localStorage.setItem(WAREHOUSE_NAME_KEY, wh.name);
    } else {
      localStorage.removeItem(WAREHOUSE_ID_KEY);
      localStorage.removeItem(WAREHOUSE_NAME_KEY);
    }
  } catch {
    /* storage error — ignored */
  }
}

export interface Session {
  currentUser: User | null;
  isAuthenticated: boolean;
  activeWarehouse: ActiveWarehouse | null;
  /** After LoginPage stored the token. */
  login: (user: User) => void;
  logout: () => Promise<void>;
  selectWarehouse: (wh: ActiveWarehouse) => void;
  /** Back to the warehouse selector. */
  leaveWarehouse: () => void;
}

/**
 * Who is signed in and which warehouse they work in. The token is the source of
 * truth: whenever it is cleared — logout, or any 401 from the API client — the
 * session ends and the selected warehouse is forgotten.
 */
export function useSession(): Session {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [activeWarehouse, setActiveWarehouse] = useState<ActiveWarehouse | null>(loadWarehouse);

  useEffect(
    () =>
      onTokenChange((token) => {
        if (token) return;
        setIsAuthenticated(false);
        setCurrentUser(null);
        setActiveWarehouse(null);
        saveWarehouse(null);
      }),
    [],
  );

  // Restore the user on page refresh
  useEffect(() => {
    if (!isAuthenticated || currentUser) return;
    getCurrentUser()
      .then(setCurrentUser)
      .catch((err) => console.error('Failed to get current user:', err));
  }, [isAuthenticated, currentUser]);

  const login = useCallback((user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  const selectWarehouse = useCallback((wh: ActiveWarehouse) => {
    saveWarehouse(wh);
    setActiveWarehouse(wh);
  }, []);

  const leaveWarehouse = useCallback(() => {
    saveWarehouse(null);
    setActiveWarehouse(null);
  }, []);

  return { currentUser, isAuthenticated, activeWarehouse, login, logout, selectWarehouse, leaveWarehouse };
}
