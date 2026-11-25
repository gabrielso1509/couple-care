begin;

create table public.finance_monthly_budgets (
    couple_id uuid not null references public.couples(id) on delete cascade,
    month_start date not null check (
        month_start between date '1900-01-01' and date '2100-12-01'
        and extract(day from month_start) = 1
    ),
    amount_cents bigint not null check (amount_cents between 1 and 99999999999),
    primary key (couple_id, month_start)
);

alter table public.finance_monthly_budgets enable row level security;
revoke all on public.finance_monthly_budgets from public, anon, authenticated;
grant select, delete on public.finance_monthly_budgets to authenticated;
grant insert (couple_id, month_start, amount_cents),
      update (couple_id, month_start, amount_cents) on public.finance_monthly_budgets to authenticated;

create policy finance_monthly_budgets_couple
on public.finance_monthly_budgets for all to authenticated
using (couple_id = (select app_private.my_couple()))
with check (couple_id = (select app_private.my_couple()));

commit;
