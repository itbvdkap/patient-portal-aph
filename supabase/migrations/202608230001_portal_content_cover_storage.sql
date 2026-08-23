insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portal-content-covers',
  'portal-content-covers',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'portal_content_covers_public_read'
  ) then
    create policy "portal_content_covers_public_read"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'portal-content-covers');
  end if;
end $$;
