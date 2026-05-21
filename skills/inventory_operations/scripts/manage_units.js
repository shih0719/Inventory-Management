#!/usr/bin/env node

/**
 * 序號品（AP）管理腳本
 * 用法: node manage_units.js --action <bulk-create|bulk-sell|list> [參數...]
 */

const { APIClient, DEFAULT_HOST } = require('./api_client');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {
  action: null,
  productId: null,
  count: null,
  prefix: 'SN',
  items: null,
  status: null,
  limit: 50,
  host: DEFAULT_HOST
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--action') params.action = args[++i];
  if (args[i] === '--product-id') params.productId = parseInt(args[++i]);
  if (args[i] === '--count') params.count = parseInt(args[++i]);
  if (args[i] === '--prefix') params.prefix = args[++i];
  if (args[i] === '--items') params.items = args[++i];
  if (args[i] === '--status') params.status = args[++i];
  if (args[i] === '--limit') params.limit = parseInt(args[++i]);
  if (args[i] === '--host') params.host = args[++i];
}

// 驗證 action 參數
if (!params.action || !['bulk-create', 'bulk-sell', 'list'].includes(params.action)) {
  console.error('❌ 缺少或無效的 action 參數');
  console.error('用法: node manage_units.js --action <bulk-create|bulk-sell|list> [參數...]');
  console.error('');
  console.error('bulk-create: node manage_units.js --action bulk-create --product-id <ID> --count <NUM> [--prefix <PREFIX>] [--host <IP>]');
  console.error('bulk-sell:   node manage_units.js --action bulk-sell --items <JSON_ARRAY> [--host <IP>]');
  console.error('list:        node manage_units.js --action list [--product-id <ID>] [--status <STATUS>] [--limit <NUM>] [--host <IP>]');
  process.exit(1);
}

// 執行序號品管理
async function manageUnits() {
  const client = new APIClient(params.host);

  try {
    if (params.action === 'bulk-create') {
      await bulkCreateUnits(client);
    } else if (params.action === 'bulk-sell') {
      await bulkSellUnits(client);
    } else if (params.action === 'list') {
      await listUnits(client);
    }
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    process.exit(1);
  }
}

// 批量建立序號品
async function bulkCreateUnits(client) {
  // 驗證必填參數
  if (!params.productId || !params.count) {
    console.error('❌ 缺少必填參數 (product-id, count)');
    process.exit(1);
  }

  const payload = {
    product_id: params.productId,
    count: params.count,
    serial_prefix: params.prefix
  };

  console.log(`⏳ 正在創建 ${params.count} 個序號品...`);
  const result = await client.post('/product-units/bulk', payload);

  if (result.success) {
    console.log('✅ 序號品創建成功');
    console.log(`📦 產品 ID: ${params.productId}`);
    console.log(`✔️  建立數量: ${result.data.created}`);
    if (result.data.units && result.data.units.length > 0) {
      console.log('🔢 序號清單:');
      for (const unit of result.data.units.slice(0, 10)) {
        console.log(`   - ${unit.serial_number} (ID: ${unit.id})`);
      }
      if (result.data.units.length > 10) {
        console.log(`   ... 及其他 ${result.data.units.length - 10} 個`);
      }
    }
  } else {
    console.error('❌ 失敗:', result.error);
    process.exit(1);
  }
}

// 批量出售序號品
async function bulkSellUnits(client) {
  // 驗證必填參數
  if (!params.items) {
    console.error('❌ 缺少必填參數 (items)');
    console.error('items 範例: \'[{"id": 1, "sold_to": "客戶名", "project_case": "案件號"}, ...]\'');
    process.exit(1);
  }

  // 解析 JSON items
  let items;
  try {
    items = JSON.parse(params.items);
    if (!Array.isArray(items)) {
      throw new Error('items 必須是陣列');
    }
  } catch (err) {
    console.error('❌ items JSON 格式錯誤:', err.message);
    process.exit(1);
  }

  // 驗證 items 內容
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.id) {
      console.error(`❌ 項目 #${i + 1} 缺少 id 欄位`);
      process.exit(1);
    }
  }

  const payload = { items };

  console.log(`⏳ 正在標記 ${items.length} 個序號品為已出售...`);
  const result = await client.post('/product-units/bulk-sell', payload);

  if (result.success) {
    console.log('✅ 序號品標記成功');
    console.log(`✔️  更新數量: ${result.data.updated_count}`);
  } else {
    console.error('❌ 失敗:', result.error);
    process.exit(1);
  }
}

// 查詢序號品
async function listUnits(client) {
  let endpoint = `/product-units?limit=${params.limit}`;

  if (params.productId) {
    endpoint += `&product_id=${params.productId}`;
  }
  if (params.status) {
    endpoint += `&status=${params.status}`;
  }

  console.log('⏳ 正在查詢序號品...');
  const result = await client.get(endpoint);

  if (result.success) {
    const units = result.data;
    console.log(`✅ 查詢成功 (共 ${units.length} 個)`);

    if (units.length === 0) {
      console.log('😕 找不到符合條件的序號品');
      return;
    }

    console.log('📋 序號品清單:');
    console.table(units.map(u => ({
      'ID': u.id,
      '序號': u.serial_number,
      '狀態': u.status,
      '出售給': u.sold_to || '—',
      '案件': u.project_case || '—',
      '建立時間': new Date(u.created_at).toLocaleDateString('zh-TW')
    })));
  } else {
    console.error('❌ 失敗:', result.error);
    process.exit(1);
  }
}

manageUnits();
