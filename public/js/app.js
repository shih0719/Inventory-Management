// API Base URL
const API_BASE = "/api";

// Global state
let products = [];
let tags = [];
let currentEditingProduct = null;

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
  await loadTags();
  await loadProducts();
  setupEventListeners();
});

// Load tags from API
async function loadTags() {
  try {
    const response = await fetch(`${API_BASE}/tags`);
    const result = await response.json();
    if (result.success) {
      tags = result.data;
      populateTagSelectors();
    }
  } catch (error) {
    console.error("Error loading tags:", error);
    showNotification("載入標籤失敗", "error");
  }
}

// Populate tag selector dropdowns
function populateTagSelectors() {
  const filterTag = document.getElementById("filter-tag");
  const transactionTag = document.getElementById("transaction-tag");
  const batchTag = document.getElementById("batch-tag");

  // Clear existing options (except first one)
  filterTag.innerHTML = '<option value="">全部標籤</option>';
  transactionTag.innerHTML = '<option value="">選擇標籤...</option>';
  batchTag.innerHTML = '<option value="">選擇標籤...</option>';

  tags.forEach((tag) => {
    const filterOption = document.createElement("option");
    filterOption.value = tag.id;
    filterOption.textContent = tag.display_name;
    filterTag.appendChild(filterOption);

    const transactionOption = document.createElement("option");
    transactionOption.value = tag.id;
    transactionOption.textContent = tag.display_name;
    transactionTag.appendChild(transactionOption);

    const batchOption = document.createElement("option");
    batchOption.value = tag.id;
    batchOption.textContent = tag.display_name;
    batchTag.appendChild(batchOption);
  });
}

// Load products from API
async function loadProducts() {
  try {
    const sku = document.getElementById("filter-sku").value;
    const tag = document.getElementById("filter-tag").value;

    let url = `${API_BASE}/products?`;
    if (sku) url += `sku=${encodeURIComponent(sku)}&`;
    if (tag) url += `tag=${tag}&`;

    const response = await fetch(url);
    const result = await response.json();
    if (result.success) {
      products = result.data;
      renderProducts();
    }
  } catch (error) {
    console.error("Error loading products:", error);
    showNotification("載入產品失敗", "error");
  }
}

// Render products table/cards
function renderProducts() {
  renderProductsTable();
  renderProductsCards();
}

// Render products table (desktop)
function renderProductsTable() {
  const tbody = document.getElementById("products-table-body");
  tbody.innerHTML = "";

  if (products.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                    😕 沒有找到產品
                </td>
            </tr>
        `;
    return;
  }

  products.forEach((product) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-gray-50";
    row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">${
                product.sku
              }</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${
              product.name
            }</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${
              product.type
            }</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${
              product.model || "-"
            }</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm">
                    <span class="badge bg-green-100 text-green-800">有帳: ${
                      product.accountable_quantity
                    }</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm">
                    <span class="badge bg-gray-100 text-gray-800">無帳: ${
                      product.non_accountable_quantity
                    }</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                <div class="flex gap-2">
                    <button onclick="openTransactionModal(${product.id}, '${
      product.name
    }', ${product.accountable_quantity}, ${product.non_accountable_quantity})" 
                            class="text-blue-600 hover:text-blue-800 font-medium">異動</button>
                    <button onclick="openHistoryModal(${product.id}, '${
      product.name
    }', '${product.sku}')" 
                            class="text-purple-600 hover:text-purple-800 font-medium">歷史</button>
                    <button onclick="editProduct(${product.id})" 
                            class="text-green-600 hover:text-green-800 font-medium">編輯</button>
                    <button onclick="deleteProduct(${product.id}, '${
      product.name
    }')" 
                            class="text-red-600 hover:text-red-800 font-medium">刪除</button>
                </div>
            </td>
        `;
    tbody.appendChild(row);
  });
}

// Render products cards (mobile)
function renderProductsCards() {
  const container = document.getElementById("products-cards");
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                😕 沒有找到產品
            </div>
        `;
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-lg shadow-md p-4";
    card.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-bold text-gray-900">${product.name}</h3>
                    <p class="text-sm text-gray-600">SKU: ${product.sku}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div>
                    <span class="text-gray-600">類型：</span>
                    <span class="text-gray-900">${product.type}</span>
                </div>
                <div>
                    <span class="text-gray-600">型號：</span>
                    <span class="text-gray-900">${product.model || "-"}</span>
                </div>
                <div>
                    <span class="text-gray-600">有帳庫存：</span>
                    <span class="font-semibold text-green-600">${
                      product.accountable_quantity
                    }</span>
                </div>
                <div>
                    <span class="text-gray-600">無帳庫存：</span>
                    <span class="font-semibold text-gray-600">${
                      product.non_accountable_quantity
                    }</span>
                </div>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="openTransactionModal(${product.id}, '${
      product.name
    }', ${product.accountable_quantity}, ${product.non_accountable_quantity})" 
                        class="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600">異動</button>
                <button onclick="openHistoryModal(${product.id}, '${
      product.name
    }', '${product.sku}')" 
                        class="flex-1 bg-purple-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-600">歷史</button>
                <button onclick="editProduct(${product.id})" 
                        class="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-600">編輯</button>
                <button onclick="deleteProduct(${product.id}, '${
      product.name
    }')" 
                        class="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-600">刪除</button>
            </div>
        `;
    container.appendChild(card);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Filter inputs
  document
    .getElementById("filter-sku")
    .addEventListener("input", debounce(loadProducts, 500));
  document
    .getElementById("filter-tag")
    .addEventListener("change", loadProducts);

  // Add product button
  document.getElementById("add-product-btn").addEventListener("click", () => {
    currentEditingProduct = null;
    document.getElementById("product-modal-title").textContent = "新增產品";
    document.getElementById("product-form").reset();
    document.getElementById("product-id").value = "";
    document.getElementById("product-sku").disabled = false;
    openModal("product-modal");
  });

  // Product form
  document
    .getElementById("product-form")
    .addEventListener("submit", handleProductSubmit);
  document
    .getElementById("product-modal-cancel")
    .addEventListener("click", () => closeModal("product-modal"));

  // Transaction form
  document
    .getElementById("transaction-form")
    .addEventListener("submit", handleTransactionSubmit);
  document
    .getElementById("transaction-modal-cancel")
    .addEventListener("click", () => closeModal("transaction-modal"));

  // History modal
  document
    .getElementById("history-modal-close")
    .addEventListener("click", () => closeModal("history-modal"));

  // CSV import
  document
    .getElementById("csv-import-input")
    .addEventListener("change", handleCSVImport);

  // CSV export
  document
    .getElementById("csv-export-btn")
    .addEventListener("click", handleCSVExport);

  // CSV template download
  document
    .getElementById("csv-template-btn")
    .addEventListener("click", handleCSVTemplateDownload);

  // Batch transaction
  document
    .getElementById("batch-transaction-btn")
    .addEventListener("click", openBatchModal);
  document
    .getElementById("batch-form")
    .addEventListener("submit", handleBatchSubmit);
  document
    .getElementById("batch-modal-cancel")
    .addEventListener("click", () => closeModal("batch-modal"));
  document
    .getElementById("add-batch-item-btn")
    .addEventListener("click", addBatchItem);

  // Batches list
  document
    .getElementById("view-batches-btn")
    .addEventListener("click", openBatchesListModal);
  document
    .getElementById("batches-list-modal-close")
    .addEventListener("click", () => closeModal("batches-list-modal"));
  document
    .getElementById("batch-details-modal-close")
    .addEventListener("click", () => closeModal("batch-details-modal"));
}

// Handle product form submission
async function handleProductSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("product-id").value;
  const data = {
    sku: document.getElementById("product-sku").value,
    name: document.getElementById("product-name").value,
    type: document.getElementById("product-type").value,
    model: document.getElementById("product-model").value,
    accountable_quantity:
      parseInt(document.getElementById("product-accountable-qty").value) || 0,
    non_accountable_quantity:
      parseInt(document.getElementById("product-non-accountable-qty").value) ||
      0,
  };

  try {
    const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
    const method = id ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      showNotification(id ? "產品更新成功" : "產品新增成功", "success");
      closeModal("product-modal");
      await loadProducts();
    } else {
      showNotification(result.error || "操作失敗", "error");
    }
  } catch (error) {
    console.error("Error saving product:", error);
    showNotification("儲存失敗", "error");
  }
}

// Edit product
async function editProduct(id) {
  try {
    const response = await fetch(`${API_BASE}/products/${id}`);
    const result = await response.json();

    if (result.success) {
      const product = result.data;
      currentEditingProduct = product;

      document.getElementById("product-modal-title").textContent = "編輯產品";
      document.getElementById("product-id").value = product.id;
      document.getElementById("product-sku").value = product.sku;
      document.getElementById("product-sku").disabled = true;
      document.getElementById("product-name").value = product.name;
      document.getElementById("product-type").value = product.type;
      document.getElementById("product-model").value = product.model || "";
      document.getElementById("product-accountable-qty").value =
        product.accountable_quantity;
      document.getElementById("product-non-accountable-qty").value =
        product.non_accountable_quantity;

      openModal("product-modal");
    }
  } catch (error) {
    console.error("Error loading product:", error);
    showNotification("載入產品失敗", "error");
  }
}

// Delete product
async function deleteProduct(id, name) {
  if (
    !confirm(
      `確定要刪除產品「${name}」嗎？\n\n注意：交易歷史記錄將會保留，但產品將不再顯示。`,
    )
  ) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (result.success) {
      showNotification("產品已刪除", "success");
      await loadProducts();
    } else {
      showNotification(result.error || "刪除失敗", "error");
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    showNotification("刪除失敗", "error");
  }
}

// Open transaction modal
function openTransactionModal(
  productId,
  productName,
  accountableQty,
  nonAccountableQty,
) {
  document.getElementById("transaction-product-id").value = productId;
  document.getElementById("transaction-product-name").textContent = productName;
  document.getElementById("transaction-accountable-qty").textContent =
    accountableQty;
  document.getElementById("transaction-non-accountable-qty").textContent =
    nonAccountableQty;
  document.getElementById("transaction-form").reset();
  openModal("transaction-modal");
}

// Handle transaction form submission
async function handleTransactionSubmit(e) {
  e.preventDefault();

  const data = {
    product_id: parseInt(
      document.getElementById("transaction-product-id").value,
    ),
    tag_id: parseInt(document.getElementById("transaction-tag").value),
    quantity_change: parseInt(
      document.getElementById("transaction-quantity").value,
    ),
    quantity_type: document.getElementById("transaction-quantity-type").value,
    remarks: document.getElementById("transaction-remarks").value,
  };

  try {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      showNotification("庫存異動成功", "success");
      closeModal("transaction-modal");
      await loadProducts();
    } else {
      showNotification(result.error || "異動失敗", "error");
    }
  } catch (error) {
    console.error("Error creating transaction:", error);
    showNotification("異動失敗", "error");
  }
}

// Open history modal
async function openHistoryModal(productId, productName, productSku) {
  document.getElementById("history-product-name").textContent = productName;
  document.getElementById("history-product-sku").textContent = productSku;

  openModal("history-modal");

  try {
    const response = await fetch(
      `${API_BASE}/transactions/product/${productId}`,
    );
    const result = await response.json();

    if (result.success) {
      renderHistory(result.data);
    }
  } catch (error) {
    console.error("Error loading history:", error);
    showNotification("載入歷史記錄失敗", "error");
  }
}

// Render transaction history
function renderHistory(transactions) {
  const tbody = document.getElementById("history-table-body");
  tbody.innerHTML = "";

  if (transactions.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                    沒有交易記錄
                </td>
            </tr>
        `;
    return;
  }

  transactions.forEach((transaction) => {
    const row = document.createElement("tr");
    row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${formatDateTime(
              transaction.created_at,
            )}</td>
            <td class="px-4 py-3">
                <span class="badge" style="background-color: ${
                  transaction.tag_color
                }20; color: ${transaction.tag_color}">
                    ${transaction.tag_name}
                </span>
            </td>
            <td class="px-4 py-3 text-sm font-semibold ${
              transaction.quantity_change > 0
                ? "text-green-600"
                : "text-red-600"
            }">
                ${transaction.quantity_change > 0 ? "+" : ""}${
      transaction.quantity_change
    }
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">${
              transaction.remarks || "-"
            }</td>
        `;
    tbody.appendChild(row);
  });
}

// Handle CSV import
async function handleCSVImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE}/csv/import`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showNotification(
        `匯入成功！新增 ${result.imported} 個產品，更新 ${result.updated} 個產品`,
        "success",
      );
      await loadProducts();
    } else {
      showNotification(result.error || "匯入失敗", "error");
    }
  } catch (error) {
    console.error("Error importing CSV:", error);
    showNotification("匯入失敗", "error");
  }

  // Reset file input
  e.target.value = "";
}

// Handle CSV export
async function handleCSVExport() {
  try {
    window.location.href = `${API_BASE}/csv/export`;
    showNotification("CSV 匯出中...", "success");
  } catch (error) {
    console.error("Error exporting CSV:", error);
    showNotification("匯出失敗", "error");
  }
}

// Handle CSV template download
async function handleCSVTemplateDownload() {
  try {
    window.location.href = `${API_BASE}/csv/template`;
    showNotification("正在下載範本...", "success");
  } catch (error) {
    console.error("Error downloading template:", error);
    showNotification("下載範本失敗", "error");
  }
}

// Utility functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function showNotification(message, type = "info") {
  // Simple alert for now - can be replaced with a better notification system
  const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  alert(`${emoji} ${message}`);
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Batch Transaction Functions
let batchItemIndex = 0;

function openBatchModal() {
  batchItemIndex = 0;
  document.getElementById("batch-form").reset();
  document.getElementById("batch-items-container").innerHTML = "";
  addBatchItem(); // Add first item by default
  openModal("batch-modal");
}

function addBatchItem() {
  const container = document.getElementById("batch-items-container");
  const index = batchItemIndex++;

  const itemDiv = document.createElement("div");
  itemDiv.className = "border border-gray-200 rounded-lg p-4 bg-gray-50";
  itemDiv.dataset.index = index;
  itemDiv.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <h5 class="font-medium text-gray-700">產品 ${index + 1}</h5>
      <button type="button" onclick="removeBatchItem(${index})" class="text-red-600 hover:text-red-800 text-sm">
        ✕ 移除
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">產品 *</label>
        <select class="batch-product-select w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" required>
          <option value="">選擇產品...</option>
          ${products
            .map(
              (p) =>
                `<option value="${p.id}" data-accountable="${p.accountable_quantity}" data-non-accountable="${p.non_accountable_quantity}">${p.name} (${p.sku})</option>`,
            )
            .join("")}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">類型 *</label>
        <select class="batch-quantity-type-select w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" required>
          <option value="accountable">有帳</option>
          <option value="non_accountable">無帳</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">數量變動 *</label>
        <input type="number" class="batch-quantity-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" placeholder="+10 或 -5" required />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">說明</label>
        <input type="text" class="batch-remarks-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" placeholder="備註..." />
      </div>
    </div>
  `;

  container.appendChild(itemDiv);
}

function removeBatchItem(index) {
  const item = document.querySelector(`[data-index="${index}"]`);
  if (item) {
    item.remove();
  }

  // Renumber remaining items
  const items = document.querySelectorAll("#batch-items-container > div");
  items.forEach((item, i) => {
    const title = item.querySelector("h5");
    if (title) {
      title.textContent = `產品 ${i + 1}`;
    }
  });
}

async function handleBatchSubmit(e) {
  e.preventDefault();

  const tagId = document.getElementById("batch-tag").value;
  const description = document.getElementById("batch-description").value;

  if (!tagId) {
    showNotification("請選擇標籤", "error");
    return;
  }

  // Collect all batch items
  const items = [];
  const itemDivs = document.querySelectorAll("#batch-items-container > div");

  if (itemDivs.length === 0) {
    showNotification("請至少添加一個產品", "error");
    return;
  }

  for (const itemDiv of itemDivs) {
    const productSelect = itemDiv.querySelector(".batch-product-select");
    const quantityTypeSelect = itemDiv.querySelector(
      ".batch-quantity-type-select",
    );
    const quantityInput = itemDiv.querySelector(".batch-quantity-input");
    const remarksInput = itemDiv.querySelector(".batch-remarks-input");

    const productId = productSelect.value;
    const quantityType = quantityTypeSelect.value;
    const quantityChange = parseInt(quantityInput.value);
    const remarks = remarksInput.value;

    if (!productId || !quantityChange || !quantityType) {
      showNotification("請填寫所有必填欄位", "error");
      return;
    }

    items.push({
      product_id: parseInt(productId),
      quantity_type: quantityType,
      quantity_change: quantityChange,
      remarks: remarks || "",
    });
  }

  try {
    const response = await fetch(`${API_BASE}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        tag_id: parseInt(tagId),
        description: description || "",
      }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification(
        `批次異動成功！處理了 ${result.data.processed_items.length} 個產品`,
        "success",
      );
      closeModal("batch-modal");
      await loadProducts();
    } else {
      showNotification(result.error || "批次異動失敗", "error");
    }
  } catch (error) {
    console.error("Error creating batch:", error);
    showNotification("批次異動失敗", "error");
  }
}

async function openBatchesListModal() {
  openModal("batches-list-modal");

  try {
    const response = await fetch(`${API_BASE}/batches`);
    const result = await response.json();

    if (result.success) {
      renderBatchesList(result.data);
    }
  } catch (error) {
    console.error("Error loading batches:", error);
    showNotification("載入批次列表失敗", "error");
  }
}

function renderBatchesList(batches) {
  const tbody = document.getElementById("batches-table-body");
  tbody.innerHTML = "";

  if (batches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-gray-500">
          沒有批次記錄
        </td>
      </tr>
    `;
    return;
  }

  batches.forEach((batch) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${
        batch.batch_number
      }</td>
      <td class="px-4 py-3 text-sm text-gray-600">${
        batch.description || "-"
      }</td>
      <td class="px-4 py-3 text-sm text-gray-900">${batch.item_count}</td>
      <td class="px-4 py-3 text-sm text-green-600 font-semibold">${
        batch.total_in || 0
      }</td>
      <td class="px-4 py-3 text-sm text-red-600 font-semibold">${
        batch.total_out || 0
      }</td>
      <td class="px-4 py-3 text-sm text-gray-600">${formatDateTime(
        batch.created_at,
      )}</td>
      <td class="px-4 py-3 text-sm">
        <button onclick="viewBatchDetails(${
          batch.id
        })" class="text-purple-600 hover:text-purple-800 font-medium">
          查看詳情
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function viewBatchDetails(batchId) {
  try {
    const response = await fetch(`${API_BASE}/batches/${batchId}`);
    const result = await response.json();

    if (result.success) {
      const batch = result.data;
      document.getElementById("batch-detail-number").textContent =
        batch.batch_number;
      document.getElementById("batch-detail-description").textContent =
        batch.description || "-";
      document.getElementById("batch-detail-time").textContent = formatDateTime(
        batch.created_at,
      );

      const tbody = document.getElementById("batch-detail-table-body");
      tbody.innerHTML = "";

      batch.transactions.forEach((trans) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="px-4 py-3 text-sm text-gray-900">${trans.sku}</td>
          <td class="px-4 py-3 text-sm text-gray-900">${trans.product_name}</td>
          <td class="px-4 py-3">
            <span class="badge" style="background-color: ${
              trans.tag_color
            }20; color: ${trans.tag_color}">
              ${trans.tag_name}
            </span>
          </td>
          <td class="px-4 py-3 text-sm font-semibold ${
            trans.quantity_change > 0 ? "text-green-600" : "text-red-600"
          }">
            ${trans.quantity_change > 0 ? "+" : ""}${trans.quantity_change}
          </td>
          <td class="px-4 py-3 text-sm text-gray-600">${
            trans.remarks || "-"
          }</td>
        `;
        tbody.appendChild(row);
      });

      closeModal("batches-list-modal");
      openModal("batch-details-modal");
    }
  } catch (error) {
    console.error("Error loading batch details:", error);
    showNotification("載入批次詳情失敗", "error");
  }
}
