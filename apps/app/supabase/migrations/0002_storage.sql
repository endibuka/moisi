-- Private buckets: original uploads and separated stems.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false), ('stems', 'stems', false)
on conflict (id) do nothing;

-- Files are stored under `{user_id}/{job_id}/...`, so the first path
-- segment must match the requesting user.

-- uploads: users manage their own folder.
create policy "uploads read own" on storage.objects
  for select using (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "uploads write own" on storage.objects
  for insert with check (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- stems: users may read their own; the worker writes with the service-role key.
create policy "stems read own" on storage.objects
  for select using (
    bucket_id = 'stems' and (storage.foldername(name))[1] = auth.uid()::text
  );
