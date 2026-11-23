begin;

-- Resumo exclusivo da conta conectada.
-- Não recebe ID de outra pessoa.
create function public.get_cycle_summary(
    p_today date default (
        (now() at time zone 'America/Sao_Paulo')::date
    )
)
returns table (
    last_start_date date,
    ongoing_start_date date,
    mean_cycle_days numeric,
    mean_period_days numeric,
    cycle_intervals integer,
    completed_periods integer,
    estimated_cycle_days integer,
    estimated_period_days integer,
    cycle_source text,
    next_period_estimate date,
    cycle_variation_days integer
)
language sql
stable
security invoker
set search_path = ''
as $$
    with own_periods as (
        select start_date, end_date, is_ongoing
        from public.menstrual_periods
        where user_id = (select auth.uid())
          and start_date <= p_today
    ),

    -- Diferença entre o início de uma menstruação e o início anterior.
    ordered_starts as (
        select
            start_date,
            start_date - lag(start_date) over (
                order by start_date
            ) as days
        from own_periods
    ),

    latest_intervals as (
        select days
        from ordered_starts
        where days > 0
        order by start_date desc
        limit 6
    ),

    -- Duração do sangramento: inclui o primeiro e o último dia.
    latest_durations as (
        select end_date - start_date + 1 as days
        from own_periods
        where not is_ongoing
          and end_date is not null
          and end_date <= p_today
        order by start_date desc
        limit 6
    ),

    cycle_stats as (
        select
            avg(days) as mean,
            count(*)::integer as total,
            max(days) - min(days) as variation
        from latest_intervals
    ),

    period_stats as (
        select
            avg(days) as mean,
            count(*)::integer as total
        from latest_durations
    ),

    starts as (
        select
            max(start_date) as last_start,
            max(start_date) filter (
                where is_ongoing
            ) as ongoing_start
        from own_periods
    ),

    own_settings as (
        select habitual_cycle_days, habitual_period_days
        from public.cycle_settings
        where user_id = (select auth.uid())
    ),

    summary as (
        select
            s.last_start,
            s.ongoing_start,
            c.mean as cycle_mean,
            p.mean as period_mean,
            c.total as intervals,
            p.total as durations,
            c.variation,

            coalesce(
                round(c.mean)::integer,
                cfg.habitual_cycle_days::integer
            ) as cycle_days,

            coalesce(
                round(p.mean)::integer,
                cfg.habitual_period_days::integer
            ) as period_days,

            case
                when c.mean is not null then 'history'
                when cfg.habitual_cycle_days is not null then 'informed'
                else 'insufficient'
            end as source

        from starts s
        cross join cycle_stats c
        cross join period_stats p
        left join own_settings cfg on true
    )

    select
        last_start,
        ongoing_start,
        round(cycle_mean, 1),
        round(period_mean, 1),
        intervals,
        durations,
        cycle_days,
        period_days,
        source,

        case
            when last_start is not null and cycle_days is not null
            then last_start + cycle_days
            else null
        end,

        variation

    from summary
    where (select auth.uid()) is not null;
$$;

revoke execute on function public.get_cycle_summary(date)
from public, anon, authenticated;

grant execute on function public.get_cycle_summary(date)
to authenticated;


-- Transforma os próprios períodos em dias para desenhar o calendário.
-- Término desconhecido: mostra somente o início confirmado.
create function public.get_my_period_days(
    p_start_date date,
    p_end_date date,
    p_today date default (
        (now() at time zone 'America/Sao_Paulo')::date
    )
)
returns table (
    user_id uuid,
    entry_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
    with periods as (
        select
            user_id,
            greatest(start_date, p_start_date) as first_day,

            least(
                coalesce(
                    end_date,
                    case
                        when is_ongoing then p_today
                        else start_date
                    end
                ),
                p_end_date,
                p_today
            ) as last_day

        from public.menstrual_periods
        where user_id = (select auth.uid())
          and p_end_date - p_start_date between 0 and 366
    )

    select distinct
        p.user_id,
        p.first_day + d.offset_days

    from periods p

    cross join lateral generate_series(
        0,
        p.last_day - p.first_day
    ) as d(offset_days)

    order by 2, 1;
$$;

revoke execute
on function public.get_my_period_days(date, date, date)
from public, anon, authenticated;

grant execute
on function public.get_my_period_days(date, date, date)
to authenticated;


-- Adapta a função já usada pelo calendário.
-- Preserva os dias avulsos e acrescenta os períodos compartilhados.
create or replace function public.get_shared_cycle_days(
    p_start_date date,
    p_end_date date
)
returns table (
    user_id uuid,
    entry_date date
)
language sql
stable
security definer
set search_path = ''
as $$
    with my_couple as (
        select couple_id
        from public.couple_members
        where user_id = (select auth.uid())
    ),

    shared_logs as (
        select log.user_id, log.entry_date

        from public.cycle_logs log

        join my_couple mine
          on mine.couple_id = log.shared_with_couple_id

        join public.couple_members author
          on author.couple_id = mine.couple_id
         and author.user_id = log.user_id

        where log.user_id <> (select auth.uid())
          and log.entry_date between p_start_date and p_end_date
          and p_end_date - p_start_date between 0 and 366
    ),

    shared_periods as (
        select
            p.user_id,
            greatest(p.start_date, p_start_date) as first_day,

            least(
                coalesce(
                    p.end_date,
                    case
                        when p.is_ongoing then
                            (now() at time zone 'America/Sao_Paulo')::date
                        else p.start_date
                    end
                ),
                p_end_date,
                (now() at time zone 'America/Sao_Paulo')::date
            ) as last_day

        from public.menstrual_periods p

        join my_couple mine
          on mine.couple_id = p.shared_with_couple_id

        join public.couple_members author
          on author.couple_id = mine.couple_id
         and author.user_id = p.user_id

        where p.user_id <> (select auth.uid())
          and p_end_date - p_start_date between 0 and 366
    )

    select log.user_id, log.entry_date
    from shared_logs log

    -- UNION impede repetir a mesma data.
    union

    select
        p.user_id,
        p.first_day + d.offset_days

    from shared_periods p

    cross join lateral generate_series(
        0,
        p.last_day - p.first_day
    ) as d(offset_days)

    order by 2, 1;
$$;

revoke execute
on function public.get_shared_cycle_days(date, date)
from public, anon, authenticated;

grant execute
on function public.get_shared_cycle_days(date, date)
to authenticated;

commit;