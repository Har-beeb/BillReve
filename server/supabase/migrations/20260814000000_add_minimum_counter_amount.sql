-- Add minimum_counter_amount to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS minimum_counter_amount numeric;
