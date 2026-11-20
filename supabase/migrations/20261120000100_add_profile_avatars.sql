-- Guarda o caminho da imagem dentro do bucket avatars.
-- NULL significa que o usuário ainda não possui foto.
alter table public.profiles
add column avatar_path text;

-- O caminho precisa pertencer à pasta do próprio perfil.
alter table public.profiles
add constraint profiles_avatar_path_own_folder
check (
    avatar_path is null
    or (
        split_part(avatar_path, '/', 1) = id::text
        and avatar_path ~
            '^[0-9a-f-]+/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'
    )
);

-- Permite consultar somente arquivos da própria pasta.
create policy avatars_select_own
on storage.objects
for select
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Permite enviar arquivos somente para a própria pasta.
create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Permite substituir arquivos sem transferi-los para outra conta.
create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Permite excluir somente arquivos da própria pasta.
create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
);