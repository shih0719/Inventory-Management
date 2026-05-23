# Inventory Management System - Prototype

现代 React + TypeScript 库存管理系统原型。

## 🚀 快速开始

### 1. 安装依赖
```bash
cd prototype
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```
访问 http://localhost:5173

### 3. 构建生产版本
```bash
npm run build
npm run preview
```

## 📁 项目结构

```
src/
├── main.tsx                    # 应用入口
├── App.tsx                     # 主应用组件（框架）
├── types.ts                    # TypeScript 类型定义
├── styles.css                  # 设计系统样式
│
├── api/                        # API 客户端层
│   ├── client.ts              # 基础 API 客户端
│   ├── products.ts            # 产品 API
│   ├── transactions.ts        # 异动 API
│   ├── batches.ts             # 批次 API
│   ├── tags.ts                # 标签 API
│   ├── locations.ts           # 位置 API
│   └── index.ts               # 导出
│
├── components/                 # UI 组件
│   ├── Dashboard.tsx          # 仪表板
│   ├── BatchFlow.tsx          # 批量操作流程
│   ├── ProductCombobox.tsx    # 产品搜索框
│   ├── Toast.tsx              # 通知提示
│   └── modals/
│       ├── AdjustStockModal.tsx    # 调整库存模态框
│       └── ProductPickerModal.tsx  # 产品选择器
│
└── lib/                        # 工具库
    ├── i18n.ts               # 国际化（英文/中文）
    └── csv.ts                # CSV 导入导出工具
```

## 🔑 核心特性

### API 客户端
- 自动请求/响应处理
- 环境变量支持
- 错误处理和日志记录

```typescript
import { productsAPI, transactionsAPI } from '@/api';

// 获取产品列表
const products = await productsAPI.list();

// 创建异动
const result = await transactionsAPI.create({
  product_id: 1,
  sku: 'SKU-001',
  quantity_change: 10,
  // ...
});
```

### 国际化 (i18n)
支持英文和繁体中文，包含完整的 UI 文本字典。

```typescript
import { getI18n, formatTime } from '@/lib/i18n';

const t = getI18n('zh');  // 或 'en'
console.log(t.appName);   // "小倉庫存"

const time = formatTime('2026-05-23T10:30:00Z', 'zh');
```

### CSV 工具
```typescript
import { exportProductsAsCSV, parseCSV } from '@/lib/csv';

// 导出
exportProductsAsCSV(products);

// 导入和解析
const file = new File(...);
const text = await file.text();
const { headers, rows } = parseCSV(text);
```

## 🔧 配置

### 环境变量 (.env.local)
```
VITE_API_BASE_URL=http://localhost:3030
```

### TypeScript
- 严格模式启用
- React JSX 支持
- Path aliases（如需要）

## 📝 开发流程

### 添加新组件
1. 在 `src/components/` 中创建新的 `.tsx` 文件
2. 导入必要的类型和工具
3. 在 `App.tsx` 中使用

### 添加新的 API
1. 在 `src/api/` 中创建新的 `.ts` 文件
2. 使用 `apiClient` 调用 API
3. 在 `src/api/index.ts` 中导出

### 修改国际化
编辑 `src/lib/i18n.ts` 中的 `i18nDict` 对象。

## 🚦 当前状态

✅ 框架完成
- 项目结构和配置
- API 客户端层
- 类型定义
- 核心组件（UI 框架）
- i18n 和 CSV 工具

⚠️ 待完成
- 完整的模态框逻辑
- 批量操作完整实现
- API 集成测试
- 错误边界和加载态
- 响应式设计优化

## 🔗 后端 API 要求

确保后端运行在 `http://localhost:3030` 并提供以下端点：

- `GET /api/products` - 获取产品列表
- `POST /api/transactions` - 创建异动
- `POST /api/batches` - 创建批次
- `GET /api/tags` - 获取标签
- `GET /api/locations` - 获取位置

## 📚 相关文件

- `vite.config.ts` - Vite 配置
- `tsconfig.json` - TypeScript 配置
- `package.json` - 项目依赖
- `index.html` - HTML 入口
