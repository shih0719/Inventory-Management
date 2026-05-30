# MVP: Add User Login + Audit Trail

> ⚠️ **此文件為規劃紀錄，已於 2026-05-30 實作完成。** 見 `docs/adr/0001-auth-provider-abstraction.md` 了解最終設計決策。

## Overview
Add simple user authentication and track who performed inventory operations (入庫/出庫).

## Scope (MVP)

### Phase 1: User Authentication
- User login endpoint (`/api/auth/login`)
- JWT token generation & validation
- Auth middleware validates token on protected endpoints
- User table in DB

### Phase 2: Audit Trail
- Add `created_by` column to: transactions, batches, shipments
- Capture `user_id` on every `POST` operation (新建操作)
- Audit log table: `id, user_id, action, resource_type, resource_id, timestamp`
- New endpoint: `GET /api/audit-logs` (view who did what, when)

## Implementation Steps

1. **DB Schema**
   - Create `users` table (id, username, password_hash, created_at)
   - Add `created_by` to transactions, batches, shipments tables
   - Create `audit_logs` table (id, user_id, action, resource_type, resource_id, timestamp)

2. **Auth Service** (new)
   - Login endpoint: verify username/password, return JWT
   - JWT middleware: validate token, attach `user_id` to request
   - No logout needed (stateless JWT)

3. **Audit Middleware**
   - Capture `user_id` on `POST/PUT/DELETE`
   - Write to audit_logs table
   - Attach `created_by` on mutations

4. **API Changes**
   - Add `Authorization: Bearer <token>` header requirement to protected endpoints
   - New endpoint: `GET /api/audit-logs?resource=transactions&limit=50`
   - Response includes username in transaction/batch/shipment queries

5. **Tests**
   - Auth: login returns JWT, token validation works
   - Audit: operations logged correctly with user_id

## Files to Create/Modify

**New:**
- `src/middleware/auth.ts` — JWT validation
- `src/middleware/audit.ts` — Audit logging
- `src/services/auth.ts` — Login logic
- `src/controllers/auth.ts` — Login endpoint
- `src/controllers/audit.ts` — Audit query endpoint
- `migrations/001_add_auth_tables.sql`
- `migrations/002_add_created_by_columns.sql`

**Modify:**
- Transaction/Batch/Shipment controllers: add `created_by` on POST
- `src/middleware/index.ts` — register auth/audit
- `docs/api.md` — add auth requirement, new endpoints

## Acceptance Criteria

- [ ] User can login with username/password, receive JWT
- [ ] JWT required on protected endpoints, 401 on missing/invalid
- [ ] All transactions/batches/shipments capture `created_by`
- [ ] Audit log records who did what, when
- [ ] `GET /api/audit-logs` returns change history
- [ ] Tests pass
- [ ] API docs updated

## Estimated Effort

- DB schema & migrations: 1h
- Auth service & endpoint: 1.5h
- Auth middleware: 1h
- Audit middleware & endpoint: 1.5h
- Controller updates: 1h
- Tests: 1h
- Docs: 0.5h
- **Total: ~7h**

## Strictly Out of Scope (DO NOT ADD)

**Authentication:**
- User registration endpoint
- Password reset / forgot password
- 2FA, OAuth, LDAP
- Session management (JWT is stateless)
- Token refresh logic

**Authorization & Filtering:**
- Role-based access control (RBAC)
- Permission checks
- User-level data filtering (all users see all data)
- Warehouse/department restrictions
- Record-level visibility rules

**Additional Tracking:**
- Who updated/deleted records (`updated_by`)
- Change history diffs (before/after values)
- Audit UI/dashboard
- Soft delete tracking
- Query audit logs

**User Management:**
- User profile pages
- User list/admin endpoints
- Activity dashboards
- User status (active/inactive)

**API Enhancements:**
- Pagination for audit logs beyond `limit/offset`
- Filter audit by date range (initial scope: all logs)
- Export audit logs to CSV
- Real-time websocket updates
- Notification system

**Testing:**
- Integration tests beyond basic auth
- Load/stress tests
- E2E UI tests

**Documentation:**
- Deployment guides
- Architecture diagrams
- User manual / onboarding docs
