/* 1. Prepara o perfil, mas não altera uma conta real nem cria vínculo. */
(function () {
    document
        .getElementById("form-perfil")
        .addEventListener("submit", function (e) {
            e.preventDefault();
            const nome = CoupleCare.ui.valor("nome");
            if (!nome) {
                document.getElementById("feedback").textContent =
                    "Informe seu nome.";
                return;
            }
            CoupleCare.dados.substituir("profiles", {
                nome: nome,
                sexo: CoupleCare.ui.valor("sexo") || null,
            });
            document.getElementById("feedback").textContent =
                "Perfil de " +
                nome +
                " preparado somente nesta página. A conta não foi alterada.";
        });
})();

/* ========================================
   MEU CASAL — CONSULTA E CONTROLES
======================================== */
(function () {
    const areaCasal = document.querySelector('.meu-casal');
    const statusCasal = document.querySelector('#status-casal');
    const feedbackCasal = document.querySelector('#feedback-casal');
    const listaParticipantes = document.querySelector('#participantes-casal');

    const areaSemVinculo = document.querySelector('#casal-sem-vinculo');
    const areaComVaga = document.querySelector('#casal-com-vaga');
    const areaConviteGerado = document.querySelector('#convite-gerado');

    const botaoCriar = document.querySelector('#criar-casal');
    const botaoGerar = document.querySelector('#gerar-convite');
    const botaoCopiar = document.querySelector('#copiar-convite');
    const botaoAtualizar = document.querySelector('#atualizar-casal');

    const formularioConvite = document.querySelector('#form-aceitar-convite');
    const botaoAceitar = document.querySelector('#aceitar-convite');
    const codigoRecebido = document.querySelector('#codigo-convite');
    const codigoGerado = document.querySelector('#convite-para-copiar');

    // null significa que ainda não conhecemos a situação da conta.
    let quantidadeParticipantes = null;
    let operacaoEmAndamento = false;

    /* 1. Exibe os controles adequados para cada situação. */
    function atualizarControles() {
        areaSemVinculo.hidden = quantidadeParticipantes !== 0;
        areaComVaga.hidden = quantidadeParticipantes !== 1;

        botaoCriar.disabled =
            operacaoEmAndamento || quantidadeParticipantes !== 0;

        botaoAceitar.disabled =
            operacaoEmAndamento || quantidadeParticipantes !== 0;

        codigoRecebido.disabled =
            operacaoEmAndamento || quantidadeParticipantes !== 0;

        botaoGerar.disabled =
            operacaoEmAndamento || quantidadeParticipantes !== 1;

        botaoCopiar.disabled =
            operacaoEmAndamento ||
            quantidadeParticipantes !== 1 ||
            !codigoGerado.value;

        botaoAtualizar.disabled = operacaoEmAndamento;

        if (operacaoEmAndamento) {
            areaCasal.setAttribute('aria-busy', 'true');
        } else {
            areaCasal.removeAttribute('aria-busy');
        }
    }

    /* 2. Centraliza o bloqueio de cliques repetidos e os erros. */
    async function executarOperacao(tarefa) {
        if (operacaoEmAndamento) {
            return;
        }

        operacaoEmAndamento = true;
        feedbackCasal.textContent = '';
        atualizarControles();

        try {
            await tarefa();
        } catch (erro) {
            // P0001 corresponde às mensagens das nossas funções SQL.
            if (erro.code === 'P0001') {
                feedbackCasal.textContent = erro.message;
            } else {
                feedbackCasal.textContent =
                    'Não foi possível concluir. Atualize os dados para conferir a situação antes de tentar novamente.';
            }

            // Não registra códigos secretos de convite no Console.
            console.error('Falha na operação do casal:', erro.code || erro.name);
        } finally {
            operacaoEmAndamento = false;
            atualizarControles();
        }
    }

    /* 3. Consulta e desenha os participantes reais. */
    async function consultarCasal() {
        quantidadeParticipantes = null;
        atualizarControles();

        listaParticipantes.replaceChildren();
        statusCasal.textContent = 'Carregando seu casal…';

        const { data, error } = await supabaseClient.rpc(
            'get_couple_members'
        );

        if (error) {
            statusCasal.textContent = 'Não foi possível carregar seu casal.';
            throw error;
        }

        quantidadeParticipantes = data.length;

        data.forEach(function (participante) {
            const item = document.createElement('li');
            const avatar = document.createElement('span');
            const nome = document.createElement('span');

            avatar.className = 'conta-avatar';
            avatar.setAttribute('aria-hidden', 'true');
            avatar.textContent = participante.display_name
                .trim()
                .charAt(0)
                .toUpperCase();

            // textContent evita interpretar o nome como HTML.
            nome.textContent = participante.display_name;

            item.append(avatar, nome);
            listaParticipantes.append(item);
        });

        if (data.length === 0) {
            statusCasal.textContent =
                'Crie um casal ou aceite o convite da outra pessoa.';
        } else if (data.length === 1) {
            statusCasal.textContent =
                'Seu casal foi criado. Falta conectar a outra pessoa.';
        } else {
            statusCasal.textContent =
                'Vocês estão conectados. As duas vagas estão ocupadas.';
        }

        // Remove códigos exibidos quando não existe mais uma vaga.
        if (data.length !== 1) {
            codigoGerado.value = '';
            areaConviteGerado.hidden = true;
        }
    }

    /* 4. Criação do casal. */
    botaoCriar.addEventListener('click', function () {
        executarOperacao(async function () {
            const { error } = await supabaseClient.rpc('create_couple');

            if (error) {
                throw error;
            }

            await consultarCasal();
            feedbackCasal.textContent =
                'Casal criado! Agora você pode gerar um convite.';
        });
    });

    /* 5. Geração de um convite, invalidando o anterior. */
    botaoGerar.addEventListener('click', function () {
        executarOperacao(async function () {
            codigoGerado.value = '';
            areaConviteGerado.hidden = true;

            const { data, error } = await supabaseClient.rpc(
                'generate_couple_invitation'
            );

            if (error) {
                throw error;
            }

            codigoGerado.value = data;
            areaConviteGerado.hidden = false;

            feedbackCasal.textContent =
                'Convite gerado. Copie o código e compartilhe com a outra pessoa.';
        });
    });

    /* 6. Cópia do código, sem gerar outro convite. */
    botaoCopiar.addEventListener('click', async function () {
        if (operacaoEmAndamento || !codigoGerado.value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(codigoGerado.value);
            feedbackCasal.textContent = 'Código copiado!';
        } catch (erro) {
            // Se o navegador bloquear a cópia, permite copiar manualmente.
            codigoGerado.focus();
            codigoGerado.select();

            feedbackCasal.textContent =
                'Não foi possível copiar automaticamente. O código está selecionado: copie manualmente.';
        }
    });

    /* 7. Aceitação de um convite recebido. */
    formularioConvite.addEventListener('submit', function (evento) {
        evento.preventDefault();

        if (
            operacaoEmAndamento ||
            !formularioConvite.reportValidity()
        ) {
            return;
        }

        const token = codigoRecebido.value.trim();

        if (!/^[0-9a-f]{64}$/.test(token)) {
            feedbackCasal.textContent =
                'Cole o código completo de 64 caracteres, sem o endereço do site.';
            return;
        }

        executarOperacao(async function () {
            const { error } = await supabaseClient.rpc(
                'accept_couple_invitation',
                { p_token: token }
            );

            if (error) {
                throw error;
            }

            codigoRecebido.value = '';

            await consultarCasal();
            feedbackCasal.textContent =
                'Convite aceito! Vocês agora fazem parte do mesmo casal.';
        });
    });

    /* 8. Atualização manual e carregamento inicial. */
    botaoAtualizar.addEventListener('click', function () {
        executarOperacao(consultarCasal);
    });

    executarOperacao(consultarCasal);
})();