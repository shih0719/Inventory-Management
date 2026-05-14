const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../../logs');

// 確保 logs 目錄存在
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}]`;
      if (service) log += ` [${service}]`;
      log += ` ${message}`;

      // 如果有額外的元數據，以 JSON 格式追加
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      return log;
    })
  ),
  defaultMeta: {},
  transports: [
    // 控制台輸出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service }) => {
          let log = `${timestamp} [${level}]`;
          if (service) log += ` [${service}]`;
          log += ` ${message}`;
          return log;
        })
      )
    }),

    // 所有日誌文件
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),

    // 錯誤日誌單獨文件
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

module.exports = logger;
