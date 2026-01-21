-- Seed data for predefined tags
-- Insert only if tags table is empty

INSERT OR IGNORE INTO tags (name, display_name, color) VALUES
('INBOUND', '入庫', '#10B981'),
('OUTBOUND', '出庫', '#EF4444'),
('TRANSFER', '調撥', '#F59E0B'),
('COUNT', '盤點', '#8B5CF6'),
('DAMAGE', '損壞', '#DC2626'),
('SCRAP', '報廢', '#6B7280'),
('RETURN', '退貨', '#3B82F6'),
('LOAN', '借出', '#06B6D4'),
('RETURN_LOAN', '歸還', '#14B8A6'),
('ADJUSTMENT', '調整', '#EC4899');
