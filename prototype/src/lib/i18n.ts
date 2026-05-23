import type { Language, I18nStrings } from '../types';

type I18nDict = Record<Language, I18nStrings>;

// 多语言字典
const i18nDict: I18nDict = {
  en: {
    appName: 'Stockroom',
    search: 'Search SKU, name, model…',
    inbound: '+ Inbound',
    outbound: '+ Outbound',

    kProducts: 'Products',
    kLowStock: 'Low stock',
    kToday: "Today's transactions",
    kApStock: 'AP units in stock',

    apOf: 'AP',
    units: 'units',
    inboundN: 'in',
    outboundN: 'out',

    lowStockTitle: 'Low stock',
    lowStockHint: 'tap a row to adjust stock',
    recentTitle: 'Recent transactions',
    recentHint: 'newest first · all tags',

    onHand: 'On hand',
    accountable: 'Accountable',
    nonAccountable: 'Non-accountable',
    acctShort: '有帳',
    nonAcctShort: '無帳',
    min: 'Min',
    apInStock: 'AP in stock',
    out: 'OUT',
    low: 'LOW',
    ok: 'OK',

    adjustTitle: 'Adjust stock',
    adjustQty: 'Quantity change',
    adjustHint: 'positive = inbound · negative = outbound',
    quantityType: 'Quantity type',
    tag: 'Tag',
    location: 'Location (optional)',
    remarks: 'Remarks',
    remarksPh: 'Optional notes',
    cancel: 'Cancel',
    save: 'Save transaction',
    none: '— none —',

    batchInTitle: 'New inbound batch',
    batchOutTitle: 'New outbound batch',
    batchName: 'Batch name (optional)',
    batchNamePh: 'e.g. "May 22 receipt"',
    batchLines: 'Items',
    addLine: '+ Add item',
    product: 'Product',
    qty: 'Quantity',
    type: 'Type',
    submit: 'Submit batch',
    saveDraft: 'Cancel',
    back: '← Back',
    total: 'Total',
    lines: 'lines',
    summary: 'Summary',

    txSaved: 'Transaction saved',
    batchSaved: 'Batch completed',
    of: 'of',
    valid: 'valid lines',
    invalidQty: 'Quantity must not be zero.',
    stockShort: 'Stock would go negative — adjust qty or split into multiple lines.',

    inboundLbl: 'Inbound',
    outboundLbl: 'Outbound',
    adjustLbl: 'Adjust',
    returnLbl: 'Return',
    internalLbl: 'Internal',

    apNoteForBatch: 'AP product · serial-number tracking lives on the AP page',
    apNote: 'AP item · serial numbers are tracked separately',

    today: 'today',
    yesterday: 'yesterday',

    importCsv: 'Import CSV',
    exportCsv: 'Export CSV',
    importMissing: 'Missing columns',
    importDone: 'Imported',
    rows: 'rows',
    updated: 'updated',
    added: 'added',
    exported: 'Exported',
  },
  zh: {
    appName: '小倉庫存',
    search: '搜尋 SKU、名稱、型號…',
    inbound: '+ 進貨',
    outbound: '+ 出貨',

    kProducts: '產品總數',
    kLowStock: '低庫存',
    kToday: '今日異動',
    kApStock: 'AP 在庫',

    apOf: 'AP',
    units: '件',
    inboundN: '進',
    outboundN: '出',

    lowStockTitle: '低庫存',
    lowStockHint: '點任一列即可調整庫存',
    recentTitle: '最近異動',
    recentHint: '新→舊 · 全部標籤',

    onHand: '現有',
    accountable: '有帳',
    nonAccountable: '無帳',
    acctShort: '有帳',
    nonAcctShort: '無帳',
    min: '下限',
    apInStock: 'AP 在庫',
    out: '缺貨',
    low: '低量',
    ok: '正常',

    adjustTitle: '調整庫存',
    adjustQty: '數量變化',
    adjustHint: '正數 = 進貨 · 負數 = 出貨',
    quantityType: '帳別',
    tag: '標籤',
    location: '位置(選填)',
    remarks: '備註',
    remarksPh: '選填',
    cancel: '取消',
    save: '建立異動',
    none: '— 無 —',

    batchInTitle: '新增進貨批次',
    batchOutTitle: '新增出貨批次',
    batchName: '批次名稱(選填)',
    batchNamePh: '例:5/22 進貨',
    batchLines: '品項',
    addLine: '+ 加入品項',
    product: '產品',
    qty: '數量',
    type: '帳別',
    submit: '送出批次',
    saveDraft: '取消',
    back: '← 返回',
    total: '總計',
    lines: '項',
    summary: '摘要',

    txSaved: '異動已建立',
    batchSaved: '批次已完成',
    of: '/',
    valid: '有效項目',
    invalidQty: '數量不可為 0。',
    stockShort: '此項目會讓庫存變負 — 請調整數量或拆成多項。',

    inboundLbl: '進貨',
    outboundLbl: '出貨',
    adjustLbl: '調整',
    returnLbl: '退貨',
    internalLbl: '內部',

    apNoteForBatch: 'AP 序號品 · 序號管理在 AP 專頁',
    apNote: 'AP 品 · 序號獨立追蹤',

    today: '今日',
    yesterday: '昨日',

    importCsv: '匯入 CSV',
    exportCsv: '匯出 CSV',
    importMissing: '缺少欄位',
    importDone: '已匯入',
    rows: '筆',
    updated: '更新',
    added: '新增',
    exported: '已匯出',
  },
};

export function getI18n(language: Language): I18nStrings {
  return i18nDict[language] || i18nDict.en;
}

// 格式化时间
export function formatTime(iso: string, lang: Language): string {
  const d = new Date(iso);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const yest = (() => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  })();
  const hm = d.toTimeString().slice(0, 5);

  if (same) return hm;
  if (yest) return (lang === 'zh' ? '昨' : 'yest') + ' ' + hm;

  const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
  return diffDays + (lang === 'zh' ? ' 天前' : 'd ago');
}

// 检查是否是今天
export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

// 获取标签标签
export function getTagLabel(tagName: string, lang: Language): string {
  const t = getI18n(lang);
  const labelMap: Record<string, string> = {
    INBOUND: t.inboundLbl,
    OUTBOUND: t.outboundLbl,
    ADJUST: t.adjustLbl,
    RETURN: t.returnLbl,
    INTERNAL: t.internalLbl,
  };
  return labelMap[tagName] || tagName;
}
