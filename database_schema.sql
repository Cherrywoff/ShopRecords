-- ==========================================
-- SHOPRECORDS DATABASE SCHEMA AND INITIALIZATION
-- (RLS BYPASSED FOR CUSTOM TABLE AUTHENTICATION)
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Wipe existing tables
DROP TABLE IF EXISTS public.daily_closings CASCADE;
DROP TABLE IF EXISTS public.customer_transactions CASCADE;
DROP TABLE IF EXISTS public.supplier_transactions CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;

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

-- 2. USERS TABLE (Custom User Auth - No Supabase Auth needed)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL, -- NULL for Admin
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Owner', 'Manager', 'Cashier')),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
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
-- DISABLE ROW LEVEL SECURITY (RLS) FOR DIRECT ACCESS
-- ==========================================
ALTER TABLE public.shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings DISABLE ROW LEVEL SECURITY;

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
