-- Contas a pagar do casal: compromissos avulsos ou recorrentes.
begin;

create table public.finance_bills (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null references public.couples(id) on delete cascade,
    created_by uuid default auth.uid() references auth.users(id) on delete set null,
    name text not null check (char_length(trim(name)) between 1 and 100),
    amount_cents bigint not null check (amount_cents between 1 and 99999999999),
    category text not null default 'other'
      check (category in ('house','leisure','health','market','transport','salary','other')),
    custom_category_id uuid,
    account_id uuid,
    due_date date not null check (due_date between date '1900-01-01' and date '2100-12-31'),
    recurrence text not null default 'once' check (recurrence in ('once','monthly','yearly')),
    is_active boolean not null default true,
    last_paid_at date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1,
    unique (couple_id,id),
    constraint finance_bills_account_same_couple
      foreign key (couple_id,account_id) references public.finance_accounts(couple_id,id),
    constraint finance_bills_category_same_couple
      foreign key (couple_id,custom_category_id) references public.finance_categories(couple_id,id),
    constraint finance_bills_category_fallback
      check (custom_category_id is null or category='other')
);

create index finance_bills_couple_due on public.finance_bills(couple_id,due_date) where is_active;
alter table public.finance_bills enable row level security;
revoke all on public.finance_bills from public,anon,authenticated;
grant select,delete on public.finance_bills to authenticated;
grant insert(couple_id,name,amount_cents,category,custom_category_id,account_id,due_date,recurrence)
  on public.finance_bills to authenticated;
grant update(name,amount_cents,category,custom_category_id,account_id,due_date,recurrence,is_active,last_paid_at)
  on public.finance_bills to authenticated;
create policy finance_bills_select on public.finance_bills for select to authenticated
  using (couple_id=(select app_private.my_couple()));
create policy finance_bills_insert on public.finance_bills for insert to authenticated
  with check (couple_id=(select app_private.my_couple()));
create policy finance_bills_update on public.finance_bills for update to authenticated
  using (couple_id=(select app_private.my_couple()))
  with check (couple_id=(select app_private.my_couple()));
create policy finance_bills_delete on public.finance_bills for delete to authenticated
  using (couple_id=(select app_private.my_couple()));
create trigger finance_bills_version before update on public.finance_bills
  for each row execute function app_private.bump_version();

create or replace function public.finance_mark_bill_paid(p_bill_id uuid,p_paid_on date default current_date)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare updated public.finance_bills;
begin
  update public.finance_bills b
  set last_paid_at=p_paid_on,
      due_date=case
        when b.recurrence='monthly' then (b.due_date + interval '1 month')::date
        when b.recurrence='yearly' then (b.due_date + interval '1 year')::date
        else b.due_date
      end,
      is_active=(b.recurrence <> 'once')
  where b.id=p_bill_id and b.couple_id=(select app_private.my_couple()) and b.is_active
  returning b.* into updated;
  if not found then raise exception 'Conta não encontrada ou já paga.' using errcode='P0002'; end if;
  return jsonb_build_object('id',updated.id,'due_date',updated.due_date,'is_active',updated.is_active,'last_paid_at',updated.last_paid_at);
end;
$$;
revoke all on function public.finance_mark_bill_paid(uuid,date) from public,anon;
grant execute on function public.finance_mark_bill_paid(uuid,date) to authenticated;

notify pgrst,'reload schema';
commit;
