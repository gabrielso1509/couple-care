begin;
-- Registro durável e mínimo dos eventos autenticados. Não contém extratos.
create table public.pluggy_webhook_receipts (
 event_hash text primary key check(event_hash ~ '^[a-f0-9]{64}$'),
 event_type text not null check(char_length(event_type) between 1 and 100),
 item_id uuid,
 received_at timestamptz not null default now()
);
alter table public.pluggy_webhook_receipts enable row level security;
revoke all on public.pluggy_webhook_receipts from public,anon,authenticated;
grant insert,select on public.pluggy_webhook_receipts to service_role;
comment on table public.pluggy_webhook_receipts is 'Recibos de eventos Pluggy validados por HMAC. Acesso exclusivo do servidor.';
notify pgrst,'reload schema';
commit;
