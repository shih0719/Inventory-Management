#!/usr/bin/env node

/**
 * CSV 導入腳本
 * 用法: node csv_import.js --type <products|transactions> --file <PATH>
 */

const fs = require('fs');
const path = require('path');
const { APIClient, DEFAULT_HOST } = require('./api_client');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {
  type: null,
  file: null,
  host: DEFAULT_HOST
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type') params.type = args[++i];
  if (args[i] === '--file') params.file = args[++i];
  if (args[i] === '--host') params.host = args[++i];
}

// 驗證必填參數
if (!params.type || !['products', 'transactions'].includes(params.type)) {
  console.error('❌ 缺少或無效的 type 參數');
  console.error('用法: node csv_import.js --type <products|transactions> --file <PATH> [--host <IP>]');
  process.exit(1);
}

if (!params.file) {
  console.error('❌ 缺少必填參數 (file)');
  process.exit(1);
}

// 檢查檔案是否存在
if (!fs.existsSync(params.file)) {
  console.error(`❌ 檔案不存在: ${params.file}`);
  process.exit(1);
}

// 簡單的 CSV 解析器
function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV 檔案至少需要標題行和一行資料');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};

    for (let j = 0; j < headers.length; j++) {
      const value = values[j];
      // 嘗試轉換為數字
      row[headers[j]] = isNaN(value) || value === '' ? value : Number(value);
    }

    rows.push(row);
  }

  return rows;
}

// 執行 CSV 導入
async function importCSV() {
  const client = new APIClient(params.host);

  try {
    console.log(`⏳ 正在讀取 CSV 檔案: ${params.file}`);
    const content = fs.readFileSync(params.file, 'utf8');
    const rows = parseCSV(content);

    console.log(`📊 解析完成，共 ${rows.length} 行資料`);

    if (params.type === 'products') {
      await importProducts(client, rows);
    } else if (params.type === 'transactions') {
      await importTransactions(client, rows);
    }
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    process.exit(1);
  }
}

// 導入產品
async function importProducts(client, rows) {
  console.log(`⏳ 正在導入 ${rows.length} 個產品...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 驗證必填欄位
    if (!row.sku || !row.name || !row.type || !row.model) {
      console.warn(`⚠️  跳過行 #${i + 2}: 缺少必填欄位 (sku, name, type, model)`);
      failCount++;
      continue;
    }

    const payload = {
      sku: row.sku,
      name: row.name,
      type: row.type,
      model: row.model,
      accountable_quantity: row.accountable_quantity || 0,
      non_accountable_quantity: row.non_accountable_quantity || 0,
      min_stock: row.min_stock || 0
    };

    try {
      const result = await client.post('/products', payload);
      if (result.success) {
        successCount++;
      } else {
        console.warn(`⚠️  行 #${i + 2} 失敗: ${result.error}`);
        failCount++;
      }
    } catch (err) {
      console.warn(`⚠️  行 #${i + 2} 出錯: ${err.message}`);
      failCount++;
    }
  }

  console.log(`✅ 導入完成`);
  console.log(`✔️  成功: ${successCount} 個`);
  if (failCount > 0) {
    console.log(`❌ 失敗: ${failCount} 個`);
  }
}

// 導入異動
async function importTransactions(client, rows) {
  console.log(`⏳ 正在導入 ${rows.length} 筆異動...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 驗證必填欄位
    if (!row.product_id || row.quantity_change === undefined || !row.quantity_type || !row.tag_id) {
      console.warn(`⚠️  跳過行 #${i + 2}: 缺少必填欄位 (product_id, quantity_change, quantity_type, tag_id)`);
      failCount++;
      continue;
    }

    const payload = {
      product_id: row.product_id,
      quantity_change: row.quantity_change,
      quantity_type: row.quantity_type,
      tag_id: row.tag_id,
    };

    if (row.location_id) payload.location_id = row.location_id;
    if (row.remarks) payload.remarks = row.remarks;

    try {
      const result = await client.post('/transactions', payload);
      if (result.success) {
        successCount++;
      } else {
        console.warn(`⚠️  行 #${i + 2} 失敗: ${result.error}`);
        failCount++;
      }
    } catch (err) {
      console.warn(`⚠️  行 #${i + 2} 出錯: ${err.message}`);
      failCount++;
    }
  }

  console.log(`✅ 導入完成`);
  console.log(`✔️  成功: ${successCount} 筆`);
  if (failCount > 0) {
    console.log(`❌ 失敗: ${failCount} 筆`);
  }
}

importCSV();
