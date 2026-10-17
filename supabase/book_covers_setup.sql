-- Run this once in Supabase SQL Editor for AuthorBIO book-cover uploads.
-- Safe to rerun. The website cannot create Storage buckets with its public key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,
  8388608,
  array['image/png','image/jpeg','image/webp','image/gif','image/avif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/avif'];

drop policy if exists "Public can view book covers" on storage.objects;
create policy "Public can view book covers"
on storage.objects for select
using (bucket_id = 'book-covers');

drop policy if exists "Signed-in users upload book covers to own folder" on storage.objects;
create policy "Signed-in users upload book covers to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update own book covers" on storage.objects;
create policy "Users update own book covers"
on storage.objects for update to authenticated
using (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete own book covers" on storage.objects;
create policy "Users delete own book covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'book-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
