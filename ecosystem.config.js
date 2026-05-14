require('dotenv').config();

const pkg = require('./package.json');

module.exports = {
  apps: [
    {
      name: pkg.name,
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'database'],
      max_restarts: 10,
      min_uptime: '10s',
      output: 'logs/out.log',
      error: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
