-- ==========================================
-- SHOPRECORDS DATABASE SCHEMA AND INITIALIZATION
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SHOPS TABLE
CREATE TABLE public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Basic', -- 'Basic', 'Premium'
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    employee_limit INT NOT NULL DEFAULT 2,
    device_limit INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PROFILES TABLE (Store Roles and Shop Association)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Owner', 'Manager', 'Cashier')),
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PRODUCTS TABLE
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    barcode TEXT,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hsn_code TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    low_stock_threshold NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    is_unlisted BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 4. CUSTOMERS TABLE
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 5. SALES TABLE (Invoices)
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Udhar')),
    status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 6. SALE ITEMS TABLE
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    barcode TEXT,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

-- 7. EXPENSES TABLE
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('Rent', 'Electricity', 'Salary', 'Tea', 'Miscellaneous')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 8. SUPPLIERS TABLE
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    outstanding_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 9. SUPPLIER TRANSACTIONS TABLE
CREATE TABLE public.supplier_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Purchase', 'Payment')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 10. CUSTOMER TRANSACTIONS TABLE (Udhar Ledger)
CREATE TABLE public.customer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('Udhar', 'Payment')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- 11. DAILY CLOSINGS TABLE (Shift cash records)
CREATE TABLE public.daily_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    physical_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    calculated_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    udhar_payments_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    performed_by_user_id UUID,
    performed_by_name TEXT,
    performed_by_role TEXT
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- ==========================================

-- Security Definer function to fetch user's shop_id avoiding RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_shop_id()
RETURNS UUID
SECURITY DEFINER
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql;

-- Security Definer function to fetch user's role avoiding RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql;

-- ==========================================
-- ENABLE RLS & DEFINE TENANT ISOLATION POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

-- --- SHOPS POLICIES ---
CREATE POLICY shops_admin_all ON public.shops
    FOR ALL USING (get_my_role() = 'Admin');

CREATE POLICY shops_owner_view ON public.shops
    FOR SELECT USING (id = get_my_shop_id());

-- --- PROFILES POLICIES ---
CREATE POLICY profiles_admin_all ON public.profiles
    FOR ALL USING (get_my_role() = 'Admin');

CREATE POLICY profiles_shop_member ON public.profiles
    FOR ALL USING (shop_id = get_my_shop_id());

-- --- PRODUCTS POLICIES ---
CREATE POLICY products_all_policy ON public.products
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- CUSTOMERS POLICIES ---
CREATE POLICY customers_all_policy ON public.customers
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- SALES POLICIES ---
CREATE POLICY sales_all_policy ON public.sales
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- SALE ITEMS POLICIES ---
CREATE POLICY sale_items_all_policy ON public.sale_items
    FOR ALL USING (
        sale_id IN (SELECT id FROM public.sales WHERE shop_id = get_my_shop_id() OR get_my_role() = 'Admin')
    );

-- --- EXPENSES POLICIES ---
CREATE POLICY expenses_all_policy ON public.expenses
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- SUPPLIERS POLICIES ---
CREATE POLICY suppliers_all_policy ON public.suppliers
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- SUPPLIER TRANSACTIONS POLICIES ---
CREATE POLICY supplier_transactions_all_policy ON public.supplier_transactions
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- CUSTOMER TRANSACTIONS POLICIES ---
CREATE POLICY customer_transactions_all_policy ON public.customer_transactions
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- --- DAILY CLOSINGS POLICIES ---
CREATE POLICY daily_closings_all_policy ON public.daily_closings
    FOR ALL USING (shop_id = get_my_shop_id() OR get_my_role() = 'Admin');

-- ==========================================
-- INDEXES FOR OPTIMAL SEARCH & FETCH PERFORMANCE
-- ==========================================
CREATE INDEX idx_products_shop_barcode ON public.products(shop_id, barcode);
CREATE INDEX idx_products_shop_name ON public.products(shop_id, name);
CREATE INDEX idx_customers_shop_phone ON public.customers(shop_id, phone);
CREATE INDEX idx_sales_shop_date ON public.sales(shop_id, created_at DESC);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_expenses_shop_date ON public.expenses(shop_id, expense_date DESC);
CREATE INDEX idx_customer_tx_customer ON public.customer_transactions(customer_id);
CREATE INDEX idx_supplier_tx_supplier ON public.suppliers(shop_id);
CREATE INDEX idx_daily_closing_date ON public.daily_closings(shop_id, closing_date DESC);

-- ==========================================
-- AUTOMATIC PROFILE CREATION ON USER SIGNUP
-- ==========================================

-- Function to handle auto-creation of a profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, status, shop_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'Owner'),
    'Active',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

