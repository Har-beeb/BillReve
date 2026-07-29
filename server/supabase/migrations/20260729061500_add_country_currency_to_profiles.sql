ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS currency text;
