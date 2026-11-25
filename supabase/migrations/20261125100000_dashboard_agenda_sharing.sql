begin;

-- Preferências vinculadas ao casal escolhido. Um vínculo novo não herda a autorização.
create table public.cycle_forecast_shares (
    user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    couple_id uuid not null references public.couples(id) on delete cascade
);

create table public.couple_birthdays (
    user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    couple_id uuid not null references public.couples(id) on delete cascade,
    birthday_month smallint not null check (birthday_month between 1 and 12),
    birthday_day smallint not null check (birthday_day between 1 and 31),
    constraint birthday_valid_day check (
        birthday_day <= case birthday_month
            when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30
            else 31 end
    )
);

alter table public.cycle_forecast_shares enable row level security;
alter table public.couple_birthdays enable row level security;
revoke all on public.cycle_forecast_shares, public.couple_birthdays from public, anon, authenticated;
grant select, delete on public.cycle_forecast_shares, public.couple_birthdays to authenticated;
grant insert (couple_id), update (couple_id) on public.cycle_forecast_shares to authenticated;
grant insert (couple_id, birthday_month, birthday_day),
      update (couple_id, birthday_month, birthday_day) on public.couple_birthdays to authenticated;

create policy forecast_own on public.cycle_forecast_shares for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and couple_id = (select app_private.my_couple()));

create policy birthday_own on public.couple_birthdays for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and couple_id = (select app_private.my_couple()));

-- A consulta devolve apenas dia e mês do aniversário de um membro do casal atual.
create function public.get_partner_birthday()
returns table (birthday_month smallint, birthday_day smallint)
language sql stable security definer set search_path = ''
as $$
    select b.birthday_month, b.birthday_day
    from public.couple_members viewer
    join public.couple_members author on author.couple_id = viewer.couple_id and author.user_id <> viewer.user_id
    join public.couple_birthdays b on b.user_id = author.user_id and b.couple_id = viewer.couple_id
    where viewer.user_id = (select auth.uid());
$$;

-- O intervalo consultado não altera a data de referência da previsão.
create function public.get_agenda_cycle(p_from date, p_to date)
returns table (user_id uuid, entry_date date, kind text)
language sql stable security definer set search_path = ''
as $$
    with request as (
        select auth.uid() as viewer, (now() at time zone 'America/Sao_Paulo')::date as today
        where p_to - p_from between 0 and 62 and auth.uid() is not null
    ),
    viewer_couple as (
        select m.couple_id from public.couple_members m join request r on r.viewer = m.user_id
    ),
    partner as (
        select m.user_id, m.couple_id
        from public.couple_members m join viewer_couple c using (couple_id)
        cross join request r where m.user_id <> r.viewer
    ),
    visible_periods as (
        select p.user_id, p.start_date, p.end_date, p.is_ongoing, r.today
        from public.menstrual_periods p cross join request r
        where p.start_date <= least(p_to, r.today)
          and (p.is_ongoing or coalesce(p.end_date, p.start_date) >= p_from)
          and (p.user_id = r.viewer or exists (
              select 1 from partner a where a.user_id = p.user_id and a.couple_id = p.shared_with_couple_id
          ))
    ),
    observed as (
        select p.user_id, d.day, case
            when d.day = p.start_date and d.day = p.end_date then 'period_start_end'
            when d.day = p.start_date then 'period_start'
            when d.day = p.end_date then 'period_end'
            else 'period_day' end as kind
        from visible_periods p
        cross join lateral generate_series(
            0, least(p_to, p.today, coalesce(p.end_date, case when p.is_ongoing then p.today else p.start_date end))
                - greatest(p_from, p.start_date)
        ) n(offset_day)
        cross join lateral (select greatest(p_from, p.start_date) + n.offset_day as day) d
    ),
    legacy_days as (
        select l.user_id, l.entry_date from public.cycle_logs l cross join request r
        where l.entry_date between p_from and least(p_to, r.today)
          and (l.user_id = r.viewer or exists (
              select 1 from partner a where a.user_id = l.user_id and a.couple_id = l.shared_with_couple_id
          ))
    ),
    forecast_owners as (
        select viewer as user_id from request
        union
        select a.user_id from partner a
        join public.cycle_forecast_shares s on s.user_id = a.user_id and s.couple_id = a.couple_id
    ),
    history as (
        select owner.user_id, recent.start_date
        from forecast_owners owner cross join request r
        cross join lateral (
            select p.start_date from public.menstrual_periods p
            where p.user_id = owner.user_id and p.start_date <= r.today
            order by p.start_date desc limit 7
        ) recent
    ),
    intervals as (
        select h.user_id, h.start_date,
               h.start_date - lag(h.start_date) over (partition by h.user_id order by h.start_date) as length
        from history h
    ),
    forecast as (
        select i.user_id, max(i.start_date) + round(avg(i.length))::integer as next_period
        from intervals i left join public.cycle_settings cfg on cfg.user_id = i.user_id
        where cfg.regularity is distinct from 'irregular'
        group by i.user_id
        -- Limites conservadores de exibição, sem substituir os registros do ciclo.
        having count(i.length) >= 2 and min(i.length) >= 21 and max(i.length) <= 35
           and max(i.length) - min(i.length) <= 7
    ),
    projections as (
        select f.user_id, f.next_period - n.offset_day as day, 'fertility_estimate'::text as kind
        from forecast f cross join request r cross join generate_series(13, 19) n(offset_day)
        where f.next_period >= r.today
        union all
        select f.user_id, f.next_period - 5, 'pms_estimate'
        from forecast f cross join request r where f.next_period >= r.today
    )
    select o.user_id, o.day, o.kind from observed o
    union all
    select l.user_id, l.entry_date, 'period_day' from legacy_days l
    where not exists (select 1 from observed o where o.user_id = l.user_id and o.day = l.entry_date)
    union all
    select p.user_id, p.day, p.kind from projections p where p.day between p_from and p_to
    order by 2, 1, 3;
$$;

revoke all on function public.get_partner_birthday(), public.get_agenda_cycle(date, date) from public, anon, authenticated;
grant execute on function public.get_partner_birthday(), public.get_agenda_cycle(date, date) to authenticated;

commit;
