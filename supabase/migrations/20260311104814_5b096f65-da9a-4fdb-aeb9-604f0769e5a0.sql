ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new_arrival boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_best_seller boolean DEFAULT false;