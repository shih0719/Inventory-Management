#!/usr/bin/env node

/**
 * Inventory Management MCP Server
 *
 * 提供工具讓 Claude Code agents 可以查詢與操作庫存系統
 * 透過本地 Node.js 伺服器連接到實際的 API（繞過沙盒限制）
 *
 * 安裝：
 *   npm install dotenv node-fetch
 *
 * 執行：
 *   node mcp/server.js
 *
 * Claude Code 設置：
 *   在 .claude/settings.json 加入：
 *   {
 *     "mcpServers": {
 *       "inventory": {
 *         "command": "node",
 *         "args": ["mcp/server.js"],
 *         "env": {
 *           "INVENTORY_API_HOST": "localhost",
 *           "INVENTORY_API_PORT": "3000"
 *         }
 *       }
 *     }
 *   }
 */

const http = require('http');
const url = require('url');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_HOST = process.env.INVENTORY_API_HOST || 'localhost';
const API_PORT = process.env.INVENTORY_API_PORT || '3000';
const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

// MCP Server 端口
const MCP_PORT = process.env.MCP_PORT || 3001;

/**
 * 呼叫 Inventory API
 */
async function callAPI(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject({
        error: 'API連線失敗',
        message: err.message,
        details: `無法連接到 ${API_HOST}:${API_PORT}`,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'API逾時',
        message: `請求超過 5 秒`,
        details: `確認服務運行在 ${API_HOST}:${API_PORT}`,
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * 工具定義
 */
const TOOLS = {
  'query-products': {
    description: '查詢所有產品或按 SKU/名稱搜尋',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: '按 SKU 搜尋（可選）' },
        name: { type: 'string', description: '按名稱搜尋（可選）' },
        page: { type: 'number', description: '頁碼（預設 1）' },
        limit: { type: 'number', description: '每頁筆數（預設 10）' },
      },
    },
  },
  'get-product': {
    description: '取得單個產品的詳細資訊',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', description: '產品 ID（必填）' },
      },
      required: ['product_id'],
    },
  },
  'query-low-stock': {
    description: '查詢庫存不足的產品',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: '頁碼（預設 1）' },
        limit: { type: 'number', description: '每頁筆數（預設 10）' },
      },
    },
  },
  'create-transaction': {
    description: '建立庫存異動記錄（進出貨）',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', description: '產品 ID（必填）' },
        quantity_change: { type: 'number', description: '數量變化，正數=進貨，負數=出貨（必填）' },
        quantity_type: {
          type: 'string',
          enum: ['accountable', 'non_accountable'],
          description: '數量類型：accountable(有帳) 或 non_accountable(無帳)（必填）',
        },
        tag_id: { type: 'number', description: '標籤 ID，通常 1=進貨 2=出貨（必填）' },
        location_id: { type: 'number', description: '儲位 ID（可選）' },
        remarks: { type: 'string', description: '備註（可選）' },
      },
      required: ['product_id', 'quantity_change', 'quantity_type', 'tag_id'],
    },
  },
  'create-batch': {
    description: '批量建立多筆庫存異動',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '異動項目陣列',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'number' },
              quantity_change: { type: 'number' },
              quantity_type: { type: 'string' },
              tag_id: { type: 'number' },
              remarks: { type: 'string' },
            },
            required: ['product_id', 'quantity_change', 'quantity_type', 'tag_id'],
          },
        },
      },
      required: ['items'],
    },
  },
  'create-product': {
    description: '新增產品',
    inputSchema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: '產品 SKU（必填）' },
        name: { type: 'string', description: '產品名稱（必填）' },
        type: { type: 'string', description: '產品類型（必填）' },
        model: { type: 'string', description: '產品型號（必填）' },
        track_serial: { type: 'boolean', description: '是否追蹤序號（可選，預設 false）' },
        min_stock: { type: 'number', description: '最低庫存閾值（可選）' },
      },
      required: ['sku', 'name', 'type', 'model'],
    },
  },
  'update-product': {
    description: '更新產品資訊',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', description: '產品 ID（必填）' },
        name: { type: 'string', description: '產品名稱（可選）' },
        type: { type: 'string', description: '產品類型（可選）' },
        model: { type: 'string', description: '產品型號（可選）' },
        min_stock: { type: 'number', description: '最低庫存閾值（可選）' },
      },
      required: ['product_id'],
    },
  },
  'bulk-create-units': {
    description: '批量建立序號品（AP）',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', description: '產品 ID（必填）' },
        serial_numbers: {
          type: 'array',
          items: { type: 'string' },
          description: '序號陣列（必填）',
        },
      },
      required: ['product_id', 'serial_numbers'],
    },
  },
  'bulk-sell-units': {
    description: '批量標記序號品為已出售',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '出售項目陣列',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: '序號品 ID' },
              sold_to: { type: 'string', description: '客戶/收件人' },
              project_case: { type: 'string', description: '案子' },
            },
          },
        },
      },
      required: ['items'],
    },
  },
};

/**
 * 執行工具
 */
async function executeTool(toolName, input) {
  try {
    switch (toolName) {
      case 'query-products': {
        const params = new URLSearchParams();
        if (input.sku) params.append('sku', input.sku);
        if (input.name) params.append('name', input.name);
        if (input.page) params.append('page', input.page);
        if (input.limit) params.append('limit', input.limit);
        return await callAPI('GET', `/api/products?${params}`);
      }

      case 'get-product': {
        return await callAPI('GET', `/api/products/${input.product_id}`);
      }

      case 'query-low-stock': {
        const params = new URLSearchParams();
        if (input.page) params.append('page', input.page);
        if (input.limit) params.append('limit', input.limit);
        return await callAPI('GET', `/api/products/low-stock?${params}`);
      }

      case 'create-transaction': {
        return await callAPI('POST', '/api/transactions', {
          product_id: input.product_id,
          quantity_change: input.quantity_change,
          quantity_type: input.quantity_type,
          tag_id: input.tag_id,
          location_id: input.location_id,
          remarks: input.remarks,
        });
      }

      case 'create-batch': {
        return await callAPI('POST', '/api/batches', {
          items: input.items,
        });
      }

      case 'create-product': {
        return await callAPI('POST', '/api/products', {
          sku: input.sku,
          name: input.name,
          type: input.type,
          model: input.model,
          track_serial: input.track_serial || false,
          min_stock: input.min_stock,
        });
      }

      case 'update-product': {
        const body = {};
        if (input.name) body.name = input.name;
        if (input.type) body.type = input.type;
        if (input.model) body.model = input.model;
        if (input.min_stock !== undefined) body.min_stock = input.min_stock;
        return await callAPI('PUT', `/api/products/${input.product_id}`, body);
      }

      case 'bulk-create-units': {
        return await callAPI('POST', `/api/product-units/bulk-create`, {
          product_id: input.product_id,
          serial_numbers: input.serial_numbers,
        });
      }

      case 'bulk-sell-units': {
        return await callAPI('POST', `/api/product-units/bulk-sell`, {
          items: input.items,
        });
      }

      default:
        throw new Error(`工具不存在: ${toolName}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * MCP 伺服器實作
 */
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // 列出工具
  if (req.method === 'GET' && req.url === '/tools') {
    const tools = Object.entries(TOOLS).map(([name, spec]) => ({
      name,
      ...spec,
    }));
    res.writeHead(200);
    res.end(JSON.stringify({ tools }));
    return;
  }

  // 執行工具
  if (req.method === 'POST' && req.url === '/tool') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const { tool, input } = JSON.parse(body);
        const result = await executeTool(tool, input);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, result }));
      } catch (error) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            success: false,
            error: error.message || String(error),
          })
        );
      }
    });
    return;
  }

  // 健康檢查
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', api: `${API_HOST}:${API_PORT}` }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: '路由不存在' }));
});

server.listen(MCP_PORT, 'localhost', () => {
  console.log(`✅ Inventory MCP Server 運行在 http://localhost:${MCP_PORT}`);
  console.log(`📡 連接到 API: http://${API_HOST}:${API_PORT}`);
  console.log(`\n可用端點:`);
  console.log(`  GET  /tools         — 列出所有工具`);
  console.log(`  POST /tool          — 執行工具`);
  console.log(`  GET  /health        — 健康檢查`);
  console.log(`\n要在 Claude Code 中使用，設置 .claude/settings.json：`);
  console.log(`\n{`);
  console.log(`  "mcpServers": {`);
  console.log(`    "inventory": {`);
  console.log(`      "command": "node",`);
  console.log(`      "args": ["${process.cwd()}/mcp/server.js"]`);
  console.log(`    }`);
  console.log(`  }`);
  console.log(`}`);
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n🛑 關閉 MCP Server');
  server.close(() => process.exit(0));
});
