-- Safely update all foreign keys pointing to auth.users to use ON DELETE CASCADE
-- This allows deleting users without violating foreign key constraints

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            tc.table_name,
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'users'
          AND ccu.table_schema = 'auth'
          AND tc.table_name IN ('profiles', 'clients', 'quotes', 'invoices')
    LOOP
        -- Drop the existing constraint
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
        
        -- Add the new constraint with CASCADE
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE', 
            r.table_name, r.constraint_name, r.column_name);
    END LOOP;
END $$;
