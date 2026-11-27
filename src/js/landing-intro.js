/* A reprodução pertence à visita atual. A demo continua disponível em qualquer falha do vídeo. */
(function () {
    'use strict';
    const hero = document.querySelector('.hero-with-intro');
    if (!hero) return;

    const video = hero.querySelector('video');
    const device = document.getElementById('hero-demo-device');
    const screen = document.getElementById('demo-screen');
    const skip = hero.querySelector('.intro-skip');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let finished = false;
    let deadline;
    let fadeFrame;

    function reveal(focus = false) {
        if (!finished) {
            finished = true;
            window.clearTimeout(deadline);
            window.cancelAnimationFrame(fadeFrame);
            hero.dataset.intro = 'ready';
            video.pause();
            device.inert = false;
            skip.hidden = true;
        }
        if (focus) screen.focus();
    }

    function trackFade() {
        if (finished || video.paused) return;
        const untilEnd = video.duration - video.currentTime;
        if (untilEnd > 0 && untilEnd <= 0.6) {
            hero.dataset.intro = 'fading';
            return;
        }
        fadeFrame = window.requestAnimationFrame(trackFade);
    }

    hero.querySelectorAll('[data-open-demo]').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            reveal(true);
        });
    });
    video.addEventListener('ended', () => reveal(), { once: true });
    video.addEventListener('error', () => reveal(), { once: true });
    video.addEventListener('playing', () => {
        window.cancelAnimationFrame(fadeFrame);
        fadeFrame = window.requestAnimationFrame(trackFade);
    });
    video.addEventListener('stalled', () => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) reveal();
    });
    motion.addEventListener('change', event => { if (event.matches) reveal(); });
    window.addEventListener('pagehide', event => { if (event.persisted) reveal(); });

    if (motion.matches || window.location.hash === '#demo-screen') {
        reveal();
        return;
    }

    device.inert = true;
    skip.hidden = false;
    deadline = window.setTimeout(() => reveal(), 13000);
    video.muted = true;
    video.play().then(() => {
        if (!finished && hero.dataset.intro === 'pending') hero.dataset.intro = 'playing';
        if (finished) video.pause();
    }).catch(() => reveal());
})();
