-- Permite que a sincronização Pluggy use upsert com ON CONFLICT sem predicado.
-- Em colunas NULL o PostgreSQL permite várias linhas, então lançamentos manuais
-- não entram em conflito com estes índices.
begin;
drop index if exists public.finance_accounts_external_unique;
create unique index finance_accounts_external_unique
  on public.finance_accounts(couple_id,provider,external_account_id);
drop index if exists public.finance_entries_external_unique;
create unique index finance_entries_external_unique
  on public.finance_entries(external_provider,external_transaction_id);
notify pgrst,'reload schema';
commit;
