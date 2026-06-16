-- Storage bucket for inline document media (images pasted / dropped / uploaded
-- in the editor). Referenced from the markdown body as `![alt](url)`.
--
-- Reference only — like the other files here, apply manually via the Supabase
-- SQL editor (or create the bucket in the dashboard). Public read so images
-- render on the published /d/{slug} page without auth; writes happen only
-- through the server upload route under the service-role key, which bypasses
-- RLS, so no anon insert policy is needed.

insert into storage.buckets (id, name, public)
values ('doc-media', 'doc-media', true)
on conflict (id) do nothing;

-- Public, read-only access to objects in this bucket.
drop policy if exists "doc-media public read" on storage.objects;
create policy "doc-media public read"
  on storage.objects for select
  using (bucket_id = 'doc-media');
