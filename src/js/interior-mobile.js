/* Controles de apresentação do interior. Dados e formulários seguem nos módulos de cada página. */
(function () {
    'use strict';
    const mobile = matchMedia('(max-width: 720px)');
    const header = document.querySelector('.cabecalho');
    const heading = header?.querySelector('h1');
    const main = document.querySelector('.conteudo');
    if (!heading || !main) return;

    const intro = CC.el('div', 'mobile-only mobile-intro');
    const title = CC.el('span', 'mobile-intro-title', main.classList.contains('menstruacao-real') ? 'Bem-estar' : heading.textContent);
    title.setAttribute('aria-hidden', 'true');
    intro.append(title);

    if (main.classList.contains('dashboard-casal')) {
        const date = CC.el('time', 'mobile-intro-date');
        date.dateTime = CC.today();
        date.textContent = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
        intro.append(date);
    }
    main.prepend(intro);

    document.querySelectorAll('.mobile-quick-toggle').forEach(function (toggle) {
        const value = document.getElementById(toggle.dataset.summary);
        const display = toggle.firstElementChild;
        function showSummary() { display.textContent = value.textContent; }
        new MutationObserver(showSummary).observe(value, { childList: true, characterData: true, subtree: true });
        showSummary();
        toggle.addEventListener('click', function () {
            const open = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(open));
            toggle.closest('.mobile-quick-widget').toggleAttribute('data-expanded', open);
        });
    });

    document.querySelectorAll('[data-money-toggle]').forEach(function (toggle) {
        const targets = toggle.getAttribute('aria-controls').split(' ').map(function (id) {
            return document.getElementById(id);
        }).filter(Boolean);
        toggle.addEventListener('click', function () {
            const masked = toggle.getAttribute('aria-pressed') !== 'true';
            toggle.setAttribute('aria-pressed', String(masked));
            toggle.setAttribute('aria-label', masked ? 'Mostrar valores' : 'Ocultar valores');
            targets.forEach(function (value) { value.toggleAttribute('data-money-masked', masked); });
        });
        mobile.addEventListener('change', function () {
            if (!mobile.matches && toggle.getAttribute('aria-pressed') === 'true') toggle.click();
        });
    });

    const progress = document.getElementById('mobile-task-progress-bar');
    if (!progress) return;
    const progressLabel = document.getElementById('mobile-task-progress-count');
    const ring = document.getElementById('mobile-progress-ring');

    function updateProgress() {
        if (progress.dataset.total === undefined) return;
        const completed = Number(progress.dataset.done);
        const total = Number(progress.dataset.total);
        ring.hidden = false;
        progress.max = total || 1;
        progress.value = completed;
        ring.style.setProperty('--completion', (total ? completed / total * 100 : 0) + '%');
        document.getElementById('mobile-progress-completed').textContent = String(completed);
        document.getElementById('mobile-progress-total').textContent = 'de ' + total;
        const pending = total - completed;
        progressLabel.textContent = !total ? 'Nenhuma tarefa com prazo hoje.' :
            !pending ? 'Todas as tarefas de hoje foram concluídas.' :
            pending === 1 ? 'Falta 1 tarefa para hoje.' : 'Faltam ' + pending + ' tarefas para hoje.';
    }

    new MutationObserver(updateProgress).observe(progress, {
        attributes: true, attributeFilter: ['data-total', 'data-done']
    });
    updateProgress();

})();
