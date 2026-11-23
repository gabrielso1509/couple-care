-- Interior conectado: finanças, metas, memórias e avisos internos.
-- Não apaga dados existentes. Execute uma vez no SQL Editor.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

-- Consulta o vínculo validado pelo banco, nunca um ID enviado como identidade.
create function app_private.my_couple() returns uuid
language sql stable security invoker set search_path = '' as $$
 select couple_id from public.couple_members where user_id = (select auth.uid());
$$;
revoke all on function app_private.my_couple() from public, anon;
grant execute on function app_private.my_couple() to authenticated;

create function app_private.bump_version() returns trigger
language plpgsql set search_path = '' as $$
begin new.version := old.version + 1; new.updated_at := now(); return new; end;
$$;
revoke all on function app_private.bump_version() from public, anon, authenticated;

create table public.couple_details (
 couple_id uuid primary key references public.couples(id) on delete cascade,
 relationship_date date check (relationship_date between date '1900-01-01' and current_date),
 updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.finance_entries (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 description text not null check (char_length(trim(description)) between 1 and 150),
 entry_type text not null check (entry_type in ('income','expense')),
 amount_cents bigint not null check (amount_cents between 1 and 99999999999),
 category text not null check (category in ('house','leisure','health','market','transport','salary','other')),
 entry_date date not null check (entry_date between date '1900-01-01' and date '2100-12-31'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version integer not null default 1
);
create index finance_entries_couple_date on public.finance_entries(couple_id,entry_date desc);
create table public.savings_goals (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 title text not null check (char_length(trim(title)) between 1 and 150),
 target_cents bigint not null check (target_cents between 1 and 99999999999),
 target_date date check (target_date between date '1900-01-01' and date '2100-12-31'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create index savings_goals_couple on public.savings_goals(couple_id);
create table public.goal_contributions (
 id uuid primary key default gen_random_uuid(),
 goal_id uuid not null references public.savings_goals(id) on delete cascade,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 amount_cents bigint not null check (amount_cents between 1 and 99999999999),
 created_at timestamptz not null default now()
);
create index goal_contributions_goal on public.goal_contributions(goal_id);

create table public.couple_memories (
 id uuid primary key default gen_random_uuid(),
 couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 title text not null check (char_length(trim(title)) between 1 and 150),
 memory_date date not null check (memory_date between date '1900-01-01' and date '2100-12-31'),
 note text not null default '' check (char_length(note) <= 3000),
 photo_paths text[] not null default array[]::text[],
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 constraint memory_photo_count check (cardinality(photo_paths) <= 6 and array_position(photo_paths,null) is null)
);
create index couple_memories_couple_date on public.couple_memories(couple_id,memory_date desc);
create function app_private.check_memory_paths() returns trigger
language plpgsql set search_path = '' as $$
declare p text;
begin
 foreach p in array new.photo_paths loop
  if p !~ ('^' || new.couple_id::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$') then
   raise exception 'Foto fora da pasta deste casal.';
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function app_private.check_memory_paths() from public,anon,authenticated;
create trigger memory_valid_paths before insert or update on public.couple_memories
for each row execute function app_private.check_memory_paths();

create table public.couple_dreams (
 id uuid primary key default gen_random_uuid(), couple_id uuid not null references public.couples(id) on delete cascade,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 title text not null check (char_length(trim(title)) between 1 and 200),
 kind text not null default 'dream' check (kind in ('dream','idea')),
 completed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create index couple_dreams_couple on public.couple_dreams(couple_id);
create unique index couple_dreams_saved_idea on public.couple_dreams(couple_id,lower(trim(title))) where kind='idea';

alter table public.couple_details enable row level security;
revoke all on public.couple_details from public,anon,authenticated;
grant select,delete on public.couple_details to authenticated;
grant insert(couple_id,relationship_date) on public.couple_details to authenticated;
grant update(relationship_date) on public.couple_details to authenticated;
create policy couple_details_select on public.couple_details for select to authenticated using (couple_id = (select app_private.my_couple()));
create policy couple_details_insert on public.couple_details for insert to authenticated with check (couple_id = (select app_private.my_couple()));
create policy couple_details_update on public.couple_details for update to authenticated using (couple_id = (select app_private.my_couple())) with check (couple_id = (select app_private.my_couple()));
create policy couple_details_delete on public.couple_details for delete to authenticated using (couple_id = (select app_private.my_couple()));
create trigger couple_details_version before update on public.couple_details for each row execute function app_private.bump_version();

alter table public.finance_entries enable row level security;
revoke all on public.finance_entries from public,anon,authenticated;
grant select,delete on public.finance_entries to authenticated;
grant insert(couple_id,description,entry_type,amount_cents,category,entry_date) on public.finance_entries to authenticated;
grant update(description,entry_type,amount_cents,category,entry_date) on public.finance_entries to authenticated;
create policy finance_entries_select on public.finance_entries for select to authenticated using (couple_id = (select app_private.my_couple()));
create policy finance_entries_insert on public.finance_entries for insert to authenticated with check (couple_id = (select app_private.my_couple()));
create policy finance_entries_update on public.finance_entries for update to authenticated using (couple_id = (select app_private.my_couple())) with check (couple_id = (select app_private.my_couple()));
create policy finance_entries_delete on public.finance_entries for delete to authenticated using (couple_id = (select app_private.my_couple()));
create trigger finance_entries_version before update on public.finance_entries for each row execute function app_private.bump_version();

alter table public.savings_goals enable row level security;
revoke all on public.savings_goals from public,anon,authenticated;
grant select,delete on public.savings_goals to authenticated;
grant insert(couple_id,title,target_cents,target_date) on public.savings_goals to authenticated;
grant update(title,target_cents,target_date) on public.savings_goals to authenticated;
create policy savings_goals_select on public.savings_goals for select to authenticated using (couple_id = (select app_private.my_couple()));
create policy savings_goals_insert on public.savings_goals for insert to authenticated with check (couple_id = (select app_private.my_couple()));
create policy savings_goals_update on public.savings_goals for update to authenticated using (couple_id = (select app_private.my_couple())) with check (couple_id = (select app_private.my_couple()));
create policy savings_goals_delete on public.savings_goals for delete to authenticated using (couple_id = (select app_private.my_couple()));
create trigger savings_goals_version before update on public.savings_goals for each row execute function app_private.bump_version();

alter table public.couple_memories enable row level security;
revoke all on public.couple_memories from public,anon,authenticated;
grant select,delete on public.couple_memories to authenticated;
grant insert(couple_id,title,memory_date,note,photo_paths) on public.couple_memories to authenticated;
grant update(title,memory_date,note,photo_paths) on public.couple_memories to authenticated;
create policy couple_memories_select on public.couple_memories for select to authenticated using (couple_id = (select app_private.my_couple()));
create policy couple_memories_insert on public.couple_memories for insert to authenticated with check (couple_id = (select app_private.my_couple()));
create policy couple_memories_update on public.couple_memories for update to authenticated using (couple_id = (select app_private.my_couple())) with check (couple_id = (select app_private.my_couple()));
create policy couple_memories_delete on public.couple_memories for delete to authenticated using (couple_id = (select app_private.my_couple()));
create trigger couple_memories_version before update on public.couple_memories for each row execute function app_private.bump_version();

alter table public.couple_dreams enable row level security;
revoke all on public.couple_dreams from public,anon,authenticated;
grant select,delete on public.couple_dreams to authenticated;
grant insert(couple_id,title,kind) on public.couple_dreams to authenticated;
grant update(title,completed) on public.couple_dreams to authenticated;
create policy couple_dreams_select on public.couple_dreams for select to authenticated using (couple_id = (select app_private.my_couple()));
create policy couple_dreams_insert on public.couple_dreams for insert to authenticated with check (couple_id = (select app_private.my_couple()));
create policy couple_dreams_update on public.couple_dreams for update to authenticated using (couple_id = (select app_private.my_couple())) with check (couple_id = (select app_private.my_couple()));
create policy couple_dreams_delete on public.couple_dreams for delete to authenticated using (couple_id = (select app_private.my_couple()));
create trigger couple_dreams_version before update on public.couple_dreams for each row execute function app_private.bump_version();

alter table public.goal_contributions enable row level security;
revoke all on public.goal_contributions from public,anon,authenticated;
grant select on public.goal_contributions to authenticated;
grant insert(goal_id,amount_cents) on public.goal_contributions to authenticated;
-- Corrigir um aporte é excluir e registrar novamente; não altera silenciosamente o valor.
grant delete on public.goal_contributions to authenticated;
create policy contributions_select on public.goal_contributions for select to authenticated using (
 exists(select 1 from public.savings_goals g where g.id=goal_id and g.couple_id=(select app_private.my_couple()))
);
create policy contributions_insert on public.goal_contributions for insert to authenticated with check (
 exists(select 1 from public.savings_goals g where g.id=goal_id and g.couple_id=(select app_private.my_couple()))
);
create policy contributions_delete on public.goal_contributions for delete to authenticated using (
 exists(select 1 from public.savings_goals g where g.id=goal_id and g.couple_id=(select app_private.my_couple()))
);

-- Agrega todos os registros do mês no banco, sem truncar no limite da API.
create function public.finance_month_summary(p_month date) returns jsonb
language sql stable security invoker set search_path = '' as $$
 with bounds as (select date_trunc('month',p_month)::date as first_day),
 entries as (select e.* from public.finance_entries e,bounds b
 where e.couple_id=(select app_private.my_couple()) and e.entry_date >= b.first_day and e.entry_date < (b.first_day+interval '1 month')::date),
 sums as (select coalesce(sum(amount_cents) filter(where entry_type='income'),0) as income,
 coalesce(sum(amount_cents) filter(where entry_type='expense'),0) as expense from entries),
 categories as (select category,sum(amount_cents) as amount from entries where entry_type='expense' group by category)
 select jsonb_build_object('income',income,'expense',expense,'balance',income-expense,
 'categories',coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',amount)) from categories),'[]'::jsonb)) from sums;
$$;
revoke all on function public.finance_month_summary(date) from public,anon;
grant execute on function public.finance_month_summary(date) to authenticated;

create function public.list_savings_goals() returns table(id uuid,title text,target_cents bigint,target_date date,saved_cents numeric,version integer)
language sql stable security invoker set search_path = '' as $$
 select g.id,g.title,g.target_cents,g.target_date,coalesce(sum(c.amount_cents),0),g.version
 from public.savings_goals g left join public.goal_contributions c on c.goal_id=g.id
 where g.couple_id=(select app_private.my_couple()) group by g.id order by g.created_at;
$$;
revoke all on function public.list_savings_goals() from public,anon;
grant execute on function public.list_savings_goals() to authenticated;

-- Fotos privadas: o arquivo nunca recebe uma URL pública.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('couple-memories','couple-memories',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy memories_storage_read on storage.objects for select to authenticated using (
 bucket_id='couple-memories' and (storage.foldername(name))[1]=(select app_private.my_couple())::text
);
create policy memories_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id='couple-memories' and (storage.foldername(name))[1]=(select app_private.my_couple())::text
 and (storage.foldername(name))[2]=(select auth.uid())::text
);
create policy memories_storage_delete on storage.objects for delete to authenticated using (
 bucket_id='couple-memories' and (storage.foldername(name))[1]=(select app_private.my_couple())::text
 and not exists(select 1 from public.couple_memories m where name=any(m.photo_paths))
);

-- Preferências de avisos internos; não promete notificações push no celular.
create table public.notification_preferences (
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 task_updates boolean not null default true,
 moments boolean not null default true,
 weekly_summary boolean not null default false,
 updated_at timestamptz not null default now(),version integer not null default 1
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select on public.notification_preferences to authenticated;
grant insert(task_updates,moments,weekly_summary) on public.notification_preferences to authenticated;
grant update(task_updates,moments,weekly_summary) on public.notification_preferences to authenticated;
create policy preferences_select on public.notification_preferences for select to authenticated using (user_id=(select auth.uid()));
create policy preferences_insert on public.notification_preferences for insert to authenticated with check (user_id=(select auth.uid()));
create policy preferences_update on public.notification_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create trigger preferences_version before update on public.notification_preferences for each row execute function app_private.bump_version();

create table public.app_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 couple_id uuid not null references public.couples(id) on delete cascade,
 event_key text not null,
 title text not null check(char_length(title)<=200),
 link text not null check(link in ('/src/tarefas.html','/src/calendario.html','/src/espaco.html','/src/index.html','/src/config.html')),
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(user_id,event_key)
);
create index notifications_user_date on public.app_notifications(user_id,created_at desc);
alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from public,anon,authenticated;
grant select on public.app_notifications to authenticated;
grant update(read_at) on public.app_notifications to authenticated;
create policy notifications_select on public.app_notifications for select to authenticated using (
 user_id=(select auth.uid()) and couple_id=(select app_private.my_couple())
);
create policy notifications_update on public.app_notifications for update to authenticated using (
 user_id=(select auth.uid()) and couple_id=(select app_private.my_couple())
) with check(user_id=(select auth.uid()) and couple_id=(select app_private.my_couple()));

-- Gatilho interno: só envia avisos genéricos a participantes do mesmo casal.
create function app_private.notify_couple() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m record; title_value text; link_value text; group_value uuid;
begin
 group_value := new.couple_id;
 if tg_table_name='tasks' then title_value := case when tg_op='INSERT' then 'Uma nova tarefa foi adicionada.' else 'Uma tarefa foi atualizada.' end; link_value := '/src/tarefas.html';
 elsif tg_table_name='calendar_events' then title_value := 'Há uma novidade no calendário de vocês.'; link_value := '/src/calendario.html';
 elsif tg_table_name='couple_memories' then title_value := 'Uma memória foi guardada no espaço de vocês.'; link_value := '/src/espaco.html';
 else title_value := 'Seu casal está conectado.'; link_value := '/src/config.html'; end if;
 for m in select cm.user_id from public.couple_members cm where cm.couple_id=group_value and cm.user_id is distinct from auth.uid() loop
  if coalesce((select case when tg_table_name='tasks' then p.task_updates else p.moments end from public.notification_preferences p where p.user_id=m.user_id),true) then
   insert into public.app_notifications(user_id,couple_id,event_key,title,link)
   values(m.user_id,group_value,tg_table_name||':'||group_value::text||':'||coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id')||':'||coalesce(to_jsonb(new)->>'version','1'),title_value,link_value)
   on conflict(user_id,event_key) do nothing;
  end if;
 end loop;
 return new;
end;
$$;
revoke all on function app_private.notify_couple() from public,anon,authenticated;
create trigger tasks_internal_notice after insert or update on public.tasks for each row execute function app_private.notify_couple();
create trigger events_internal_notice after insert or update on public.calendar_events for each row execute function app_private.notify_couple();
create trigger memories_internal_notice after insert on public.couple_memories for each row execute function app_private.notify_couple();
create trigger membership_internal_notice after insert on public.couple_members for each row execute function app_private.notify_couple();

-- Reconciliador chamado ao abrir o aplicativo: sem cron ou cobrança de serviços.
create function public.refresh_my_notifications(p_today date default current_date) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); cid uuid; prefs public.notification_preferences%rowtype; r record;
begin
 if uid is null then raise exception 'Autenticação necessária.'; end if;
 if p_today is null or abs(p_today-current_date)>1 then raise exception 'Data inválida.'; end if;
 select couple_id into cid from public.couple_members where user_id=uid;
 if cid is null then return; end if;
 select * into prefs from public.notification_preferences where user_id=uid;
 if coalesce(prefs.task_updates,true) then
  for r in select id,due_date from public.tasks where couple_id=cid and status='pending' and due_date between p_today-1 and p_today+1 loop
   insert into public.app_notifications(user_id,couple_id,event_key,title,link)
   values(uid,cid,'due:'||r.id||':'||r.due_date,'Confira as tarefas com prazo próximo.','/src/tarefas.html') on conflict do nothing;
  end loop;
 end if;
 if coalesce(prefs.weekly_summary,false) then
  insert into public.app_notifications(user_id,couple_id,event_key,title,link)
  values(uid,cid,'week:'||cid::text||':'||date_trunc('week',p_today)::date,'Seu resumo da semana está disponível.','/src/index.html') on conflict do nothing;
 end if;
end;
$$;
revoke all on function public.refresh_my_notifications(date) from public,anon;
grant execute on function public.refresh_my_notifications(date) to authenticated;

-- Retorna meses disponíveis sem expor períodos privados da outra pessoa.
create function public.available_cycle_months() returns table(month text)
language sql stable security definer set search_path = '' as $$
 with me as (select auth.uid() as uid),
 own_couple as (select couple_id from public.couple_members,me where user_id=me.uid),
 allowed_periods as (
  select p.start_date,p.end_date,p.is_ongoing from public.menstrual_periods p,me
  where me.uid is not null and (p.user_id=me.uid or exists(
   select 1 from public.couple_members author,own_couple c where author.user_id=p.user_id
   and author.couple_id=c.couple_id and p.shared_with_couple_id=c.couple_id))
 ), months as (
  select to_char(g,'YYYY-MM') as value from allowed_periods p cross join lateral generate_series(
   date_trunc('month',p.start_date)::timestamp,
   date_trunc('month',coalesce(p.end_date,case when p.is_ongoing then greatest(p.start_date,current_date) else p.start_date end))::timestamp,
   interval '1 month') g
  union
  select to_char(l.entry_date,'YYYY-MM') from public.cycle_logs l,me where me.uid is not null and
   (l.user_id=me.uid or exists(select 1 from public.couple_members author,own_couple c where author.user_id=l.user_id
    and author.couple_id=c.couple_id and l.shared_with_couple_id=c.couple_id))
 ) select distinct value from months order by value desc;
$$;
revoke all on function public.available_cycle_months() from public,anon;
grant execute on function public.available_cycle_months() to authenticated;
commit;
