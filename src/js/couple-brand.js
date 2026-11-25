(function () {
    'use strict';
    const markup = `<svg viewBox="-5 -3 56 53" class="cc-brand-mark" aria-hidden="true">
<defs>
  <path id="cc-left-N" d="M23 12 C16 3 4 6 4 16 C4 25 19 36 23 40"/>
  <path data-curve="" id="cc-right-N" d="M23 12 C30 3 42 6 42 16 C42 25 27 37 23 40"/>
  <filter id="cc-soft-N" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.3"/></filter>
</defs>
<g fill="none" stroke-linecap="round" stroke-width="3">
  <g data-shadow="" filter="url(#cc-soft-N)" opacity="0" stroke-width="4">
    <use href="#cc-left-N" stroke="#ef985f"/><use href="#cc-right-N" stroke="#ac88da"/>
  </g>
  <use href="#cc-left-N" stroke="#f39860"/><use href="#cc-right-N" stroke="#f39860"/>
  <use href="#cc-right-N" data-ink="" stroke="#b494dd" opacity="0"/>
</g>
<circle data-dot="" cx="31" cy="15" r="5" fill="#ae745e"/>
</svg>`;
    let serial = 0;
    window.CCBrand = function (target) {
        target.innerHTML = markup.replaceAll('-N', '-' + ++serial);
        const mark = target.firstElementChild;
        const trigger = target.closest('a, button') || target;
        const curve = mark.querySelector('[data-curve]');
        const ink = mark.querySelector('[data-ink]');
        const dot = mark.querySelector('[data-dot]');
        const shadow = mark.querySelector('[data-shadow]');
        const length = curve.getTotalLength();
        ink.setAttribute('stroke-dasharray', length + ' ' + length);
        let progress = 0, frame = 0;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        function draw(t) {
          const approach = Math.min(1, t / 0.28);
          const trace = Math.max(0, Math.min(1, (t - 0.28) / 0.57));
          const tip = curve.getPointAtLength(trace * length);
          dot.setAttribute('cx', 31 + (tip.x - 31) * approach);
          dot.setAttribute('cy', 15 + (tip.y - 15) * approach);
          dot.setAttribute('r', 5 - 3.5 * approach);
          dot.setAttribute('fill', 'rgb(' + [174+6*approach,116+32*approach,94+127*approach].join(',') + ')');
          ink.setAttribute('stroke-dashoffset', length * (1 - trace));
          ink.setAttribute('opacity', trace > 0 ? 1 : 0);
          shadow.setAttribute('opacity', Math.max(0, (t - 0.85) / 0.15) * 0.65);
        }
        function animate(target) {
          cancelAnimationFrame(frame);
          const start = progress, time = performance.now();
          function tick(now) {
            const u = reduced.matches ? 1 : Math.min(1,(now-time)/780);
            progress = start+(target-start)*u*u*(3-2*u);
            draw(progress);
            if (u<1) frame = requestAnimationFrame(tick);
          }
          frame = requestAnimationFrame(tick);
        }

        trigger.addEventListener('pointerenter', function (event) {
            if (event.pointerType === 'mouse') animate(1);
        });
        trigger.addEventListener('pointerleave', function (event) {
            if (event.pointerType === 'mouse') animate(0);
        });
        trigger.addEventListener('focusin', function () { animate(1); });
        trigger.addEventListener('focusout', function () { animate(0); });
        if (trigger.matches('button')) trigger.addEventListener('click', function (event) {
            if (event.pointerType !== 'mouse') {
                const active = trigger.getAttribute('aria-pressed') !== 'true';
                trigger.setAttribute('aria-pressed', String(active));
                animate(Number(active));
            }
        });
        draw(0);
    };
    document.querySelectorAll('.marca-tarefas-icone, .marca-icone, .orbit-heart, .panel-icon').forEach(window.CCBrand);
})();
