-- ===================================================
-- SHOPRECORDS SCHEMA MIGRATION V2
-- Copy and run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ekwygvppeqssjtrffotw/sql/new
-- ===================================================

-- 1. Add GSTIN columns
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gstin TEXT;

-- 2. Update payment_method check constraint and add split details
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Udhar', 'Split'));
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_details JSONB;

-- 3. Ensure customer_transactions table exists for Udhar history ledger
CREATE TABLE IF NOT EXISTS public.customer_transactions (
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

-- Disable Row Level Security on it
ALTER TABLE public.customer_transactions DISABLE ROW LEVEL SECURITY;
