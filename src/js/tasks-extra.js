/* As categorias visuais continuam usando o mesmo select e o mesmo banco. */
(function () {
    const select = document.getElementById('categoria');
    function refresh() {
        document.querySelectorAll('[data-category]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.category === select.value)); });
    }
    document.querySelectorAll('[data-category]').forEach(function (b) {
        b.addEventListener('click', function () { select.value = b.dataset.category; select.dispatchEvent(new Event('input', { bubbles: true })); refresh(); });
    });
    document.getElementById('form-tarefa').addEventListener('reset', function () { queueMicrotask(refresh); });
    new MutationObserver(refresh).observe(document.getElementById('titulo-editor'), { childList: true, subtree: true });
    refresh();
})();
