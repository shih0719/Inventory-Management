const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'vite-app', 'dist');
const dest = path.join(__dirname, '..', 'public');

console.log('複製前端文件...');
console.log(`源: ${source}`);
console.log(`目標: ${dest}`);

// 檢查源文件是否存在
if (!fs.existsSync(source)) {
  console.error(`❌ 前端構建文件不存在: ${source}`);
  console.error('請確保已執行: npm run build:frontend');
  process.exit(1);
}

// 備份舊的 public 目錄
if (fs.existsSync(dest)) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const backup = `${dest}_backup_${timestamp}`;
  fs.renameSync(dest, backup);
  console.log(`✓ 已備份舊文件到: ${backup}`);
}

// 遞歸複製文件
function copyRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }

  fs.readdirSync(src).forEach(file => {
    const srcFile = path.join(src, file);
    const dstFile = path.join(dst, file);

    if (fs.statSync(srcFile).isDirectory()) {
      copyRecursive(srcFile, dstFile);
    } else {
      fs.copyFileSync(srcFile, dstFile);
    }
  });
}

copyRecursive(source, dest);
console.log(`✓ 前端文件已複製到 ${dest}`);
