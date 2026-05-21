#!/usr/bin/env node

/**
 * 批次操作腳本
 * 用法: node create_batch.js --batch-name "進貨批次" --items '[{...}, {...}]'
 */

const { APIClient, DEFAULT_HOST } = require('./api_client');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {
  batchName: null,
  items: null,
  host: DEFAULT_HOST
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--batch-name') params.batchName = args[++i];
  if (args[i] === '--items') params.items = args[++i];
  if (args[i] === '--host') params.host = args[++i];
}

// 驗證必填參數
if (!params.batchName || !params.items) {
  console.error('❌ 缺少必填參數');
  console.error('用法: node create_batch.js --batch-name <NAME> --items <JSON_ARRAY> [--host <IP>]');
  console.error('');
  console.error('JSON_ARRAY 範例:');
  console.error(`'[
    {"product_id": 1, "quantity_change": 10, "quantity_type": "accountable", "tag_id": 1, "remarks": "品項1"},
    {"product_id": 2, "quantity_change": 20, "quantity_type": "accountable", "tag_id": 1, "remarks": "品項2"}
  ]'`);
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
  if (!item.product_id || item.quantity_change === undefined || !item.quantity_type || !item.tag_id) {
    console.error(`❌ 項目 #${i + 1} 缺少必填欄位: product_id, quantity_change, quantity_type, tag_id`);
    process.exit(1);
  }
  if (!['accountable', 'non_accountable'].includes(item.quantity_type)) {
    console.error(`❌ 項目 #${i + 1} 的 quantity_type 無效。必須是 "accountable" 或 "non_accountable"`);
    process.exit(1);
  }
}

// 執行批次操作
async function createBatch() {
  const client = new APIClient(params.host);

  const payload = {
    name: params.batchName,
    items: items
  };

  try {
    console.log(`⏳ 正在創建批次 "${params.batchName}"...`);
    console.log(`📦 包含 ${items.length} 項異動`);
    const result = await client.post('/batches', payload);

    if (result.success) {
      console.log('✅ 批次創建成功');
      console.log(`📋 批次 ID: ${result.data.batch_id}`);
      console.log(`📊 狀態: ${result.data.status}`);
      console.log(`✔️  成功的異動 ID: ${result.data.transaction_ids.join(', ')}`);
      console.log(`⏰ 建立時間: ${result.data.created_at}`);
    } else if (result.message === '部分項目處理失敗') {
      console.warn('⚠️  部分項目處理失敗');

      if (result.data.successful && result.data.successful.length > 0) {
        console.log(`✔️  成功的異動 (${result.data.successful.length}):`,
          result.data.successful.map(s => `[#${s.index}] ID:${s.transaction_id}`).join(', '));
      }

      if (result.data.failed && result.data.failed.length > 0) {
        console.log(`❌ 失敗的項目 (${result.data.failed.length}):`);
        for (const f of result.data.failed) {
          console.log(`   [項目 #${f.index + 1}] ${f.error}`);
        }
      }
    } else {
      console.error('❌ 失敗:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    process.exit(1);
  }
}

createBatch();
