-- 1. Create Organization Tables
CREATE TABLE organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    email text,
    phone text,
    address text,
    logo_url text,
    paystack_public_key text,
    flutterwave_public_key text,
    country text,
    currency text,
    industry text,
    business_description text,
    bank_accounts jsonb DEFAULT '[]'::jsonb,
    email_flags jsonb DEFAULT '{}'::jsonb,
    is_pro boolean DEFAULT false,
    pro_expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT chk_logo_url_no_base64 CHECK (logo_url IS NULL OR logo_url NOT LIKE 'data:image%')
);

CREATE TABLE organization_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'owner',
    created_at timestamptz DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 2. Add organization_id to all tables
ALTER TABLE clients ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE quotes ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
-- Note: user_secrets is 1-to-1 with organization now, so let's rename the primary key
ALTER TABLE user_secrets ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE user_sequences ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE api_logs ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- 3. Migrate Data
DO $$
DECLARE
    rec RECORD;
    new_org_id uuid;
BEGIN
    FOR rec IN SELECT * FROM profiles
    LOOP
        -- Create Organization for each user
        INSERT INTO organizations (
            name, email, phone, address, logo_url, 
            paystack_public_key, flutterwave_public_key, country, currency,
            industry, business_description, bank_accounts, email_flags,
            is_pro, pro_expires_at, created_at, updated_at
        ) VALUES (
            rec.name, rec.email, rec.phone, rec.address, rec.logo_url,
            rec.paystack_public_key, rec.flutterwave_public_key, rec.country, rec.currency,
            rec.industry, rec.business_description, rec.bank_accounts, rec.email_flags,
            rec.is_pro, rec.pro_expires_at, rec.created_at, rec.updated_at
        ) RETURNING id INTO new_org_id;

        -- Create Member
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (new_org_id, rec.id, 'owner');
        
        -- Migrate related tables
        UPDATE clients SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE invoices SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE quotes SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE notifications SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE user_secrets SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE user_sequences SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE api_logs SET organization_id = new_org_id WHERE user_id = rec.id;
    END LOOP;
END $$;

-- 4. Make organization_id NOT NULL and Drop user_id
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE quotes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE user_secrets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE user_sequences ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE api_logs ALTER COLUMN organization_id SET NOT NULL;

-- Remove old unique constraints and foreign keys relying on user_id
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_user_id_local_id_key;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_local_id_key;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_user_id_local_id_key;
ALTER TABLE user_secrets DROP CONSTRAINT IF EXISTS user_secrets_pkey;
ALTER TABLE user_sequences DROP CONSTRAINT IF EXISTS user_sequences_pkey;


  -- Drop all old policies relying on user_id
  DROP POLICY IF EXISTS "Users can view own clients" ON clients;
  DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
  DROP POLICY IF EXISTS "Users can update own clients" ON clients;
  DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

  DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
  DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;

  DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
  DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
  DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
  DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

  DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
  DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

  DROP POLICY IF EXISTS "Users can view own secrets" ON user_secrets;
  DROP POLICY IF EXISTS "Users can insert own secrets" ON user_secrets;
  DROP POLICY IF EXISTS "Users can update own secrets" ON user_secrets;
  DROP POLICY IF EXISTS "Users can read their own secrets" ON user_secrets;
  DROP POLICY IF EXISTS "Users can insert their own secrets" ON user_secrets;
  DROP POLICY IF EXISTS "Users can update their own secrets" ON user_secrets;

  DROP POLICY IF EXISTS "Users can view own sequences" ON user_sequences;
  
  -- Drop user_id column
ALTER TABLE clients DROP COLUMN user_id;
ALTER TABLE invoices DROP COLUMN user_id;
ALTER TABLE quotes DROP COLUMN user_id;
ALTER TABLE notifications DROP COLUMN user_id;
ALTER TABLE user_secrets DROP COLUMN user_id;
ALTER TABLE user_sequences DROP COLUMN user_id;
ALTER TABLE api_logs DROP COLUMN user_id;

-- Add new constraints
ALTER TABLE clients ADD CONSTRAINT clients_org_id_local_id_key UNIQUE (organization_id, local_id);
ALTER TABLE invoices ADD CONSTRAINT invoices_org_id_local_id_key UNIQUE (organization_id, local_id);
ALTER TABLE quotes ADD CONSTRAINT quotes_org_id_local_id_key UNIQUE (organization_id, local_id);
ALTER TABLE user_secrets ADD CONSTRAINT user_secrets_pkey PRIMARY KEY (organization_id);
ALTER TABLE user_sequences ADD CONSTRAINT user_sequences_pkey PRIMARY KEY (organization_id, entity);
CREATE INDEX idx_api_logs_rate_limit ON api_logs (organization_id, endpoint, created_at);

-- 5. Drop old profiles table
DROP TABLE profiles CASCADE;

-- 6. Rewrite RLS Policies
-- First, drop all existing policies
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check membership
CREATE OR REPLACE FUNCTION public.is_member_of(_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE organization_id = _org_id AND user_id = auth.uid()
    );
$$;

-- Create Policies
CREATE POLICY "Users can view their organizations" ON organizations FOR SELECT 
USING (public.is_member_of(id));
CREATE POLICY "Users can update their organizations" ON organizations FOR UPDATE 
USING (public.is_member_of(id));

CREATE POLICY "Users can view members of their organizations" ON organization_members FOR SELECT 
USING (public.is_member_of(organization_id));

-- For data tables
CREATE POLICY "Members can view clients" ON clients FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "Members can insert clients" ON clients FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "Members can update clients" ON clients FOR UPDATE USING (public.is_member_of(organization_id));
CREATE POLICY "Members can delete clients" ON clients FOR DELETE USING (public.is_member_of(organization_id));

CREATE POLICY "Members can view invoices" ON invoices FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "Members can insert invoices" ON invoices FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "Members can update invoices" ON invoices FOR UPDATE USING (public.is_member_of(organization_id));
CREATE POLICY "Members can delete invoices" ON invoices FOR DELETE USING (public.is_member_of(organization_id));

CREATE POLICY "Members can view quotes" ON quotes FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "Members can insert quotes" ON quotes FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "Members can update quotes" ON quotes FOR UPDATE USING (public.is_member_of(organization_id));
CREATE POLICY "Members can delete quotes" ON quotes FOR DELETE USING (public.is_member_of(organization_id));

CREATE POLICY "Members can view notifications" ON notifications FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "Members can update notifications" ON notifications FOR UPDATE USING (public.is_member_of(organization_id));
CREATE POLICY "Members can delete notifications" ON notifications FOR DELETE USING (public.is_member_of(organization_id));

CREATE POLICY "Members can view secrets" ON user_secrets FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "Members can insert secrets" ON user_secrets FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "Members can update secrets" ON user_secrets FOR UPDATE USING (public.is_member_of(organization_id));

CREATE POLICY "Members can view sequences" ON user_sequences FOR SELECT USING (public.is_member_of(organization_id));

-- 7. Triggers for new users
-- Drop old trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    new_org_id uuid;
BEGIN
    INSERT INTO public.organizations (name, email)
    VALUES ('My Business', NEW.email)
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Fix RPC functions
CREATE OR REPLACE FUNCTION "public"."get_public_profile"("p_id" "uuid") RETURNS SETOF "public"."organizations"
      LANGUAGE "plpgsql" SECURITY DEFINER
      SET "search_path" TO 'public'
      AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.organizations WHERE id = p_id LIMIT 1;
END;
$$;
