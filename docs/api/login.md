# 登入 API 說明

## 概述

使用 JWT Bearer Token 進行認証。所有API（除了登入和公開端點）都需要在 HTTP Header 中提供有效的 token。

**Base URL:** `http://localhost:3030`

---

## 登入流程

### 1. 登入 (取得 Token)

**Endpoint:** `POST /api/auth/login`

**請求：**
```bash
curl -X POST http://localhost:3030/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "eric",
    "password": "password"
  }'
```

**響應 (200)：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "eric",
      "created_at": "2026-05-28T00:00:00Z"
    }
  }
}
```

**錯誤 (401)：**
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

---

### 2. 使用 Token 進行認証請求

取得 token 後，在所有認証 API 請求的 Header 中加入：

```bash
Authorization: Bearer <token>
```

**例子：**
```bash
curl -X GET http://localhost:3030/api/products \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 3. 獲取當前用户信息

**Endpoint:** `GET /api/auth/me`

**請求：**
```bash
curl -X GET http://localhost:3030/api/auth/me \
  -H "Authorization: Bearer <token>"
```

**響應 (200)：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "eric"
  }
}
```

---

### 4. 修改密碼

**Endpoint:** `POST /api/auth/change-password`

**請求：**
```bash
curl -X POST http://localhost:3030/api/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "old_password",
    "new_password": "new_password"
  }'
```

**響應 (200)：**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 5. 登出

**Endpoint:** `POST /api/auth/logout`

**請求：**
```bash
curl -X POST http://localhost:3030/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

**響應 (200)：**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

> 注：系統採用無狀態認証，登出後只需删除本地存儲的 token 即可。

---

## Token 存儲

前端應將 token 存儲在 **localStorage**：

```javascript
// 登入成功後
localStorage.setItem('inv.token', response.data.token);

// 發送請求時
const token = localStorage.getItem('inv.token');
const response = await fetch('/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 登出後
localStorage.removeItem('inv.token');
```

---

## 公開端點（不需要認証）

以下端點可以無需 token 直接訪問：

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/auth/login` | POST | 登入 |
| `/api/products` | GET | 查詢所有商品 |
| `/api/products/:id` | GET | 查詢單個商品 |
| `/inventory/` | GET | 公開庫存查看頁面 |

---

## Token 過期

如果 token 過期或無效，API 會返回：

**401 Unauthorized：**
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or expired token"
}
```

此時需要重新登入以取得新的 token。

---

## 安全建議

1. **HTTPS 傳輸**：生產環境務必使用 HTTPS，保護 token 傳輸安全
2. **Token 有效期**：考慮實現 token 過期機制
3. **Refresh Token**：可選實現 refresh token 以支援長期登入
4. **CORS**：生產環境應設置適當的 CORS 策略
