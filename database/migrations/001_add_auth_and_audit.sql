-- Migration: Add authentication and audit trail tables
-- Created: 2026-05-25

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')),
    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add created_by_user column to transactions table
ALTER TABLE transactions ADD COLUMN created_by_user TEXT;

-- Add created_by_user column to batches table
ALTER TABLE batches ADD COLUMN created_by_user TEXT;

-- Add created_by_user column to shipments table
ALTER TABLE shipments ADD COLUMN created_by_user TEXT;

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Create indexes for tracking created_by_user
CREATE INDEX IF NOT EXISTS idx_transactions_created_by_user ON transactions(created_by_user);
CREATE INDEX IF NOT EXISTS idx_batches_created_by_user ON batches(created_by_user);
CREATE INDEX IF NOT EXISTS idx_shipments_created_by_user ON shipments(created_by_user);
