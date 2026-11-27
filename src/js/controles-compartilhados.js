(function () {
    'use strict';
    const C = CC;
    const paths = {
        calendar: 'M4 6h16v14H4zM4 10h16M8 3v5m8-5v5',
        income: 'M3 5h18v9H3zM12 8.5v2M12 15v7m-3-3 3 3 3-3',
        receipt: 'M5 3l2 2 2-2 3 2 3-2 2 2 2-2v18l-2-2-2 2-3-2-3 2-2-2-2 2zM8 9h8m-8 4h8',
        charge: 'm14 2-9 12h6l-1 8 9-12h-6z',
        shopping: 'M2 4h3l2 11h12l2-8H6m3 13h.01m8 0h.01',
        food: 'M4 3v6a3 3 0 0 0 6 0V3M7 3v18m11 0V3c-3 2-4 5-4 9h4',
        transport: 'M4 16V6l2-2h12l2 2v10H4zm0-6h16M6 17v3m12-3v3',
        card: 'M3 5h18v14H3zM3 10h18m-14 5h4',
        transfer: 'M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4',
        home: 'm3 11 9-8 9 8m-2-1v10h-5v-6h-4v6H5V10',
        health: 'M3 12h5l2-4 3 8 2-4h6M9 20l3 2 7.5-7.4A5.4 5.4 0 0 0 12 7a5.4 5.4 0 0 0-8 7.6z',
        heart: 'M20.8 5.5a5 5 0 0 0-7.1 0L12 7.2l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.4a5 5 0 0 0 0-7.1Z',
        birthday: 'M4 13h16v7H4zm-1 7h18m-15-7V9m6 4V9m6 4V9M6 5v1m6-1v1m6-1v1',
        bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
        task: 'M8 4H5v16h14V9M9 4h7v3H9zM8 13l3 3 8-9',
        cycle: 'M12 2c4 6 7 10 7 13a7 7 0 0 1-14 0c0-3 3-7 7-13z',
        investment: 'M3 19h18M5 15l5-5 4 3 5-7m-6 0h6v6'
    };
    C.uiIcon = function (name) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        const path = document.createElementNS(ns, 'path');
        Object.entries({ viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor',
            'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
            .forEach(([key, value]) => svg.setAttribute(key, value));
        path.setAttribute('d', paths[name] || paths.receipt);
        svg.append(path);
        return svg;
    };

    const months = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
    function name(month) {
        const label = months.format(new Date(Date.UTC(2000, month - 1, 1)));
        return label.charAt(0).toUpperCase() + label.slice(1);
    }
    C.monthPicker = function ({ id, button, caption, current, select }) {
        const dialog = C.dialog(id, 'Escolher mês', `
          <form class="form-app">
            <label class="cc-field">Mês<select name="month"></select></label>
            <label class="cc-field">Ano<input name="year" type="number" min="1900" max="2100" required></label>
            <button class="primary-button" type="submit">Aplicar</button>
          </form>`);
        const form = dialog.querySelector('form');
        const monthInput = form.elements.month;
        const yearInput = form.elements.year;
        for (let i = 1; i <= 12; i++) monthInput.add(new Option(name(i), i));
        button.classList.add('cc-month-button');
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', id);
        button.prepend(C.uiIcon('calendar'));
        const parts = () => current().split('-').map(Number);
        button.addEventListener('click', () => {
            const [year, month] = parts();
            monthInput.value = String(month);
            yearInput.value = year;
            dialog.showModal();
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            select(yearInput.value + '-' + monthInput.value.padStart(2, '0'));
            dialog.close();
        });
        const update = () => {
            const [year, month] = parts();
            caption.textContent = name(month) + ' de ' + year;
        };
        update();
        return update;
    };
})();
