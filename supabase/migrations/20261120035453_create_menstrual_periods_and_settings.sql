begin;

-- Permite impedir períodos sobrepostos para a mesma pessoa.
create extension if not exists btree_gist with schema extensions;

-- Preferências informadas pela usuária.
-- Estes valores não são médias calculadas pelo aplicativo.
create table public.cycle_settings (
    user_id uuid primary key default auth.uid()
        references auth.users(id) on delete cascade,

    habitual_cycle_days smallint
        check (habitual_cycle_days between 1 and 365),

    habitual_period_days smallint
        check (habitual_period_days between 1 and 365),

    regularity text not null default 'unknown'
        check (regularity in ('unknown', 'regular', 'irregular')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1,

    constraint cycle_settings_valid_durations check (
        habitual_cycle_days is null
        or habitual_period_days is null
        or habitual_period_days <= habitual_cycle_days
    )
);

-- Cada linha representa uma menstruação, com início e término.
create table public.menstrual_periods (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null default auth.uid()
        references auth.users(id) on delete cascade,

    start_date date not null
        check (
            start_date between date '1900-01-01'
            and date '2100-12-31'
        ),

    end_date date
        check (
            end_date between date '1900-01-01'
            and date '2100-12-31'
        ),

    -- Diferencia "continua menstruando" de "não lembro o término".
    is_ongoing boolean not null default true,

    -- Compartilhamento desligado por padrão.
    shared_with_couple_id uuid
        references public.couples(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    version integer not null default 1,

    constraint menstrual_periods_valid_dates check (
        end_date is null or end_date >= start_date
    ),

    constraint menstrual_periods_ongoing_without_end check (
        not is_ongoing or end_date is null
    ),

    -- Intervalo técnico usado para impedir sobreposição.
    -- Em andamento: intervalo aberto.
    -- Término desconhecido: somente o início está confirmado.
    period_span daterange generated always as (
        daterange(
            start_date,
            case
                when is_ongoing then null
                else coalesce(end_date, start_date)
            end,
            '[]'
        )
    ) stored,

    constraint menstrual_periods_no_overlap
        exclude using gist (
            user_id with =,
            period_span with &&
        )
);

create index menstrual_periods_user_start_idx
on public.menstrual_periods(user_id, start_date desc);

-- Ativa a proteção por linha.
alter table public.cycle_settings enable row level security;
alter table public.menstrual_periods enable row level security;

-- Remove permissões padrão.
revoke all on public.cycle_settings, public.menstrual_periods
from public, anon, authenticated;

grant select, delete
on public.cycle_settings, public.menstrual_periods
to authenticated;

-- O navegador não pode alterar autoria, versão ou datas técnicas.
grant insert(
    habitual_cycle_days,
    habitual_period_days,
    regularity
)
on public.cycle_settings to authenticated;

grant update(
    habitual_cycle_days,
    habitual_period_days,
    regularity
)
on public.cycle_settings to authenticated;

grant insert(
    start_date,
    end_date,
    is_ongoing,
    shared_with_couple_id
)
on public.menstrual_periods to authenticated;

grant update(
    start_date,
    end_date,
    is_ongoing,
    shared_with_couple_id
)
on public.menstrual_periods to authenticated;

-- As configurações pessoais são privadas.
create policy cycle_settings_select_own
on public.cycle_settings
for select to authenticated
using (user_id = (select auth.uid()));

create policy cycle_settings_insert_own
on public.cycle_settings
for insert to authenticated
with check (
    user_id = (select auth.uid())
    and exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and gender = 'feminino'
    )
);

create policy cycle_settings_update_own
on public.cycle_settings
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy cycle_settings_delete_own
on public.cycle_settings
for delete to authenticated
using (user_id = (select auth.uid()));

-- Somente a dona consulta o período completo.
-- A função de resumo do parceiro será adaptada na próxima etapa.
create policy menstrual_periods_select_own
on public.menstrual_periods
for select to authenticated
using (user_id = (select auth.uid()));

create policy menstrual_periods_insert_own
on public.menstrual_periods
for insert to authenticated
with check (
    user_id = (select auth.uid())

    and exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
          and gender = 'feminino'
    )

    and (
        shared_with_couple_id is null

        or shared_with_couple_id in (
            select couple_id
            from public.couple_members
            where user_id = (select auth.uid())
        )
    )
);

create policy menstrual_periods_update_own
on public.menstrual_periods
for update to authenticated
using (user_id = (select auth.uid()))
with check (
    user_id = (select auth.uid())

    and (
        shared_with_couple_id is null

        or shared_with_couple_id in (
            select couple_id
            from public.couple_members
            where user_id = (select auth.uid())
        )
    )
);

create policy menstrual_periods_delete_own
on public.menstrual_periods
for delete to authenticated
using (user_id = (select auth.uid()));

-- Registra alterações e permite controlar edições entre abas.
create function public.prepare_menstrual_record_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    new.version := old.version + 1;

    return new;
end;
$$;

create trigger cycle_settings_before_update
before update on public.cycle_settings
for each row
execute function public.prepare_menstrual_record_update();

create trigger menstrual_periods_before_update
before update on public.menstrual_periods
for each row
execute function public.prepare_menstrual_record_update();

revoke execute
on function public.prepare_menstrual_record_update()
from public, anon, authenticated;

commit;