-- Categorias próprias do casal, preservando as categorias e lançamentos existentes.
-- Requer a migração do interior completo já aplicada. Execute uma única vez.
begin;
create table public.finance_categories (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples(id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 40),
    created_by uuid default auth.uid() references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    unique (couple_id,id)
);
create unique index finance_categories_unique_name
on public.finance_categories(couple_id,lower(trim(name)));
alter table public.finance_categories enable row level security;
revoke all on public.finance_categories from public,anon,authenticated;
grant select on public.finance_categories to authenticated;
grant insert(couple_id,name) on public.finance_categories to authenticated;
create policy finance_categories_select on public.finance_categories for select to authenticated
using (couple_id=(select app_private.my_couple()));
create policy finance_categories_insert on public.finance_categories for insert to authenticated
with check (couple_id=(select app_private.my_couple()));

alter table public.finance_entries add column custom_category_id uuid;
-- Chave composta impede apontar para uma categoria de outro casal.
alter table public.finance_entries add constraint finance_entries_custom_category_same_couple
foreign key (couple_id,custom_category_id) references public.finance_categories(couple_id,id);
alter table public.finance_entries add constraint finance_entries_custom_category_fallback
check (custom_category_id is null or category='other');
create index finance_entries_custom_category_idx on public.finance_entries(custom_category_id)
where custom_category_id is not null;
grant insert(custom_category_id),update(custom_category_id) on public.finance_entries to authenticated;

create or replace function public.finance_month_summary(p_month date) returns jsonb
language sql stable security invoker set search_path = '' as $$
with bounds as (select date_trunc('month',p_month)::date as first_day),
entries as (
 select e.* from public.finance_entries e,bounds b
 where e.couple_id=(select app_private.my_couple())
 and e.entry_date>=b.first_day and e.entry_date<(b.first_day+interval '1 month')::date
), sums as (
 select coalesce(sum(amount_cents) filter(where entry_type='income'),0) as income,
 coalesce(sum(amount_cents) filter(where entry_type='expense'),0) as expense from entries
), categories as (
 select case when e.custom_category_id is null then e.category else 'custom:'||e.custom_category_id::text end as category,
 c.name as name,sum(e.amount_cents) as amount
 from entries e left join public.finance_categories c on c.id=e.custom_category_id and c.couple_id=e.couple_id
 where e.entry_type='expense' group by e.category,e.custom_category_id,c.name
)
select jsonb_build_object('income',income,'expense',expense,'balance',income-expense,
 'categories',coalesce((select jsonb_agg(jsonb_build_object('category',category,'name',name,'amount',amount) order by amount desc,category) from categories),'[]'::jsonb)) from sums;
$$;
revoke all on function public.finance_month_summary(date) from public,anon;
grant execute on function public.finance_month_summary(date) to authenticated;
commit;
