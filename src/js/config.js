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
   MEU CASAL — CONSULTA AO SUPABASE
======================================== */
(function () {
    const statusCasal = document.querySelector('#status-casal');
    const listaParticipantes = document.querySelector('#participantes-casal');
    const botaoAtualizar = document.querySelector('#atualizar-casal');

    let carregandoCasal = false;

    async function carregarCasal() {
        if (carregandoCasal) {
            return;
        }

        carregandoCasal = true;
        botaoAtualizar.disabled = true;
        listaParticipantes.replaceChildren();
        statusCasal.textContent = 'Carregando seu casal…';

        try {
            const { data, error } = await supabaseClient.rpc(
                'get_couple_members'
            );

            if (error) {
                throw error;
            }

            if (!data || data.length === 0) {
                statusCasal.textContent =
                    'Você ainda não participa de um casal.';
                return;
            }

            // Cria os elementos sem interpretar os nomes como HTML.
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

                nome.textContent = participante.display_name;

                item.append(avatar, nome);
                listaParticipantes.append(item);
            });

            if (data.length === 2) {
                statusCasal.textContent =
                    'Vocês estão conectados. As duas vagas estão ocupadas.';
            } else {
                statusCasal.textContent =
                    'Seu casal foi criado. Falta convidar a outra pessoa.';
            }
        } catch (erro) {
            statusCasal.textContent =
                'Não foi possível carregar seu casal. Tente atualizar.';

            console.error('Falha ao consultar casal:', erro.message);
        } finally {
            carregandoCasal = false;
            botaoAtualizar.disabled = false;
        }
    }

    botaoAtualizar.addEventListener('click', carregarCasal);

    carregarCasal();
})();
