-- Add pro_expires_at column to profiles table for subscription expiry tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ NULL;

-- Index for efficient expiry queries (e.g. cron job checking expired subs)
CREATE INDEX IF NOT EXISTS idx_profiles_pro_expires_at ON profiles(pro_expires_at) WHERE is_pro = true;

-- Comment for clarity
COMMENT ON COLUMN profiles.pro_expires_at IS 'Timestamp when the Pro subscription expires. NULL means no active subscription or free tier.';
