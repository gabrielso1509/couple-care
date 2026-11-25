/* Vitrine da página pública. O conteúdo de cada tela fica no HTML. */
(function () {
    'use strict';
    const tour = document.querySelector('.app-tour');
    if (!tour) return;

    const tablist = tour.querySelector('[role="tablist"]');
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    const mobile = window.matchMedia('(max-width: 560px)');
    const more = tour.querySelector('#tour-more');
    const mainTabs = tabs.filter(tab => !tab.hasAttribute('data-tour-extra'));
    const extraTabs = tabs.filter(tab => tab.hasAttribute('data-tour-extra'));

    function visibleTabs() {
        if (!mobile.matches) return tabs;
        return tour.hasAttribute('data-tour-menu-open') ? [...mainTabs, ...extraTabs] : mainTabs;
    }

    function adjustTablist() {
        tablist.setAttribute('aria-orientation', mobile.matches ? 'horizontal' : 'vertical');
        const available = visibleTabs();
        const focusable = available.find(tab => tab.getAttribute('aria-selected') === 'true') || available[0];
        tabs.forEach(tab => { tab.tabIndex = tab === focusable ? 0 : -1; });
    }

    function showMore(open) {
        tour.toggleAttribute('data-tour-menu-open', open);
        more.setAttribute('aria-expanded', String(open));
        adjustTablist();
    }

    function select(tab) {
        tabs.forEach((item, position) => {
            const active = item === tab;
            item.setAttribute('aria-selected', String(active));
            panels[position].hidden = !active;
        });
        if (mobile.matches && mainTabs.includes(tab)) showMore(false);
        else adjustTablist();
    }

    tabs.forEach(tab => tab.addEventListener('click', () => select(tab)));
    more.addEventListener('click', function () {
        const open = !tour.hasAttribute('data-tour-menu-open');
        showMore(open);
        if (open) {
            const selected = extraTabs.find(tab => tab.getAttribute('aria-selected') === 'true');
            (selected || extraTabs[0]).focus();
        }
    });

    tour.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && mobile.matches && tour.hasAttribute('data-tour-menu-open')) {
            event.preventDefault();
            showMore(false);
            more.focus();
        }
    });

    tablist.addEventListener('keydown', function (event) {
        const available = visibleTabs();
        const index = available.indexOf(event.target);
        if (index === -1) return;
        const nextKey = mobile.matches ? 'ArrowRight' : 'ArrowDown';
        const previousKey = mobile.matches ? 'ArrowLeft' : 'ArrowUp';
        let next;
        switch (event.key) {
            case nextKey: next = (index + 1) % available.length; break;
            case previousKey: next = (index + available.length - 1) % available.length; break;
            case 'Home': next = 0; break;
            case 'End': next = available.length - 1; break;
            default: return;
        }
        event.preventDefault();
        select(available[next]);
        available[next].focus({ preventScroll: true });
    });

    mobile.addEventListener('change', function () {
        showMore(mobile.matches && extraTabs.some(tab => tab.getAttribute('aria-selected') === 'true'));
    });
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
