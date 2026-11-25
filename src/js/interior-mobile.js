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

    const taskButton = document.querySelector('[data-task-editor]');
    if (!taskButton) return;
    const done = document.getElementById('total-concluidas');
    const pending = document.getElementById('total-pendentes');
    const progress = document.getElementById('mobile-task-progress-bar');
    const progressLabel = document.getElementById('mobile-task-progress-count');

    function updateProgress() {
        const completed = Number(done.textContent);
        const total = completed + Number(pending.textContent);
        if (!Number.isFinite(total)) return;
        progress.hidden = total === 0;
        progress.max = total || 1;
        progress.value = completed;
        progressLabel.textContent = total ? completed + ' de ' + total + ' concluídas' : 'Nenhuma tarefa cadastrada.';
    }

    const stats = new MutationObserver(updateProgress);
    stats.observe(done, { childList: true, subtree: true, characterData: true });
    stats.observe(pending, { childList: true, subtree: true, characterData: true });
    updateProgress();

    const editor = document.getElementById(taskButton.getAttribute('aria-controls'));
    function setEditor(open) {
        editor.toggleAttribute('data-task-open', open);
        taskButton.setAttribute('aria-expanded', String(open));
        taskButton.textContent = open ? 'Recolher formulário' : '+ Nova tarefa';
    }
    taskButton.addEventListener('click', function () {
        const open = taskButton.getAttribute('aria-expanded') !== 'true';
        setEditor(open);
        if (open) editor.querySelector('input')?.focus();
    });
    editor.addEventListener('abrir-editor-tarefa', function () { setEditor(true); });
})();
