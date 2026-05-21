const http = require('http');

// 從環境變數讀取，預設 localhost
const DEFAULT_HOST = process.env.INVENTORY_API_HOST || 'localhost';
const DEFAULT_PORT = parseInt(process.env.INVENTORY_API_PORT || '3000', 10);

/**
 * 簡易的 HTTP 請求封裝，用於查詢庫存 API
 */
async function fetchInventory(params = {}) {
    const { host = DEFAULT_HOST, sku, name, limit = 100 } = params;
    let url = `/api/products?limit=${limit}`;
    if (sku) url += `&sku=${encodeURIComponent(sku)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;

    return new Promise((resolve, reject) => {
        const options = {
            hostname: host,
            port: DEFAULT_PORT,
            path: url,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.success) {
                        resolve(result.data);
                    } else {
                        reject(new Error(result.error || 'API 請求失敗'));
                    }
                } catch (e) {
                    reject(new Error('解析 JSON 失敗: ' + e.message));
                }
            });
        });

        req.on('error', (e) => reject(new Error('連線到伺服器失敗: ' + e.message)));
        req.end();
    });
}

// 處理命令行參數
const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host') params.host = args[++i];
    if (args[i] === '--sku') params.sku = args[++i];
    if (args[i] === '--name') params.name = args[++i];
    if (args[i] === '--limit') params.limit = args[++i];
}

// 執行查詢
fetchInventory(params)
    .then(data => {
        if (data.length === 0) {
            console.log("😕 找不到符合條件的產品庫存。");
            return;
        }

        console.log("📊 當前庫存列表：");
        console.table(data.map(p => ({
            "編號 (SKU)": p.sku,
            "名稱": p.name,
            "類型": p.type,
            "有帳": p.accountable_quantity,
            "無帳": p.non_accountable_quantity
        })));
    })
    .catch(err => {
        console.error("❌ 查詢出錯：", err.message);
        process.exit(1);
    });
