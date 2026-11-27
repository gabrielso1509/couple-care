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
        lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4V7Z"/><circle cx="12" cy="13" r="4"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        chart: '<path d="M3 20h18M6 16v-4m4 4V8m4 8V5m4 11v-6"/>',
        crown: '<path d="M3 6l5 4 4-6 4 6 5-4-2 12H5zm3 15h12"/>',
        book: '<path d="M12 7c-3-3-7-3-10-1v13c3-2 7-2 10 1 3-3 7-3 10-1V6c-3-2-7-2-10 1Zm0 0v13"/>',
        dots: '<path d="M5 12h.01m7 0h.01m7 0h.01"/>',
        users: '<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-14a3 3 0 0 1 0 6m5 8v-2a4 4 0 0 0-4-4"/>'
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
        { arquivo: 'dashboard.html', titulo: 'Início', icone: 'home' },
        { arquivo: 'tarefas.html', titulo: 'Tarefas e Compromissos', icone: 'tasks' },
        { arquivo: 'calendario.html', titulo: 'Calendário', icone: 'calendar' },
        { arquivo: 'menstruacao.html', titulo: 'Saúde e Ciclo', icone: 'heart' },
        { arquivo: 'financas.html', titulo: 'Finanças', icone: 'wallet' },
        { arquivo: 'relatorios.html', titulo: 'Relatórios', icone: 'chart' },
        { arquivo: 'config.html', titulo: 'Configurações', icone: 'settings' }
    ];

    const menu = {
        ...Object.fromEntries(paginas.map(({arquivo,titulo,icone})=>[arquivo.split('.')[0],['/src/'+arquivo,titulo,icone]])),
        planos:['/#planos','Planos','crown'],
        site:['/','Página inicial','home']
    };
    const completo = ['dashboard','financas','tarefas','calendario','menstruacao','relatorios','config'];

    function linkMenu(chave, arquivoAtual, classe = '') {
        const [href, titulo, desenho] = menu[chave];
        const link = elemento('a', classe);
        link.href = href;
        link.title = titulo;
        link.setAttribute('aria-label', titulo);
        link.innerHTML = icone(desenho);
        link.append(elemento('span','',titulo));
        if (href === '/src/'+arquivoAtual) {
            link.classList.add('ativo');
            link.setAttribute('aria-current','page');
        }
        return link;
    }

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
        if (!arquivoAtual) arquivoAtual = location.pathname.split('/').pop() || 'dashboard.html';
        const chaveAtual = document.body.dataset.ccPage || arquivoAtual.split('.')[0];
        const pagina = paginas.find(function (item) { return item.arquivo === arquivoAtual; });
        if (pagina) {
            const titulo = chaveAtual === 'calendario' ? 'Calendário do Casal' : pagina.titulo;
            cabecalho.querySelector('h1').textContent = titulo;
            document.title = titulo + ' | CoupleCare';
        }
        const marca = lateral.querySelector('.marca-tarefas');
        if (marca) marca.href = '/src/dashboard.html';

        const atalhos = completo;
        nav.replaceChildren(...atalhos.map(chave=>linkMenu(chave,arquivoAtual,'item-menu')));
        const restantes = [...completo,'planos','site'].filter(chave=>
            !atalhos.some(existente=>menu[existente][0]===menu[chave][0]));
        const outros = elemento('details','cc-nav-outros');
        const resumo = elemento('summary','item-menu');
        resumo.innerHTML = icone('dots');
        resumo.append(elemento('span','','Mais'));
        resumo.setAttribute('aria-label','Mais páginas');
        outros.append(resumo,...restantes.map(chave=>linkMenu(chave,arquivoAtual,'item-menu')));
        nav.append(outros);

        const conta = lateral.querySelector('.conta-menu');
        if (conta && chaveAtual==='financas') {
            const planos=linkMenu('planos',arquivoAtual,'cc-menu-plans');
            planos.append(elemento('small','','Recursos e preços'));
            conta.before(planos);
        }

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
        const mobileMark = elemento('a', 'cc-mobile-brand-icon');
        mobileMark.href = '/src/dashboard.html';
        mobileMark.setAttribute('aria-label', 'Início do CoupleCare');
        const markSlot = elemento('span', 'marca-tarefas-icone');
        mobileMark.append(markSlot);
        const mobileName = elemento('strong', 'cc-mobile-wordmark', 'Couple');
        mobileName.append(elemento('span', '', 'Care'));
        mobileBrand.append(mobileMark, mobileName,
            elemento('span', '', '/ ' + (pagina ? pagina.titulo : cabecalho.querySelector('h1').textContent)));
        grupoTitulo.firstElementChild.after(mobileBrand);
        if (['calendario','financas','menstruacao','tarefas','relatorios'].includes(chaveAtual)) {
            const tituloMovel = elemento('span','cc-mobile-page-label',
                chaveAtual==='calendario'?'Calendário':menu[chaveAtual][1]);
            tituloMovel.setAttribute('aria-hidden','true');
            mobileBrand.after(tituloMovel);
        }
        if (window.CCBrand) window.CCBrand(markSlot);

        const inferior = elemento('nav', 'cc-bottom-nav');
        inferior.setAttribute('aria-label', 'Navegação rápida');
        const mais = botao('', 'Mais páginas', 'dots');
        mais.append(elemento('span', '', 'Mais'));
        mais.setAttribute('aria-controls', lateral.id);
        mais.setAttribute('aria-expanded', 'false');
        const novo = elemento('button','mock-mobile-plus','+');
        novo.type='button';
        const novoItem={financas:['new-entry','Adicionar despesa'],tarefas:['novo-item','Novo item']}[chaveAtual];
        novo.setAttribute('aria-label',novoItem?.[1] || (chaveAtual==='calendario' ? 'Adicionar evento' : chaveAtual==='menstruacao' ? 'Registrar hoje' : 'Adicionar tarefa'));
        novo.addEventListener('click',()=>{
            if(novoItem) document.getElementById(novoItem[0])?.click();
            else if(chaveAtual==='calendario') document.querySelector('.calendar-day-action')?.click();
            else if(chaveAtual==='menstruacao') document.getElementById('cc-checkin')?.scrollIntoView({block:'start'});
            else location.assign('/src/tarefas.html?nova=tarefa');
        });
        const atalhosMobile=['dashboard','financas','+','calendario','mais'];
        inferior.append(...atalhosMobile.map(chave=>chave==='+'?novo:chave==='mais'?mais:linkMenu(chave,arquivoAtual)));
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
        nav.addEventListener('click', evento=>{
            if (aberto && evento.target.closest('a[href]')) mostrarMenu(false);
        });
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
            const itens = Array.from(lateral.querySelectorAll('a[href], summary, button:not(:disabled)')).filter(function (item) { return item.getClientRects().length; });
            const primeiro = itens[0];
            const ultimo = itens[itens.length - 1];
            if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
            else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
        });
        mostrarMenu(false);
        atualizarBotao();
        const acoes = elemento('div', 'cc-header-actions');
        const hoje = new Date();
        const data = elemento('time', 'cc-date', hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }));
        acoes.append(data);
        cabecalho.append(acoes);

    }

    prepararAplicacao();

    // A tela restaurada pelo histórico precisa validar a sessão novamente.
    const app = document.querySelector('.aplicacao[data-shell-state]');
    if (!app) return;
    window.addEventListener('pagehide', function (event) {
        if (event.persisted && !app.hidden) {
            document.documentElement.classList.add('cc-history-restore');
            app.dataset.shellState = 'loading';
        }
    });
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) window.location.reload();
    });
})();


