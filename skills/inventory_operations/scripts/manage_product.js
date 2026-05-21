#!/usr/bin/env node

/**
 * 產品管理腳本（創建、更新、刪除）
 * 用法: node manage_product.js --action <create|update|delete> [參數...]
 */

const { APIClient, DEFAULT_HOST } = require('./api_client');

// 解析命令行參數
const args = process.argv.slice(2);
const params = {
  action: null,
  productId: null,
  sku: null,
  name: null,
  type: null,
  model: null,
  minStock: 0,
  host: DEFAULT_HOST
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--action') params.action = args[++i];
  if (args[i] === '--product-id') params.productId = parseInt(args[++i]);
  if (args[i] === '--sku') params.sku = args[++i];
  if (args[i] === '--name') params.name = args[++i];
  if (args[i] === '--type') params.type = args[++i];
  if (args[i] === '--model') params.model = args[++i];
  if (args[i] === '--min-stock') params.minStock = parseInt(args[++i]);
  if (args[i] === '--host') params.host = args[++i];
}

// 驗證 action 參數
if (!params.action || !['create', 'update', 'delete'].includes(params.action)) {
  console.error('❌ 缺少或無效的 action 參數');
  console.error('用法: node manage_product.js --action <create|update|delete> [參數...]');
  console.error('');
  console.error('create: node manage_product.js --action create --sku <SKU> --name <NAME> --type <normal|ap> --model <MODEL> [--min-stock <QTY>] [--host <IP>]');
  console.error('update: node manage_product.js --action update --product-id <ID> [--name <NAME>] [--min-stock <QTY>] [--host <IP>]');
  console.error('delete: node manage_product.js --action delete --product-id <ID> [--host <IP>]');
  process.exit(1);
}

// 執行產品管理
async function manageProduct() {
  const client = new APIClient(params.host);

  try {
    if (params.action === 'create') {
      await createProduct(client);
    } else if (params.action === 'update') {
      await updateProduct(client);
    } else if (params.action === 'delete') {
      await deleteProduct(client);
    }
  } catch (err) {
    console.error('❌ 錯誤:', err.message);
    process.exit(1);
  }
}

// 創建產品
async function createProduct(client) {
  // 驗證必填參數
  if (!params.sku || !params.name || !params.type || !params.model) {
    console.error('❌ 缺少必填參數 (sku, name, type, model)');
    process.exit(1);
  }

  if (!['normal', 'ap'].includes(params.type)) {
    console.error('❌ 無效的產品類型。必須是 "normal" 或 "ap"');
    process.exit(1);
  }

  const payload = {
    sku: params.sku,
    name: params.name,
    type: params.type,
    model: params.model,
    accountable_quantity: 0,
    non_accountable_quantity: 0,
    min_stock: params.minStock
  };

  console.log('⏳ 正在創建產品...');
  const result = await client.post('/products', payload);

  if (result.success) {
    console.log('✅ 產品創建成功');
    console.log(`🔑 產品 ID: ${result.data.id}`);
    console.log(`📦 SKU: ${result.data.sku}`);
    console.log(`📝 名稱: ${result.data.name}`);
    console.log(`🏷️  類型: ${result.data.type}`);
    console.log(`🔧 型號: ${result.data.model}`);
    console.log(`⚠️  最低庫存: ${result.data.min_stock}`);
  } else {
    console.error('❌ 失敗:', result.error);
    process.exit(1);
  }
}

// 更新產品
async function updateProduct(client) {
  // 驗證必填參數
  if (!params.productId) {
    console.error('❌ 缺少必填參數 (product-id)');
    process.exit(1);
  }

  // 檢查是否有要更新的欄位
  if (!params.name && params.minStock === 0) {
    console.error('❌ 沒有要更新的欄位');
    process.exit(1);
  }

  const payload = {};
  if (params.name) payload.name = params.name;
  if (params.minStock !== 0) payload.min_stock = params.minStock;

  console.log(`⏳ 正在更新產品 ID ${params.productId}...`);
  const result = await client.put(`/products/${params.productId}`, payload);

  if (result.success) {
    console.log('✅ 產品更新成功');
    console.log(`🔑 產品 ID: ${result.data.id}`);
    console.log(`📦 SKU: ${result.data.sku}`);
    console.log(`📝 名稱: ${result.data.name}`);
    console.log(`⚠️  最低庫存: ${result.data.min_stock}`);
  } else {
    console.error('❌ 失敗:', result.error);
    process.exit(1);
  }
}

// 刪除產品（軟刪除）
async function deleteProduct(client) {
  // 驗證必填參數
  if (!params.productId) {
    console.error('❌ 缺少必填參數 (product-id)');
    process.exit(1);
  }

  console.log(`⏳ 正在刪除產品 ID ${params.productId}...`);
  const result = await client.delete(`/products/${params.productId}`);

  if (result.success) {
    console.log('✅ 產品刪除成功（軟刪除）');
    console.log(`🔑 產品 ID: ${params.productId}`);
  } else {
    console.error('❌ 失敗:', result.error);
    process.exit(1);
  }
}

manageProduct();
