// API Base URL
const API_BASE = "/api";

// Global state
let products = [];
let tags = [];
let locations = [];
let html5QrCode = null; // Camera scanner instance
let currentEditingProduct = null;
let currentPage = 1;
let totalPages = 1;
let totalProducts = 0;
let serverUrl = window.location.origin;

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
  // Try to get actual server IP for QR codes
  try {
    const infoRes = await fetch(`${API_BASE}/info`);
    const info = await infoRes.json();
    if (info.url) serverUrl = info.url;
  } catch (e) {
    console.warn("Could not fetch server info, falling back to current origin");
  }

  await loadTags();
  await loadLocations();
  await loadProducts();
  setupEventListeners();
  
  // Check for URL parameters (e.g., ?location=A-01)
  const urlParams = new URLSearchParams(window.location.search);
  const locationParam = urlParams.get('location');
  if (locationParam) {
    // Small delay to ensure everything is rendered
    setTimeout(() => {
      openLocationContentModal(locationParam);
      // Optional: Clean up URL without reload
      // window.history.replaceState({}, document.title, window.location.pathname);
    }, 500);
  }
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

// Load locations from API
async function loadLocations() {
  try {
    const response = await fetch(`${API_BASE}/locations`);
    const result = await response.json();
    if (result.success) {
      locations = result.data;
      populateLocationSelectors();
      renderLocationsTable();
    }
  } catch (error) {
    console.error("Error loading locations:", error);
    showNotification("載入櫃位失敗", "error");
  }
}

// Populate location selectors
function populateLocationSelectors() {
  const transactionLocation = document.getElementById("transaction-location");
  const batchLocation = document.getElementById("batch-location");
  const plModalSelect = document.getElementById("pl-modal-location-select");

  if(transactionLocation) transactionLocation.innerHTML = '<option value="">選擇櫃位...</option>';
  if(batchLocation) batchLocation.innerHTML = '<option value="">無</option>';
  if(plModalSelect) plModalSelect.innerHTML = '<option value="">選擇欲綁定的櫃位...</option>';

  locations.forEach((loc) => {
    const option1 = document.createElement("option");
    option1.value = loc.id;
    option1.textContent = loc.name;
    if(transactionLocation) transactionLocation.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = loc.id;
    option2.textContent = loc.name;
    if(batchLocation) batchLocation.appendChild(option2);

    const option3 = document.createElement("option");
    option3.value = loc.name; // Tag is used in API params as identifier
    option3.textContent = loc.name;
    if(plModalSelect) plModalSelect.appendChild(option3);
  });
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
async function loadProducts(page = 1) {
  try {
    const sku = document.getElementById("filter-sku").value;
    const name = document.getElementById("filter-name").value;
    const model = document.getElementById("filter-model").value;
    const tag = document.getElementById("filter-tag").value;

    let url = `${API_BASE}/products?page=${page}&limit=10`;
    if (sku) url += `&sku=${encodeURIComponent(sku)}`;
    if (name) url += `&name=${encodeURIComponent(name)}`;
    if (model) url += `&model=${encodeURIComponent(model)}`;
    if (tag) url += `&tag=${tag}`;

    const response = await fetch(url);
    const result = await response.json();
    if (result.success) {
      products = result.data;
      currentPage = result.pagination.page;
      totalPages = result.pagination.totalPages;
      totalProducts = result.pagination.total;
      renderProducts();
      renderPagination();
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
    const isLow =
      product.min_stock > 0 &&
      product.accountable_quantity < product.min_stock;
    const row = document.createElement("tr");
    row.className = isLow ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50";
    const accBadgeClass = isLow
      ? "badge bg-red-100 text-red-800"
      : "badge bg-green-100 text-green-800";
    const accLabel = isLow
      ? `⚠️ 有帳: ${product.accountable_quantity} / ${product.min_stock}`
      : `有帳: ${product.accountable_quantity}`;
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
                    <span class="${accBadgeClass}" title="${
                      isLow ? `低於最低庫存閾值 ${product.min_stock}` : ""
                    }">${accLabel}</span>
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
                    <button onclick="openTransactionModal(${product.id}, '${product.name}', ${product.accountable_quantity}, ${product.non_accountable_quantity})" 
                            class="text-blue-600 hover:text-blue-800 font-medium">異動</button>
                    <button onclick="openProductLocationsModal(${product.id}, '${product.sku}', '${product.name}')" 
                            class="text-teal-600 hover:text-teal-800 font-medium">📍 櫃位</button>
                    <button onclick="openHistoryModal(${product.id}, '${product.name}', '${product.sku}')"
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
    const isLow =
      product.min_stock > 0 &&
      product.accountable_quantity < product.min_stock;
    const card = document.createElement("div");
    card.className = isLow
      ? "bg-red-50 border border-red-200 rounded-lg shadow-md p-4"
      : "bg-white rounded-lg shadow-md p-4";
    const accClass = isLow
      ? "font-semibold text-red-600"
      : "font-semibold text-green-600";
    const accText = isLow
      ? `⚠️ ${product.accountable_quantity} / ${product.min_stock}`
      : `${product.accountable_quantity}`;
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
                    <span class="${accClass}">${accText}</span>
                </div>
                <div>
                    <span class="text-gray-600">無帳庫存：</span>
                    <span class="font-semibold text-gray-600">${
                      product.non_accountable_quantity
                    }</span>
                </div>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button onclick="openTransactionModal(${product.id}, '${product.name}', ${product.accountable_quantity}, ${product.non_accountable_quantity})" 
                        class="flex-1 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-600">異動</button>
                <button onclick="openProductLocationsModal(${product.id}, '${product.sku}', '${product.name}')" 
                        class="flex-1 bg-teal-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-teal-600">📍 櫃位</button>
                <button onclick="openHistoryModal(${product.id}, '${product.name}', '${product.sku}')"
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

// Render pagination controls
function renderPagination() {
  const totalSpan = document.getElementById("total-products");
  const buttonsContainer = document.getElementById("pagination-buttons");

  totalSpan.textContent = totalProducts;
  buttonsContainer.innerHTML = "";

  if (totalPages <= 1) {
    buttonsContainer.innerHTML =
      '<span class="text-sm text-gray-500">第 1 頁，共 1 頁</span>';
    return;
  }

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.className = `px-3 py-1 rounded ${
    currentPage === 1
      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
      : "bg-blue-500 text-white hover:bg-blue-600"
  }`;
  prevBtn.textContent = "上一頁";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      loadProducts(currentPage - 1);
    }
  };
  buttonsContainer.appendChild(prevBtn);

  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    const firstBtn = document.createElement("button");
    firstBtn.className =
      "px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300";
    firstBtn.textContent = "1";
    firstBtn.onclick = () => loadProducts(1);
    buttonsContainer.appendChild(firstBtn);

    if (startPage > 2) {
      const dots = document.createElement("span");
      dots.className = "px-2 text-gray-500";
      dots.textContent = "...";
      buttonsContainer.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = `px-3 py-1 rounded ${
      i === currentPage
        ? "bg-blue-600 text-white font-semibold"
        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`;
    pageBtn.textContent = i;
    pageBtn.onclick = () => loadProducts(i);
    buttonsContainer.appendChild(pageBtn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement("span");
      dots.className = "px-2 text-gray-500";
      dots.textContent = "...";
      buttonsContainer.appendChild(dots);
    }

    const lastBtn = document.createElement("button");
    lastBtn.className =
      "px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300";
    lastBtn.textContent = totalPages;
    lastBtn.onclick = () => loadProducts(totalPages);
    buttonsContainer.appendChild(lastBtn);
  }

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.className = `px-3 py-1 rounded ${
    currentPage === totalPages
      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
      : "bg-blue-500 text-white hover:bg-blue-600"
  }`;
  nextBtn.textContent = "下一頁";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      loadProducts(currentPage + 1);
    }
  };
  buttonsContainer.appendChild(nextBtn);
}

// Setup event listeners
function setupEventListeners() {
  // Filter inputs
  document.getElementById("filter-sku").addEventListener(
    "input",
    debounce(() => loadProducts(1), 500),
  );
  document.getElementById("filter-name").addEventListener(
    "input",
    debounce(() => loadProducts(1), 500),
  );
  document.getElementById("filter-model").addEventListener(
    "input",
    debounce(() => loadProducts(1), 500),
  );
  document
    .getElementById("filter-tag")
    .addEventListener("change", () => loadProducts(1));

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

  // Webhooks
  document
    .getElementById("view-webhooks-btn")
    .addEventListener("click", openWebhooksModal);
  document
    .getElementById("webhooks-modal-close")
    .addEventListener("click", () => closeModal("webhooks-modal"));
  document
    .getElementById("webhook-add-btn")
    .addEventListener("click", () => openWebhookForm(null));
  document
    .getElementById("webhook-form-cancel")
    .addEventListener("click", () => closeModal("webhook-form-modal"));
  document
    .getElementById("webhook-form")
    .addEventListener("submit", handleWebhookSubmit);

  // All transactions
  document
    .getElementById("view-all-transactions-btn")
    .addEventListener("click", openAllTransactionsModal);
  document
    .getElementById("all-transactions-modal-close")
    .addEventListener("click", () => closeModal("all-transactions-modal"));
  document
    .getElementById("all-trans-search-btn")
    .addEventListener("click", loadAllTransactions);

  // Locations Management 
  document.getElementById("location-create-form")?.addEventListener("submit", handleLocationCreate);
  document.getElementById("location-scan-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputEL = document.getElementById("scan-location-input");
    const val = inputEL.value.trim();
    if(!val) return;
    
    await openLocationContentModal(val);
    inputEL.value = ''; // clear upon success or attempt
    inputEL.focus(); // keep focus for next scan
  });
  document.getElementById("open-camera-btn")?.addEventListener("click", openCameraScanner);
  document.getElementById("camera-scan-modal-close")?.addEventListener("click", closeCameraScanner);

  // Product Locations
  document.getElementById("product-locations-modal-close")?.addEventListener("click", () => closeModal("product-locations-modal"));
  document.getElementById("assign-location-form")?.addEventListener("submit", handleAssignLocation);

  // System Update
  document.getElementById("check-update-btn")?.addEventListener("click", handleCheckUpdate);

  // Location Content
  document.getElementById("location-content-modal-close")?.addEventListener("click", () => closeModal("location-content-modal"));

  // Location QR Code
  document.getElementById("location-qrcode-modal-close")?.addEventListener("click", () => closeModal("location-qrcode-modal"));
  document.getElementById("location-qrcode-modal-print")?.addEventListener("click", () => {
    const printWindow = window.open('', '_blank');
    const qrContent = document.getElementById("qrcode-container").innerHTML;
    const locName = document.getElementById("qr-modal-location-name").textContent;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>櫃位標籤 - ${locName}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 20px; }
            .label-box { border: 2px solid #000; padding: 20px; display: inline-block; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .qr-placeholder img { width: 200px; height: 200px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <h1>櫃位：${locName}</h1>
            <div class="qr-placeholder">${qrContent}</div>
            <p style="margin-top: 10px; font-size: 14px;">庫房管理系統標籤</p>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  });
}

// Populate all transactions tag filter
function populateAllTransTagFilter() {
  const filterTag = document.getElementById("all-trans-filter-tag");
  if (!filterTag) return;

  filterTag.innerHTML = '<option value="">全部標籤</option>';
  tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag.id;
    option.textContent = tag.display_name;
    filterTag.appendChild(option);
  });
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
    min_stock:
      parseInt(document.getElementById("product-min-stock").value) || 0,
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
      document.getElementById("product-min-stock").value =
        product.min_stock || 0;

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
    location_id: parseInt(document.getElementById("transaction-location").value) || null,
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
                <td colspan="5" class="px-4 py-8 text-center text-gray-500">
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
            <td class="px-4 py-3 text-sm text-gray-600">
                ${
                  transaction.batch_number
                    ? `<span class="badge bg-purple-100 text-purple-800">${transaction.batch_number}</span>`
                    : "-"
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

// Open all transactions modal
async function openAllTransactionsModal() {
  populateAllTransTagFilter();
  openModal("all-transactions-modal");
  await loadAllTransactions();
}

// Load all transactions with filters
async function loadAllTransactions() {
  try {
    const sku = document.getElementById("all-trans-filter-sku").value;
    const tagId = document.getElementById("all-trans-filter-tag").value;
    const type = document.getElementById("all-trans-filter-type").value;

    let url = `${API_BASE}/transactions?limit=500`;
    if (sku) url += `&sku=${encodeURIComponent(sku)}`;
    if (tagId) url += `&tag_id=${tagId}`;
    if (type === "in") url += `&min_quantity=0`;
    if (type === "out") url += `&max_quantity=-1`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      renderAllTransactions(result.data);
    }
  } catch (error) {
    console.error("Error loading all transactions:", error);
    showNotification("載入異動記錄失敗", "error");
  }
}

// Render all transactions table
function renderAllTransactions(transactions) {
  const tbody = document.getElementById("all-transactions-table-body");
  const totalSpan = document.getElementById("all-trans-total");

  tbody.innerHTML = "";
  totalSpan.textContent = transactions.length;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-gray-500">
          沒有找到異動記錄
        </td>
      </tr>
    `;
    return;
  }

  transactions.forEach((trans) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-gray-50";
    row.innerHTML = `
      <td class="px-4 py-3 text-sm text-gray-900">${formatDateTime(
        trans.created_at,
      )}</td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${trans.sku}</td>
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
      <td class="px-4 py-3 text-sm text-gray-600">
        ${
          trans.batch_number
            ? `<span class="badge bg-purple-100 text-purple-800">${trans.batch_number}</span>`
            : "-"
        }
      </td>
      <td class="px-4 py-3 text-sm text-gray-600">${trans.remarks || "-"}</td>
    `;
    tbody.appendChild(row);
  });
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
      <div class="relative">
        <label class="block text-sm font-medium text-gray-700 mb-1">產品 *</label>
        <input 
          type="text" 
          class="batch-product-search w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" 
          placeholder="搜尋 SKU 或名稱..."
          data-index="${index}"
          autocomplete="off"
        />
        <input type="hidden" class="batch-product-id" data-index="${index}" />
        <div class="batch-product-results absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto hidden" data-index="${index}"></div>
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

  // Add event listener for product search
  const searchInput = itemDiv.querySelector(".batch-product-search");
  const resultsDiv = itemDiv.querySelector(".batch-product-results");
  const hiddenInput = itemDiv.querySelector(".batch-product-id");

  let searchTimeout;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();

    if (query.length < 1) {
      resultsDiv.classList.add("hidden");
      hiddenInput.value = "";
      return;
    }

    searchTimeout = setTimeout(async () => {
      await searchBatchProducts(query, resultsDiv, searchInput, hiddenInput);
    }, 300);
  });

  // Hide results when clicking outside
  document.addEventListener("click", function (e) {
    if (!itemDiv.contains(e.target)) {
      resultsDiv.classList.add("hidden");
    }
  });
}

// Search products for batch transaction
async function searchBatchProducts(
  query,
  resultsDiv,
  searchInput,
  hiddenInput,
) {
  try {
    const response = await fetch(
      `${API_BASE}/products?sku=${encodeURIComponent(
        query,
      )}&name=${encodeURIComponent(query)}&limit=50`,
    );
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      resultsDiv.innerHTML = result.data
        .map(
          (p) => `
        <div class="px-3 py-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100 text-sm" 
             data-product-id="${p.id}"
             data-product-name="${p.name.replace(/"/g, "&quot;")}"
             data-product-sku="${p.sku.replace(/"/g, "&quot;")}"
             data-product-accountable="${p.accountable_quantity}"
             data-product-non-accountable="${p.non_accountable_quantity}"
             data-index="${resultsDiv.dataset.index}">
          <div class="font-medium text-gray-900">${p.name}</div>
          <div class="text-xs text-gray-600">SKU: ${p.sku} | 有帳: ${
            p.accountable_quantity
          } | 無帳: ${p.non_accountable_quantity}</div>
        </div>
      `,
        )
        .join("");
      resultsDiv.classList.remove("hidden");

      // Add click event listeners
      resultsDiv.querySelectorAll("[data-product-id]").forEach((item) => {
        item.addEventListener("click", function () {
          selectBatchProduct(
            this.dataset.productId,
            this.dataset.productName,
            this.dataset.productAccountable,
            this.dataset.productNonAccountable,
            this.dataset.productSku,
            this.dataset.index,
          );
        });
      });
    } else {
      resultsDiv.innerHTML =
        '<div class="px-3 py-2 text-sm text-gray-500">沒有找到產品</div>';
      resultsDiv.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error searching products:", error);
  }
}

// Select product for batch transaction
function selectBatchProduct(id, name, accountable, nonAccountable, sku, index) {
  const itemDiv = document.querySelector(`[data-index="${index}"]`);
  if (!itemDiv) return;

  const searchInput = itemDiv.querySelector(".batch-product-search");
  const hiddenInput = itemDiv.querySelector(".batch-product-id");
  const resultsDiv = itemDiv.querySelector(".batch-product-results");

  searchInput.value = `${name} (${sku})`;
  hiddenInput.value = id;
  resultsDiv.classList.add("hidden");
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
    const productIdInput = itemDiv.querySelector(".batch-product-id");
    const quantityTypeSelect = itemDiv.querySelector(
      ".batch-quantity-type-select",
    );
    const quantityInput = itemDiv.querySelector(".batch-quantity-input");
    const remarksInput = itemDiv.querySelector(".batch-remarks-input");

    const productId = productIdInput.value;
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
    const batchLocationId = document.getElementById("batch-location") ? document.getElementById("batch-location").value : null;

    const response = await fetch(`${API_BASE}/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        tag_id: parseInt(tagId),
        location_id: batchLocationId ? parseInt(batchLocationId) : null,
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

// ==========================================
// Locations Management Functions
// ==========================================

function renderLocationsTable() {
  const tbody = document.getElementById("locations-table-body");
  tbody.innerHTML = "";

  if (locations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">沒有櫃位記錄</td></tr>`;
    return;
  }

  locations.forEach(loc => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${loc.name}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${loc.description || "-"}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${formatDateTime(loc.created_at)}</td>
      <td class="px-4 py-3 text-sm">
        <div class="flex gap-2">
          <button onclick="openLocationContentModal('${loc.name}')" class="text-teal-600 hover:text-teal-800 font-medium">查看內容</button>
          <button onclick="showLocationQRCode('${loc.name}')" class="text-indigo-600 hover:text-indigo-800 font-medium">🏷️ 標籤</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function handleLocationCreate(e) {
  e.preventDefault();
  const name = document.getElementById("new-location-name").value;
  const description = document.getElementById("new-location-desc").value;

  try {
    const response = await fetch(`${API_BASE}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description })
    });
    const result = await response.json();
    if (result.success) {
      showNotification("櫃位新增成功", "success");
      document.getElementById("location-create-form").reset();
      await loadLocations(); // Backend creates, we reload
      renderLocationsTable();
    } else {
      showNotification(result.error || "櫃位新增失敗", "error");
    }
  } catch (err) {
    showNotification("新增失敗", "error");
  }
}

async function openLocationContentModal(tag) {
  try {
    const locResponse = await fetch(`${API_BASE}/locations/${encodeURIComponent(tag)}/content`);
    const locResult = await locResponse.json();
    if (locResult.success) {
      const { location, products } = locResult.data;
      document.getElementById("lc-modal-location-name").textContent = location.name;
      document.getElementById("lc-modal-location-desc").textContent = location.description || "無";
      
      const tbody = document.getElementById("lc-modal-table-body");
      tbody.innerHTML = "";
      if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">該櫃位目前沒有產品</td></tr>`;
      } else {
        products.forEach(p => {
          const row = document.createElement("tr");
          
          // Need these values for Transaction Modal
          const accountableQty = p.accountable_quantity || 0;
          const nonAccountableQty = p.non_accountable_quantity || 0;
          
          row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${p.sku}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${p.name}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${p.type}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${p.model || "-"}</td>
            <td class="px-4 py-3 text-sm text-gray-600">
              <div class="flex gap-2">
                <button onclick="openTransactionModalFromLocation(${p.id}, '${p.name}', ${accountableQty}, ${nonAccountableQty}, '${location.id}')" class="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">異動</button>
                <button onclick="unassignLocationFromContentModal('${location.name}', ${p.id}, '${tag}')" class="text-red-600 hover:text-red-800 font-medium whitespace-nowrap">解除綁定</button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
      openModal("location-content-modal");
    } else {
      showNotification(locResult.error || "找不到此櫃位", "error");
    }
  } catch (err) {
    showNotification("載入櫃位內容失敗", "error");
  }
}

async function openProductLocationsModal(productId, sku, name) {
  document.getElementById("pl-modal-product-id").value = productId;
  document.getElementById("pl-modal-product-name").textContent = name;
  document.getElementById("pl-modal-product-sku").textContent = sku;
  document.getElementById("assign-location-form").reset();
  
  openModal("product-locations-modal");
  await refreshProductLocationsTable(sku);
}

async function refreshProductLocationsTable(sku) {
  try {
    const response = await fetch(`${API_BASE}/products/${encodeURIComponent(sku)}/locations`);
    const result = await response.json();
    const tbody = document.getElementById("pl-modal-table-body");
    tbody.innerHTML = "";
    
    if (result.success) {
      const locs = result.data.locations;
      if (locs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="px-4 py-8 text-center text-gray-500">此產品尚未綁定任何櫃位</td></tr>`;
      } else {
        locs.forEach(loc => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${loc.name}</td>
            <td class="px-4 py-3 text-sm">
              <button onclick="unassignLocation('${loc.name}', ${document.getElementById("pl-modal-product-id").value}, '${sku}')" class="text-red-600 hover:text-red-800 font-medium">解除綁定</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    }
  } catch (err) {
    showNotification("載入產品櫃位失敗", "error");
  }
}

async function handleAssignLocation(e) {
  e.preventDefault();
  const productId = parseInt(document.getElementById("pl-modal-product-id").value);
  const locationName = document.getElementById("pl-modal-location-select").value;
  const sku = document.getElementById("pl-modal-product-sku").textContent;

  if(!locationName) return;

  try {
    const response = await fetch(`${API_BASE}/locations/${encodeURIComponent(locationName)}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId })
    });
    const result = await response.json();
    if(result.success) {
      showNotification("綁定成功", "success");
      await refreshProductLocationsTable(sku);
    } else {
      showNotification(result.error || "綁定失敗", "error");
    }
  } catch (err) {
    showNotification("綁定失敗", "error");
  }
}

async function unassignLocation(locationName, productId, sku) {
  if(!confirm(`確定要將產品從櫃位 ${locationName} 移除嗎？`)) return;
  try {
    const response = await fetch(`${API_BASE}/locations/${encodeURIComponent(locationName)}/products/${productId}`, {
      method: "DELETE"
    });
    const result = await response.json();
    if(result.success) {
      showNotification("解綁成功", "success");
      await refreshProductLocationsTable(sku);
    } else {
      showNotification(result.error || "解綁失敗", "error");
    }
} catch(err) {
    showNotification("解綁失敗", "error");
  }
}

// Wrapper for unassigning from content modal to refresh properly
async function unassignLocationFromContentModal(locationName, productId, originalTag) {
  if(!confirm(`確定要將產品從櫃位 ${locationName} 移除嗎？`)) return;
  try {
    const response = await fetch(`${API_BASE}/locations/${encodeURIComponent(locationName)}/products/${productId}`, {
      method: "DELETE"
    });
    const result = await response.json();
    if(result.success) {
      showNotification("解綁成功", "success");
      await openLocationContentModal(originalTag); // Refresh that modal
    } else {
      showNotification(result.error || "解綁失敗", "error");
    }
  } catch(err) {
    showNotification("解綁失敗", "error");
  }
}

// Wrapper for opening transaction modal with pre-filled location
function openTransactionModalFromLocation(productId, productName, accountableQty, nonAccountableQty, locationId) {
  closeModal("location-content-modal"); // Close the parent modal to prevent z-index overlap
  openTransactionModal(productId, productName, accountableQty, nonAccountableQty);
  
  // Pre-fill location
  const locationSelect = document.getElementById("transaction-location");
  if(locationSelect) {
    locationSelect.value = locationId;
  }
}

// Camera Scanning functionality
async function openCameraScanner() {
  openModal("camera-scan-modal");
  
  // Wait a tick for the modal to be visible before initializing the scanner
  setTimeout(async () => {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }
    
    try {
      await html5QrCode.start(
        { facingMode: "environment" }, // Rear camera
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Success callback
          await closeCameraScanner();
          // Pause briefly to ensure camera modal is gone before showing the next
          setTimeout(async () => {
            document.getElementById("scan-location-input").value = decodedText;
            await openLocationContentModal(decodedText);
            document.getElementById("scan-location-input").value = ''; // clear
          }, 200);
        },
        (errorMessage) => {
          // Ignore parsing errors (they trigger continuously while seeking)
        }
      );
    } catch (err) {
      console.error("Camera start error:", err);
      showNotification("無法啟動相機，請確認已授予網站攝影機權限。", "error");
      closeModal("camera-scan-modal");
    }
  }, 100);
}

async function closeCameraScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
    } catch(err) {
      console.error("Error stopping camera", err);
    }
  }
  closeModal("camera-scan-modal");
}

// QR Code Labels
function showLocationQRCode(tag) {
  document.getElementById("qr-modal-location-name").textContent = tag;
  const container = document.getElementById("qrcode-container");
  container.innerHTML = ""; // Clear previous
  
  // Use the detected serverUrl instead of window.location.href
  const url = new URL(serverUrl);
  url.searchParams.set('location', tag);
  const targetUrl = url.toString();
  
  // Generate QR code
  new QRCode(container, {
    text: targetUrl,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });
  
  openModal("location-qrcode-modal");
}

// --- System Update Functions ---

// Handle check update
async function handleCheckUpdate() {
  const btn = document.getElementById("check-update-btn");
  const originalText = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ 檢查中...';
    
    const response = await fetch(`${API_BASE}/system/check-update`);
    const result = await response.json();
    
    if (result.success) {
      if (result.data.updateAvailable) {
        const confirmUpdate = confirm(
          `發現新版本！\n目前版本: ${result.data.localHash}\n遠端版本: ${result.data.remoteHash}\n\n是否現在套用更新？系統將會下載並自動重啟。`
        );
        if (confirmUpdate) {
          await handleApplyUpdate();
        }
      } else {
        alert(`目前已是最新版本 (${result.data.localHash})`);
      }
    } else {
      showNotification(result.error || "檢查更新失敗", "error");
    }
  } catch (error) {
    console.error("Check update error:", error);
    showNotification("無法連接到伺服器進行更新檢查", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Handle apply update
async function handleApplyUpdate() {
  try {
    showNotification("正在下載更新...", "info");
    
    const response = await fetch(`${API_BASE}/system/apply-update`, {
      method: "POST"
    });
    const result = await response.json();
    
    if (result.success) {
      // 顯示倒數提示
      let countdown = 5;
      showNotification(`更新成功！系統將在 ${countdown} 秒後自動重載...`, "success");
      const interval = setInterval(() => {
        countdown--;
        if (countdown < 0) {
          clearInterval(interval);
          window.location.reload();
        } else {
          showNotification(`更新成功！系統將在 ${countdown} 秒後自動重載...`, "success");
        }
      }, 1000);
    } else {
      showNotification(result.error || "更新套用失敗", "error");
    }
  } catch (error) {
    console.error("Apply update error:", error);
    showNotification("更新過程發生錯誤", "error");
  }
}

// ── Webhooks ────────────────────────────────────────────────────────────────

async function openWebhooksModal() {
  openModal("webhooks-modal");
  await loadWebhooks();
}

async function loadWebhooks() {
  const container = document.getElementById("webhooks-list");
  container.innerHTML = '<p class="text-gray-500 text-sm">載入中...</p>';
  try {
    const response = await fetch(`${API_BASE}/webhooks`);
    const result = await response.json();
    if (!result.success) {
      container.innerHTML = `<p class="text-red-500 text-sm">載入失敗：${result.error || ""}</p>`;
      return;
    }
    renderWebhooks(result.data || []);
  } catch (error) {
    console.error("Error loading webhooks:", error);
    container.innerHTML = '<p class="text-red-500 text-sm">載入失敗</p>';
  }
}

function renderWebhooks(subs) {
  const container = document.getElementById("webhooks-list");
  if (subs.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-sm text-center py-4">尚未建立任何 Webhook 訂閱</p>';
    return;
  }
  container.innerHTML = "";
  subs.forEach((sub) => {
    let events = [];
    try {
      events = JSON.parse(sub.events);
    } catch {
      events = [];
    }
    const card = document.createElement("div");
    card.className = "border border-gray-200 rounded-lg p-4 bg-gray-50";
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="font-bold text-gray-900 truncate">${escapeHtml(sub.name)}</h4>
            <span class="badge ${sub.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}">
              ${sub.is_active ? "啟用" : "停用"}
            </span>
          </div>
          <p class="text-xs text-gray-600 break-all">${escapeHtml(sub.url)}</p>
          <div class="flex gap-1 flex-wrap mt-2">
            ${events.map((e) => `<span class="badge bg-pink-100 text-pink-800 text-xs">${escapeHtml(e)}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap mt-3">
        <button onclick="editWebhook(${sub.id})" class="text-blue-600 hover:text-blue-800 text-sm font-medium">編輯</button>
        <button onclick="testWebhook(${sub.id})" class="text-purple-600 hover:text-purple-800 text-sm font-medium">測試推送</button>
        <button onclick="viewWebhookLogs(${sub.id}, '${escapeHtml(sub.name).replace(/'/g, "\\'")}')" class="text-teal-600 hover:text-teal-800 text-sm font-medium">查看紀錄</button>
        <button onclick="deleteWebhook(${sub.id}, '${escapeHtml(sub.name).replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-800 text-sm font-medium">刪除</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openWebhookForm(sub) {
  document.getElementById("webhook-form").reset();
  document.getElementById("webhook-id").value = "";
  document.getElementById("webhook-is-active").checked = true;
  document.querySelectorAll(".webhook-event").forEach((cb) => (cb.checked = true));
  document.getElementById("webhook-form-title").textContent = sub ? "編輯 Webhook" : "新增 Webhook";

  if (sub) {
    document.getElementById("webhook-id").value = sub.id;
    document.getElementById("webhook-name").value = sub.name;
    document.getElementById("webhook-url").value = sub.url;
    document.getElementById("webhook-is-active").checked = !!sub.is_active;
    let events = [];
    try {
      events = JSON.parse(sub.events);
    } catch {
      events = [];
    }
    document.querySelectorAll(".webhook-event").forEach((cb) => {
      cb.checked = events.includes(cb.value);
    });
  }
  openModal("webhook-form-modal");
}

async function editWebhook(id) {
  try {
    const response = await fetch(`${API_BASE}/webhooks`);
    const result = await response.json();
    if (!result.success) {
      showNotification("載入失敗", "error");
      return;
    }
    const sub = (result.data || []).find((s) => s.id === id);
    if (!sub) {
      showNotification("找不到該訂閱", "error");
      return;
    }
    openWebhookForm(sub);
  } catch (error) {
    console.error("Error loading webhook:", error);
    showNotification("載入失敗", "error");
  }
}

async function handleWebhookSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("webhook-id").value;
  const events = Array.from(document.querySelectorAll(".webhook-event:checked")).map((cb) => cb.value);
  if (events.length === 0) {
    showNotification("請至少勾選一個事件", "error");
    return;
  }
  const data = {
    name: document.getElementById("webhook-name").value.trim(),
    url: document.getElementById("webhook-url").value.trim(),
    events,
    is_active: document.getElementById("webhook-is-active").checked ? 1 : 0,
  };
  try {
    const url = id ? `${API_BASE}/webhooks/${id}` : `${API_BASE}/webhooks`;
    const method = id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (result.success) {
      showNotification(id ? "Webhook 更新成功" : "Webhook 新增成功", "success");
      closeModal("webhook-form-modal");
      await loadWebhooks();
    } else {
      showNotification(result.error || "操作失敗", "error");
    }
  } catch (error) {
    console.error("Error saving webhook:", error);
    showNotification("儲存失敗", "error");
  }
}

async function deleteWebhook(id, name) {
  if (!confirm(`確定要刪除 Webhook「${name}」嗎？`)) return;
  try {
    const response = await fetch(`${API_BASE}/webhooks/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (result.success) {
      showNotification("已刪除", "success");
      await loadWebhooks();
    } else {
      showNotification(result.error || "刪除失敗", "error");
    }
  } catch (error) {
    console.error("Error deleting webhook:", error);
    showNotification("刪除失敗", "error");
  }
}

async function testWebhook(id) {
  try {
    const response = await fetch(`${API_BASE}/webhooks/${id}/test`, { method: "POST" });
    const result = await response.json();
    if (result.success) {
      showNotification("測試推送已觸發，請查看紀錄", "success");
    } else {
      showNotification(result.error || "測試失敗", "error");
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    showNotification("測試失敗", "error");
  }
}

async function viewWebhookLogs(id, name) {
  try {
    const response = await fetch(`${API_BASE}/webhooks/${id}/logs?limit=20`);
    const result = await response.json();
    if (!result.success) {
      showNotification(result.error || "載入失敗", "error");
      return;
    }
    const logs = result.data || [];
    if (logs.length === 0) {
      alert(`「${name}」尚無推送紀錄`);
      return;
    }
    const lines = logs.map((log) => {
      const status = log.success ? "✅" : "❌";
      const code = log.status_code != null ? `HTTP ${log.status_code}` : "—";
      const err = log.error_message ? ` — ${log.error_message}` : "";
      return `${status} [${log.created_at}] ${log.event} (${code}, ${log.attempts} 次)${err}`;
    });
    alert(`「${name}」最近 ${logs.length} 筆推送：\n\n${lines.join("\n")}`);
  } catch (error) {
    console.error("Error loading webhook logs:", error);
    showNotification("載入失敗", "error");
  }
}

