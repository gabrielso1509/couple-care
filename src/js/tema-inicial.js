/* Aplica a preferência antes de desenhar a página, evitando flashes de tema. */
(function () {
    'use strict';
    let tema = 'light';
    try {
        // Apenas uma preferência visual: nenhum dado pessoal fica no navegador.
        tema = localStorage.getItem('cc-tema') === 'dark' ? 'dark' : 'light';
    } catch (_) { /* Navegadores que bloqueiam armazenamento mantêm o padrão. */ }
    document.documentElement.dataset.ccTheme = tema;
})();
