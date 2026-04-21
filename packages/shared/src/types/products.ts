export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string;
  price: number; // ZAR, VAT-inclusive
  image_url?: string;
  description?: string;
  alcohol_percentage?: number;
  volume_ml?: number;
  origin_country?: string;
  stock_quantity: number;
  is_available: boolean;
  is_featured?: boolean;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}
