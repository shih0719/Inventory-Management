// src/lib/routes.ts — the URL is the source of truth for which page is shown.

export type View =
  | { kind: 'dashboard' }
  | { kind: 'batch'; batchKind: 'inbound' | 'outbound' }
  | { kind: 'ap-products' }
  | { kind: 'edit-products' }
  | { kind: 'shipments' }
  | { kind: 'transactions' }
  | { kind: 'audit-logs' }
  | { kind: 'reports' }
  | { kind: 'warehouses' }
  | { kind: 'users' }
  | { kind: 'backup-settings' }
  | { kind: 'manual' };

const PATHS: Record<Exclude<View['kind'], 'batch'>, string> = {
  dashboard: '/',
  'ap-products': '/ap-products',
  'edit-products': '/products',
  shipments: '/shipments',
  transactions: '/transactions',
  'audit-logs': '/audit-logs',
  reports: '/reports',
  warehouses: '/warehouses',
  users: '/users',
  'backup-settings': '/backup-settings',
  manual: '/manual',
};

export function pathForView(view: View): string {
  return view.kind === 'batch' ? `/${view.batchKind}` : PATHS[view.kind];
}

/** Returns null for paths that match no page. */
export function viewFromPath(pathname: string): View | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/inbound' || path === '/outbound') {
    return { kind: 'batch', batchKind: path === '/inbound' ? 'inbound' : 'outbound' };
  }
  const kind = (Object.keys(PATHS) as (keyof typeof PATHS)[]).find((k) => PATHS[k] === path);
  return kind ? { kind } : null;
}
