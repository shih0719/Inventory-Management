ALTER TABLE product_units ADD COLUMN warehouse_id INTEGER REFERENCES warehouses(id);
