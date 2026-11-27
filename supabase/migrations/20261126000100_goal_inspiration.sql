begin;
-- Guarda a referência de uma imagem de inspiração separadamente da meta.
-- A meta e os aportes continuam com suas tabelas e regras anteriores.
create table if not exists public.goal_inspiration (
    goal_id uuid primary key references public.savings_goals(id) on delete cascade,
    pexels_id bigint not null,
    image_url text not null check (image_url like 'https://images.pexels.com/%'),
    photographer text not null,
    source_url text not null check (source_url like 'https://www.pexels.com/%'),
    theme text not null
);
alter table public.goal_inspiration enable row level security;
revoke all on public.goal_inspiration from public, anon, authenticated;
grant select, insert, update, delete on public.goal_inspiration to authenticated;
-- A consulta à meta respeita as políticas existentes do casal.
create policy goal_inspiration_own_couple on public.goal_inspiration for all to authenticated
using (exists (select 1 from public.savings_goals g where g.id = goal_id and g.couple_id = (select app_private.my_couple())))
with check (exists (select 1 from public.savings_goals g where g.id = goal_id and g.couple_id = (select app_private.my_couple())));
notify pgrst, 'reload schema';
commit;
