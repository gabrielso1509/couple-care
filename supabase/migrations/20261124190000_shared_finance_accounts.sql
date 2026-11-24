-- Contas financeiras compartilhadas pelo casal e identificação de importações.
-- A migração é aditiva: preserva os lançamentos e conexões existentes.
begin;

create table public.finance_accounts (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples(id) on delete cascade,
    created_by uuid default auth.uid() references auth.users(id) on delete set null,
    name text not null check (char_length(trim(name)) between 1 and 100),
    account_type text not null check (account_type in ('checking','savings','credit','cash','investment','other')),
    source text not null default 'manual' check (source in ('manual','pluggy')),
    provider text,
    external_account_id text,
    balance_cents bigint not null default 0 check (balance_cents between -99999999999 and 99999999999),
    currency_code text not null default 'BRL' check (currency_code ~ '^[A-Z]{3}$'),
    balance_updated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1,
    unique (couple_id,id),
    constraint finance_accounts_external_fields check (
      (source='manual' and provider is null and external_account_id is null)
      or (source='pluggy' and provider is not null and external_account_id is not null)
    )
);

create unique index finance_accounts_external_unique
  on public.finance_accounts(couple_id,provider,external_account_id);
create index finance_accounts_couple on public.finance_accounts(couple_id,created_at desc);

alter table public.finance_entries
  add column account_id uuid,
  add column source text not null default 'manual' check (source in ('manual','pluggy')),
  add column external_provider text,
  add column external_transaction_id text,
  add constraint finance_entries_account_same_couple
    foreign key (couple_id,account_id) references public.finance_accounts(couple_id,id),
  add constraint finance_entries_external_fields check (
    (source='manual' and external_provider is null and external_transaction_id is null)
    or (source='pluggy' and external_provider is not null and external_transaction_id is not null)
  );

create unique index finance_entries_external_unique
  on public.finance_entries(external_provider,external_transaction_id);
create index finance_entries_account_date
  on public.finance_entries(couple_id,account_id,entry_date desc)
  where account_id is not null;

alter table public.finance_accounts enable row level security;
revoke all on public.finance_accounts from public,anon,authenticated;
grant select,delete on public.finance_accounts to authenticated;
grant insert(couple_id,name,account_type,source,provider,external_account_id,balance_cents,currency_code,balance_updated_at)
  on public.finance_accounts to authenticated;
grant update(name,account_type,source,provider,external_account_id,balance_cents,currency_code,balance_updated_at)
  on public.finance_accounts to authenticated;
create policy finance_accounts_select on public.finance_accounts for select to authenticated
  using (couple_id=(select app_private.my_couple()));
create policy finance_accounts_insert on public.finance_accounts for insert to authenticated
  with check (couple_id=(select app_private.my_couple()));
create policy finance_accounts_update on public.finance_accounts for update to authenticated
  using (couple_id=(select app_private.my_couple()))
  with check (couple_id=(select app_private.my_couple()));
create policy finance_accounts_delete on public.finance_accounts for delete to authenticated
  using (couple_id=(select app_private.my_couple()));
create trigger finance_accounts_version before update on public.finance_accounts
  for each row execute function app_private.bump_version();

-- Mantém a criação manual atual e autoriza o app a associar lançamentos a uma conta.
grant insert(account_id) on public.finance_entries to authenticated;
grant update(account_id) on public.finance_entries to authenticated;

-- Os lançamentos Pluggy serão sincronizados pela pessoa que conectou o banco.
-- Como finance_entries já é compartilhada por RLS, ambos os membros do casal
-- verão os lançamentos importados depois da sincronização.
grant insert(source,external_provider,external_transaction_id) on public.finance_entries to authenticated;
grant update(source,external_provider,external_transaction_id) on public.finance_entries to authenticated;

-- Resumo por intervalo para filtros: hoje, semana, 15 dias, mês, semestre,
-- ano ou intervalo escolhido no calendário. O limite de 366 dias acompanha o
-- maior período oferecido pela interface e reduz consultas acidentais enormes.
create or replace function public.finance_period_summary(p_from date,p_to date)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from
     or p_from < date '1900-01-01' or p_to > date '2100-12-31'
     or p_to - p_from > 365 then
    raise exception 'Escolha um período válido de até 366 dias.' using errcode='22023';
  end if;

  with entries as (
    select e.* from public.finance_entries e
    where e.couple_id=(select app_private.my_couple())
      and e.entry_date between p_from and p_to
  ), sums as (
    select coalesce(sum(amount_cents) filter(where entry_type='income'),0) as income,
           coalesce(sum(amount_cents) filter(where entry_type='expense'),0) as expense
    from entries
  ), categories as (
    select case when e.custom_category_id is null then e.category
                else 'custom:'||e.custom_category_id::text end as category,
           c.name,sum(e.amount_cents) as amount
    from entries e
    left join public.finance_categories c
      on c.id=e.custom_category_id and c.couple_id=e.couple_id
    where e.entry_type='expense'
    group by e.category,e.custom_category_id,c.name
  )
  select jsonb_build_object(
    'income',income,'expense',expense,'balance',income-expense,
    'categories',coalesce((
      select jsonb_agg(jsonb_build_object('category',category,'name',name,'amount',amount)
                       order by amount desc,category)
      from categories
    ),'[]'::jsonb)
  ) into result from sums;
  return result;
end;
$$;
revoke all on function public.finance_period_summary(date,date) from public,anon;
grant execute on function public.finance_period_summary(date,date) to authenticated;

notify pgrst,'reload schema';
commit;
