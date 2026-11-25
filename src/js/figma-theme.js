/* ==================================================
   COUPLECARE — VISUAL ADAPTADO DA DEMO DO FIGMA

   Mantém os IDs e os formulários existentes.
   O Supabase continua responsável por autenticação e permissões.
   Este arquivo não cria tabelas e não modifica políticas.
================================================== */
(function () {
    'use strict';

    document.documentElement.classList.add('cc-figma');

    /* 1. Ícones locais: nenhuma biblioteca extra precisa ser instalada. */
    const desenhos = {
        home: '<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>',
        tasks: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 2.2 2.2L16 8.5"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
        wallet: '<path d="M4 6.5h14a2 2 0 0 1 2 2v10H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h12M16 12h6v4h-6a2 2 0 0 1 0-4Z"/>',
        sparkles: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 1 3h4l1-3 3-1 2-3-2-2 1-3-3-2-1-3Z"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4V7Z"/><circle cx="12" cy="13" r="4"/>'
    };

    function icone(nome) {
        return '<svg class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + desenhos[nome] + '</svg>';
    }

    function elemento(tag, classe, texto) {
        const item = document.createElement(tag);
        if (classe) item.className = classe;
        if (texto !== undefined) item.textContent = texto;
        return item;
    }

    function botao(classe, rotulo, desenho) {
        const item = elemento('button', classe);
        item.type = 'button';
        item.setAttribute('aria-label', rotulo);
        item.innerHTML = icone(desenho);
        return item;
    }

    const paginas = [
        { arquivo: 'dashboard.html', titulo: 'Dashboard', icone: 'home' },
        { arquivo: 'tarefas.html', titulo: 'Tarefas', icone: 'tasks' },
        { arquivo: 'calendario.html', titulo: 'Calendário', icone: 'calendar' },
        { arquivo: 'menstruacao.html', titulo: 'Menstruação', icone: 'heart' },
        { arquivo: 'financas.html', titulo: 'Finanças', icone: 'wallet' },
        { arquivo: 'espaco.html', titulo: 'Nosso espaço', icone: 'sparkles' },
        { arquivo: 'config.html', titulo: 'Configurações', icone: 'settings' }
    ];

    /* 3. Navegação: os links continuam sendo páginas reais, com sessão validada. */
    function prepararAplicacao() {
        const app = document.querySelector('.aplicacao');
        const lateral = document.querySelector('.menu-lateral');
        const nav = document.querySelector('#navegacao-tarefas');
        const cabecalho = document.querySelector('.conteudo-principal > .cabecalho');
        if (!app || !lateral || !nav || !cabecalho) return;
        const principal = document.querySelector('.conteudo-principal');
        app.classList.remove('menu-recolhido');
        const atual = nav.querySelector('[aria-current="page"]');
        let arquivoAtual = atual ? new URL(atual.href).pathname.split('/').pop() : '';
        if (document.getElementById('cc-nosso-espaco')) arquivoAtual = 'espaco.html';
        if (!arquivoAtual) arquivoAtual = location.pathname.split('/').pop() || 'dashboard.html';
        const pagina = paginas.find(function (item) { return item.arquivo === arquivoAtual; });
        if (pagina) {
            cabecalho.querySelector('h1').textContent = pagina.titulo;
            document.title = pagina.titulo + ' | CoupleCare';
        }
        const marca = lateral.querySelector('.marca-tarefas');
        if (marca) marca.href = '/src/dashboard.html';

        nav.replaceChildren();
        paginas.forEach(function (item, indice) {
            if (indice === 0 || indice === 5) {
                const grupo = elemento('span', 'cc-nav-label', indice === 0 ? 'ORGANIZAR' : 'CONECTAR');
                grupo.setAttribute('aria-hidden', 'true');
                nav.append(grupo);
            }
            const link = elemento('a', 'item-menu');
            link.href = '/src/' + item.arquivo;
            link.title = item.titulo;
            link.setAttribute('aria-label', item.titulo);
            link.innerHTML = icone(item.icone);
            link.append(elemento('span', '', item.titulo));
            if (item.arquivo === arquivoAtual) {
                link.classList.add('ativo');
                link.setAttribute('aria-current', 'page');
            }
            nav.append(link);
        });

        const nota = elemento('p', 'cc-menu-note', 'Pequenos cuidados. Mais vida juntos.');
        const conta = lateral.querySelector('.conta-menu');
        if (conta) conta.before(nota);

        const fundo = botao('cc-backdrop', 'Fechar menu', 'close');
        fundo.hidden = true;
        fundo.tabIndex = -1;
        fundo.setAttribute('aria-hidden', 'true');
        app.prepend(fundo);
        lateral.id = 'cc-menu-lateral';
        const menuMovel = botao('cc-mobile-open', 'Abrir menu', 'menu');
        menuMovel.setAttribute('aria-controls', lateral.id);
        menuMovel.setAttribute('aria-expanded', 'false');
        const grupoTitulo = elemento('div', 'cc-heading-group');
        cabecalho.firstElementChild.before(grupoTitulo);
        grupoTitulo.append(menuMovel, grupoTitulo.nextElementSibling);

        const mobileBrand = elemento('div', 'cc-mobile-brand');
        const mobileMark = elemento('button', 'cc-mobile-brand-icon');
        mobileMark.type = 'button';
        mobileMark.setAttribute('aria-label', 'Animar coração do CoupleCare');
        mobileMark.setAttribute('aria-pressed', 'false');
        const markSlot = elemento('span', 'marca-tarefas-icone');
        mobileMark.append(markSlot);
        mobileBrand.append(mobileMark, elemento('strong', '', 'CoupleCare'),
            elemento('span', '', '/ ' + (pagina ? pagina.titulo : cabecalho.querySelector('h1').textContent)));
        grupoTitulo.firstElementChild.after(mobileBrand);
        if (window.CCBrand) window.CCBrand(markSlot);

        const inferior = elemento('nav', 'cc-bottom-nav');
        inferior.setAttribute('aria-label', 'Navegação rápida');
        paginas.slice(0, 4).forEach(function (item, indice) {
            const link = elemento('a', item.arquivo === arquivoAtual ? 'ativo' : '');
            link.href = '/src/' + item.arquivo;
            if (item.arquivo === arquivoAtual) link.setAttribute('aria-current', 'page');
            link.innerHTML = icone(item.icone);
            link.append(elemento('span', '', indice === 0 ? 'Início' : indice === 3 ? 'Bem-estar' : item.titulo));
            inferior.append(link);
        });
        const mais = botao('', 'Mais páginas', 'menu');
        mais.append(elemento('span', '', 'Mais'));
        mais.setAttribute('aria-controls', lateral.id);
        mais.setAttribute('aria-expanded', 'false');
        if (paginas.slice(4).some(function (item) { return item.arquivo === arquivoAtual; })) mais.classList.add('ativo');
        inferior.append(mais);
        app.append(inferior);

        /* A gaveta mobile limita o foco; Esc fecha e devolve o foco ao botão. */
        const pequeno = window.matchMedia('(max-width: 900px)');
        let retorno = menuMovel;
        let aberto = false;
        const recolher = lateral.querySelector('#botao-menu');

        function mostrarMenu(valor, origem) {
            aberto = valor && pequeno.matches;
            if (origem) retorno = origem;
            app.classList.toggle('cc-menu-open', aberto);
            fundo.hidden = !aberto;
            principal.inert = aberto;
            inferior.inert = aberto;
            lateral.inert = pequeno.matches && !aberto;
            menuMovel.setAttribute('aria-expanded', String(aberto));
            mais.setAttribute('aria-expanded', String(aberto));
            document.body.style.overflow = aberto ? 'hidden' : '';
            if (aberto) {
                lateral.setAttribute('role', 'dialog');
                lateral.setAttribute('aria-modal', 'true');
                lateral.setAttribute('aria-label', 'Menu do CoupleCare');
                if (recolher) recolher.focus();
            } else {
                lateral.removeAttribute('role');
                lateral.removeAttribute('aria-modal');
                lateral.removeAttribute('aria-label');
            }
        }
        function fecharMenu() {
            mostrarMenu(false);
            retorno.focus();
        }
        menuMovel.addEventListener('click', function () { mostrarMenu(true, menuMovel); });
        mais.addEventListener('click', function () { mostrarMenu(true, mais); });
        fundo.addEventListener('click', fecharMenu);
        if (recolher) {
            // Captura o clique antes do comportamento antigo de recolher o menu.
            recolher.addEventListener('click', function (evento) {
                evento.stopImmediatePropagation();
                if (pequeno.matches) fecharMenu();
                else {
                    app.classList.toggle('cc-compact');
                    atualizarBotao();
                }
            }, true);
        }
        function atualizarBotao() {
            if (!recolher) return;
            const compacto = app.classList.contains('cc-compact');
            recolher.innerHTML = icone(pequeno.matches ? 'close' : 'menu');
            recolher.setAttribute('aria-label', pequeno.matches ? 'Fechar menu' : compacto ? 'Expandir menu' : 'Recolher menu');
            recolher.setAttribute('aria-expanded', String(pequeno.matches ? aberto : !compacto));
        }
        pequeno.addEventListener('change', function () {
            app.classList.remove('cc-compact');
            const focoNaLateral = lateral.contains(document.activeElement);
            mostrarMenu(false);
            atualizarBotao();
            if (pequeno.matches && focoNaLateral) menuMovel.focus();
        });
        lateral.addEventListener('keydown', function (evento) {
            if (!aberto) return;
            if (evento.key === 'Escape') { evento.preventDefault(); fecharMenu(); return; }
            if (evento.key !== 'Tab') return;
            const itens = Array.from(lateral.querySelectorAll('a[href], button:not(:disabled)')).filter(function (item) { return item.getClientRects().length; });
            const primeiro = itens[0];
            const ultimo = itens[itens.length - 1];
            if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
            else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
        });
        mostrarMenu(false);
        atualizarBotao();
        prepararBusca(cabecalho);

    }

    /* 4. Busca de páginas, sem fingir uma busca global nos dados da conta. */
    function prepararBusca(cabecalho) {
        const acoes = elemento('div', 'cc-header-actions');
        const abrir = botao('cc-search-open', 'Buscar página', 'search');
        abrir.append(elemento('span', '', 'Buscar página'));
        const data = elemento('time', 'cc-date', new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }));
        acoes.append(abrir, data);
        cabecalho.append(acoes);
        const dialogo = elemento('dialog', 'cc-search');
        dialogo.setAttribute('aria-labelledby', 'cc-busca-titulo');
        const topo = elemento('header');
        const titulo = elemento('h2', '', 'Ir para…');
        titulo.id = 'cc-busca-titulo';
        const fechar = botao('icon-button', 'Fechar busca', 'close');
        topo.append(titulo, fechar);
        const rotulo = elemento('label', 'cc-sr', 'Nome da página');
        rotulo.htmlFor = 'cc-busca-pagina';
        const campo = elemento('input');
        campo.id = 'cc-busca-pagina';
        campo.type = 'search';
        campo.placeholder = 'Qual página você procura?';
        const links = elemento('nav');
        links.setAttribute('aria-label', 'Resultados da busca de páginas');
        paginas.forEach(function (item) {
            const link = elemento('a');
            link.href = '/src/' + item.arquivo;
            link.innerHTML = icone(item.icone);
            link.append(elemento('span', '', item.titulo));
            links.append(link);
        });
        const vazio = elemento('p', '', 'Nenhuma página encontrada.');
        vazio.hidden = true;
        dialogo.append(topo, rotulo, campo, links, vazio);
        document.body.append(dialogo);
        abrir.addEventListener('click', function () { dialogo.showModal(); campo.focus(); });
        fechar.addEventListener('click', function () { dialogo.close(); });
        dialogo.addEventListener('close', function () { abrir.focus(); });
        dialogo.addEventListener('keydown', function (evento) {
            if (evento.key === 'Escape') { evento.preventDefault(); dialogo.close(); }
        });
        campo.addEventListener('input', function () {
            const termo = campo.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            let quantidade = 0;
            links.querySelectorAll('a').forEach(function (link) {
                const texto = link.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                link.hidden = !texto.includes(termo);
                if (!link.hidden) quantidade += 1;
            });
            vazio.hidden = quantidade > 0;
        });
    }


    prepararAplicacao();
})();

