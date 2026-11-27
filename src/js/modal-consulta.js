/* Consultas devolvem o foco ao controle que abriu o painel. */
(function () {
    'use strict';
    CC.openOverview = function (dialog, trigger) {
        if (dialog.open) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const closeButton = dialog.querySelector('[data-close]');
        dialog.showModal();
        closeButton.focus({ preventScroll: true });
        let animation;
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
            if (reduced.matches) {
                dialog.close();
                return;
            }
            dialog.dataset.closing = 'true';
            const style = getComputedStyle(dialog);
            animation = dialog.animate([
                { transform: style.transform, opacity: style.opacity },
                { transform: 'translateX(35px)', opacity: 0 }
            ], { duration: 190, easing: 'ease-in', fill: 'forwards' });
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
