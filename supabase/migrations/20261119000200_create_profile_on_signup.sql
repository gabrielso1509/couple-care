/* O que está acontecendo:
- returns trigger: indica que a função será usada por um gatilho.
- language plpgsql: permite escrever uma rotina com begin e end.
- security definer: executa com as permissões de quem criou a função, permitindo criar o perfil antes de existir uma sessão do usuário.
- set search_path = '': exige referências explícitas como public.profiles, evitando procurar tabelas em outros schemas.
- new: representa a conta que acabou de ser inserida.
- ->>: extrai um valor dos dados JSON do cadastro como texto. */
-------------------------------------------------------------------
-- Cria o perfil usando os dados enviados no cadastro.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name, gender)
    values (
        new.id,
        trim(new.raw_user_meta_data ->> 'display_name'),
        new.raw_user_meta_data ->> 'gender'
    );

    return new;
end;
$$;

-- Executa a função para cada nova conta criada no Auth.
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();