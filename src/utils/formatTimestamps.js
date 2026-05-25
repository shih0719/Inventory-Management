/**
 * 遞迴格式化對象中所有的時間戳欄位為 ISO 格式（帶 Z 後綴）
 * 將 "YYYY-MM-DD HH:MM:SS" 轉換為 "YYYY-MM-DDTHH:MM:SSZ"
 */
function formatTimestamps(data) {
  if (!data) return data;

  // 時間戳欄位名稱
  const timestampFields = ['created_at', 'updated_at', 'timestamp', 'shipment_date'];

  if (Array.isArray(data)) {
    return data.map(item => formatTimestamps(item));
  }

  if (typeof data === 'object') {
    const formatted = { ...data };

    for (const key of Object.keys(formatted)) {
      if (timestampFields.includes(key) && typeof formatted[key] === 'string') {
        const ts = formatted[key];
        // 如果已經是 ISO 格式（包含 T），就不改
        if (!ts.includes('T')) {
          // 將 "2026-05-25 15:08:29" 改為 "2026-05-25T15:08:29Z"
          formatted[key] = ts.replace(' ', 'T') + 'Z';
        }
      } else if (typeof formatted[key] === 'object') {
        // 遞迴處理嵌套對象
        formatted[key] = formatTimestamps(formatted[key]);
      }
    }

    return formatted;
  }

  return data;
}

module.exports = { formatTimestamps };
