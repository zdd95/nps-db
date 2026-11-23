/* ============================================================
   Пасхалка NPS Survey Data
   Три клика по бейджу «NPS · Analytics» — из-под бейджа
   выбегает персонаж и пробегает по линии .page-rule вправо,
   к переключателю темы. Персонаж зависит от темы:
   light — машина с водителем, dark — призрак, matrix — летающая тарелка.
   ============================================================ */

(function () {
    'use strict';

    var ENABLED = true;

    var CLICKS_REQUIRED = 3;
    var CLICK_WINDOW_MS = 1500;
    var MAX_RUNNERS = 12;
    var RUNNER_SIZE = 36;
    var RUN_SPEED = 0.35;          // px за мс
    var MIN_DURATION_MS = 900;
    var MAX_DURATION_MS = 2200;
    var STILL_MS = 600;            // показ без анимации при reduce-motion

    // Цвета машин в светлой теме: первая — красная, дальше по кругу.
    var CAR_COLORS = [
        '#dc2626', '#2563eb', '#16a34a', '#d97706',
        '#7c3aed', '#0d9488', '#db2777', '#475569'
    ];

    var SPRITES = {
        light:
            '<svg viewBox="0 0 32 32" width="32" height="32" focusable="false" aria-hidden="true">' +
                '<path d="M9.6 15.2l2.5-5.3a2.2 2.2 0 0 1 2-1.3h6a2.2 2.2 0 0 1 2 1.2l2.9 5.4z" fill="currentColor"/>' +
                '<path d="M12.6 14.2l1.7-3.6h3.1v3.6z" fill="#eef4fb"/>' +
                '<path d="M18.6 14.2v-3.6h1.7l2.3 3.6z" fill="#eef4fb"/>' +
                '<circle cx="14.7" cy="11.4" r="1.25" fill="#334155"/>' +
                '<path d="M12.9 14.2c0-1.2.8-2.1 1.8-2.1s1.8.9 1.8 2.1z" fill="#334155"/>' +
                '<rect x="3.2" y="14.6" width="25.6" height="9.4" rx="3" fill="currentColor"/>' +
                '<circle cx="9.6" cy="24" r="4.3" fill="#1f2937"/>' +
                '<circle cx="9.6" cy="24" r="1.5" fill="#cbd5e1"/>' +
                '<circle cx="23.4" cy="24" r="4.3" fill="#1f2937"/>' +
                '<circle cx="23.4" cy="24" r="1.5" fill="#cbd5e1"/>' +
                '<circle cx="28.2" cy="18" r="1.3" fill="#fde68a"/>' +
            '</svg>',
        dark:
            '<svg viewBox="0 0 32 32" width="32" height="32" focusable="false" aria-hidden="true">' +
                '<path fill="currentColor" d="M16 3.5c-5.1 0-9.2 3.9-9.2 8.7v13.5c0 .9 1 1.4 1.7.8l1.5-1.3 1.7 1.6c.4.4 1 .4 1.4 0l1.6-1.6 1.6 1.6c.4.4 1 .4 1.4 0l1.7-1.6 1.5 1.3c.7.6 1.7.1 1.7-.8V12.2c0-4.8-4.1-8.7-9.2-8.7z"/>' +
                '<path d="M8.2 14.4L3.8 18.8 2.2 10.6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<path d="M23.8 14.4l4.4 4.4 1.6-8.2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
                '<circle cx="2.2" cy="10.4" r="1.9" fill="currentColor"/>' +
                '<circle cx="29.8" cy="10.4" r="1.9" fill="currentColor"/>' +
                '<circle cx="12.6" cy="12.2" r="1.25" fill="#0b1120"/>' +
                '<circle cx="19.4" cy="12.2" r="1.25" fill="#0b1120"/>' +
                '<path d="M14.2 16.6c.6.7 1.2 1 1.8 1s1.2-.3 1.8-1" fill="none" stroke="#0b1120" stroke-width="1.2" stroke-linecap="round"/>' +
            '</svg>',
        matrix:
            '<svg viewBox="0 0 32 32" width="32" height="32" focusable="false" aria-hidden="true">' +
                '<path d="M9.5 10.4a6.5 6.5 0 0 1 13 0z" fill="currentColor"/>' +
                '<ellipse cx="16" cy="8.8" rx="3.1" ry="2.3" fill="#020617" opacity="0.45"/>' +
                '<ellipse cx="16" cy="15" rx="13" ry="4.6" fill="currentColor"/>' +
                '<circle cx="7.5" cy="16.1" r="1.3" fill="#020617" opacity="0.5"/>' +
                '<circle cx="12.5" cy="17.4" r="1.3" fill="#020617" opacity="0.5"/>' +
                '<circle cx="19.5" cy="17.4" r="1.3" fill="#020617" opacity="0.5"/>' +
                '<circle cx="24.5" cy="16.1" r="1.3" fill="#020617" opacity="0.5"/>' +
                '<path d="M11.5 19.4l2.2 7.4h4.6l2.2-7.4z" fill="currentColor" opacity="0.16"/>' +
            '</svg>'
    };

    var header = null;
    var layer = null;
    var badge = null;
    var toggle = null;
    var rule = null;

    var active = [];
    var clickCount = 0;
    var firstClickAt = 0;
    var resetTimer = 0;
    var carColorIndex = 0;

    var reduceMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : { matches: false };

    function currentTheme() {
        var root = document.documentElement;

        if (root.classList.contains('matrix')) {
            return 'matrix';
        }
        if (root.classList.contains('dark')) {
            return 'dark';
        }

        return 'light';
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function measure(theme) {
        if (!header || !badge || !toggle) {
            return null;
        }

        var headerRect = header.getBoundingClientRect();
        var badgeRect = badge.getBoundingClientRect();
        var toggleRect = toggle.getBoundingClientRect();

        var startX = badgeRect.right - headerRect.left - RUNNER_SIZE + 4;
        var endX = toggleRect.left - headerRect.left
            + Math.round(toggleRect.width / 2 - RUNNER_SIZE / 2);

        if (endX - startX < RUNNER_SIZE) {
            endX = headerRect.width - RUNNER_SIZE - 4;
        }

        var lineY = rule
            ? rule.getBoundingClientRect().top - headerRect.top
            : badgeRect.bottom - headerRect.top;

        // Машина едет колёсами по линии, призрак и тарелка парят выше неё.
        var yOffset = theme === 'light' ? 4 : -1;

        return {
            startX: startX,
            endX: endX,
            distance: Math.max(0, endX - startX),
            y: lineY - RUNNER_SIZE + yOffset
        };
    }

    function removeRunner(el) {
        var index = active.indexOf(el);

        if (index !== -1) {
            active.splice(index, 1);
        }
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    function spawnRunner() {
        if (!ENABLED || !layer || active.length >= MAX_RUNNERS) {
            return;
        }

        var theme = currentTheme();
        var geometry = measure(theme);

        if (!geometry || geometry.distance < 40) {
            return;
        }

        var el = document.createElement('div');

        el.className = 'egg-runner egg-runner--' + theme;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="egg-runner__bob">' + SPRITES[theme] + '</span>';

        if (theme === 'light') {
            el.style.color = CAR_COLORS[carColorIndex % CAR_COLORS.length];
            carColorIndex += 1;
        }

        var jitter = theme === 'light' ? 0 : Math.random() * 6 - 3;

        el.style.left = geometry.startX + 'px';
        el.style.top = (geometry.y + jitter) + 'px';

        active.push(el);
        layer.appendChild(el);

        if (reduceMotion.matches) {
            el.classList.add('egg-runner--still');
            window.setTimeout(function () {
                removeRunner(el);
            }, STILL_MS);
            return;
        }

        var duration = clamp(geometry.distance / RUN_SPEED, MIN_DURATION_MS, MAX_DURATION_MS);

        duration = Math.round(duration * (0.9 + Math.random() * 0.2));

        el.style.setProperty('--egg-distance', geometry.distance + 'px');
        el.style.setProperty('--egg-duration', duration + 'ms');

        var removed = false;
        var cleanup = function () {
            if (removed) {
                return;
            }
            removed = true;
            removeRunner(el);
        };

        el.addEventListener('animationend', function (event) {
            if (event.target === el) {
                cleanup();
            }
        });

        // Страховка: если animationend не придёт (вкладка была скрыта и т.п.).
        window.setTimeout(cleanup, duration + 400);
    }

    function onBadgeClick(event) {
        if (!ENABLED || event.button !== 0) {
            return;
        }

        var selection = window.getSelection ? String(window.getSelection()).trim() : '';

        if (selection) {
            return;
        }

        var now = Date.now();

        if (clickCount === 0 || now - firstClickAt > CLICK_WINDOW_MS) {
            clickCount = 0;
            firstClickAt = now;
        }

        clickCount += 1;

        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(function () {
            clickCount = 0;
        }, CLICK_WINDOW_MS + 50);

        if (clickCount < CLICKS_REQUIRED) {
            return;
        }

        clickCount = 0;
        window.clearTimeout(resetTimer);
        spawnRunner();
    }

    function init() {
        header = document.querySelector('.page-header');
        badge = document.querySelector('.badge');
        toggle = document.getElementById('theme-toggle');
        rule = document.querySelector('.page-rule');

        if (!ENABLED || !header || !badge || !toggle) {
            return;
        }

        layer = document.createElement('div');
        layer.className = 'egg-layer';
        layer.setAttribute('aria-hidden', 'true');
        header.appendChild(layer);

        badge.addEventListener('click', onBadgeClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
