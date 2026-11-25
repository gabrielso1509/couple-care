/* Tarefas reais do casal. A RLS e os gatilhos do banco validam cada operação. */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const form = $('form-tarefa');
    if (!form) return;
    const categorias = { house: 'Casa', shopping: 'Compras', bills: 'Contas', care: 'Cuidados', leisure: 'Lazer', other: 'Outros' };
    const prioridades = { high: 'Alta', normal: 'Normal', low: 'Baixa' };
    const repeticoes = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };
    const acoes = { created: 'criou', edited: 'atualizou', completed: 'concluiu', reopened: 'reabriu', deleted: 'excluiu' };
    let tarefas = [], membros = [], eventos = [];
    let casalId = null, usuarioId = null, edicao = null;
    let ocupado = false, carregando = false, pronto = false, atualizarDepois = false;
    let filtro = matchMedia('(max-width: 720px)').matches ? 'today' : 'all', limite = 30, canal = null, timerRealtime = null;
    let conectado = false, encerrado = false;
    const fotos = new Map();
    let historicoLimite = 50, temMaisHistorico = false;
    const periodosHistoricoAbertos = new Set();

    // Datas sem horário são comparadas no calendário local do usuário.
    function hoje() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function dataCurta(valor) { return valor ? valor.split('-').reverse().join('/') : 'Sem prazo'; }
    function instante(valor) { return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
    function nome(id) { return membros.find(m => m.user_id === id)?.display_name || 'Conta indisponível'; }
    function elemento(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto !== undefined) el.textContent = texto;
        return el;
    }
    function mensagem(texto) { $('feedback').textContent = texto; }
    function controles() {
        const bloqueado = ocupado || carregando || !pronto;
        $('campos-tarefa').disabled = bloqueado;
        $('atualizar-tarefas').disabled = ocupado || carregando;
        $('mais-atividades').disabled = ocupado || carregando;
        $('form-tarefa').setAttribute('aria-busy', String(ocupado));
        document.querySelectorAll('#lista button, #lista input').forEach(el => { el.disabled = bloqueado; });
    }
    function estadoConexao() {
        if (!casalId) return;
        $('status-tarefas').textContent = carregando ? 'Atualizando tarefas…' : !pronto
            ? 'Não foi possível atualizar. Use Atualizar para tentar novamente.'
            : conectado ? 'Tudo em dia · atualização automática conectada.'
            : 'Atualização automática desconectada. Você pode usar Atualizar.';
    }

    // Reutiliza URLs das fotos privadas e libera a memória ao sair da página.
    async function avatar(el, membro) {
        el.textContent = membro.display_name.trim().charAt(0).toUpperCase();
        if (!membro.avatar_path) return;
        const caminho = membro.avatar_path;
        if (!fotos.has(caminho)) {
            fotos.set(caminho, supabaseClient.storage.from('avatars').download(caminho)
                .then(({ data, error }) => !error && !encerrado ? URL.createObjectURL(data) : null)
                .catch(() => null));
        }
        const url = await fotos.get(caminho);
        if (url && el.isConnected) {
            const img = elemento('img'); img.alt = ''; img.src = url;
            img.addEventListener('error', () => { el.textContent = membro.display_name.charAt(0).toUpperCase(); });
            el.replaceChildren(img);
        }
    }
    function opcoesMembros() {
        const selecionado = $('responsavel').value;
        const filtrado = $('filtro-responsavel').value;
        $('responsavel').replaceChildren(new Option('Sem responsável', ''), new Option('Nós dois', 'both'));
        $('filtro-responsavel').replaceChildren(new Option('Todos', 'all'), new Option('Nós dois', 'both'), new Option('Sem responsável', 'unassigned'));
        membros.forEach(m => {
            $('responsavel').add(new Option(m.display_name, m.user_id));
            $('filtro-responsavel').add(new Option(m.display_name, m.user_id));
        });
        $('responsavel').value = (selecionado === 'both' || membros.some(m => m.user_id === selecionado)) ? selecionado : '';
        $('filtro-responsavel').value = ['all', 'unassigned', 'both', ...membros.map(m => m.user_id)].includes(filtrado) ? filtrado : 'all';
    }
    function botao(texto, acao, tarefa) {
        const b = elemento('button', '', texto); b.type = 'button';
        b.dataset.acao = acao; b.dataset.id = tarefa.id;
        b.setAttribute('aria-label', texto + ': ' + tarefa.title);
        return b;
    }
    function renderizarCompromissos() {
        const list = $('compromissos-recorrentes');
        const records = new Map(tarefas.map(function (task) { return [task.id, task]; }));
        const current = tarefas.filter(function (task) {
            return task.recurrence === 'weekly' && task.status === 'pending' && !task.recurrence_generated;
        });
        list.replaceChildren();
        list.hidden = !current.length;

        current.forEach(function (task) {
            // Cada ocorrência aponta para a anterior. Uma semana ausente ou reaberta encerra a sequência.
            let previous = records.get(task.recurrence_parent);
            let expected = CC.agenda.plusDays(task.due_date, -7);
            let streak = 0;
            while (previous?.status === 'completed' && previous.due_date === expected) {
                streak += 1;
                expected = CC.agenda.plusDays(expected, -7);
                previous = records.get(previous.recurrence_parent);
            }

            const card = elemento('article', 'card compromisso-semanal');
            const heading = elemento('header');
            heading.append(elemento('span', 'mobile-kicker', '♡ Compromisso do casal'), elemento('span', 'compromisso-selo', 'Semanal'));
            const responsible = task.assigned_to_both ? 'Nós dois' : task.assigned_to ? nome(task.assigned_to) : 'Sem responsável';
            const bar = elemento('progress', 'compromisso-progresso');
            bar.max = 4;
            bar.value = Math.min(streak, 4);
            bar.setAttribute('aria-label', 'Progresso até 4 semanas seguidas');
            const message = streak === 1 ? '1 semana seguida' : streak + ' semanas seguidas';
            card.append(heading, elemento('h3', '', task.title), elemento('p', '', dataCurta(task.due_date) + ' · ' + responsible),
                bar, elemento('small', '', streak ? message : 'A sequência começa ao concluir a primeira semana.'));
            list.append(card);
        });
    }

    function renderizar() {
        const dia = hoje();
        const pendentes = tarefas.filter(t => t.status === 'pending');
        $('total-pendentes').textContent = pendentes.length;
        $('total-hoje').textContent = pendentes.filter(t => t.due_date === dia).length;
        $('total-concluidas').textContent = tarefas.filter(t => t.status === 'completed').length;
        const tasksToday = tarefas.filter(function (task) { return task.due_date === dia; });
        $('mobile-task-progress-bar').dataset.total = String(tasksToday.length);
        $('mobile-task-progress-bar').dataset.done = String(tasksToday.filter(function (task) { return task.status === 'completed'; }).length);
        renderizarCompromissos();
        $('total-atrasadas').textContent = pendentes.filter(t => t.due_date && t.due_date < dia).length;
        const busca = $('busca-tarefa').value.trim().toLocaleLowerCase('pt-BR');
        const pessoa = $('filtro-responsavel').value;
        const visiveis = tarefas.filter(t => {
            if (filtro === 'pending' && t.status !== 'pending') return false;
            if (filtro === 'completed' && t.status !== 'completed') return false;
            if (['today', 'upcoming', 'overdue'].includes(filtro)) {
                if (t.status !== 'pending' || !t.due_date) return false;
                if (filtro === 'today' && t.due_date !== dia) return false;
                if (filtro === 'upcoming' && t.due_date <= dia) return false;
                if (filtro === 'overdue' && t.due_date >= dia) return false;
            }
            if (pessoa === 'both' && !t.assigned_to_both) return false;
            if (pessoa === 'unassigned' && (t.assigned_to || t.assigned_to_both)) return false;
            if (pessoa !== 'all' && pessoa !== 'unassigned' && pessoa !== 'both' && !t.assigned_to_both && t.assigned_to !== pessoa) return false;
            return (t.title + ' ' + t.description).toLocaleLowerCase('pt-BR').includes(busca);
        });
        const peso = { high: 0, normal: 1, low: 2 };
        visiveis.sort((a, b) => {
            const ordem = $('ordenacao').value;
            if (ordem === 'priority') return peso[a.priority] - peso[b.priority] || (a.due_date || '9999').localeCompare(b.due_date || '9999') || b.created_at.localeCompare(a.created_at);
            if (ordem === 'newest') return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
            return (a.due_date || '9999').localeCompare(b.due_date || '9999') || peso[a.priority] - peso[b.priority] || b.created_at.localeCompare(a.created_at);
        });
        const lista = $('lista'); lista.replaceChildren();
        $('resumo').textContent = `${visiveis.length} de ${tarefas.length} tarefa(s) neste filtro.`;
        $('mais-tarefas').hidden = visiveis.length <= limite;
        if (!visiveis.length) lista.append(elemento('p', 'texto-suave', 'Nenhuma tarefa para este filtro.'));
        visiveis.slice(0, limite).forEach(t => {
            const concluida = t.status === 'completed';
            const atrasada = !concluida && t.due_date && t.due_date < dia;
            const card = elemento('article', 'tarefa-cartao' + (concluida ? ' concluida' : atrasada ? ' atrasada' : t.due_date === dia ? ' para-hoje' : ''));
            const toggle = botao(concluida ? '✓' : '○', 'status', t); toggle.className = 'cc-task-toggle'; toggle.setAttribute('aria-label', (concluida ? 'Reabrir: ' : 'Concluir: ') + t.title);
            const header = elemento('div', 'tarefa-cartao-texto');
            header.append(elemento('h3', '', t.title), elemento('p', 'tarefa-meta', dataCurta(t.due_date) + ' · ' + categorias[t.category]));
            if (t.description) header.append(elemento('p', 'mobile-only tarefa-cartao-resumo', t.description));
            const lado = elemento('div', 'tarefa-cartao-lado');
            const prazo = concluida ? 'Feita' : t.due_date === dia ? 'Hoje' :
                t.due_date === CC.agenda.plusDays(dia, 1) ? 'Amanhã' : t.due_date ? dataCurta(t.due_date).slice(0, 5) : '';
            if (prazo) lado.append(elemento('span', 'mobile-only tarefa-cartao-prazo', prazo));
            card.append(toggle, header, lado);
            const details = elemento('details', 'tarefa-details'); details.append(elemento('summary', '', 'Detalhes e ações')); 
            const tags = elemento('div', 'tarefa-etiquetas');
            tags.append(elemento('span', 'tarefa-etiqueta', categorias[t.category]), elemento('span', 'tarefa-etiqueta' + (t.priority === 'high' ? ' alta' : ''), 'Prioridade ' + prioridades[t.priority].toLowerCase()));
            tags.append(elemento('span', 'tarefa-etiqueta' + (atrasada ? ' atraso' : ''), (atrasada ? 'Atrasada · ' : !concluida && t.due_date === dia ? 'Hoje · ' : '') + dataCurta(t.due_date)));
            if (concluida) tags.append(elemento('span', 'tarefa-etiqueta', 'Concluída'));
            if (t.recurrence !== 'none') tags.append(elemento('span', 'tarefa-etiqueta', 'Repetição ' + repeticoes[t.recurrence].toLowerCase()));
            details.append(tags);
            if (t.description) details.append(elemento('p', 'tarefa-descricao', t.description));
            const responsaveis = t.assigned_to_both ? membros : membros.filter(m => m.user_id === t.assigned_to);
            const nomeResponsavel = t.assigned_to_both ? 'Nós dois' :
                t.assigned_to ? nome(t.assigned_to) : 'Sem responsável';
            details.append(elemento('p', 'tarefa-responsavel-texto', 'Responsável: ' + nomeResponsavel));
            if (responsaveis.length) {
                const fotos = elemento('div', 'tarefa-pessoa');
                fotos.title = nomeResponsavel;
                fotos.setAttribute('role', 'img');
                fotos.setAttribute('aria-label', 'Responsável: ' + nomeResponsavel);
                responsaveis.forEach(function (membro) {
                    const foto = elemento('span', 'tarefa-avatar');
                    foto.setAttribute('aria-hidden', 'true');
                    fotos.append(foto);
                    queueMicrotask(function () { avatar(foto, membro); });
                });
                lado.append(fotos);
            }
            if (t.checklist.length) {
                const feitos = t.checklist.filter(i => i.done).length;
                details.append(elemento('small', '', `Checklist: ${feitos}/${t.checklist.length}`));
                const ul = elemento('ul', 'tarefa-checklist');
                t.checklist.forEach(item => {
                    const li = elemento('li'), label = elemento('label'), check = elemento('input');
                    check.type = 'checkbox'; check.checked = item.done;
                    check.dataset.tarefa = t.id; check.dataset.item = item.id;
                    label.append(check, elemento('span', '', item.text)); li.append(label); ul.append(li);
                });
                details.append(ul);
            }
            const buttons = elemento('div', 'tarefa-acoes');
            buttons.append(botao(concluida ? 'Reabrir' : 'Concluir', 'status', t), botao('Editar', 'editar', t), botao('Excluir', 'excluir', t));
            details.append(buttons);
            let autoria = 'Criada por ' + nome(t.created_by) + ' · ' + instante(t.created_at);
            if (concluida) autoria += ' | Concluída por ' + (t.completed_by ? nome(t.completed_by) : 'conta não registrada') + ' · ' + instante(t.completed_at);
            details.append(elemento('p', 'tarefa-autoria', autoria)); card.append(details); lista.append(card);
        });
        renderizarHistorico();
        controles();
    }

    /* Histórico: agrupa datas locais e mantém autoria/foto em cada atividade. */
    function renderizarHistorico() {
        const lista = $('historico-tarefas');
        const rolagem = $('rolagem-historico');
        const posicao = rolagem.scrollTop;
        const foco = document.activeElement?.closest('.activity-period')?.dataset.periodo;
        // Mantém os grupos abertos e a posição quando chegam novas atividades.
        lista.querySelectorAll('.activity-period').forEach(function (periodo) {
            if (periodo.open) periodosHistoricoAbertos.add(periodo.dataset.periodo);
            else periodosHistoricoAbertos.delete(periodo.dataset.periodo);
        });
        lista.replaceChildren();
        const modo = $('agrupar-atividades').value;
        const grupos = new Map();
        eventos.forEach(function (evento) {
            const data = new Date(evento.created_at);
            if (Number.isNaN(data.getTime())) return;
            const base = new Date(data.getFullYear(), data.getMonth(), data.getDate());
            let chaveGrupo, titulo;
            if (modo === 'year') {
                chaveGrupo = String(data.getFullYear()); titulo = 'Ano de ' + data.getFullYear();
            } else if (modo === 'month') {
                chaveGrupo = data.getFullYear() + '-' + data.getMonth();
                titulo = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
            } else {
                base.setDate(base.getDate() - (base.getDay() + 6) % 7);
                const fim = new Date(base); fim.setDate(fim.getDate() + 6);
                chaveGrupo = base.getFullYear() + '-' + base.getMonth() + '-' + base.getDate();
                titulo = 'Semana de ' + base.toLocaleDateString('pt-BR') + ' a ' + fim.toLocaleDateString('pt-BR');
            }
            if (!grupos.has(chaveGrupo)) grupos.set(chaveGrupo, { titulo: titulo, itens: [] });
            grupos.get(chaveGrupo).itens.push(evento);
        });
        grupos.forEach(function (grupo, chave) {
            const secao = elemento('li', 'activity-group');
            const periodo = elemento('details', 'activity-period');
            periodo.dataset.periodo = modo + '|' + chave;
            periodo.open = periodosHistoricoAbertos.has(periodo.dataset.periodo);
            const topo = elemento('summary', 'activity-group-heading');
            topo.append(elemento('span', 'activity-period-title', grupo.titulo), elemento('span', 'activity-period-count', grupo.itens.length + ' atividade(s)'));
            const itens = elemento('ol', 'activity-items');
            grupo.itens.forEach(function (evento) {
                const li = elemento('li', 'activity-item');
                const foto = elemento('span', 'activity-avatar'); foto.setAttribute('aria-hidden', 'true');
                const autor = membros.find(function (m) { return m.user_id === evento.actor_id; });
                foto.textContent = autor ? autor.display_name.trim().charAt(0).toUpperCase() : '?';
                const corpo = elemento('div', 'activity-body');
                const frase = elemento('p', 'activity-description');
                frase.append(elemento('strong', '', nome(evento.actor_id)), document.createTextNode(' ' + (acoes[evento.action] || 'alterou') + ' '), elemento('span', 'activity-task-title', '“' + evento.title + '”'));
                const rodape = elemento('div', 'activity-meta');
                const textos = { created: 'Criação', edited: 'Edição', completed: 'Conclusão', reopened: 'Reabertura', deleted: 'Exclusão' };
                rodape.append(elemento('span', 'activity-badge ' + evento.action, textos[evento.action] || 'Alteração'));
                const time = elemento('time', '', new Date(evento.created_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }));
                time.dateTime = evento.created_at; rodape.append(time); corpo.append(frase, rodape); li.append(foto, corpo); itens.append(li);
                if (autor) queueMicrotask(function () { avatar(foto, autor); });
            });
            periodo.append(topo, itens); secao.append(periodo); lista.append(secao);
        });
        if (!eventos.length) lista.append(elemento('li', 'empty-state', 'As atividades de vocês vão aparecer aqui.'));
        $('resumo-atividades').textContent = eventos.length + ' atividade(s) carregada(s)' + (temMaisHistorico ? ' · Há registros anteriores disponíveis.' : ' · Histórico carregado.');
        $('mais-atividades').hidden = !temMaisHistorico;
        if (foco) {
            const anterior = Array.from(lista.querySelectorAll('.activity-period')).find(function (p) { return p.dataset.periodo === foco; });
            if (anterior) anterior.querySelector('summary').focus({ preventScroll: true });
        }
        rolagem.scrollTop = posicao;
    }

    // Busca todas as tarefas em páginas para não truncar no limite da API.
    async function buscarTarefas() {
        const resultado = [];
        for (let inicio = 0; ; inicio += 500) {
            const { data, error } = await supabaseClient.from('tasks').select('*')
                .eq('couple_id', casalId).order('id').range(inicio, inicio + 499);
            if (error) throw error;
            resultado.push(...data);
            if (data.length < 500) return resultado;
        }
    }
    async function atualizar() {
        if (!casalId) return iniciar();
        if (ocupado || carregando) { atualizarDepois = true; return; }
        carregando = true; atualizarDepois = false; controles(); estadoConexao();
        try {
            const [novas, historico, participantes] = await Promise.all([
                buscarTarefas(),
                supabaseClient.from('task_events').select('id,actor_id,action,title,created_at')
                    .eq('couple_id', casalId).order('created_at', { ascending: false }).order('id').limit(historicoLimite + 1),
                supabaseClient.rpc('get_couple_members')
            ]);
            if (historico.error) throw historico.error;
            if (participantes.error) throw participantes.error;
            if (!participantes.data.some(m => m.user_id === usuarioId && m.couple_id === casalId)) {
                window.location.reload(); return;
            }
            membros = participantes.data; opcoesMembros();
            if ($('feedback').textContent.startsWith('Não foi possível carregar as tarefas.')) mensagem('');
            // Uma migration ausente precisa de uma mensagem útil, sem habilitar gravações.
            if (novas.some(t => !Array.isArray(t.checklist) || !t.version)) throw new Error('Estrutura de tarefas desatualizada.');
            tarefas = novas; temMaisHistorico = historico.data.length > historicoLimite; eventos = historico.data.slice(0, historicoLimite); pronto = true;
            renderizar();
        } catch (erro) {
            pronto = false;
            mensagem('Não foi possível carregar as tarefas. Confira a conexão e se a migration de melhorias foi executada. Depois clique em Atualizar.');
            console.error('Falha ao carregar tarefas:', erro.code || erro.name);
        } finally {
            carregando = false; controles(); estadoConexao();
            if (atualizarDepois) { atualizarDepois = false; void atualizar(); }
        }
    }
    function limparEditor() {
        edicao = null; form.reset(); $('titulo').setCustomValidity('');
        $('prazo').setCustomValidity(''); $('checklist-texto').setCustomValidity('');
        $('titulo-editor').textContent = 'Nova tarefa';
        $('salvar-tarefa').textContent = 'Criar tarefa'; $('cancelar-edicao').hidden = true;
    }
    function editar(t) {
        edicao = structuredClone(t);
        ['titulo', 'prazo', 'checklist-texto'].forEach(id => $(id).setCustomValidity(''));
        $('titulo').value = t.title; $('descricao').value = t.description;
        $('prazo').value = t.due_date || ''; $('prioridade').value = t.priority;
        $('categoria').value = t.category; $('responsavel').value = t.assigned_to_both ? 'both' : t.assigned_to || '';
        $('repeticao').value = t.recurrence; $('checklist-texto').value = t.checklist.map(i => i.text).join('\n');
        $('titulo-editor').textContent = 'Editar tarefa'; $('salvar-tarefa').textContent = 'Salvar alterações';
        $('cancelar-edicao').hidden = false; mensagem('Editando “' + t.title + '”.');
        $('editor-tarefa-mobile').dispatchEvent(new Event('abrir-editor-tarefa'));
        $('titulo').focus(); $('titulo-editor').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function checklistDoEditor() {
        const linhas = $('checklist-texto').value.split('\n').map(s => s.trim()).filter(Boolean);
        const usados = new Set();
        return linhas.map(text => {
            // Preserva as marcações dos itens que mantiveram o mesmo texto.
            const antigo = edicao?.checklist.find(i => i.text === text && !usados.has(i.id));
            if (antigo) { usados.add(antigo.id); return antigo; }
            return { id: crypto.randomUUID(), text, done: false };
        });
    }
    async function gravar(operacao, sucesso, aoSalvar) {
        if (ocupado || carregando || !pronto) return;
        ocupado = true; controles(); mensagem('Salvando…');
        try {
            const { data, error } = await operacao();
            if (error) throw error;
            if (!data) throw new Error('Registro não retornado.');
            if (aoSalvar) aoSalvar();
            mensagem(sucesso);
        } catch (erro) {
            const conflito = erro.code === 'PGRST116';
            mensagem(conflito
                ? 'Esta tarefa mudou ou foi excluída na outra conta. Cancele a edição e abra a versão atual para tentar novamente.'
                : 'Não foi possível confirmar a alteração. Atualize e confira a lista antes de tentar novamente.');
            console.error('Falha ao alterar tarefa:', erro.code || erro.name);
        } finally {
            ocupado = false;
            await atualizar(); controles();
        }
    }
    function atualizarTarefa(t, valores) {
        // A versão impede sobrescrever uma mudança recente da outra pessoa.
        return supabaseClient.from('tasks').update(valores).eq('id', t.id)
            .eq('couple_id', casalId).eq('version', t.version).select('id').single();
    }
    form.addEventListener('input', () => {
        $('titulo').setCustomValidity(''); $('prazo').setCustomValidity(''); $('checklist-texto').setCustomValidity('');
    });
    form.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (!pronto || ocupado || carregando) return;
        $('titulo').setCustomValidity($('titulo').value.trim() ? '' : 'Informe o título.');
        $('prazo').setCustomValidity($('repeticao').value !== 'none' && !$('prazo').value ? 'Escolha um prazo para a repetição.' : '');
        const checklist = checklistDoEditor();
        $('checklist-texto').setCustomValidity(checklist.length > 30 || checklist.some(i => i.text.length > 200) ? 'Use até 30 itens, com até 200 caracteres por item.' : '');
        if (!form.reportValidity()) return;
        const valores = {
            title: $('titulo').value.trim(), description: $('descricao').value.trim(),
            due_date: $('prazo').value || null, priority: $('prioridade').value,
            category: $('categoria').value, assigned_to: $('responsavel').value === 'both' ? null : $('responsavel').value || null, assigned_to_both: $('responsavel').value === 'both',
            recurrence: $('repeticao').value, checklist
        };
        const atual = edicao;
        await gravar(() => atual ? atualizarTarefa(atual, valores)
            : supabaseClient.from('tasks').insert({ couple_id: casalId, ...valores }).select('id').single(),
        atual ? 'Tarefa atualizada!' : 'Tarefa criada!', limparEditor);
    });
    $('cancelar-edicao').addEventListener('click', () => { limparEditor(); mensagem('Edição cancelada.'); });
    $('lista').addEventListener('click', async evento => {
        const b = evento.target.closest('button[data-acao]');
        if (!b || ocupado || carregando || !pronto) return;
        const t = tarefas.find(t => t.id === b.dataset.id); if (!t) return;
        if (b.dataset.acao === 'editar') { editar(t); return; }
        if (b.dataset.acao === 'excluir') {
            if (!window.confirm('Excluir “' + t.title + '”? O registro ficará no histórico.')) return;
            await gravar(() => supabaseClient.from('tasks').delete().eq('id', t.id).eq('couple_id', casalId).eq('version', t.version).select('id').single(), 'Tarefa excluída.', () => { if (edicao?.id === t.id) limparEditor(); });
        } else {
            if (edicao?.id === t.id) { mensagem('Salve ou cancele a edição antes de mudar o estado desta tarefa.'); return; }
            const concluindo = t.status === 'pending';
            await gravar(() => atualizarTarefa(t, { status: concluindo ? 'completed' : 'pending' }),
                concluindo && t.recurrence !== 'none' && !t.recurrence_generated ? 'Tarefa concluída! A próxima ocorrência foi criada.' : concluindo ? 'Tarefa concluída!' : 'Tarefa reaberta.');
        }
    });
    $('lista').addEventListener('change', async evento => {
        const check = evento.target.closest('input[data-item]'); if (!check) return;
        const t = tarefas.find(t => t.id === check.dataset.tarefa); if (!t) return;
        if (edicao?.id === t.id || ocupado || carregando || !pronto) {
            check.checked = !check.checked; mensagem('Salve ou cancele a edição antes de marcar os itens.'); return;
        }
        const checklist = t.checklist.map(i => i.id === check.dataset.item ? { ...i, done: check.checked } : i);
        await gravar(() => atualizarTarefa(t, { checklist }), 'Checklist atualizado.');
    });
    const botoesFiltro = document.querySelectorAll('[data-filtro]');
    const filtroEstado = $('filtro-estado-tarefa');
    const dialogoFiltros = $('filtros-tarefas');
    const abrirFiltros = $('abrir-filtros-tarefas');

    function sincronizarFiltros() {
        filtroEstado.value = filtro;
        botoesFiltro.forEach(function (botao) {
            botao.setAttribute('aria-pressed', String(botao.dataset.filtro === filtro));
        });
    }
    function filtrar(valor) {
        filtro = valor;
        limite = 30;
        sincronizarFiltros();
        renderizar();
    }
    botoesFiltro.forEach(function (botao) {
        botao.addEventListener('click', function () { filtrar(botao.dataset.filtro); });
    });
    filtroEstado.addEventListener('change', function () { filtrar(filtroEstado.value); });
    abrirFiltros.addEventListener('click', function () { dialogoFiltros.showModal(); });
    $('fechar-filtros-tarefas').addEventListener('click', function () { dialogoFiltros.close(); });
    $('ver-tarefas-filtradas').addEventListener('click', function () { dialogoFiltros.close(); });
    dialogoFiltros.addEventListener('close', function () { abrirFiltros.focus({ preventScroll: true }); });
    sincronizarFiltros();
    ['busca-tarefa', 'filtro-responsavel', 'ordenacao'].forEach(id => $(id).addEventListener('input', () => { limite = 30; renderizar(); }));
    $('mais-tarefas').addEventListener('click', () => { limite += 30; renderizar(); });
    $('atualizar-tarefas').addEventListener('click', atualizar);
    $('agrupar-atividades').addEventListener('change', function () {
        $('rolagem-historico').scrollTop = 0;
        renderizarHistorico();
    });
    $('mais-atividades').addEventListener('click', function () {
        if (carregando || ocupado) return;
        historicoLimite += 50; void atualizar();
    });

    // Eventos INSERT informam criação, edição, conclusão e exclusão de tarefas.
    function conectarRealtime() {
        canal = supabaseClient.channel('tarefas-' + casalId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_events', filter: 'couple_id=eq.' + casalId }, () => {
                clearTimeout(timerRealtime); timerRealtime = setTimeout(atualizar, 300);
            })
            .subscribe(estado => {
                conectado = estado === 'SUBSCRIBED'; estadoConexao();
                if (conectado) void atualizar();
            });
    }
    async function iniciar() {
        if (carregando || ocupado) return;
        carregando = true; controles();
        try {
            const { data: auth, error: erroAuth } = await supabaseClient.auth.getUser();
            if (erroAuth || !auth.user) throw erroAuth || new Error('Sem sessão.');
            usuarioId = auth.user.id;
            const { data, error } = await supabaseClient.rpc('get_couple_members');
            if (error) throw error;
            membros = data; casalId = membros.find(m => m.user_id === usuarioId)?.couple_id || null;
            opcoesMembros();
            if (!casalId) {
                $('status-tarefas').replaceChildren(document.createTextNode('Você precisa criar ou entrar em um casal. '));
                const link = elemento('a', '', 'Abrir Meu casal'); link.href = 'config.html'; $('status-tarefas').append(link);
                $('resumo').textContent = 'Conecte as duas contas em Configurações para compartilhar tarefas.';
                return;
            }
        } catch (erro) {
            $('status-tarefas').textContent = 'Não foi possível carregar seu casal. Confira a conexão e clique em Atualizar.';
            return;
        } finally { carregando = false; controles(); }
        await atualizar();
        if (!canal) conectarRealtime();
    }
    window.addEventListener('perfil-atualizado', async () => {
        const { data, error } = await supabaseClient.rpc('get_couple_members');
        if (!error && data) { membros = data; opcoesMembros(); renderizar(); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && casalId) void atualizar(); });
    window.addEventListener('online', () => { void atualizar(); });
    window.addEventListener('pagehide', () => {
        encerrado = true; clearTimeout(timerRealtime);
        if (canal) void supabaseClient.removeChannel(canal);
        fotos.forEach(async promessa => { const url = await promessa; if (url) URL.revokeObjectURL(url); });
    });
    window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });
    void iniciar();
})();
