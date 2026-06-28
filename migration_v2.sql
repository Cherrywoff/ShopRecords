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
