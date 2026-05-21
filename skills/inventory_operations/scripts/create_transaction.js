#!/usr/bin/env node

/**
 * 創建異動記錄腳本
 * 用法: node create_transaction.js --product-id 1 --quantity 10 --type accountable --tag-id 1
 */

const { APIClient, DEFAULT_HOST } = require('./api_client');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {
  productId: null,
  quantity: null,
  type: null,
  tagId: null,
  locationId: null,
  remarks: null,
  host: DEFAULT_HOST
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--product-id') params.productId = parseInt(args[++i]);
  if (args[i] === '--quantity') params.quantity = parseInt(args[++i]);
  if (args[i] === '--type') params.type = args[++i];
  if (args[i] === '--tag-id') params.tagId = parseInt(args[++i]);
  if (args[i] === '--location-id') params.locationId = parseInt(args[++i]);
  if (args[i] === '--remarks') params.remarks = args[++i];
  if (args[i] === '--host') params.host = args[++i];
}

// 驗證必填參數
if (!params.productId || params.quantity === null || !params.type || !params.tagId) {
  console.error('❌ 缺少必填參數');
  console.error('用法: node create_transaction.js --product-id <ID> --quantity <QTY> --type <accountable|non_accountable> --tag-id <ID> [--location-id <ID>] [--remarks <TEXT>] [--host <IP>]');
  process.exit(1);
}

// 驗證類型
if (!['accountable', 'non_accountable'].includes(params.type)) {
  console.error('❌ 無效的 quantity_type。必須是 "accountable" 或 "non_accountable"');
  process.exit(1);
}

// 執行異動創建
async function createTransaction() {
  const client = new APIClient(params.host);

  const payload = {
    product_id: params.productId,
    quantity_change: params.quantity,
    quantity_type: params.type,
    tag_id: params.tagId,
  };

  if (params.locationId) payload.location_id = params.locationId;
  if (params.remarks) payload.remarks = params.remarks;

  try {
    console.log('⏳ 正在創建異動記錄...');
    const result = await client.post('/transactions', payload);

    if (result.success) {
      console.log('✅ 異動記錄創建成功');
      console.log(`📋 異動 ID: ${result.data.id}`);
      console.log(`📦 產品 ID: ${result.data.product_id}`);
      console.log(`📊 數量變化: ${result.data.quantity_change} (${params.type})`);
      console.log(`🏷️  標籤: ${result.data.tag_name}`);
      console.log(`⏰ 建立時間: ${result.data.created_at}`);
      if (result.data.remarks) {
        console.log(`💬 備註: ${result.data.remarks}`);
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

createTransaction();
