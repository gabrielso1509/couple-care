begin;
-- Guarda apenas a referência da conexão, sem credenciais ou transações.
create table public.pluggy_connections (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 item_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,item_id)
);
alter table public.pluggy_connections enable row level security;
revoke all on public.pluggy_connections from public,anon,authenticated;
grant select,delete on public.pluggy_connections to authenticated;
grant insert(user_id,item_id),update(user_id,item_id) on public.pluggy_connections to authenticated;
create policy pluggy_own_select on public.pluggy_connections for select to authenticated using(user_id=(select auth.uid()));
create policy pluggy_own_insert on public.pluggy_connections for insert to authenticated with check(user_id=(select auth.uid()));
create policy pluggy_own_update on public.pluggy_connections for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy pluggy_own_delete on public.pluggy_connections for delete to authenticated using(user_id=(select auth.uid()));
-- A API confere também clientUserId na Pluggy em TODA consulta, mesmo com referência adulterada.
notify pgrst,'reload schema';
commit;
