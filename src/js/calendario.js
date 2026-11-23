/* ========================================
   CALENDÁRIO CONECTADO AO SUPABASE

   Mostra:
   - Compromissos do casal.
   - Prazos das tarefas.
   - Sentimentos compartilhados.
   - Dias de menstruação autorizados.
======================================== */
(function () {
    'use strict';

    /* ========================================
       1. ELEMENTOS E ESTADO DA PÁGINA
    ======================================== */

    // Atalho para buscar um elemento pelo seu ID.
    function $(id) {
        return document.getElementById(id);
    }

    // Evita executar o JS novo com o HTML antigo.
    const obrigatorios = [
        'status-calendario',
        'dias',
        'mes',
        'lista',
        'form-evento',
        'campos-evento',
        'form-sentimentos',
        'form-ciclo',
        'cancelar-evento',
        'atualizar-calendario',
        'opcoes-sentimentos'
    ];

    const faltando = obrigatorios.filter(function (id) {
        return !$(id);
    });

    if (faltando.length) {
        const aviso = document.createElement('p');

        aviso.setAttribute('role', 'alert');

        aviso.textContent =
            'Atualize o calendario.html completo junto com o calendario.js. ' +
            'Faltam elementos da nova página.';

        document.querySelector('main').prepend(aviso);

        console.error(
            'HTML do calendário desatualizado:',
            faltando.join(', ')
        );

        return;
    }

    // Os códigos são os mesmos permitidos pela tabela daily_wellbeing.
    const sentimentos = {
        happy: ['😊', 'Feliz'],
        affectionate: ['😍', 'Carinhosa'],
        calm: ['😌', 'Tranquila'],
        sad: ['😔', 'Triste'],
        tearful: ['😢', 'Com vontade de chorar'],
        sensitive: ['🥺', 'Sensível'],
        irritated: ['😠', 'Irritada'],
        anxious: ['😰', 'Ansiosa'],
        overwhelmed: ['🤯', 'Sobrecarregada'],
        sleepy: ['😴', 'Sonolenta'],
        tired: ['🪫', 'Cansada'],
        energetic: ['⚡', 'Com energia'],
        pain: ['🤕', 'Com dor'],
        nausea: ['🤢', 'Enjoada'],
        bloated: ['🎈', 'Inchada'],
        wants_affection: ['🤗', 'Quero carinho'],
        wants_company: ['🫂', 'Quero companhia'],
        wants_space: ['🌿', 'Quero um tempo para mim']
    };

    const fluxos = {
        light: 'Leve',
        moderate: 'Moderado',
        heavy: 'Intenso'
    };

    const prioridades = {
        low: 'Baixa',
        normal: 'Normal',
        high: 'Alta'
    };

    let selecionada = chave(new Date());

    let usuarioId = null;
    let casalId = null;
    let feminino = false;
    let membros = [];

    let eventos = [];
    let tarefas = [];
    let humores = [];
    let ciclos = [];
    let compartilhados = [];
    // Dias pertencentes aos períodos completos da própria conta.
    let diasPeriodos = [];

    let pronto = false;
    let carregando = false;
    let ocupado = false;
    let repetirCarga = false;

    // Guarda a versão do registro que está sendo editado.
    let edicaoEvento = null;
    let edicaoHumor = null;
    let edicaoCiclo = null;

    // Indica se existem alterações ainda não salvas.
    let sujoEvento = false;
    let sujoHumor = false;
    let sujoCiclo = false;

    let timer = null;
    let encerrado = false;
    let iniciando = false;

    /* ========================================
       2. FUNÇÕES AUXILIARES
    ======================================== */

    // Converte uma data local para YYYY-MM-DD.
    function chave(data) {
        return (
            data.getFullYear() +
            '-' +
            String(data.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(data.getDate()).padStart(2, '0')
        );
    }

    // Monta a data por partes para não mudar o dia por causa do fuso.
    function dataLocal(texto) {
        const partes = texto.split('-');

        return new Date(
            Number(partes[0]),
            Number(partes[1]) - 1,
            Number(partes[2])
        );
    }

    function dataTexto(texto) {
        return dataLocal(texto).toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    // textContent evita executar HTML digitado nos formulários.
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

    function nome(id) {
        const membro = membros.find(function (pessoa) {
            return pessoa.user_id === id;
        });

        if (membro) {
            return membro.display_name;
        }

        return id === usuarioId ? 'Você' : 'Parceira';
    }

    function recado(tipo, texto) {
        $('feedback-' + tipo).textContent = texto;
    }

    function registroDoDia(linhas) {
        return linhas.find(function (registro) {
            return (
                registro.entry_date === selecionada &&
                registro.user_id === usuarioId
            );
        }) || null;
    }

    function linhaCopiada(linha) {
        return linha ? structuredClone(linha) : null;
    }

    function controles() {
        const bloqueado = ocupado || !pronto;

        $('campos-evento').disabled = bloqueado || !casalId;
        $('campos-sentimentos').disabled = bloqueado || !feminino;
        $('campos-ciclo').disabled = bloqueado || !feminino;

        $('compartilhar-sentimentos').disabled = !casalId;
        $('compartilhar-ciclo').disabled = !casalId;

        $('atualizar-calendario').disabled =
            ocupado || carregando || iniciando;

        const data = dataLocal(selecionada);

        $('anterior').disabled =
            ocupado ||
            carregando ||
            (data.getFullYear() === 1900 && data.getMonth() === 0);

        $('seguinte').disabled =
            ocupado ||
            carregando ||
            (data.getFullYear() === 2100 && data.getMonth() === 11);

        $('hoje').disabled = ocupado || carregando;

        document.querySelectorAll(
            '#dias button, #lista button'
        ).forEach(function (botao) {
            botao.disabled = ocupado || carregando || !pronto;
        });
    }

    /* ========================================
       3. FORMULÁRIOS DOS REGISTROS PESSOAIS
    ======================================== */

    function criarOpcoes() {
        $('opcoes-sentimentos').replaceChildren();

        Object.keys(sentimentos).forEach(function (codigo) {
            const label = elemento('label');
            const input = elemento('input');

            input.type = 'checkbox';
            input.value = codigo;
            input.name = 'sentimento';

            label.append(
                input,
                elemento('span', '', sentimentos[codigo].join(' '))
            );

            $('opcoes-sentimentos').append(label);
        });
    }

    function resumoPartilha(registro) {
        if (!registro || !registro.shared_with_couple_id) {
            return 'Privado: só você vê este registro.';
        }

        if (registro.shared_with_couple_id !== casalId) {
            return 'Este registro não está compartilhado com seu casal atual.';
        }

        return (
            'Compartilhado com seu parceiro atual. ' +
            'Desmarque e salve para revogar.'
        );
    }

    function preencherPessoais() {
        $('dia-registro').textContent = dataTexto(selecionada);

        // Não sobrescreve o que a pessoa está digitando.
        if (!sujoHumor) {
            edicaoHumor = linhaCopiada(registroDoDia(humores));

            const codigos = edicaoHumor
                ? edicaoHumor.feelings
                : [];

            document.querySelectorAll(
                '[name="sentimento"]'
            ).forEach(function (input) {
                input.checked = codigos.includes(input.value);
            });

            $('nota-sentimentos').value = edicaoHumor
                ? edicaoHumor.note
                : '';

            $('compartilhar-sentimentos').checked = !!(
                edicaoHumor &&
                casalId &&
                edicaoHumor.shared_with_couple_id === casalId
            );

            $('excluir-sentimentos').hidden = !edicaoHumor;

            $('estado-sentimentos').textContent =
                resumoPartilha(edicaoHumor);
        }

        if (!sujoCiclo) {
            edicaoCiclo = linhaCopiada(registroDoDia(ciclos));

            $('fluxo').value = edicaoCiclo
                ? edicaoCiclo.flow || ''
                : '';

            $('compartilhar-ciclo').checked = !!(
                edicaoCiclo &&
                casalId &&
                edicaoCiclo.shared_with_couple_id === casalId
            );

            $('excluir-ciclo').hidden = !edicaoCiclo;

            $('estado-ciclo').textContent =
                resumoPartilha(edicaoCiclo);
        }
    }

    /* ========================================
       4. AGENDA DO DIA
    ======================================== */

    function acao(texto, codigo, id) {
        const botao = elemento('button', 'botao-secundario', texto);

        botao.type = 'button';
        botao.dataset.acao = codigo;
        botao.dataset.id = id;

        return botao;
    }

    function cartao(titulo, texto) {
        const item = elemento('article', 'registro-app');

        item.append(elemento('h4', '', titulo));

        if (texto) {
            item.append(elemento('p', 'texto-suave', texto));
        }

        return item;
    }

    function agenda() {
        $('selecionado').textContent = dataTexto(selecionada);

        const lista = $('lista');
        lista.replaceChildren();

        // Compromissos do casal.
        eventos.filter(function (evento) {
            return evento.event_date === selecionada;
        }).sort(function (a, b) {
            return (
                (a.start_time || '').localeCompare(b.start_time || '') ||
                a.title.localeCompare(b.title)
            );
        }).forEach(function (evento) {
            let horario = 'Dia inteiro';

            if (evento.start_time) {
                horario = evento.start_time.slice(0, 5);

                if (evento.end_time) {
                    horario += ' até ' + evento.end_time.slice(0, 5);
                }
            }

            const item = cartao('📅 ' + evento.title, horario);

            if (evento.description) {
                item.append(elemento('p', '', evento.description));
            }

            const botoes = elemento('div', 'acoes-app');

            botoes.append(
                acao('Editar', 'editar', evento.id),
                acao('Excluir', 'excluir', evento.id)
            );

            item.append(botoes);
            lista.append(item);
        });

        // Tarefas são consultadas diretamente na tabela existente.
        tarefas.filter(function (tarefa) {
            return tarefa.due_date === selecionada;
        }).forEach(function (tarefa) {
            const estado = tarefa.status === 'completed'
                ? 'Concluída'
                : 'Pendente';

            const item = cartao(
                '✅ ' + tarefa.title,
                estado +
                    ' · Prioridade ' +
                    prioridades[tarefa.priority].toLowerCase()
            );

            if (tarefa.assigned_to) {
                item.append(
                    elemento(
                        'p',
                        'texto-suave',
                        'Responsável: ' + nome(tarefa.assigned_to)
                    )
                );
            }

            const link = elemento('a', '', 'Abrir Tarefas');
            link.href = 'tarefas.html';

            item.append(link);
            lista.append(item);
        });

        // A RLS permite receber somente os sentimentos autorizados.
        humores.filter(function (registro) {
            return registro.entry_date === selecionada;
        }).forEach(function (registro) {
            const texto = registro.feelings.map(function (codigo) {
                return sentimentos[codigo]
                    ? sentimentos[codigo].join(' ')
                    : codigo;
            }).join(' · ');

            const item = cartao(
                '💭 ' + nome(registro.user_id),
                texto
            );

            if (registro.note) {
                item.append(elemento('p', '', registro.note));
            }

            if (registro.user_id === usuarioId) {
                item.append(
                    elemento('small', '', resumoPartilha(registro))
                );
            }

            lista.append(item);
        });

        // Registros completos da própria usuária.
        ciclos.filter(function (registro) {
            return registro.entry_date === selecionada;
        }).forEach(function (registro) {
            const texto = registro.flow
                ? 'Fluxo: ' + fluxos[registro.flow] + ' (só você vê)'
                : 'Dia registrado por você.';

            const item = cartao(
                '🩸 Seu registro de menstruação',
                texto
            );

            item.append(
                elemento('small', '', resumoPartilha(registro))
            );

            lista.append(item);
        });

        // O parceiro recebe somente as datas, sem o fluxo.
        compartilhados.filter(function (registro) {
            return registro.entry_date === selecionada;
        }).forEach(function (registro) {
            lista.append(
                cartao(
                    '🩸 Menstruação · ' + nome(registro.user_id),
                    'Data registrada e compartilhada por ela.'
                )
            );
        });

        // Um período pode existir sem registro diário de fluxo.
        const temPeriodo = pronto && diasPeriodos.some(function (registro) {
            return (
                registro.entry_date === selecionada &&
                registro.user_id === usuarioId
            );
        });

        const temDiario = ciclos.some(function (registro) {
            return registro.entry_date === selecionada;
        });

        // Evita repetir o cartão quando já existe um diário neste dia.
        if (temPeriodo && !temDiario) {
            const item = cartao(
                '🩸 Seu período de menstruação',
                'Período registrado na página Menstruação.'
            );

            const link = elemento('a', '', 'Ver meus períodos');
            link.href = 'menstruacao.html';

            item.append(link);
            lista.append(item);
        }
        if (!lista.children.length) {
            lista.append(
                elemento(
                    'p',
                    'texto-suave',
                    pronto
                        ? 'Nenhum registro visível para este dia.'
                        : 'Os registros aparecerão após o carregamento.'
                )
            );
        }

        preencherPessoais();
        controles();
    }

    /* ========================================
       5. DESENHO DO CALENDÁRIO MENSAL
    ======================================== */

    function renderizar() {
        const atual = dataLocal(selecionada);
        const ano = atual.getFullYear();
        const mes = atual.getMonth();

        $('mes').textContent = atual.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
        });

        const tinhaFoco =
            document.activeElement &&
            document.activeElement.dataset.dia;

        const grade = $('dias');
        grade.replaceChildren();

        // Segunda-feira é a primeira coluna.
        const espacos = new Date(ano, mes, 1).getDay();

        for (let i = 0; i < espacos; i++) {
            const vazio = elemento('span', 'dia-vazio');

            vazio.setAttribute('aria-hidden', 'true');
            grade.append(vazio);
        }

        const ultimo = new Date(ano, mes + 1, 0).getDate();

        for (let dia = 1; dia <= ultimo; dia++) {
            const data = chave(new Date(ano, mes, dia));
            const botao = elemento('button', 'dia-app');

            botao.type = 'button';
            botao.dataset.dia = data;

            botao.setAttribute(
                'aria-pressed',
                String(data === selecionada)
            );

            if (data === chave(new Date())) {
                botao.classList.add('hoje');
                botao.setAttribute('aria-current', 'date');
            }

            botao.append(elemento('span', '', String(dia)));

            const marcadores = elemento(
                'span',
                'calendario-marcadores'
            );

            marcadores.setAttribute('aria-hidden', 'true');

            const textos = [];

            if (eventos.some(function (evento) {
                return evento.event_date === data;
            })) {
                marcadores.append(elemento('span', 'marker-event', ''));
                textos.push('com compromisso');
            }

            if (tarefas.some(function (tarefa) {
                return tarefa.due_date === data;
            })) {
                marcadores.append(elemento('span', 'marker-task', ''));
                textos.push('com prazo de tarefa');
            }

            // Inclui os períodos completos nos marcadores do calendário.
            // Durante uma falha ou troca de mês, ignora resultados antigos.
            if (
                ciclos.concat(
                    compartilhados,
                    pronto ? diasPeriodos : []
                ).some(function (registro) {
                    return registro.entry_date === data;
                })
            ) {
                marcadores.append(elemento('span', '', '🩸'));
                textos.push('com registro de menstruação');
            }

            const sentimentosDia = humores.filter(function (registro) {
                return registro.entry_date === data;
            });

            if (sentimentosDia.length) {
                const codigos = [];

                sentimentosDia.forEach(function (registro) {
                    registro.feelings.forEach(function (codigo) {
                        if (!codigos.includes(codigo)) {
                            codigos.push(codigo);
                        }
                    });
                });

                if (!codigos.length) {
                    marcadores.append(elemento('span', '', '💭'));
                }

                // Mostra até dois emojis. Os demais ficam na agenda.
                codigos.slice(0, 2).forEach(function (codigo) {
                    marcadores.append(
                        elemento(
                            'span',
                            '',
                            sentimentos[codigo]
                                ? sentimentos[codigo][0]
                                : '💭'
                        )
                    );
                });

                if (codigos.length > 2) {
                    marcadores.append(elemento('span', '', '+'));
                }

                textos.push('com sentimentos informados');
            }

            botao.setAttribute(
                'aria-label',
                dataTexto(data) +
                    (textos.length ? ', ' + textos.join(', ') : '')
            );

            botao.append(marcadores);
            grade.append(botao);
        }

        agenda();

        // Mantém o foco do teclado ao atualizar os dias.
        if (tinhaFoco) {
            const alvo = grade.querySelector(
                '[data-dia="' + tinhaFoco + '"]'
            );

            if (alvo) {
                alvo.focus();
            }
        }
    }

    /* ========================================
       6. LEITURA DOS DADOS NO SUPABASE
    ======================================== */

    // Busca em páginas para não cortar listas grandes no limite da API.
    async function buscarTodos(fabrica) {
        const linhas = [];

        for (let inicio = 0; ; inicio += 500) {
            const resposta = await fabrica()
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
        if (!usuarioId) {
            return iniciar();
        }

        if (ocupado || carregando) {
            repetirCarga = true;
            return;
        }

        carregando = true;
        repetirCarga = false;

        controles();

        $('status-calendario').textContent =
            'Atualizando calendário…';

        const data = dataLocal(selecionada);

        const inicio = chave(
            new Date(data.getFullYear(), data.getMonth(), 1)
        );

        const fim = chave(
            new Date(data.getFullYear(), data.getMonth() + 1, 0)
        );

        try {
            const respostaMembros = await supabaseClient.rpc(
                'get_couple_members'
            );

            if (respostaMembros.error) {
                throw respostaMembros.error;
            }

            membros = respostaMembros.data;

            const casalAnterior = casalId;

            const vinculo = membros.find(function (registro) {
                return registro.user_id === usuarioId;
            });

            casalId = vinculo ? vinculo.couple_id : null;

            // Um novo vínculo exige uma nova escolha de compartilhamento.
            if (casalAnterior && casalAnterior !== casalId) {
                $('compartilhar-sentimentos').checked = false;
                $('compartilhar-ciclo').checked = false;

                recado(
                    'sentimentos',
                    'Seu vínculo mudou. Confirme novamente antes de ' +
                    'compartilhar com outro parceiro.'
                );

                recado(
                    'ciclo',
                    'Seu vínculo mudou. Confirme novamente antes de ' +
                    'compartilhar com outro parceiro.'
                );
            }

            $('aviso-casal').hidden = !!casalId;

            // As consultas independentes são feitas em paralelo.
            const resultados = await Promise.all([
                casalId
                    ? buscarTodos(function () {
                        return supabaseClient
                            .from('calendar_events')
                            .select('*')
                            .eq('couple_id', casalId)
                            .gte('event_date', inicio)
                            .lte('event_date', fim);
                    })
                    : [],

                casalId
                    ? buscarTodos(function () {
                        return supabaseClient
                            .from('tasks')
                            .select(
                                'id,title,due_date,status,priority,assigned_to'
                            )
                            .eq('couple_id', casalId)
                            .gte('due_date', inicio)
                            .lte('due_date', fim);
                    })
                    : [],

                buscarTodos(function () {
                    return supabaseClient
                        .from('daily_wellbeing')
                        .select('*')
                        .gte('entry_date', inicio)
                        .lte('entry_date', fim);
                }),

                buscarTodos(function () {
                    return supabaseClient
                        .from('cycle_logs')
                        .select('*')
                        .eq('user_id', usuarioId)
                        .gte('entry_date', inicio)
                        .lte('entry_date', fim);
                }),

                supabaseClient.rpc('get_shared_cycle_days', {
                    p_start_date: inicio,
                    p_end_date: fim
                }),

                // Consulta os próprios períodos completos.
                supabaseClient.rpc('get_my_period_days', {
                    p_start_date: inicio,
                    p_end_date: fim,
                    p_today: chave(new Date())
                })
                ]);

                if (resultados[4].error) {
                    throw resultados[4].error;
                }

                if (resultados[5].error) {
                    throw resultados[5].error;
                }

                eventos = resultados[0];
                tarefas = resultados[1];
                humores = resultados[2];
                ciclos = resultados[3];
                compartilhados = resultados[4].data;
                diasPeriodos = resultados[5].data;

            pronto = true;
            renderizar();

            const horario = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            $('status-calendario').textContent =
                'Atualizado às ' + horario +
                ' · atualização automática a cada 30 segundos.';
        } catch (erro) {
            pronto = false;

            eventos = [];
            tarefas = [];
            humores = [];
            ciclos = [];
            compartilhados = [];

            // Remove também os dados compartilhados que estavam na tela.
            renderizar();

            $('status-calendario').textContent =
                'Não foi possível carregar. ' +
                'Confira a conexão e clique em Atualizar.';

            console.error(
                'Falha ao carregar calendário:',
                erro.code || erro.name
            );
        } finally {
            carregando = false;
            controles();

            if (repetirCarga && !encerrado) {
                repetirCarga = false;
                void carregar();
            }
        }
    }

    /* ========================================
       7. NAVEGAÇÃO ENTRE DIAS E MESES
    ======================================== */

    function cancelarEvento() {
        edicaoEvento = null;
        sujoEvento = false;

        $('form-evento').reset();
        $('data').value = selecionada;

        $('titulo-form-evento').textContent = 'Novo compromisso';
        $('salvar-evento').textContent = 'Criar compromisso';
        $('cancelar-evento').hidden = true;

        $('titulo').setCustomValidity('');
        $('hora-fim').setCustomValidity('');
    }

    function podeMudarDia() {
        if (ocupado || carregando) {
            return false;
        }

        const temAlteracoes = sujoEvento || sujoHumor || sujoCiclo;

        if (
            temAlteracoes &&
            !window.confirm(
                'Descartar as alterações não salvas antes de mudar de dia?'
            )
        ) {
            return false;
        }

        sujoEvento = false;
        sujoHumor = false;
        sujoCiclo = false;

        return true;
    }

    async function selecionar(data) {
        if (!podeMudarDia()) {
            return;
        }

        const mudouMes =
            data.slice(0, 7) !== selecionada.slice(0, 7);

        selecionada = data;
        cancelarEvento();

        ['evento', 'sentimentos', 'ciclo'].forEach(function (tipo) {
            recado(tipo, '');
        });

        if (mudouMes) {
            pronto = false;

            eventos = [];
            tarefas = [];
            humores = [];
            ciclos = [];
            compartilhados = [];

            renderizar();
            await carregar();
        } else {
            renderizar();
        }
    }

    function mudarMes(passo) {
        const data = dataLocal(selecionada);

        const novo = new Date(
            data.getFullYear(),
            data.getMonth() + passo,
            1
        );

        const dia = Math.min(
            data.getDate(),
            new Date(
                novo.getFullYear(),
                novo.getMonth() + 1,
                0
            ).getDate()
        );

        if (
            novo.getFullYear() < 1900 ||
            novo.getFullYear() > 2100
        ) {
            return;
        }

        void selecionar(
            chave(new Date(novo.getFullYear(), novo.getMonth(), dia))
        );
    }

    /* ========================================
       8. GRAVAÇÃO E CONTROLE DE VERSÃO
    ======================================== */

    // A versão evita sobrescrever uma alteração feita em outra aba.
    function editarRegistro(tabela, registro, valores) {
        return supabaseClient
            .from(tabela)
            .update(valores)
            .eq('id', registro.id)
            .eq('version', registro.version)
            .select('id')
            .single();
    }

    function excluirRegistro(tabela, registro) {
        return supabaseClient
            .from(tabela)
            .delete()
            .eq('id', registro.id)
            .eq('version', registro.version)
            .select('id')
            .single();
    }

    async function gravar(tipo, operacao, sucesso, finalizar) {
        if (ocupado || !pronto) {
            return;
        }

        if (carregando) {
            recado(
                tipo,
                'Aguarde a atualização terminar e tente novamente.'
            );

            return;
        }

        ocupado = true;
        controles();
        recado(tipo, 'Salvando…');

        try {
            const resposta = await operacao();

            if (resposta.error) {
                throw resposta.error;
            }

            if (!resposta.data) {
                throw new Error('Resposta sem confirmação.');
            }

            finalizar();
            recado(tipo, sucesso);
        } catch (erro) {
            const conflito =
                erro.code === 'PGRST116' ||
                erro.code === '23505';

            recado(
                tipo,
                conflito
                    ? 'Este registro mudou em outra aba. Use Atualizar e ' +
                      'descarte sua edição para abrir a versão atual.'
                    : 'Não foi possível confirmar a alteração. Atualize e ' +
                      'confira os dados antes de tentar novamente.'
            );

            console.error(
                'Falha ao salvar calendário:',
                erro.code || erro.name
            );
        } finally {
            ocupado = false;

            await carregar();
            controles();
        }
    }

    /* ========================================
       9. CRIAR, EDITAR E EXCLUIR COMPROMISSOS
    ======================================== */

    $('form-evento').addEventListener('input', function () {
        sujoEvento = true;

        $('titulo').setCustomValidity('');
        $('hora-fim').setCustomValidity('');
    });

    $('form-evento').addEventListener('submit', async function (evento) {
        evento.preventDefault();

        $('titulo').setCustomValidity(
            $('titulo').value.trim() ? '' : 'Informe o compromisso.'
        );

        const hora = $('hora').value;
        const fim = $('hora-fim').value;

        $('hora-fim').setCustomValidity(
            fim && (!hora || fim <= hora)
                ? 'O fim precisa ser depois do início, no mesmo dia.'
                : ''
        );

        if (!$('form-evento').reportValidity() || !casalId) {
            return;
        }

        const valores = {
            title: $('titulo').value.trim(),
            description: $('descricao-evento').value.trim(),
            event_date: $('data').value,
            start_time: hora || null,
            end_time: fim || null
        };

        const registro = edicaoEvento;

        await gravar(
            'evento',

            function () {
                if (registro) {
                    return editarRegistro(
                        'calendar_events',
                        registro,
                        valores
                    );
                }

                return supabaseClient
                    .from('calendar_events')
                    .insert(
                        Object.assign({ couple_id: casalId }, valores)
                    )
                    .select('id')
                    .single();
            },

            registro
                ? 'Compromisso atualizado!'
                : 'Compromisso criado!',

            function () {
                // Preserva rascunhos dos outros formulários.
                if (!sujoHumor && !sujoCiclo) {
                    selecionada = valores.event_date;
                }

                cancelarEvento();
            }
        );
    });

    $('cancelar-evento').addEventListener('click', function () {
        cancelarEvento();
        recado('evento', 'Edição cancelada.');
    });

    $('lista').addEventListener('click', async function (evento) {
        const botao = evento.target.closest('button[data-acao]');

        if (!botao || ocupado || carregando) {
            return;
        }

        const registro = eventos.find(function (item) {
            return item.id === botao.dataset.id;
        });

        if (!registro) {
            return;
        }

        if (botao.dataset.acao === 'excluir') {
            if (
                !window.confirm(
                    'Excluir o compromisso “' + registro.title + '”?'
                )
            ) {
                return;
            }

            await gravar(
                'evento',

                function () {
                    return excluirRegistro('calendar_events', registro);
                },

                'Compromisso excluído.',

                function () {
                    if (
                        edicaoEvento &&
                        edicaoEvento.id === registro.id
                    ) {
                        cancelarEvento();
                    }
                }
            );
        } else {
            if (
                sujoEvento &&
                !window.confirm('Descartar a edição atual?')
            ) {
                return;
            }

            edicaoEvento = linhaCopiada(registro);
            sujoEvento = true;

            $('titulo').value = registro.title;
            $('descricao-evento').value = registro.description;
            $('data').value = registro.event_date;

            $('hora').value = registro.start_time
                ? registro.start_time.slice(0, 5)
                : '';

            $('hora-fim').value = registro.end_time
                ? registro.end_time.slice(0, 5)
                : '';

            $('titulo-form-evento').textContent = 'Editar compromisso';
            $('salvar-evento').textContent = 'Salvar alterações';
            $('cancelar-evento').hidden = false;

            $('titulo').setCustomValidity('');
            $('hora-fim').setCustomValidity('');
            $('titulo').focus();
        }
    });

    /* ========================================
       10. SENTIMENTOS E MENSTRUAÇÃO
    ======================================== */

    $('form-sentimentos').addEventListener('input', function () {
        sujoHumor = true;
        recado('sentimentos', '');
    });

    $('form-ciclo').addEventListener('input', function () {
        sujoCiclo = true;
        recado('ciclo', '');
    });

    $('form-sentimentos').addEventListener(
        'submit',
        async function (evento) {
            evento.preventDefault();

            if (!feminino) {
                return;
            }

            const codigos = Array.from(
                document.querySelectorAll(
                    '[name="sentimento"]:checked'
                )
            ).map(function (input) {
                return input.value;
            });

            const observacao = $('nota-sentimentos').value.trim();

            if (!codigos.length && !observacao) {
                recado(
                    'sentimentos',
                    'Escolha pelo menos um sentimento ou escreva uma observação.'
                );

                return;
            }

            const registro = edicaoHumor;

            const valores = {
                entry_date: selecionada,
                feelings: codigos,
                note: observacao,
                shared_with_couple_id:
                    $('compartilhar-sentimentos').checked
                        ? casalId
                        : null
            };

            await gravar(
                'sentimentos',

                function () {
                    if (registro) {
                        return editarRegistro(
                            'daily_wellbeing',
                            registro,
                            valores
                        );
                    }

                    return supabaseClient
                        .from('daily_wellbeing')
                        .insert(valores)
                        .select('id')
                        .single();
                },

                'Sentimentos salvos.',

                function () {
                    sujoHumor = false;
                }
            );
        }
    );

    $('form-ciclo').addEventListener('submit', async function (evento) {
        evento.preventDefault();

        if (!feminino) {
            return;
        }

        const registro = edicaoCiclo;

        const valores = {
            entry_date: selecionada,
            flow: $('fluxo').value || null,
            shared_with_couple_id:
                $('compartilhar-ciclo').checked ? casalId : null
        };

        await gravar(
            'ciclo',

            function () {
                if (registro) {
                    return editarRegistro('cycle_logs', registro, valores);
                }

                return supabaseClient
                    .from('cycle_logs')
                    .insert(valores)
                    .select('id')
                    .single();
            },

            'Dia de menstruação salvo.',

            function () {
                sujoCiclo = false;
            }
        );
    });

    $('excluir-sentimentos').addEventListener(
        'click',
        async function () {
            if (
                !edicaoHumor ||
                !window.confirm('Apagar seus sentimentos deste dia?')
            ) {
                return;
            }

            const registro = edicaoHumor;

            await gravar(
                'sentimentos',

                function () {
                    return excluirRegistro('daily_wellbeing', registro);
                },

                'Registro apagado.',

                function () {
                    sujoHumor = false;
                }
            );
        }
    );

    $('excluir-ciclo').addEventListener('click', async function () {
        if (
            !edicaoCiclo ||
            !window.confirm(
                'Remover seu registro de menstruação deste dia?'
            )
        ) {
            return;
        }

        const registro = edicaoCiclo;

        await gravar(
            'ciclo',

            function () {
                return excluirRegistro('cycle_logs', registro);
            },

            'Dia removido.',

            function () {
                sujoCiclo = false;
            }
        );
    });

    /* ========================================
       11. BOTÕES DE NAVEGAÇÃO E ATUALIZAÇÃO
    ======================================== */

    $('atualizar-calendario').addEventListener('click', function () {
        const temAlteracoes = sujoEvento || sujoHumor || sujoCiclo;

        if (
            temAlteracoes &&
            !window.confirm(
                'Descartar alterações não salvas e carregar os registros atuais?'
            )
        ) {
            return;
        }

        sujoHumor = false;
        sujoCiclo = false;

        cancelarEvento();
        void carregar();
    });

    $('dias').addEventListener('click', function (evento) {
        const botao = evento.target.closest('button[data-dia]');

        if (botao && botao.dataset.dia !== selecionada) {
            void selecionar(botao.dataset.dia);
        }
    });

    $('anterior').addEventListener('click', function () {
        mudarMes(-1);
    });

    $('seguinte').addEventListener('click', function () {
        mudarMes(1);
    });

    $('hoje').addEventListener('click', function () {
        void selecionar(chave(new Date()));
    });

    /* ========================================
       12. INICIALIZAÇÃO E ATUALIZAÇÃO AUTOMÁTICA
    ======================================== */

    async function iniciar() {
        if (iniciando) {
            return;
        }

        iniciando = true;
        controles();

        try {
            const autenticacao = await supabaseClient.auth.getUser();

            if (
                autenticacao.error ||
                !autenticacao.data.user
            ) {
                throw autenticacao.error || new Error('Sem sessão.');
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

            $('painel-pessoal').hidden = !feminino;

            criarOpcoes();
            cancelarEvento();
        } catch (erro) {
            $('status-calendario').textContent =
                'Não foi possível carregar sua conta. ' +
                'Confira a conexão e clique em Atualizar.';

            return;
        } finally {
            iniciando = false;
            controles();
        }

        await carregar();

        // Atualiza a cada 30 segundos enquanto a página estiver visível.
        if (!timer) {
            timer = setInterval(function () {
                if (
                    !document.hidden &&
                    !ocupado &&
                    !carregando &&
                    !encerrado
                ) {
                    void carregar();
                }
            }, 30000);
        }
    }

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && usuarioId) {
            void carregar();
        }
    });

    window.addEventListener('online', function () {
        void carregar();
    });

    window.addEventListener('offline', function () {
        pronto = false;

        eventos = [];
        tarefas = [];
        humores = [];
        ciclos = [];
        compartilhados = [];

        renderizar();

        $('status-calendario').textContent =
            'Você está sem conexão. Reconecte e atualize ' +
            'para consultar os registros.';
    });

    // Evita sair sem perceber que existem alterações não salvas.
    window.addEventListener('beforeunload', function (evento) {
        if (sujoEvento || sujoHumor || sujoCiclo) {
            evento.preventDefault();
            evento.returnValue = '';
        }
    });

    window.addEventListener('pagehide', function () {
        encerrado = true;
        clearInterval(timer);
    });

    window.addEventListener('pageshow', function (evento) {
        if (evento.persisted) {
            window.location.reload();
        }
    });

    renderizar();
    void iniciar();
})();