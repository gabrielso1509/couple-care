begin;

-- Cada linha representa um dia de menstruação informado pela pessoa.
create table public.cycle_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid()
        references auth.users(id) on delete cascade,
    entry_date date not null
        check (entry_date between date '1900-01-01' and date '2100-12-31'),

    -- O fluxo é opcional e fica visível apenas para a dona do registro.
    flow text check (flow in ('light', 'moderate', 'heavy')),

    -- NULL significa privado. O compartilhamento fica vinculado a este casal.
    shared_with_couple_id uuid references public.couples(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1,
    constraint cycle_logs_one_per_day unique(user_id, entry_date)
);

create index cycle_logs_shared_date_idx
on public.cycle_logs(shared_with_couple_id, entry_date)
where shared_with_couple_id is not null;

alter table public.cycle_logs enable row level security;
revoke all on public.cycle_logs from public, anon, authenticated;
grant select, delete on public.cycle_logs to authenticated;
grant insert(entry_date, flow, shared_with_couple_id)
on public.cycle_logs to authenticated;
grant update(entry_date, flow, shared_with_couple_id)
on public.cycle_logs to authenticated;

-- A tabela completa é consultada somente pela própria dona.
create policy cycle_logs_select_own
on public.cycle_logs for select to authenticated
using (user_id = (select auth.uid()));

-- Na regra atual do aplicativo, o perfil feminino pode cadastrar os dias.
create policy cycle_logs_insert_own
on public.cycle_logs for insert to authenticated
with check (
    user_id = (select auth.uid())
    and exists (
        select 1 from public.profiles
        where id = (select auth.uid()) and gender = 'feminino'
    )
    and (
        shared_with_couple_id is null
        or shared_with_couple_id in (
            select couple_id from public.couple_members
            where user_id = (select auth.uid())
        )
    )
);

-- A dona pode editar e revogar o compartilhamento dos registros existentes.
create policy cycle_logs_update_own
on public.cycle_logs for update to authenticated
using (user_id = (select auth.uid()))
with check (
    user_id = (select auth.uid())
    and (
        shared_with_couple_id is null
        or shared_with_couple_id in (
            select couple_id from public.couple_members
            where user_id = (select auth.uid())
        )
    )
);

create policy cycle_logs_delete_own
on public.cycle_logs for delete to authenticated
using (user_id = (select auth.uid()));

create function public.prepare_cycle_log_update()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    new.version := old.version + 1;
    return new;
end;
$$;

create trigger cycle_logs_before_update
before update on public.cycle_logs
for each row execute function public.prepare_cycle_log_update();

revoke execute on function public.prepare_cycle_log_update()
from public, anon, authenticated;

-- O calendário do parceiro recebe somente a pessoa e as datas autorizadas.
-- Não recebe fluxo, datas técnicas ou o conteúdo completo do registro.
create function public.get_shared_cycle_days(p_start_date date, p_end_date date)
returns table(user_id uuid, entry_date date)
language sql stable security definer set search_path = '' as $$
    select log.user_id, log.entry_date
    from public.cycle_logs as log
    join public.couple_members as viewer
      on viewer.couple_id = log.shared_with_couple_id
     and viewer.user_id = (select auth.uid())
    join public.couple_members as author
      on author.couple_id = log.shared_with_couple_id
     and author.user_id = log.user_id
    where (select auth.uid()) is not null
      and log.user_id <> (select auth.uid())
      and log.entry_date between p_start_date and p_end_date
    order by log.entry_date, log.user_id;
$$;

revoke execute on function public.get_shared_cycle_days(date, date)
from public, anon, authenticated;
grant execute on function public.get_shared_cycle_days(date, date)
to authenticated;

commit;
