# Phase 4 — Microsoft SSO（Azure AD OIDC）

## 狀態：⏸ 暫緩（等待 Azure AD 憑證）

## 目標

讓系統管理員可以將登入方式切換為 Microsoft Azure AD，
使用者以公司帳號（Microsoft 帳號）登入，無需維護本地密碼。

## 需要的 Azure 資訊

- Tenant ID
- Client ID（App Registration）
- Client Secret

## 待完成任務

### 後端

- [ ] `MicrosoftProvider` 實作 `AuthProvider` 介面
- [ ] `GET /api/auth/microsoft/redirect` — 導向 Microsoft 授權頁
- [ ] `GET /api/auth/microsoft/callback` — 處理授權碼，交換 token，建立/查找本地 user 記錄
- [ ] 新使用者自動建立（provider='microsoft'，role 預設 'view'）
- [ ] `AUTH_PROVIDER=microsoft` env 切換

### 前端

- [ ] 登入頁已完成（偵測到 microsoft 時顯示「Sign in with Microsoft」按鈕）
- [ ] 按鈕 redirect 到 `/api/auth/microsoft/redirect`（已完成）

### 測試

- [ ] `tests/microsoftAuth.test.js` — mock Microsoft OAuth 回調

## 關鍵設計決策

- 切換 provider 後，舊的 local 帳號全部失效（不混用）
- Microsoft 使用者的 `password_hash` 為 null
- 首次從 Microsoft 登入的使用者，role 預設 'view'，需要 admin 手動升級
