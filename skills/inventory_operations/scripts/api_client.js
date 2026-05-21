/**
 * API Client 封裝
 * 提供統一的 HTTP 請求方法供所有腳本使用
 */

const http = require('http');
const https = require('https');

// 從環境變數讀取，預設 localhost
const DEFAULT_HOST = process.env.INVENTORY_API_HOST || 'localhost';
const DEFAULT_PORT = parseInt(process.env.INVENTORY_API_PORT || '3000', 10);

class APIClient {
  constructor(host = DEFAULT_HOST, port = DEFAULT_PORT) {
    this.host = host;
    this.port = port;
    this.baseURL = `http://${host}:${port}/api`;
  }

  /**
   * 執行 HTTP 請求
   */
  async request(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const lib = this.host.startsWith('https') ? https : http;

      const options = {
        hostname: this.host,
        port: this.port,
        path: `/api${endpoint}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      const req = lib.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(result.error || result.message || `HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`解析 JSON 失敗: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`連線到伺服器失敗: ${e.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('請求超時'));
      });

      req.setTimeout(10000);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  // GET 請求
  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  // POST 請求
  async post(endpoint, data) {
    return this.request('POST', endpoint, data);
  }

  // PUT 請求
  async put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  }

  // DELETE 請求
  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

module.exports = { APIClient, DEFAULT_HOST, DEFAULT_PORT };
