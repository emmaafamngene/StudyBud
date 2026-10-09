alter table public.documents
  add column if not exists subject text,
  add column if not exists file_size_bytes bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_subject_valid'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_subject_valid
      check (
        subject is null or
        subject in ('Physics', 'Mathematics', 'Chemistry', 'Biology', 'Computer Science', 'Other')
      )
      not valid;
  end if;
end;
$$;

alter table public.documents validate constraint documents_subject_valid;
