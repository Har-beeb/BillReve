-- =============================================================================
-- 20261014020000_campaign_assets_bucket.sql
--
-- Public storage bucket for images embedded in campaign emails.
--
-- WHY NOT BASE64: inlining images as data URIs bloats every message (often past
-- the 102KB point where Gmail clips the body), is a spam signal, and is blocked
-- outright by several clients. The same reasoning already drives the
-- chk_logo_url_no_base64 CHECK constraint on organizations.logo_url.
--
-- The bucket is PUBLIC because the images have to render in a recipient's
-- inbox, where there is no session and no signed-URL support. Objects are
-- namespaced per organization and writes are restricted to members of that
-- organization, so one tenant cannot write into another's folder.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'campaign-assets',
    'campaign-assets',
    true,
    2097152, -- 2MB. Large images are the main cause of clipped, slow-loading email.
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
   SET public = true,
       file_size_limit = 2097152,
       allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- Anyone may read: these URLs are fetched by mail clients with no credentials.
DROP POLICY IF EXISTS "Campaign assets are publicly readable" ON storage.objects;
CREATE POLICY "Campaign assets are publicly readable" ON storage.objects
    FOR SELECT USING (bucket_id = 'campaign-assets');

-- Writes are scoped to the organization that owns the first path segment.
-- Objects are stored as `<organization_id>/<filename>`.
DROP POLICY IF EXISTS "Members upload campaign assets" ON storage.objects;
CREATE POLICY "Members upload campaign assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'campaign-assets'
        AND public.is_member_of(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Members update campaign assets" ON storage.objects;
CREATE POLICY "Members update campaign assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'campaign-assets'
        AND public.is_member_of(((storage.foldername(name))[1])::uuid)
    );

DROP POLICY IF EXISTS "Members delete campaign assets" ON storage.objects;
CREATE POLICY "Members delete campaign assets" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'campaign-assets'
        AND public.is_member_of(((storage.foldername(name))[1])::uuid)
    );
