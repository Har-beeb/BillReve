import { supabase } from './supabase';

/**
 * Resolves the signed-in user's organization id.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `organizations.id` is a randomly generated UUID created by the signup
 * trigger. It is NOT the same value as `auth.users.id`. Four components were
 * written as:
 *
 *     supabase.from('organizations').update({...}).eq('id', user.id)
 *
 * which matches zero rows. PostgREST returns `{ data: [], error: null }` for a
 * zero-row UPDATE, so `if (error) throw` never fires and the UI reports
 * success. The practical effect was that bank accounts, gateway public keys,
 * business name, address and logo were never persisted to the cloud — they
 * lived only in localStorage and vanished on a second device or a cache clear.
 *
 * Tenancy must always be resolved through `organization_members`. Use this
 * helper rather than reaching for `user.id`.
 * ---------------------------------------------------------------------------
 *
 * The result is memoised per session because it is needed on most writes and
 * never changes while signed in. Call `clearOrganizationCache()` on logout.
 */
let cachedOrgId: string | null = null;
let inFlight: Promise<string | null> | null = null;

export const getOrganizationId = async (): Promise<string | null> => {
  if (cachedOrgId) return cachedOrgId;

  // Collapse concurrent callers onto one request.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[organization] Failed to resolve organization:', error);
        return null;
      }

      cachedOrgId = data?.organization_id ?? null;
      return cachedOrgId;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
};

/** Clear the memoised id. Must be called on logout, or the next user inherits it. */
export const clearOrganizationCache = () => {
  cachedOrgId = null;
  inFlight = null;
};

/**
 * Same as `getOrganizationId` but throws instead of returning null, for write
 * paths where silently doing nothing is worse than surfacing an error.
 */
export const requireOrganizationId = async (): Promise<string> => {
  const orgId = await getOrganizationId();
  if (!orgId) {
    throw new Error('Could not resolve your workspace. Please sign out and back in, then try again.');
  }
  return orgId;
};
