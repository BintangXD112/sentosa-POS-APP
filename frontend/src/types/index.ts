export type Role = 'owner' | 'branch_manager' | 'cashier' | 'inventory_staff';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
}

export interface User {
  id: string;
  business_id: string;
  business_name?: string;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  branches: Branch[];
}

export interface Business {
  id: string;
  name: string;
  currency: string;
  phone?: string;
  address?: string;
  receipt_footer?: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
}

export interface Product {
  id: string;
  category_id?: string;
  category_name?: string;
  unit_id?: string;
  unit_name?: string;
  unit_symbol?: string;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  cost_price?: number;
  stock: number;
  is_active: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ReceiptLine {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface SaleDetail {
  id: string;
  receipt_number: string;
  branch_name: string;
  cashier_name: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  amount_paid: number;
  change_due: number;
  status: 'completed' | 'voided';
  notes?: string;
  created_at: string;
  lines: ReceiptLine[];
}

export interface SaleSummary {
  id: string;
  receipt_number: string;
  branch_name: string;
  cashier_name: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  product_name: string;
  sku: string;
  movement_type: string;
  quantity: number;
  balance_after: number;
  reference_id?: string;
  notes?: string;
  actor_name?: string;
  created_at: string;
}

export interface DailySummary {
  total_sales: number;
  total_orders: number;
  cash_sales: number;
  non_cash_sales: number;
  items_sold: number;
  average_order_value: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_sales: number;
}

export interface CashierPerformance {
  cashier_name: string;
  total_orders: number;
  total_sales: number;
}

export interface ReportData {
  start_date: string;
  end_date: string;
  summary: DailySummary;
  top_products: TopProduct[];
  cashier_performance: CashierPerformance[];
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
  total_supplies: number;
}

