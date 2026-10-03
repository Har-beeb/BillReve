-- Reload schema cache so RPCs return the new theme column
NOTIFY pgrst, 'reload schema';
