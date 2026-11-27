/* Seletor de tema acessível, compartilhado pela área pública e pelo aplicativo. */
(function () {
    'use strict';
    const raiz = document.documentElement;
    const corNavegador = document.querySelector('meta[name="theme-color"][data-dark]');
    const corClara = corNavegador?.content;
    const destino = document.querySelector('.cc-header-actions') || document.querySelector('.site-header') || document.querySelector('.cabecalho');
    if (!destino) return;
    const botao = document.getElementById('cc-theme-toggle') || document.createElement('button');
    if (!botao.id) {
        botao.type = 'button';
        botao.id = 'cc-theme-toggle';
        botao.className = 'cc-theme-toggle';
        for (const [className, symbol] of [['theme-sun', '☀'], ['theme-moon', '☾']]) {
            const icon = document.createElement('span');
            icon.className = className;
            icon.textContent = symbol;
            icon.setAttribute('aria-hidden', 'true');
            botao.append(icon);
        }
        const data = destino.querySelector('.cc-date');
        if (data) data.after(botao);
        else destino.append(botao);
    }
    function atualizar() {
        const escuro = raiz.dataset.ccTheme === 'dark';
        botao.setAttribute('aria-pressed', String(escuro));
        const label = escuro ? 'Ativar tema claro' : 'Ativar tema escuro';
        botao.setAttribute('aria-label', label);
        botao.title = label;
        if (corNavegador) corNavegador.content = escuro ? corNavegador.dataset.dark : corClara;
    }
    botao.addEventListener('click', function () {
        raiz.dataset.ccTheme = raiz.dataset.ccTheme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('cc-tema', raiz.dataset.ccTheme); } catch (_) {}
        atualizar();
    });
    atualizar();
})();
