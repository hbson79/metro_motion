-- Extend document uploads to raster photos. Apply once with project-owner approval.
-- Preserves existing records, private bucket, size limits, Auth and RLS policies.
begin;
alter table public.documents drop constraint documents_storage_path_check;
alter table public.documents add constraint documents_storage_path_check
  check(storage_path ~ '^[A-Za-z0-9_-]+\.(pdf|txt|docx|jpg|jpeg|png|webp)$');
alter table public.documents drop constraint documents_mime_type_check;
alter table public.documents add constraint documents_mime_type_check
  check(mime_type in ('application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp'));
-- Keep any previously allowed MIME types instead of replacing the bucket configuration.
do $$
begin
  if not exists(select 1 from storage.buckets where id='metro-documents') then
    raise exception 'metro-documents bucket is missing';
  end if;
end $$;
update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then null
  else array(select distinct mime from unnest(allowed_mime_types || array['image/jpeg','image/png','image/webp']) as mime order by mime)
end
where id='metro-documents';
commit;
