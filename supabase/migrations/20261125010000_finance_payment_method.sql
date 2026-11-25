begin;

-- Guarda apenas o rótulo do meio de pagamento. As políticas de casal continuam
-- limitando as linhas acessíveis em finance_entries.
alter table public.finance_entries
    add column payment_method text
    check (payment_method in ('pix', 'ted', 'doc', 'boleto', 'credit', 'debit'));

grant select (payment_method), insert (payment_method), update (payment_method)
    on public.finance_entries to authenticated;

notify pgrst, 'reload schema';
commit;
