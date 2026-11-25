/* Vitrine da página pública. O conteúdo de cada tela fica no HTML. */
(function () {
    'use strict';
    const tour = document.querySelector('.app-tour');
    if (!tour) return;

    const tablist = tour.querySelector('[role="tablist"]');
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    const wide = window.matchMedia('(min-width: 561px)');

    function adjustTablist() {
        tablist.setAttribute('aria-orientation', wide.matches ? 'vertical' : 'horizontal');
        if (!wide.matches) {
            const selected = tablist.querySelector('[aria-selected="true"]');
            tablist.scrollLeft = selected.offsetLeft - (tablist.clientWidth - selected.offsetWidth) / 2;
        }
    }

    function select(index, focus) {
        tabs.forEach((tab, position) => {
            const active = position === index;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            panels[position].hidden = !active;
        });
        if (focus) tabs[index].focus({ preventScroll: true });
        adjustTablist();
    }

    tabs.forEach((tab, index) => tab.addEventListener('click', () => select(index, false)));
    tablist.addEventListener('keydown', function (event) {
        const index = tabs.indexOf(event.target);
        if (index === -1) return;
        const nextKey = wide.matches ? 'ArrowDown' : 'ArrowRight';
        const previousKey = wide.matches ? 'ArrowUp' : 'ArrowLeft';
        let next;
        switch (event.key) {
            case nextKey: next = (index + 1) % tabs.length; break;
            case previousKey: next = (index + tabs.length - 1) % tabs.length; break;
            case 'Home': next = 0; break;
            case 'End': next = tabs.length - 1; break;
            default: return;
        }
        event.preventDefault();
        select(next, true);
    });
    wide.addEventListener('change', adjustTablist);
    adjustTablist();

    const periods = Array.from(tour.querySelectorAll('[data-tour-period]'));
    const note = tour.querySelector('#tour-period-note');
    const descriptions = {
        Semana: 'Veja o resumo dos últimos 7 dias.',
        Mês: 'Veja o resumo do mês atual.',
        Ano: 'Veja o acumulado do ano atual.'
    };
    periods.forEach(button => button.addEventListener('click', function () {
        periods.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        note.textContent = descriptions[button.dataset.tourPeriod];
    }));
})();
