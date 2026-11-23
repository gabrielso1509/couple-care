/* ========================================
   MENSTRUAÇÃO — PERÍODOS E RESUMO

   Usa as tabelas:
   - menstrual_periods
   - cycle_settings

   As médias são calculadas pelo banco.
======================================== */
(function () {
    'use strict';

    function buscar(id) {
        return document.getElementById(id);
    }

    /* ========================================
       1. ELEMENTOS E ESTADO DA PÁGINA
    ======================================== */

    const obrigatorios = [
        'status-menstruacao',
        'filtro-mes',
        'atualizar-registros',
        'individual',
        'parceiro',
        'ultimo-inicio',
        'media-ciclo',
        'media-menstruacao',
        'proxima-estimada',
        'base-estimativa',
        'periodo-andamento',
        'texto-andamento',
        'encerrar-menstruacao',
        'form-configuracao',
        'campos-configuracao',
        'ciclo-habitual',
        'duracao-habitual',
        'regularidade',
        'feedback-configuracao',
        'titulo-periodo',
        'form-periodo',
        'campos-periodo',
        'inicio-periodo',
        'situacao-periodo',
        'campo-fim',
        'fim-periodo',
        'compartilhar-periodo',
        'aviso-vinculo',
        'salvar-periodo',
        'cancelar-periodo',
        'feedback-periodo',
        'lista-periodos'
    ];

    const faltando = obrigatorios.filter(function (id) {
        return !buscar(id);
    });

    if (faltando.length) {
        const aviso = document.createElement('p');

        aviso.setAttribute('role', 'alert');

        aviso.textContent =
            'Atualize o HTML da página para a versão com início e término.';

        const destino = document.querySelector('main') || document.body;

        destino.prepend(aviso);

        console.error(
            'HTML desatualizado. Faltam:',
            faltando.join(', ')
        );

        return;
    }

    let usuarioId = null;
    let feminino = false;
    let identidadePronta = false;

    let casalId = null;
    let membros = [];
    let periodos = [];

    let configuracao = null;
    let resumo = null;

    // Cópias das versões abertas para edição.
    let edicao = null;
    let baseConfiguracao = null;

    let periodoAlterado = false;
    let configuracaoAlterada = false;

    let pronto = false;
    let carregando = false;
    let ocupado = false;
    let iniciando = false;

    const formPeriodo = buscar('form-periodo');
    const formConfiguracao = buscar('form-configuracao');

    /* ========================================
       2. DATAS E FUNÇÕES AUXILIARES
    ======================================== */

    function chave(data) {
        return (
            data.getFullYear() +
            '-' +
            String(data.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(data.getDate()).padStart(2, '0')
        );
    }

    function hoje() {
        return chave(new Date());
    }

    function dataTexto(valor) {
        const partes = valor.split('-');

        return new Date(
            Number(partes[0]),
            Number(partes[1]) - 1,
            Number(partes[2])
        ).toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function duracao(inicio, fim) {
        const a = inicio.split('-').map(Number);
        const b = fim.split('-').map(Number);

        // Conta os dias sem interferência do horário de verão.
        const primeiro = Date.UTC(a[0], a[1] - 1, a[2]);
        const ultimo = Date.UTC(b[0], b[1] - 1, b[2]);

        return Math.round((ultimo - primeiro) / 86400000) + 1;
    }

    function dias(valor) {
        return (
            Number(valor).toLocaleString('pt-BR', {
                maximumFractionDigits: 1
            }) +
            ' dias'
        );
    }

    // textContent escreve texto sem executar HTML.
    function elemento(tag, classe, texto) {
        const item = document.createElement(tag);

        if (classe) {
            item.className = classe;
        }

        if (texto !== undefined) {
            item.textContent = texto;
        }

        return item;
    }

    function feedback(tipo, texto) {
        buscar('feedback-' + tipo).textContent = texto;
    }

    function temRascunho() {
        return periodoAlterado || configuracaoAlterada;
    }

    let mesAtual = hoje().slice(0, 7);

    buscar('filtro-mes').value = mesAtual;

    function controles() {
        const bloqueado =
            !pronto || ocupado || carregando || !feminino;

        buscar('campos-periodo').disabled = bloqueado;
        buscar('campos-configuracao').disabled = bloqueado;
        buscar('compartilhar-periodo').disabled = !casalId;

        buscar('atualizar-registros').disabled =
            ocupado || carregando || iniciando;

        buscar('filtro-mes').disabled =
            ocupado || carregando || iniciando || !buscar('filtro-mes').querySelector('option[value]:not([value=""])');

        buscar('encerrar-menstruacao').disabled = bloqueado;

        document.querySelectorAll(
            '#lista-periodos button'
        ).forEach(function (botao) {
            botao.disabled = bloqueado;
        });
    }

    /* ========================================
       3. FORMULÁRIOS
    ======================================== */

    function atualizarSituacao() {
        const terminou =
            buscar('situacao-periodo').value === 'finished';

        buscar('campo-fim').hidden = !terminou;
        buscar('fim-periodo').required = terminou;

        buscar('fim-periodo').min =
            buscar('inicio-periodo').value || '1900-01-01';

        buscar('fim-periodo').max = hoje();
        buscar('inicio-periodo').max = hoje();

        if (!terminou) {
            buscar('fim-periodo').value = '';
        }

        buscar('fim-periodo').setCustomValidity('');
    }

    function limparPeriodo() {
        edicao = null;
        periodoAlterado = false;

        formPeriodo.reset();

        buscar('inicio-periodo').value = hoje();
        buscar('inicio-periodo').setCustomValidity('');

        buscar('titulo-periodo').textContent =
            'Registrar menstruação';

        buscar('salvar-periodo').textContent =
            'Salvar período';

        buscar('cancelar-periodo').hidden = true;

        atualizarSituacao();
    }

    function preencherConfiguracao() {
        // Preserva o que a pessoa está digitando.
        if (configuracaoAlterada) {
            return;
        }

        baseConfiguracao = configuracao
            ? structuredClone(configuracao)
            : null;

        buscar('ciclo-habitual').value =
            configuracao &&
            configuracao.habitual_cycle_days !== null
                ? configuracao.habitual_cycle_days
                : '';

        buscar('duracao-habitual').value =
            configuracao &&
            configuracao.habitual_period_days !== null
                ? configuracao.habitual_period_days
                : '';

        buscar('regularidade').value = configuracao
            ? configuracao.regularity
            : 'unknown';

        buscar('duracao-habitual').setCustomValidity('');
    }

    function abrirEdicao(periodo) {
        if (
            periodoAlterado &&
            !window.confirm(
                'Descartar a edição não salva do período?'
            )
        ) {
            return false;
        }

        edicao = structuredClone(periodo);
        periodoAlterado = true;

        buscar('inicio-periodo').value = periodo.start_date;
        buscar('inicio-periodo').setCustomValidity('');

        buscar('situacao-periodo').value = periodo.is_ongoing
            ? 'ongoing'
            : periodo.end_date
                ? 'finished'
                : 'unknown';

        atualizarSituacao();

        buscar('fim-periodo').value = periodo.end_date || '';

        buscar('compartilhar-periodo').checked = !!(
            casalId &&
            periodo.shared_with_couple_id === casalId
        );

        buscar('titulo-periodo').textContent =
            'Editar menstruação';

        buscar('salvar-periodo').textContent =
            'Salvar alterações';

        buscar('cancelar-periodo').hidden = false;

        feedback(
            'periodo',
            'Editando o período iniciado em ' +
                dataTexto(periodo.start_date) +
                '.'
        );

        buscar('inicio-periodo').focus();

        return true;
    }

    /* ========================================
       4. RESUMO PRIVADO DO CICLO
    ======================================== */

    function exibirResumo() {
        buscar('ultimo-inicio').textContent =
            resumo && resumo.last_start_date
                ? dataTexto(resumo.last_start_date)
                : 'Não informado';

        buscar('media-ciclo').textContent =
            resumo && resumo.mean_cycle_days !== null
                ? dias(resumo.mean_cycle_days)
                : 'Histórico insuficiente';

        buscar('media-menstruacao').textContent =
            resumo && resumo.mean_period_days !== null
                ? dias(resumo.mean_period_days)
                : 'Sem término registrado';

        buscar('proxima-estimada').textContent =
            resumo && resumo.next_period_estimate
                ? dataTexto(resumo.next_period_estimate)
                : 'Sem estimativa';

        let texto = '';

        if (resumo && resumo.cycle_source === 'history') {
            texto =
                'Estimativa baseada na média arredondada de ' +
                resumo.cycle_intervals +
                ' intervalo(s) entre os inícios registrados.';
        } else if (
            resumo &&
            resumo.cycle_source === 'informed'
        ) {
            texto =
                'Estimativa baseada na duração habitual de ' +
                resumo.estimated_cycle_days +
                ' dias informada por você.';
        } else {
            texto =
                'Registre pelo menos dois inícios para calcular o ciclo, ' +
                'ou informe a duração habitual para uma estimativa inicial.';
        }

        if (resumo && !resumo.last_start_date) {
            texto +=
                ' Registre um início para estimar a próxima data.';
        }

        if (resumo && resumo.completed_periods > 0) {
            texto +=
                ' A média da menstruação usa ' +
                resumo.completed_periods +
                ' período(s) com término conhecido.';
        }

        if (
            resumo &&
            resumo.next_period_estimate &&
            resumo.next_period_estimate < hoje()
        ) {
            texto +=
                ' A data estimada já passou sem outro início ' +
                'registrado neste histórico.';
        }

        buscar('base-estimativa').textContent = texto;

        const atual = periodos.find(function (periodo) {
            return (
                periodo.is_ongoing &&
                periodo.start_date <= hoje()
            );
        });

        buscar('periodo-andamento').hidden = !atual;

        buscar('texto-andamento').textContent = atual
            ? 'Início informado em ' +
              dataTexto(atual.start_date) +
              '. Informe o término quando acontecer.'
            : '';
    }

    /* ========================================
       5. HISTÓRICO DOS PERÍODOS
    ======================================== */

    function limitesMes() {
        const partes = mesAtual.split('-');

        return {
            inicio: mesAtual + '-01',
            fim: chave(
                new Date(
                    Number(partes[0]),
                    Number(partes[1]),
                    0
                )
            )
        };
    }

    function renderizar() {
        const lista = buscar('lista-periodos');

        lista.replaceChildren();

        if (feminino) {
            exibirResumo();
            preencherConfiguracao();

            const limites = limitesMes();

            // Inclui períodos que começaram no mês anterior
            // e continuaram durante o mês consultado.
            const visiveis = periodos.filter(function (periodo) {
                const fim = periodo.is_ongoing
                    ? hoje()
                    : periodo.end_date || periodo.start_date;

                return (
                    periodo.start_date <= limites.fim &&
                    fim >= limites.inicio
                );
            });

            visiveis.forEach(function (periodo) {
                const item = elemento('article', 'registro-app');

                item.append(
                    elemento(
                        'h3',
                        '',
                        'Início: ' + dataTexto(periodo.start_date)
                    )
                );

                let fim = '';

                if (periodo.is_ongoing) {
                    fim = 'Em andamento';
                } else if (periodo.end_date) {
                    fim =
                        'Término: ' +
                        dataTexto(periodo.end_date) +
                        ' · ' +
                        duracao(
                            periodo.start_date,
                            periodo.end_date
                        ) +
                        ' dia(s)';
                } else {
                    fim =
                        'Término desconhecido: duração não calculada.';
                }

                item.append(
                    elemento('p', 'texto-suave', fim)
                );

                let partilha = '';

                if (!periodo.shared_with_couple_id) {
                    partilha = 'Este período é privado.';
                } else if (
                    periodo.shared_with_couple_id === casalId
                ) {
                    partilha =
                        'Datas deste período compartilhadas ' +
                        'com o parceiro atual.';
                } else {
                    partilha =
                        'Este período não está compartilhado ' +
                        'com o casal atual.';
                }

                item.append(
                    elemento('p', 'texto-suave', partilha)
                );

                const acoes = elemento('div', 'acoes-app');

                ['editar', 'excluir'].forEach(function (acao) {
                    const botao = elemento(
                        'button',
                        'botao-secundario',
                        acao === 'editar' ? 'Editar' : 'Excluir'
                    );

                    botao.type = 'button';
                    botao.dataset.acao = acao;
                    botao.dataset.id = periodo.id;

                    botao.setAttribute(
                        'aria-label',
                        botao.textContent +
                            ' período de ' +
                            dataTexto(periodo.start_date)
                    );

                    acoes.append(botao);
                });

                item.append(acoes);
                lista.append(item);
            });

            if (!visiveis.length) {
                lista.append(
                    elemento(
                        'p',
                        'texto-suave',
                        'Nenhum período registrado neste mês.'
                    )
                );
            }
        }

        controles();
    }

    function ocultarDados() {
        periodos = [];
        resumo = null;
        pronto = false;

        buscar('lista-periodos').replaceChildren();
        buscar('periodo-andamento').hidden = true;

        [
            'ultimo-inicio',
            'media-ciclo',
            'media-menstruacao',
            'proxima-estimada'
        ].forEach(function (id) {
            buscar(id).textContent = 'Indisponível';
        });

        buscar('base-estimativa').textContent =
            'Atualize os registros para consultar o resumo.';

        controles();
    }

    /* ========================================
       6. CONSULTAS AO SUPABASE
    ======================================== */

    async function buscarPeriodos() {
        const linhas = [];

        // Busca em páginas para não truncar um histórico extenso.
        for (let inicio = 0; ; inicio += 500) {
            const resposta = await supabaseClient
                .from('menstrual_periods')
                .select('*')
                .eq('user_id', usuarioId)
                .order('start_date', { ascending: false })
                .order('id')
                .range(inicio, inicio + 499);

            if (resposta.error) {
                throw resposta.error;
            }

            linhas.push.apply(linhas, resposta.data);

            if (resposta.data.length < 500) {
                return linhas;
            }
        }
    }

    async function carregar() {
        if (!feminino) return;
        if (!identidadePronta) {
            return iniciar();
        }

        if (carregando || ocupado) {
            return;
        }

        carregando = true;
        controles();

        buscar('status-menstruacao').textContent =
            'Carregando registros…';

        try {
            const membrosResposta = await supabaseClient.rpc(
                'get_couple_members'
            );

            if (membrosResposta.error) {
                throw membrosResposta.error;
            }

            membros = membrosResposta.data;

            const anterior = casalId;

            const vinculo = membros.find(function (membro) {
                return membro.user_id === usuarioId;
            });

            casalId = vinculo ? vinculo.couple_id : null;

            // Um novo vínculo exige uma nova escolha de compartilhamento.
            if (anterior && anterior !== casalId) {
                buscar('compartilhar-periodo').checked = false;

                feedback(
                    'periodo',
                    'Seu vínculo mudou. Confirme novamente se deseja ' +
                    'compartilhar com o casal atual.'
                );
            }

            buscar('aviso-vinculo').textContent = casalId
                ? 'Seu parceiro recebe somente as datas autorizadas deste período.'
                : 'Sem vínculo com um casal, seus períodos ficam privados.';

            // Lista apenas meses com dados autorizados; o usuário não precisa adivinhar datas.
            const mesesResposta = await supabaseClient.rpc('available_cycle_months');
            if (mesesResposta.error) throw mesesResposta.error;
            const meses = mesesResposta.data.map(function (r) { return r.month; });
            const escolha = buscar('filtro-mes'); escolha.replaceChildren();
            if (!meses.length) {
                const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = 'Nenhum mês registrado ainda'; escolha.append(vazio);
            } else {
                if (!meses.includes(mesAtual)) mesAtual = meses[0];
                meses.forEach(function (mes) {
                    const opcao = document.createElement('option'); opcao.value = mes;
                    opcao.textContent = new Date(mes + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); escolha.append(opcao);
                });
                escolha.value = mesAtual;
            }
            if (feminino) {
                const respostas = await Promise.all([
                    buscarPeriodos(),

                    supabaseClient
                        .from('cycle_settings')
                        .select('*')
                        .eq('user_id', usuarioId)
                        .maybeSingle(),

                    supabaseClient.rpc('get_cycle_summary', {
                        p_today: hoje()
                    })
                ]);

                if (respostas[1].error) {
                    throw respostas[1].error;
                }

                if (respostas[2].error) {
                    throw respostas[2].error;
                }

                if (
                    !respostas[2].data ||
                    !respostas[2].data.length
                ) {
                    throw new Error('Resumo não retornado.');
                }

                periodos = respostas[0];
                configuracao = respostas[1].data;
                resumo = respostas[2].data[0];
                window.dispatchEvent(new CustomEvent('cycle-summary-updated', { detail: resumo }));
            }

            pronto = true;
            renderizar();

            buscar('status-menstruacao').textContent =
                'Registros atualizados.';
        } catch (erro) {
            ocultarDados();

            buscar('status-menstruacao').textContent =
                'Não foi possível carregar. Confira a conexão ' +
                'e clique em Atualizar registros.';

            console.error(
                'Falha ao carregar menstruação:',
                erro.code || erro.name
            );
        } finally {
            carregando = false;
            controles();
        }
    }

    /* ========================================
       7. GRAVAÇÃO E TRATAMENTO DE ERROS
    ======================================== */

    async function gravar(tipo, operacao, mensagem, finalizar) {
        if (
            !feminino ||
            ocupado ||
            carregando ||
            !pronto
        ) {
            return;
        }

        ocupado = true;
        controles();
        feedback(tipo, 'Salvando…');

        try {
            const resposta = await operacao();

            if (resposta.error) {
                throw resposta.error;
            }

            if (!resposta.data) {
                throw new Error('Resposta sem confirmação.');
            }

            finalizar();
            feedback(tipo, mensagem);
        } catch (erro) {
            let texto =
                'Não foi possível confirmar a alteração. Atualize ' +
                'e confira os registros antes de tentar novamente.';

            if (erro.code === '23P01') {
                texto =
                    'Este período se sobrepõe a outro. Confira o histórico ' +
                    'e encerre ou corrija o período anterior.';
            }

            if (erro.code === 'PGRST116') {
                texto =
                    'O registro mudou em outra aba ou foi excluído. ' +
                    'Atualize e abra a versão atual.';
            }

            if (erro.code === '23505') {
                texto =
                    'Já existe um registro correspondente. ' +
                    'Atualize antes de tentar novamente.';
            }

            if (
                erro.code === '23514' ||
                erro.code === '22000'
            ) {
                texto = 'Confira as datas e as durações informadas.';
            }

            feedback(tipo, texto);

            console.error(
                'Falha ao salvar menstruação:',
                erro.code || erro.name
            );
        } finally {
            ocupado = false;
            await carregar();
        }
    }

    /* ========================================
       8. SALVAR INÍCIO E TÉRMINO
    ======================================== */

    formPeriodo.addEventListener('input', function () {
        periodoAlterado = true;

        buscar('inicio-periodo').setCustomValidity('');
        buscar('fim-periodo').setCustomValidity('');
    });

    buscar('situacao-periodo').addEventListener(
        'change',
        atualizarSituacao
    );

    buscar('inicio-periodo').addEventListener(
        'change',
        atualizarSituacao
    );

    formPeriodo.addEventListener(
        'submit',
        async function (evento) {
            evento.preventDefault();

            const inicio = buscar('inicio-periodo').value;
            const situacao = buscar('situacao-periodo').value;

            const fim = situacao === 'finished'
                ? buscar('fim-periodo').value
                : null;

            buscar('inicio-periodo').setCustomValidity(
                inicio > hoje()
                    ? 'Informe um início que já aconteceu.'
                    : ''
            );

            buscar('fim-periodo').setCustomValidity(
                fim && (fim < inicio || fim > hoje())
                    ? 'Informe um término entre o início e hoje.'
                    : ''
            );

            if (!formPeriodo.reportValidity()) {
                return;
            }

            const dados = {
                start_date: inicio,
                end_date: fim,
                is_ongoing: situacao === 'ongoing',
                shared_with_couple_id:
                    buscar('compartilhar-periodo').checked
                        ? casalId
                        : null
            };

            const original = edicao;

            await gravar(
                'periodo',

                function () {
                    if (original) {
                        // Não sobrescreve uma versão mais recente.
                        return supabaseClient
                            .from('menstrual_periods')
                            .update(dados)
                            .eq('id', original.id)
                            .eq('user_id', usuarioId)
                            .eq('version', original.version)
                            .select('id')
                            .single();
                    }

                    // A autoria é preenchida pelo banco.
                    return supabaseClient
                        .from('menstrual_periods')
                        .insert(dados)
                        .select('id')
                        .single();
                },

                original
                    ? 'Período atualizado.'
                    : 'Período registrado.',

                function () {
                    mesAtual = inicio.slice(0, 7);
                    buscar('filtro-mes').value = mesAtual;
                    limparPeriodo();
                }
            );
        }
    );

    /* ========================================
       9. SALVAR CONFIGURAÇÕES
    ======================================== */

    formConfiguracao.addEventListener('input', function () {
        configuracaoAlterada = true;
        buscar('duracao-habitual').setCustomValidity('');
    });

    formConfiguracao.addEventListener(
        'submit',
        async function (evento) {
            evento.preventDefault();

            // Campo vazio vira null, nunca zero.
            const ciclo = buscar('ciclo-habitual').value === ''
                ? null
                : Number(buscar('ciclo-habitual').value);

            const periodo = buscar('duracao-habitual').value === ''
                ? null
                : Number(buscar('duracao-habitual').value);

            buscar('duracao-habitual').setCustomValidity(
                ciclo !== null &&
                periodo !== null &&
                periodo > ciclo
                    ? 'A duração da menstruação não pode ser maior que o ciclo informado.'
                    : ''
            );

            if (!formConfiguracao.reportValidity()) {
                return;
            }

            const dados = {
                habitual_cycle_days: ciclo,
                habitual_period_days: periodo,
                regularity: buscar('regularidade').value
            };

            const original = baseConfiguracao;

            await gravar(
                'configuracao',

                function () {
                    if (original) {
                        return supabaseClient
                            .from('cycle_settings')
                            .update(dados)
                            .eq('user_id', usuarioId)
                            .eq('version', original.version)
                            .select('user_id')
                            .single();
                    }

                    return supabaseClient
                        .from('cycle_settings')
                        .insert(dados)
                        .select('user_id')
                        .single();
                },

                'Configurações salvas.',

                function () {
                    configuracaoAlterada = false;
                }
            );
        }
    );

    /* ========================================
       10. EDITAR, EXCLUIR E INFORMAR TÉRMINO
    ======================================== */

    buscar('lista-periodos').addEventListener(
        'click',
        async function (evento) {
            const botao = evento.target.closest(
                'button[data-acao]'
            );

            if (
                !botao ||
                ocupado ||
                carregando ||
                !pronto ||
                !feminino
            ) {
                return;
            }

            const periodo = periodos.find(function (registro) {
                return registro.id === botao.dataset.id;
            });

            if (!periodo) {
                return;
            }

            if (botao.dataset.acao === 'editar') {
                abrirEdicao(periodo);
                return;
            }

            if (
                !window.confirm(
                    'Excluir o período iniciado em ' +
                    dataTexto(periodo.start_date) +
                    '?'
                )
            ) {
                return;
            }

            await gravar(
                'periodo',

                function () {
                    return supabaseClient
                        .from('menstrual_periods')
                        .delete()
                        .eq('id', periodo.id)
                        .eq('user_id', usuarioId)
                        .eq('version', periodo.version)
                        .select('id')
                        .single();
                },

                'Período excluído.',

                function () {
                    if (
                        edicao &&
                        edicao.id === periodo.id
                    ) {
                        limparPeriodo();
                    }
                }
            );
        }
    );

    buscar('encerrar-menstruacao').addEventListener(
        'click',
        function () {
            const atual = periodos.find(function (periodo) {
                return (
                    periodo.is_ongoing &&
                    periodo.start_date <= hoje()
                );
            });

            if (
                !atual ||
                ocupado ||
                carregando ||
                !pronto
            ) {
                return;
            }

            if (!abrirEdicao(atual)) {
                return;
            }

            buscar('situacao-periodo').value = 'finished';
            atualizarSituacao();

            // É uma sugestão no formulário.
            // Só grava depois que ela confirmar em Salvar alterações.
            buscar('fim-periodo').value = hoje();
            buscar('fim-periodo').focus();

            feedback(
                'periodo',
                'Confira a data de término e clique em Salvar alterações.'
            );
        }
    );

    buscar('cancelar-periodo').addEventListener(
        'click',
        function () {
            limparPeriodo();
            feedback('periodo', 'Edição cancelada.');
        }
    );

    /* ========================================
       11. FILTRO E ATUALIZAÇÃO
    ======================================== */

    buscar('atualizar-registros').addEventListener(
        'click',
        function () {
            if (
                temRascunho() &&
                !window.confirm(
                    'Descartar alterações não salvas e atualizar?'
                )
            ) {
                return;
            }

            configuracaoAlterada = false;
            limparPeriodo();

            feedback('periodo', '');
            feedback('configuracao', '');

            void carregar();
        }
    );

    buscar('filtro-mes').addEventListener(
        'change',
        function () {
            if (!this.value || !this.reportValidity()) {
                this.value = mesAtual;
                return;
            }

            if (
                temRascunho() &&
                !window.confirm(
                    'Descartar alterações não salvas e mudar de mês?'
                )
            ) {
                this.value = mesAtual;
                return;
            }

            mesAtual = this.value;
            configuracaoAlterada = false;
            limparPeriodo();

            feedback('periodo', '');
            feedback('configuracao', '');

            pronto = false;
            void carregar();
        }
    );

    /* ========================================
       12. IDENTIDADE E INICIALIZAÇÃO
    ======================================== */

    async function iniciar() {
        if (iniciando) {
            return;
        }

        iniciando = true;
        controles();

        try {
            const autenticacao =
                await supabaseClient.auth.getUser();

            if (
                autenticacao.error ||
                !autenticacao.data.user
            ) {
                throw autenticacao.error ||
                    new Error('Sem sessão.');
            }

            const id = autenticacao.data.user.id;

            const perfil = await supabaseClient
                .from('profiles')
                .select('gender')
                .eq('id', id)
                .single();

            if (perfil.error) {
                throw perfil.error;
            }

            usuarioId = id;
            feminino = perfil.data.gender === 'feminino';
            identidadePronta = true;

            buscar('individual').hidden = !feminino;
            buscar('parceiro').hidden = feminino;

            limparPeriodo();
        } catch (erro) {
            buscar('status-menstruacao').textContent =
                'Não foi possível carregar a conta. Confira a conexão ' +
                'e clique em Atualizar registros.';

            return;
        } finally {
            iniciando = false;
            controles();
        }

        await carregar();
    }

    document.addEventListener(
        'visibilitychange',
        function () {
            if (!document.hidden && identidadePronta) {
                void carregar();
            }
        }
    );

    window.addEventListener('online', function () {
        void carregar();
    });

    window.addEventListener('offline', function () {
        ocultarDados();

        buscar('status-menstruacao').textContent =
            'Sem conexão. Reconecte e atualize os registros.';
    });

    window.addEventListener(
        'beforeunload',
        function (evento) {
            if (temRascunho()) {
                evento.preventDefault();
                evento.returnValue = '';
            }
        }
    );

    window.addEventListener('pageshow', function (evento) {
        if (evento.persisted) {
            window.location.reload();
        }
    });

    limparPeriodo();
    void iniciar();
})();