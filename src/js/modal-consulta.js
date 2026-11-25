/* Diálogos de consulta se deslocam do controle de origem até o centro. */
(function () {
    'use strict';
    CC.openOverview = function (dialog, trigger) {
        if (dialog.open) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const closeButton = dialog.querySelector('[data-close]');
        dialog.showModal();
        closeButton.focus({ preventScroll: true });
        const origin = trigger.getBoundingClientRect();
        const end = dialog.getBoundingClientRect();
        const dx = origin.left + origin.width / 2 - (end.left + end.width / 2);
        const dy = origin.top + origin.height / 2 - (end.top + end.height / 2);
        const x = Math.max(-100, Math.min(100, dx * .25));
        const y = Math.max(-72, Math.min(72, dy * .25));
        const from = { transform: 'translate(' + x + 'px, ' + y + 'px) scale(.95)', opacity: 0 };
        const to = { transform: 'none', opacity: 1 };
        let animation = reduced.matches ? null : dialog.animate([from, to], {
            duration: 280, easing: 'cubic-bezier(.18,.77,.28,1)'
        });
        let closing = false;
        let backdropPointer = false;

        function backdrop(event) {
            const box = dialog.getBoundingClientRect();
            return event.target === dialog && (event.clientX < box.left || event.clientX > box.right ||
                event.clientY < box.top || event.clientY > box.bottom);
        }

        function onPointer(event) { backdropPointer = backdrop(event); }
        function onClick(event) {
            if (backdropPointer && backdrop(event)) close(event);
            backdropPointer = false;
        }
        function close(event) {
            event.preventDefault();
            if (closing) return;
            closing = true;
            if (animation) animation.cancel();
            if (reduced.matches) {
                dialog.close();
                return;
            }
            dialog.dataset.closing = 'true';
            animation = dialog.animate([to, from], { duration: 190, easing: 'ease-in', fill: 'forwards' });
            animation.onfinish = function () { dialog.close(); };
        }

        closeButton.addEventListener('click', close);
        dialog.addEventListener('cancel', close);
        dialog.addEventListener('pointerdown', onPointer);
        dialog.addEventListener('click', onClick);
        dialog.addEventListener('close', function () {
            if (animation) animation.cancel();
            delete dialog.dataset.closing;
            closeButton.removeEventListener('click', close);
            dialog.removeEventListener('cancel', close);
            dialog.removeEventListener('pointerdown', onPointer);
            dialog.removeEventListener('click', onClick);
            if (trigger.isConnected) trigger.focus({ preventScroll: true });
        }, { once: true });
    };
})();
