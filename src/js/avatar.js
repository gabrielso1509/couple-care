/* ========================================
   FOTO DE PERFIL — SUPABASE STORAGE
======================================== */
(function () {
    const arquivo = document.querySelector('#arquivo-avatar');
    const imagem = document.querySelector('#foto-perfil-imagem');
    const inicial = document.querySelector('#foto-perfil-inicial');
    const salvar = document.querySelector('#salvar-avatar');
    const remover = document.querySelector('#remover-avatar');
    const feedback = document.querySelector('#feedback-avatar');

    const tipos = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };

    let usuarioId = null;
    let caminhoAtual = null;
    let ocupado = false;
    let urlTemporaria = null;

    function atualizarControles() {
        arquivo.disabled = ocupado || !usuarioId;
        salvar.disabled = ocupado || !usuarioId || !arquivo.files.length;
        remover.disabled = ocupado || !usuarioId || !caminhoAtual;
    }

    // A imagem é carregada por uma URL temporária da memória do navegador.
    function mostrarImagem(blob) {
        if (urlTemporaria) {
            URL.revokeObjectURL(urlTemporaria);
        }

        urlTemporaria = URL.createObjectURL(blob);
        imagem.src = urlTemporaria;
        imagem.hidden = false;
        inicial.hidden = true;
    }

    function mostrarInicial() {
        imagem.hidden = true;
        imagem.removeAttribute('src');
        inicial.hidden = false;

        if (urlTemporaria) {
            URL.revokeObjectURL(urlTemporaria);
            urlTemporaria = null;
        }
    }

    /* 1. Carrega a identidade e a foto cadastrada. */
    async function carregarFoto() {
        ocupado = true;
        atualizarControles();

        try {
            const perfil = await obterPerfilDaPagina();
            if (!perfil) throw new Error('Sessão indisponível.');

            usuarioId = perfil.id;
            caminhoAtual = perfil.avatar_path;
            inicial.textContent = perfil.display_name.trim().charAt(0).toUpperCase();

            if (caminhoAtual) {
                // download respeita as permissões do bucket privado.
                const { data: foto, error: erroFoto } = await supabaseClient
                    .storage
                    .from('avatars')
                    .download(caminhoAtual);

                if (erroFoto) {
                    throw erroFoto;
                }

                mostrarImagem(foto);
            } else {
                mostrarInicial();
            }

            feedback.textContent = '';
        } catch (erro) {
            feedback.textContent =
                'Não foi possível carregar a foto. Recarregue a página para tentar novamente.';
        } finally {
            ocupado = false;
            atualizarControles();
        }
    }

    /* 2. Valida o arquivo antes do envio. */
    arquivo.addEventListener('change', function () {
        feedback.textContent = '';

        const foto = arquivo.files[0];

        if (!foto) {
            atualizarControles();
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(tipos, foto.type)) {
            arquivo.value = '';
            feedback.textContent = 'Escolha uma imagem JPG, PNG ou WebP.';
        } else if (foto.size === 0 || foto.size > 2 * 1024 * 1024) {
            arquivo.value = '';
            feedback.textContent = 'Escolha uma imagem de até 2 MB, que não esteja vazia.';
        } else {
            feedback.textContent =
                'Imagem selecionada. Clique em Salvar foto para enviar.';
        }

        atualizarControles();
    });

    /* 3. Envia o arquivo e salva o caminho no perfil. */
    salvar.addEventListener('click', async function () {
        if (ocupado || !usuarioId || !arquivo.files.length) {
            return;
        }

        const foto = arquivo.files[0];
        const extensao = tipos[foto.type];

        if (!extensao || foto.size === 0 || foto.size > 2 * 1024 * 1024) {
            feedback.textContent = 'Selecione uma imagem válida de até 2 MB.';
            return;
        }

        ocupado = true;
        atualizarControles();
        feedback.textContent = 'Enviando foto…';

        try {
            // Um nome novo evita reutilizar uma imagem antiga do cache.
            const novoCaminho =
                usuarioId + '/' + crypto.randomUUID() + '.' + extensao;

            const { error: erroUpload } = await supabaseClient
                .storage
                .from('avatars')
                .upload(novoCaminho, foto, {
                    contentType: foto.type,
                    upsert: false
                });

            if (erroUpload) {
                throw erroUpload;
            }

            const { data: perfil, error: erroPerfil } = await supabaseClient
                .from('profiles')
                .update({ avatar_path: novoCaminho })
                .eq('id', usuarioId)
                .select('avatar_path')
                .single();

            if (erroPerfil) {
                // Não apaga o upload aqui: uma falha de rede pode ocorrer
                // depois de o banco já ter confirmado a alteração.
                throw erroPerfil;
            }

            const caminhoAnterior = caminhoAtual;
            caminhoAtual = perfil.avatar_path;

            mostrarImagem(foto);
            arquivo.value = '';
            // Atualiza o menu e a lista do casal.
            window.dispatchEvent(new Event('perfil-atualizado'));

            feedback.textContent = 'Foto salva com sucesso!';

            // Só remove a anterior depois de confirmar o novo caminho.
            if (caminhoAnterior && caminhoAnterior !== caminhoAtual) {
                const { error: erroLimpeza } = await supabaseClient
                    .storage
                    .from('avatars')
                    .remove([caminhoAnterior]);

                if (erroLimpeza) {
                    feedback.textContent =
                        'Foto salva. A limpeza do arquivo anterior ficou pendente.';
                }
            }
        } catch (erro) {
            feedback.textContent =
                'Não foi possível concluir a operação. Recarregue a página para conferir a foto antes de tentar novamente.';
            console.error('Falha ao salvar foto:', erro.code || erro.name);
        } finally {
            ocupado = false;
            atualizarControles();
        }
    });

    /* 4. Remove o vínculo e depois exclui o arquivo. */
    remover.addEventListener('click', async function () {
        if (ocupado || !usuarioId || !caminhoAtual) {
            return;
        }

        ocupado = true;
        atualizarControles();
        feedback.textContent = 'Removendo foto…';

        try {
            const caminhoAnterior = caminhoAtual;

            const { error: erroPerfil } = await supabaseClient
                .from('profiles')
                .update({ avatar_path: null })
                .eq('id', usuarioId)
                .select('id')
                .single();

            if (erroPerfil) {
                throw erroPerfil;
            }

            caminhoAtual = null;
            arquivo.value = '';
            mostrarInicial();
            // Atualiza o menu e a lista do casal.
            window.dispatchEvent(new Event('perfil-atualizado'));

            const { error: erroArquivo } = await supabaseClient
                .storage
                .from('avatars')
                .remove([caminhoAnterior]);

            feedback.textContent = erroArquivo
                ? 'Foto retirada do perfil. A exclusão do arquivo ficou pendente.'
                : 'Foto removida do perfil.';
        } catch (erro) {
            feedback.textContent =
                'Não foi possível concluir a remoção. Recarregue a página para conferir a situação.';
        } finally {
            ocupado = false;
            atualizarControles();
        }
    });

    carregarFoto();
})();