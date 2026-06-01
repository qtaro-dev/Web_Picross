-- Ticket127: news image storage bucket and RLS policies.
-- Apply after the base schema and admin helper functions are available.

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
