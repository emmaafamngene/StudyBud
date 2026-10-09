create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null unique,
  extracted_text text not null,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
