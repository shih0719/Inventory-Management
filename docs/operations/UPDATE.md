# 版本更新系統

## 概述

系統提供半自動化的版本更新機制。應用會定期檢查 GitHub 上是否有新版本，用戶可以通過 Web UI 手動觸發更新。版本號使用語義化版本（Semantic Versioning）管理。

## 架構

### 版本管理位置
- **模組**：`src/services/updateService.js`
- **路由**：`src/routes/updates.js`
- **Web UI**：`public/updates.html`
- **版本源**：`package.json` 的 `version` 字段
- **遠端源**：GitHub `origin/main` 上的 `package.json`

### 版本控制策略

| 項目 | 說明 |
|------|------|
| **版本格式** | 語義化版本 (semver) —— `主.次.補` |
| **例子** | `1.0.0`, `1.1.0`, `2.0.0` |
| **檢查方式** | 手動觸發（無自動檢查） |
| **更新方式** | 一鍵式（點擊按鈕自動執行） |
| **版本比較** | 使用 semver 規則 |

## 版本號說明

### 語義化版本規則

```
版本格式：MAJOR.MINOR.PATCH

MAJOR (主版本) — 不兼容的 API 變更
  例：1.0.0 → 2.0.0（新功能或大改動）

MINOR (次版本) — 向後兼容的功能新增
  例：1.0.0 → 1.1.0（新功能但舊功能還能用）

PATCH (補丁版本) — 向後兼容的 bug 修復
  例：1.0.0 → 1.0.1（bug 修復）
```

### 版本比較示例

```
1.0.0 < 1.0.1 < 1.1.0 < 2.0.0
 ├─ 補丁更新  ├─ 次要更新  ├─ 主要更新
 └─ 最小風險  └─ 中等風險  └─ 最大風險
```

## 工作原理

### 1. 版本檢查流程

```
用戶訪問 /updates.html
         ↓
加載當前版本（從 package.json）
         ↓
點擊「檢查更新」按鈕
         ↓
API: POST /api/updates/check
         ↓
git fetch origin 拉取遠端最新
         ↓
讀取遠端 package.json 版本
         ↓
比較版本號
         ↓
返回結果
  ├─ 有新版本 → 啟用「應用更新」按鈕
  └─ 已是最新 → 顯示「✓ 已是最新」
```

### 2. 版本比較機制

#### compareVersions() 函數

```javascript
function compareVersions(local, remote) {
  const localParts = local.split('.').map(Number);  // [1, 0, 0]
  const remoteParts = remote.split('.').map(Number); // [1, 1, 0]

  for (let i = 0; i < Math.max(...); i++) {
    const l = localParts[i] || 0;
    const r = remoteParts[i] || 0;

    if (l < r) return -1;  // local < remote (有新版本)
    if (l > r) return 1;   // local > remote (本地較新)
  }
  return 0;  // 版本相同
}
```

#### 比較示例

```javascript
compareVersions('1.0.0', '1.1.0')  // -1 → 有新版本
compareVersions('1.1.0', '1.0.0')  // 1  → 本地較新
compareVersions('1.0.0', '1.0.0')  // 0  → 版本相同
```

### 3. 更新流程

```
用戶點擊「應用更新」
         ↓
確認對話框
         ↓
API: POST /api/updates/apply
         ↓
git fetch origin 拉取最新代碼
git reset --hard origin/main 強制同步
npm install --production 安裝新依賴
         ↓
process.exit(0) 應用退出
         ↓
Docker 檢測到退出，自動重啟容器
         ↓
容器啟動時運行 npm start
應用加載新代碼 → 啟動備份服務 → 運行成功
         ↓
應用版本更新完成，用戶見到新版本號
```

## 代碼詳解

### updateService.js 核心函數

#### `readLocalVersion()`

```javascript
readLocalVersion() {
  try {
    const packagePath = path.join(__dirname, '../../package.json');
    if (!fs.existsSync(packagePath)) {
      console.error('[UPDATE] package.json not found');
      return '0.0.0';
    }
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log('[UPDATE] Local version loaded:', packageJson.version);
    return packageJson.version;
  } catch (error) {
    console.error('[UPDATE] Error reading version:', error.message);
    return '0.0.0';
  }
}
```

#### `readRemoteVersion()`

```javascript
async readRemoteVersion() {
  try {
    // 使用 git show 讀取遠端 package.json
    const { stdout } = await execAsync('git show origin/main:package.json');
    const remotePackage = JSON.parse(stdout);
    return remotePackage.version;
  } catch (error) {
    throw new Error('無法讀取遠端版本：' + error.message);
  }
}
```

#### `checkRemoteVersion()`

```javascript
async checkRemoteVersion() {
  try {
    // 1. 獲取遠端最新信息
    await execAsync('git fetch origin --quiet 2>&1');

    // 2. 讀取遠端版本
    const remoteVersion = await this.readRemoteVersion();

    // 3. 比較版本
    const comparison = this.compareVersions(
      this.currentVersion,
      remoteVersion
    );
    const hasUpdates = comparison < 0;  // 本地 < 遠端

    // 4. 更新狀態
    this.updateStatus = {
      available: hasUpdates,
      remoteVersion,
      currentVersion: this.currentVersion,
      lastCheckTime: new Date(),
      isUpdating: false,
      error: null
    };

    if (hasUpdates) {
      console.log(
        `[UPDATE] 發現新版本：${this.currentVersion} → ${remoteVersion}`
      );
    }

    return this.updateStatus;
  } catch (error) {
    this.updateStatus.error = error.message;
    return this.updateStatus;
  }
}
```

#### `performUpdate()`

```javascript
async performUpdate() {
  if (this.updateStatus.isUpdating) {
    throw new Error('更新正在進行中');
  }

  try {
    this.updateStatus.isUpdating = true;

    // 1. 拉取遠端代碼
    console.log('[UPDATE] 下載新版本代碼...');
    await execAsync('git fetch origin --quiet && git reset --hard origin/main');

    // 2. 安裝依賴
    console.log('[UPDATE] 安裝依賴...');
    await execAsync('npm install --production');

    // 3. 重新讀取版本
    this.currentVersion = this.readLocalVersion();

    console.log(`[UPDATE] 更新完成，當前版本：${this.currentVersion}`);

    // 4. 重啟應用
    process.exit(0);  // Docker 會自動重啟

  } catch (error) {
    this.updateStatus.isUpdating = false;
    this.updateStatus.error = error.message;
    throw error;
  }
}
```

### API 端點詳解

#### GET /api/updates/status

**功能**：獲取當前更新狀態

**請求**：
```bash
curl http://localhost:3030/api/updates/status
```

**回應**：
```json
{
  "currentVersion": "1.0.1",
  "available": false,
  "remoteVersion": null,
  "lastCheckTime": null,
  "isUpdating": false,
  "error": null
}
```

**回應字段說明**：
- `currentVersion` — 當前應用版本
- `available` — 是否有新版本可用
- `remoteVersion` — 遠端版本（未檢查時為 null）
- `lastCheckTime` — 最後檢查時間（ISO 8601 格式）
- `isUpdating` — 是否正在更新中
- `error` — 錯誤信息（如有）

#### POST /api/updates/check

**功能**：手動檢查是否有新版本

**請求**：
```bash
curl -X POST http://localhost:3030/api/updates/check
```

**回應**（有新版本）：
```json
{
  "currentVersion": "1.0.0",
  "available": true,
  "remoteVersion": "1.0.1",
  "lastCheckTime": "2026-05-14T08:15:30.000Z",
  "isUpdating": false,
  "error": null
}
```

**回應**（已是最新）：
```json
{
  "currentVersion": "1.0.1",
  "available": false,
  "remoteVersion": "1.0.1",
  "lastCheckTime": "2026-05-14T08:15:30.000Z",
  "isUpdating": false,
  "error": null
}
```

#### POST /api/updates/apply

**功能**：執行應用更新

**請求**：
```bash
curl -X POST http://localhost:3030/api/updates/apply
```

**回應**：
```json
{
  "message": "更新已開始，應用將自動重啟..."
}
```

**注意**：
- 應用會在 500ms 後開始更新
- 更新期間應用會退出並由 Docker 重啟
- 整個過程通常需要 30-60 秒
- 期間無法訪問應用

## 更新步驟詳解

### 開發者側：發布新版本

#### 1. 修改 package.json 版本

```json
{
  "name": "inventory-management-system",
  "version": "1.0.1"  // 改為新版本號
}
```

#### 2. 提交並推送到 GitHub

```bash
git add package.json
git commit -m "chore: bump version to 1.0.1"
git push origin main
```

#### 3. （可選）在 GitHub 上創建 Release

```bash
gh release create v1.0.1 \
  --title "Version 1.0.1" \
  --notes "Bug fixes and improvements"
```

### 用戶側：應用更新

#### 1. 訪問更新頁面

```
http://your-domain:3030/updates.html
```

或點擊首頁「⚙️ 系統設定」按鈕

#### 2. 檢查版本

```
當前版本: v1.0.0
遠端版本: 尚未檢查
```

#### 3. 點擊「檢查更新」

```
「🔍 檢查更新」按鈕
         ↓
連接 GitHub 檢查遠端版本
         ↓
顯示結果：
  - 有新版本：「📥 應用更新」按鈕啟用
  - 已是最新：「✓ 已是最新」
```

#### 4. 點擊「應用更新」（如有新版本）

```
確認對話框：「確認要更新系統嗎？」
         ↓
用戶選擇「確認」
         ↓
顯示「更新已開始，應用將自動重啟...」
         ↓
應用更新中... 每 2 秒檢查一次
         ↓
應用重啟完成
         ↓
頁面重新加載，顯示新版本號
```

## 故障排查

### 問題 1: 「版本檢查失敗」錯誤

**症狀**：點擊「檢查更新」時顯示錯誤

**錯誤信息**：`Command failed: git fetch origin --quiet`

**原因分析**：

1. **容器內無法訪問 GitHub**
   ```bash
   # 測試容器網絡
   docker exec inventory-system ping github.com
   ```

2. **Git 認證失敗**
   ```bash
   # 檢查 git 配置
   docker exec inventory-system git config --list
   ```

3. **.git 目錄未掛載**
   ```bash
   # 檢查 .git 是否在容器內
   docker exec inventory-system ls -la .git/
   ```

**解決方案**：

- 檢查防火牆是否允許 HTTPS 訪問 github.com
- 確保 docker-compose.yml 中有掛載 `.git`：
  ```yaml
  volumes:
    - ./.git:/app/.git
  ```
- 重新啟動容器：
  ```bash
  docker-compose restart inventory-system
  ```

### 問題 2: 更新失敗，應用無法重啟

**症狀**：點擊「應用更新」後，應用一直顯示「更新中」

**原因分析**：

1. **npm install 失敗**
   ```bash
   # 檢查日誌
   docker logs inventory-system | tail -50
   ```

2. **代碼有語法錯誤**
   ```bash
   # 在本地測試
   npm install --production
   npm start
   ```

3. **磁盤空間不足**
   ```bash
   # 檢查磁盤
   df -h
   ```

**解決方案**：

- 查看完整日誌找出具體錯誤
- 修復錯誤後重新推送到 GitHub
- 手動重啟容器：
  ```bash
  docker-compose restart inventory-system
  ```

### 問題 3: 版本號顯示不正確

**症狀**：Web UI 顯示 `v-` 或 `vundefined`

**原因分析**：

1. **package.json 讀取失敗**
   ```bash
   # 檢查文件
   cat package.json | grep version
   ```

2. **版本號格式不正確**
   ```json
   // ❌ 錯誤
   "version": "v1.0.0"

   // ✅ 正確
   "version": "1.0.0"
   ```

**解決方案**：

- 確保 package.json 的版本字段格式為 `x.y.z`
- 重新啟動應用：
  ```bash
  docker-compose restart inventory-system
  ```

### 問題 4: 更新後應用無法啟動

**症狀**：更新完成後應用一直重啟失敗

**原因分析**：

1. **新代碼有錯誤**
2. **依賴版本衝突**
3. **數據庫遷移失敗**

**解決方案**：

```bash
# 1. 查看詳細日誌
docker logs -f inventory-system

# 2. 回退到上個版本
git reset --hard HEAD~1
docker-compose down && docker-compose up -d --build

# 3. 修復問題後重新發布
```

## Git 要求

### 必需的 Git 配置

更新系統需要以下 Git 環境：

```bash
# 已配置 origin remote
git remote -v
# origin  https://github.com/your-org/your-repo.git (fetch)
# origin  https://github.com/your-org/your-repo.git (push)

# 有權限訪問倉庫
git fetch origin

# .git 目錄存在
ls -la .git/
```

### Docker 中的 Git

確保 `docker-compose.yml` 中掛載了 `.git`：

```yaml
volumes:
  - ./.git:/app/.git  # Git 目錄
  - ./src:/app/src    # 源代碼
```

## 最佳實踐

### ✅ 應該做的

1. **定期檢查更新**
   - 每週檢查一次
   - 檢查 GitHub Release 日誌

2. **在非工作時間更新**
   - 避免業務時間中斷

3. **備份數據**
   - 更新前確保備份存在
   - 檢查 `database/backups/` 目錄

4. **測試更新**
   - 在開發環境先測試
   - 確認新版本功能正常

5. **記錄更新**
   ```bash
   # 更新前
   git log --oneline -1
   # 更新後
   git log --oneline -1
   ```

### ❌ 不應該做的

1. ❌ 在生產數據庫上進行 git reset
2. ❌ 手動修改 package.json 版本號（應在 GitHub 上改）
3. ❌ 在更新過程中強制重啟應用
4. ❌ 忽視更新失敗的錯誤信息
5. ❌ 跳過備份直接更新

## 版本發布流程（推薦）

### 完整的發布步驟

```bash
# 1. 開發完成，提交代碼
git add .
git commit -m "feat: add new feature"

# 2. 修改 package.json 版本
vim package.json
# version: "1.0.0" → "1.1.0"

# 3. 提交版本變更
git add package.json
git commit -m "chore: bump version to 1.1.0"

# 4. 創建 Git tag（可選但推薦）
git tag v1.1.0

# 5. 推送到 GitHub
git push origin main
git push origin v1.1.0

# 6. 在 GitHub 上創建 Release（可選）
gh release create v1.1.0 --title "Version 1.1.0" --notes "Feature updates"

# 7. 等待用戶更新
# 用戶會在應用中看到新版本提示
```

## 性能考慮

### 版本檢查的開銷

- **網絡請求** — 1 次 git fetch（通常 < 1 秒）
- **磁盤 I/O** — 讀 package.json（< 10ms）
- **CPU** — 版本比較（< 1ms）
- **應用影響** — 無影響（非阻塞操作）

### 更新的開銷

- **git reset** — 可能需要幾秒（取決於文件數量）
- **npm install** — 取決於依賴數量和網速（通常 30-60 秒）
- **應用重啟** — 取決於初始化時間（通常 5-10 秒）
- **總時間** — 通常 30-90 秒

## 相關文件

- `src/services/updateService.js` — 版本檢查和更新邏輯
- `src/routes/updates.js` — 更新 API 端點
- `public/updates.html` — 更新管理 Web UI
- `package.json` — 版本號定義
- `.git/` — Git 倉庫（必需）

## 更新歷史

- **2026-05-14** — 實現版本管理系統，使用 package.json 版本號
