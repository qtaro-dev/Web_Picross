-- Ticket140: news-images Storage visibility review.
--
-- Decision: keep news-images as a public bucket for now.
--
-- Rationale:
-- - Published news images need stable public URLs for the public news screen.
-- - The current UI stores image_url directly on news_posts.
-- - Switching to a private bucket would require signed URL generation,
--   expiry handling, and refresh logic in the public news screen.
--
-- Operational note:
-- - Anyone who knows a news-images object URL can read that image.
-- - Do not upload confidential draft-only images to this bucket.
-- - Remove mistaken or unused files with the admin Storage delete action.
-- - Upload, update, and delete remain restricted to active admins by RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-images',
  'news-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "news_images_public_read" on storage.objects;
create policy "news_images_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'news-images');

drop policy if exists "news_images_admin_insert" on storage.objects;
create policy "news_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'news-images'
  and public.is_admin()
);

drop policy if exists "news_images_admin_update" on storage.objects;
create policy "news_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'news-images'
  and public.is_admin()
)
with check (
  bucket_id = 'news-images'
  and public.is_admin()
);

drop policy if exists "news_images_admin_delete" on storage.objects;
create policy "news_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'news-images'
  and public.is_admin()
);
