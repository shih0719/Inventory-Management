# ADR 0001 — Auth Provider 抽象層 + Role/Warehouse 存取控制

**日期**：2026-05-30  
**狀態**：已採納

## 背景

原系統只有 local 帳號密碼登入，無 role 區分，產品 API 部分為公開存取。需求升級為：
- 支援 SSO（Microsoft Azure AD）與 local 登入並存，由管理員擇一
- 使用者分三種 role（admin / manager / view）
- 使用者可存取複數倉庫（第一階段只做存取控制，產品不綁倉庫）

## 決策

### 1. Provider 是系統層級設定，不是使用者層級選擇

管理員在後台選一個 provider，全員走同一條路。切換 provider 時舊帳號直接失效（不做過渡期相容）。

**理由**：使用者少的倉庫系統，切換通知成本低；向後相容邏輯複雜度不值得。

### 2. `AuthProvider` interface 抽象化

```
AuthProvider (interface)
├── LocalProvider   → username/password → bcrypt
└── MicrosoftProvider → Azure AD OIDC
```

所有 provider 輸出統一的 User 物件，後續 JWT 簽發邏輯不感知 provider 類型。

### 3. SSO 使用者第一次登入自動建立帳號

Local 使用者由 admin 手動建立。SSO 使用者首次登入後自動建立，初始無 role / 無倉庫，需 admin 事後設定。

**理由**：SSO 情境下 admin 無法預知所有 Microsoft 帳號，自動建立比預先手工維護更省力。

### 4. JWT payload 新增 role 和 warehouses

```json
{ "id": 1, "username": "eric", "role": "manager", "warehouses": [1, 2] }
```

**理由**：避免每次 API 請求都查資料庫做授權判斷。warehouses 數量少（典型倉庫系統 < 20），放進 token 不造成 size 問題。

### 5. 三層 middleware

- `verifyAuth` — token 驗証 + 掛載 req.user
- `requireRole(roles)` — role 檢查
- `requireWarehouse` — 倉庫存取檢查（第二階段）

### 6. 所有 API 端點改為需要登入

原本 `GET /api/products` 為公開存取，改為需要 `verifyAuth`。公開庫存查詢需求由部署層（IP 白名單）或另行設計的 read-only token 處理。

## 替代方案（已排除）

- **Per-user provider 選擇**：同一系統支援多 provider 並存 → 複雜度高，這個系統規模不需要
- **Role per warehouse**（每個倉庫獨立 role）→ 過度複雜；系統層級 role + 倉庫存取清單已足夠
- **RBAC 細粒度 permission**（permission 表）→ 三個 role 語意固定，不需要動態 permission

## 影響

- `users` 表新增 `role`、`provider`、`email` 欄位
- 新增 `warehouses` 表與 `user_warehouses` join 表
- `authMiddleware.js` 新增 `requireRole`
- 所有 routes 補上適當的 middleware
- 新增 `/api/warehouses` 和 `/api/users` 管理端點（admin only）
