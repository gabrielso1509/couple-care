/* Abre o formulário existente em um dialog nativo, sem mudar suas gravações. */
(function () {
    'use strict';
    const d = document.getElementById('dialogo-evento'); if (!d) return;
    function busy() { return document.getElementById('form-evento').getAttribute('aria-busy') === 'true'; }
    document.querySelectorAll('[data-open="dialogo-evento"]').forEach(function (b) {
        b.addEventListener('click', function () { if (!d.open) d.showModal(); });
    });
    d.querySelector('[data-close]').addEventListener('click', function () { if (!busy()) d.close(); });
    d.addEventListener('cancel', function (e) { if (busy()) e.preventDefault(); });
    document.getElementById('lista').addEventListener('click', function (e) {
        if (e.target.closest('[data-acao="editar"]') && !d.open) d.showModal();
    });
})();
