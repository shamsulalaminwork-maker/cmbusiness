-- CorpoMerch online setup. Paste ALL of this into Supabase > SQL Editor > New query, then click Run.
-- Safe to run more than once.

-- 1. One table that holds every shared record (invoice, quotation, product, task, person, settings)
create table if not exists public.records (
  kind       text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid        default auth.uid(),
  primary key (kind, id)
);
create index if not exists records_updated_idx on public.records (updated_at);

-- 2. The server stamps the time and the user on every change
create or replace function public.touch_records() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_records();

-- 3. Only signed-in team members can read or write
alter table public.records enable row level security;
drop policy if exists team_all on public.records;
create policy team_all on public.records for all to authenticated using (true) with check (true);

-- 4. Live updates between phones and computers
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;

-- 5. Private storage for product and task photos
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
drop policy if exists media_team on storage.objects;
create policy media_team on storage.objects for all to authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');

-- Needed on newer Supabase projects: let signed-in users use the table
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.records to authenticated;
