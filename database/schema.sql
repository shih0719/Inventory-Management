-- Inventory Management System Database Schema
-- SQLite3 Compatible

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    model TEXT,
    accountable_quantity INTEGER NOT NULL DEFAULT 0,
    non_accountable_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    track_serial INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tags Table (Predefined transaction categories)
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    color TEXT NOT NULL
);

-- Locations Table (Warehouse shelf locations)
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Locations Table (Many-to-many relationship mapping product models to locations)
CREATE TABLE IF NOT EXISTS product_locations (
    product_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, location_id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Batches Table (For grouping multiple transactions)
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_number TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table (History log)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    batch_id INTEGER,
    location_id INTEGER,
    quantity_change INTEGER NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (tag_id) REFERENCES tags(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- Product Units Table (Serial number tracking for high-value items)
CREATE TABLE IF NOT EXISTS product_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    serial_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'in_stock' CHECK(status IN ('in_stock', 'sold')),
    project_case TEXT,
    sold_to TEXT,
    sold_at DATETIME,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_status ON product_units(status);
CREATE INDEX IF NOT EXISTS idx_product_units_serial_number ON product_units(serial_number);

CREATE TRIGGER IF NOT EXISTS update_product_units_timestamp
AFTER UPDATE ON product_units
FOR EACH ROW
BEGIN
    UPDATE product_units SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_batch_id ON transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_location_id ON transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_batches_batch_number ON batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_product_locations_location_id ON product_locations(location_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Trigger to update updated_at timestamp for locations
CREATE TRIGGER IF NOT EXISTS update_locations_timestamp 
AFTER UPDATE ON locations
FOR EACH ROW
BEGIN
    UPDATE locations SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- Webhook Subscriptions Table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    events     TEXT NOT NULL DEFAULT '["inventory.changed","batch.created","inventory.low"]',
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Delivery Logs Table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    event           TEXT NOT NULL,
    payload         TEXT NOT NULL,
    status_code     INTEGER,
    attempts        INTEGER NOT NULL DEFAULT 0,
    success         INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription_id ON webhook_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);

-- Shipments Table (出貨單據)
CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_number TEXT NOT NULL,
    customer TEXT,
    project_case TEXT,
    shipment_date DATE,
    is_deleted BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shipment Transactions Junction Table (Many-to-many relationship)
CREATE TABLE IF NOT EXISTS shipment_transactions (
    shipment_id INTEGER NOT NULL,
    transaction_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (shipment_id, transaction_id),
    FOREIGN KEY (shipment_id) REFERENCES shipments(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Indexes for Shipments
-- Partial UNIQUE index: only active (not deleted) shipments must have unique shipment_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_shipment_number_active
ON shipments(shipment_number) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_shipments_is_deleted ON shipments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at);
CREATE INDEX IF NOT EXISTS idx_shipment_transactions_shipment_id ON shipment_transactions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_transactions_transaction_id ON shipment_transactions(transaction_id);

-- Trigger to update shipments updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_shipments_timestamp
AFTER UPDATE ON shipments
FOR EACH ROW
BEGIN
    UPDATE shipments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
