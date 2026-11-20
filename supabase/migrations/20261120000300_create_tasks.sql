-- Tarefas compartilhadas pelos participantes de um casal.
create table public.tasks (
    id uuid primary key default gen_random_uuid(),

    -- Identifica o casal ao qual a tarefa pertence.
    couple_id uuid not null
        references public.couples (id) on delete cascade,

    -- Registra quem criou; preserva a tarefa se a conta for excluída.
    created_by uuid references auth.users (id) on delete set null,

    title text not null
        check (char_length(trim(title)) between 1 and 150),

    -- Sem horário: corresponde ao campo de data do formulário.
    due_date date,

    priority text not null default 'normal'
        check (priority in ('low', 'normal', 'high')),

    status text not null default 'pending'
        check (status in ('pending', 'completed')),

    created_at timestamptz not null default now(),

    completed_at timestamptz,

    -- Uma tarefa concluída precisa ter data de conclusão.
    constraint tasks_completion_consistent
        check (
            (status = 'pending' and completed_at is null)
            or
            (status = 'completed' and completed_at is not null)
        )
);

alter table public.tasks enable row level security;

-- Ajuda a consultar as tarefas de cada casal.
create index tasks_couple_id_idx
on public.tasks (couple_id);

-- Preenche a autoria usando a conta conectada.
alter table public.tasks
alter column created_by set default auth.uid();

-- Define explicitamente as operações permitidas.
revoke all on table public.tasks
from public, anon, authenticated;

grant select, delete on table public.tasks
to authenticated;

-- A aplicação não escolhe o autor nem a data de criação.
grant insert (couple_id, title, due_date, priority)
on public.tasks to authenticated;

-- Impede alterar o casal, o autor ou a data de criação.
grant update (title, due_date, priority, status, completed_at)
on public.tasks to authenticated;

-- Consultar tarefas do próprio casal.
create policy tasks_select_member
on public.tasks
for select
to authenticated
using (
    couple_id in (
        select m.couple_id
        from public.couple_members m
        where m.user_id = (select auth.uid())
    )
);

-- Criar tarefas somente no próprio casal e com a própria autoria.
create policy tasks_insert_member
on public.tasks
for insert
to authenticated
with check (
    created_by = (select auth.uid())
    and couple_id in (
        select m.couple_id
        from public.couple_members m
        where m.user_id = (select auth.uid())
    )
);

-- Editar tarefas do próprio casal.
create policy tasks_update_member
on public.tasks
for update
to authenticated
using (
    couple_id in (
        select m.couple_id
        from public.couple_members m
        where m.user_id = (select auth.uid())
    )
)
with check (
    couple_id in (
        select m.couple_id
        from public.couple_members m
        where m.user_id = (select auth.uid())
    )
);

-- Os dois participantes podem excluir tarefas do casal.
create policy tasks_delete_member
on public.tasks
for delete
to authenticated
using (
    couple_id in (
        select m.couple_id
        from public.couple_members m
        where m.user_id = (select auth.uid())
    )
);