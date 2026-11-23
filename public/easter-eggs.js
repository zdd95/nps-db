/* ============================================================
   Пасхалка NPS Survey Data
   Три клика по бейджу «NPS · Analytics» — из-под бейджа
   выбегает персонаж и пробегает по линии .page-rule вправо,
   к переключателю темы. Персонаж зависит от темы:
   light — машина с водителем, dark — призрак, matrix — летающая тарелка.
   Плюс редкие гости в шапке после бездействия:
   light — заяц, dark — бабочка, matrix — открывающиеся глаза.
   Проверить без ожидания: ?critter или ?critter=hare|butterfly|eyes.
   ============================================================ */

(function () {
    'use strict';

    var ENABLED = true;

    var CLICKS_REQUIRED = 3;
    var CLICK_WINDOW_MS = 1500;
    var MAX_RUNNERS = 12;
    var RUNNER_SIZE = 36;
    var RUN_SPEED = 0.3;           // px за мс
    var MIN_DURATION_MS = 900;
    var MAX_DURATION_MS = 3400;
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

    /* ---------------- редкие гости в шапке ---------------- */

    var CRITTER_IDLE_MS = 45000;      // бездействие до появления
    var CRITTER_COOLDOWN_MS = 120000; // пауза после гостя
    var CRITTER_TICK_MS = 5000;

    var CRITTERS = {
        hare: {
            width: 38,
            height: 38,
            className: 'critter--hare',
            hop: true
        },
        butterfly: { width: 28, height: 28, speed: 0.07, className: 'critter--butterfly' },
        eyes: { width: 64, height: 32, speed: 0, className: 'critter--eyes' }
    };

    var CRITTER_SPRITES = {
        hare:
            '<svg viewBox="0 0 30 30" width="30" height="30" focusable="false" aria-hidden="true">' +
                '<g class="critter__pose critter__pose--run">' +
                    '<ellipse cx="14" cy="18" rx="8.2" ry="5.6" fill="currentColor"/>' +
                    '<g class="critter__legs">' +
                        '<ellipse cx="11.6" cy="24.2" rx="2.6" ry="1.5" fill="currentColor"/>' +
                        '<ellipse cx="17.4" cy="24.4" rx="2" ry="1.3" fill="currentColor"/>' +
                    '</g>' +
                    '<circle cx="5.4" cy="16.4" r="2.4" fill="#f1ece4" stroke="#cdbfae" stroke-width="0.6"/>' +
                    '<ellipse cx="19.4" cy="6.2" rx="1.7" ry="4.9" transform="rotate(-12 19.4 6.2)" fill="currentColor"/>' +
                    '<ellipse cx="22.8" cy="5.6" rx="1.7" ry="5.1" transform="rotate(10 22.8 5.6)" fill="currentColor"/>' +
                    '<ellipse cx="19.6" cy="6.8" rx="0.7" ry="3.4" transform="rotate(-12 19.6 6.8)" fill="#f8fafc" opacity="0.45"/>' +
                    '<ellipse cx="21.2" cy="13.4" rx="4.2" ry="3.8" fill="currentColor"/>' +
                    '<circle cx="22.6" cy="12.6" r="0.72" fill="#111827"/>' +
                    '<circle cx="25" cy="14.1" r="0.55" fill="#111827"/>' +
                '</g>' +
                '<g class="critter__pose critter__pose--eat">' +
                    '<ellipse cx="12.4" cy="24.6" rx="4" ry="2.2" fill="currentColor"/>' +
                    '<ellipse cx="14.2" cy="18" rx="5" ry="6.6" fill="currentColor"/>' +
                    '<circle cx="7.8" cy="20.4" r="2" fill="#f1ece4" stroke="#cdbfae" stroke-width="0.6"/>' +
                    '<ellipse cx="17.6" cy="4.6" rx="1.5" ry="4.3" transform="rotate(-10 17.6 4.6)" fill="currentColor"/>' +
                    '<ellipse cx="20.6" cy="4.2" rx="1.5" ry="4.5" transform="rotate(10 20.6 4.2)" fill="currentColor"/>' +
                    '<ellipse cx="18.6" cy="10.4" rx="3.8" ry="3.5" fill="currentColor"/>' +
                    '<circle cx="20.1" cy="9.8" r="0.65" fill="#111827"/>' +
                    '<circle cx="22.2" cy="11" r="0.5" fill="#111827"/>' +
                    '<g class="critter__carrot">' +
                        '<path d="M19.4 14.6l4.8 1.6-3.6 3.2z" fill="#ea580c"/>' +
                        '<path d="M23.6 15l1.2-1.3M24.2 15.8l1.6-.4" fill="none" stroke="#16a34a" stroke-width="0.85" stroke-linecap="round"/>' +
                    '</g>' +
                    '<circle cx="19" cy="15.6" r="1.15" fill="currentColor"/>' +
                    '<circle cx="20.6" cy="16.8" r="1.15" fill="currentColor"/>' +
                '</g>' +
            '</svg>',
        butterfly:
            '<svg viewBox="0 0 28 28" width="28" height="28" focusable="false" aria-hidden="true">' +
                '<g class="critter__wing critter__wing--left">' +
                    '<ellipse cx="8.6" cy="10.2" rx="6" ry="4.3" transform="rotate(-30 8.6 10.2)" fill="currentColor" opacity="0.78"/>' +
                    '<ellipse cx="9.4" cy="18.2" rx="4.4" ry="3.2" transform="rotate(-14 9.4 18.2)" fill="currentColor" opacity="0.62"/>' +
                    '<circle cx="7" cy="9.4" r="1.2" fill="#0b1120" opacity="0.35"/>' +
                    '<circle cx="10.4" cy="12" r="0.8" fill="#0b1120" opacity="0.3"/>' +
                    '<circle cx="8.6" cy="18.6" r="0.9" fill="#0b1120" opacity="0.28"/>' +
                '</g>' +
                '<g class="critter__wing critter__wing--right">' +
                    '<ellipse cx="19.4" cy="10.2" rx="6" ry="4.3" transform="rotate(30 19.4 10.2)" fill="currentColor" opacity="0.78"/>' +
                    '<ellipse cx="18.6" cy="18.2" rx="4.4" ry="3.2" transform="rotate(14 18.6 18.2)" fill="currentColor" opacity="0.62"/>' +
                    '<circle cx="21" cy="9.4" r="1.2" fill="#0b1120" opacity="0.35"/>' +
                    '<circle cx="17.6" cy="12" r="0.8" fill="#0b1120" opacity="0.3"/>' +
                    '<circle cx="19.4" cy="18.6" r="0.9" fill="#0b1120" opacity="0.28"/>' +
                '</g>' +
                '<ellipse cx="14" cy="14" rx="1.4" ry="6.4" fill="currentColor"/>' +
                '<path d="M12.6 8.4c-1-1.7-2.3-2.5-3.7-2.7M15.4 8.4c1-1.7 2.3-2.5 3.7-2.7" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/>' +
                '<circle cx="8.8" cy="5.6" r="0.7" fill="currentColor"/>' +
                '<circle cx="19.2" cy="5.6" r="0.7" fill="currentColor"/>' +
            '</svg>',
        eyes:
            '<svg viewBox="0 0 64 32" width="64" height="32" focusable="false" aria-hidden="true">' +
                '<defs>' +
                    '<radialGradient id="critterEyeFill" cx="50%" cy="42%" r="62%">' +
                        '<stop offset="0%" stop-color="#d1fae5"/>' +
                        '<stop offset="55%" stop-color="#4ade80"/>' +
                        '<stop offset="100%" stop-color="#15803d"/>' +
                    '</radialGradient>' +
                    '<mask id="critterEyeMaskL" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">' +
                        '<rect x="0" y="0" width="32" height="32" fill="#fff"/>' +
                        '<path class="eye-lid" d="M-4 -40H34V30Q16 38 -4 30Z" fill="#000"/>' +
                    '</mask>' +
                    '<mask id="critterEyeMaskR" maskUnits="userSpaceOnUse" x="32" y="0" width="32" height="32">' +
                        '<rect x="32" y="0" width="32" height="32" fill="#fff"/>' +
                        '<path class="eye-lid eye-lid--right" d="M32 -40H68V30Q50 38 32 30Z" fill="#000"/>' +
                    '</mask>' +
                '</defs>' +
                '<g class="eye eye--left" mask="url(#critterEyeMaskL)">' +
                    '<path d="M5 16c6.2-10.2 15.8-10.2 22 0-6.2 10.2-15.8 10.2-22 0z" fill="url(#critterEyeFill)"/>' +
                    '<circle cx="16" cy="16" r="5.4" fill="#22c55e" opacity="0.45"/>' +
                    '<path d="M5 16c6.2-10.2 15.8-10.2 22 0c-5.4-7.4-16.6-7.4-22 0z" fill="#052e16" opacity="0.62"/>' +
                    '<path d="M7.4 14.6c5.2-8 12-8 17.2 0" fill="none" stroke="#022c22" stroke-width="1.1" stroke-linecap="round"/>' +
                    '<path d="M10.2 10.3L9.2 7.6M13 8.8L12.6 6.1M16 8.35L16 5.5M19 8.8L19.4 6.1M21.8 10.3L22.8 7.6" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" opacity="0.9"/>' +
                    '<g class="pupil">' +
                        '<circle cx="16" cy="16" r="4" fill="#020617"/>' +
                        '<circle cx="17.3" cy="14.6" r="1" fill="#d1fae5" opacity="0.9"/>' +
                    '</g>' +
                '</g>' +
                '<g class="eye eye--right" mask="url(#critterEyeMaskR)">' +
                    '<path d="M37 16c6.2-10.2 15.8-10.2 22 0-6.2 10.2-15.8 10.2-22 0z" fill="url(#critterEyeFill)"/>' +
                    '<circle cx="48" cy="16" r="5.4" fill="#22c55e" opacity="0.45"/>' +
                    '<path d="M37 16c6.2-10.2 15.8-10.2 22 0c-5.4-7.4-16.6-7.4-22 0z" fill="#052e16" opacity="0.62"/>' +
                    '<path d="M39.4 14.6c5.2-8 12-8 17.2 0" fill="none" stroke="#022c22" stroke-width="1.1" stroke-linecap="round"/>' +
                    '<path d="M53.8 10.3L54.8 7.6M51 8.8L51.4 6.1M48 8.35L48 5.5M45 8.8L44.6 6.1M42.2 10.3L41.2 7.6" fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round" opacity="0.9"/>' +
                    '<g class="pupil">' +
                        '<circle cx="48" cy="16" r="4" fill="#020617"/>' +
                        '<circle cx="49.3" cy="14.6" r="1" fill="#d1fae5" opacity="0.9"/>' +
                    '</g>' +
                '</g>' +
            '</svg>'
    };

    var critterLayer = null;
    var critterEl = null;
    var critterState = null;
    var lastActivityAt = Date.now();
    var cooldownUntil = 0;

    function critterKey() {
        var theme = currentTheme();

        if (theme === 'matrix') {
            return 'eyes';
        }
        if (theme === 'dark') {
            return 'butterfly';
        }

        return 'hare';
    }

    // ?critter — гость текущей темы, ?critter=hare|butterfly|eyes — конкретный.
    function critterFromQuery() {
        var match = /[?&]critter(?:=([^&]*))?/i.exec(window.location.search);

        if (!match) {
            return null;
        }

        var key = decodeURIComponent(match[1] || '').toLowerCase();

        if (!key || key === '1' || key === 'true' || key === 'auto') {
            key = critterKey();
        }

        return CRITTER_SPRITES[key] ? key : null;
    }

    function critterArea(conf) {
        var lineTop = rule ? rule.offsetTop : header.clientHeight;
        var maxY = Math.max(4, lineTop - conf.height - 2);

        return {
            minX: 6,
            maxX: Math.max(6, header.clientWidth - conf.width - 6),
            minY: 4,
            maxY: maxY
        };
    }

    function critterSpot(area, size) {
        var headerRect = header.getBoundingClientRect();
        var zones = [];

        [badge, toggle].forEach(function (element) {
            if (!element) {
                return;
            }

            var rect = element.getBoundingClientRect();

            zones.push({
                left: rect.left - headerRect.left - 10,
                right: rect.right - headerRect.left + 10,
                top: rect.top - headerRect.top - 10,
                bottom: rect.bottom - headerRect.top + 10
            });
        });

        var x = area.minX;
        var y = area.minY;

        for (var i = 0; i < 8; i++) {
            x = area.minX + Math.random() * Math.max(1, area.maxX - area.minX);
            y = area.minY + Math.random() * Math.max(1, area.maxY - area.minY);

            var blocked = zones.some(function (zone) {
                return x + size.width > zone.left && x < zone.right
                    && y + size.height > zone.top && y < zone.bottom;
            });

            if (!blocked) {
                break;
            }
        }

        return { x: x, y: y };
    }

    function perchTarget(state) {
        var headerRect = header.getBoundingClientRect();
        var candidates = [];

        [badge, toggle].forEach(function (element) {
            if (!element) {
                return;
            }

            var rect = element.getBoundingClientRect();

            candidates.push({
                x: rect.left - headerRect.left + rect.width / 2 - state.size.width / 2,
                y: rect.top - headerRect.top + (rect.height - state.size.height) / 2
            });
        });

        if (!candidates.length) {
            return null;
        }

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function pickTarget(state) {
        if (state.entering) {
            state.entering = false;
            state.perch = false;

            var inward = state.x < header.clientWidth / 2 ? 1 : -1;

            state.tx = clamp(state.x + inward * 240, state.area.minX, state.area.maxX);
            state.ty = state.area.maxY - 2;
            return;
        }

        if (Math.random() < 0.45) {
            var perch = perchTarget(state);

            if (perch) {
                state.perch = true;
                state.tx = perch.x;
                state.ty = perch.y;
                return;
            }
        }

        var spot = critterSpot(state.area, state.size);

        state.perch = false;
        state.tx = spot.x;
        state.ty = spot.y;
    }

    function hareBounds(state) {
        var headerRect = header.getBoundingClientRect();
        var left = state.area.minX;
        var right = state.area.maxX;

        if (badge) {
            var badgeRect = badge.getBoundingClientRect();

            left = Math.max(left, badgeRect.right - headerRect.left + 6);
        }
        if (toggle) {
            var toggleRect = toggle.getBoundingClientRect();

            right = Math.min(right, toggleRect.left - headerRect.left - state.size.width - 6);
        }

        if (right < left) {
            return { min: state.area.minX, max: state.area.maxX };
        }

        return { min: left, max: right };
    }

    function pickHareTarget(state) {
        var bounds = hareBounds(state);

        if (Math.random() < 0.22) {
            state.dir = -state.dir;
        }

        var step = 25 + Math.random() * 20;
        var tx = state.x + state.dir * step;

        if (tx < bounds.min || tx > bounds.max) {
            state.dir = -state.dir;
            tx = state.x + state.dir * step;
        }

        state.tx = Math.max(bounds.min, Math.min(bounds.max, tx));
        state.ty = state.groundY;
    }

    function startHop(state) {
        pickHareTarget(state);

        var dist = Math.sqrt(
            Math.pow(state.tx - state.x, 2) + Math.pow(state.ty - state.y, 2)
        );

        state.hopFrom = { x: state.x, y: state.y };
        state.hopTo = { x: state.tx, y: state.ty };
        state.hopStart = performance.now();

        // Следы остаются на месте отталкивания, за зайцем.
        dropPrints(state);
        state.hopDuration = Math.max(320, Math.min(720, dist * 3.2));

        var desiredLift = Math.min(7, Math.max(3, dist * 0.12));
        var maxLift = Math.max(2, Math.min(state.hopFrom.y, state.hopTo.y) - 2);

        state.hopHeight = Math.min(desiredLift, maxLift);
        state.hop = true;
        state.facing = state.hopTo.x < state.x ? -1 : 1;

        critterEl.classList.remove('critter--eating');
        critterEl.classList.remove('critter--looking');
        critterEl.classList.add('critter--jumping');
    }

    function dropPrints(state) {
        if (state.y < state.groundY - 1) {
            return;
        }

        var print = document.createElement('span');

        print.className = 'critter-print';
        print.style.transform = 'translate3d('
            + (state.x + state.size.width / 2 - 6).toFixed(1) + 'px,'
            + (state.y + Math.round(state.size.height * 0.86) - 1) + 'px,0)';
        critterLayer.insertBefore(print, critterEl);

        state.prints.push(print);

        if (state.prints.length > 3) {
            var old = state.prints.shift();

            if (old.parentNode) {
                old.parentNode.removeChild(old);
            }
        }
    }

    function landHare(state) {
        var now = performance.now();

        state.hop = false;
        state.x = state.hopTo.x;
        state.y = state.hopTo.y;

        if (state.leaving) {
            removeCritter();
            return;
        }

        critterEl.classList.remove('critter--jumping');

        if (Math.random() < 0.06) {
            critterEl.classList.add('critter--eating');
            state.pauseUntil = now + 2000 + Math.random() * 700;
        } else if (Math.random() < 0.35) {
            critterEl.classList.add('critter--looking');
            state.pauseUntil = now + 800 + Math.random() * 400;
        } else {
            state.pauseUntil = now + 250 + Math.random() * 250;
        }
    }

    function moveHare(now) {
        var state = critterState;

        if (!state || !critterEl) {
            return;
        }

        state.last = now;

        if (!state.hop) {
            if (now < state.pauseUntil) {
                state.raf = window.requestAnimationFrame(moveHare);
                return;
            }

            startHop(state);
        }

        var p = Math.min(1, (now - state.hopStart) / state.hopDuration);
        var x = state.hopFrom.x + (state.hopTo.x - state.hopFrom.x) * p;
        var y = state.hopFrom.y + (state.hopTo.y - state.hopFrom.y) * p
            - Math.sin(Math.PI * p) * state.hopHeight;

        state.x = x;
        state.y = y;

        critterEl.style.transform = 'translate3d(' + x.toFixed(1) + 'px,'
            + y.toFixed(1) + 'px,0)'
            + (state.facing < 0 ? ' scaleX(-1)' : '');

        if (state.shadow) {
            var groundY = state.area.maxY + state.size.height;

            state.shadow.style.transform = 'translate3d('
                + (x + state.size.width / 2 - 11).toFixed(1) + 'px,' + groundY + 'px,0)';
            state.shadow.style.opacity = '1';
        }

        if (p >= 1) {
            landHare(state);
        }

        state.raf = window.requestAnimationFrame(moveHare);
    }

    function moveCritter(now) {
        var state = critterState;

        if (!state || !critterEl) {
            return;
        }

        var dt = state.last ? Math.min(now - state.last, 48) : 16;

        state.last = now;

        if (state.pauseUntil > now) {
            state.raf = window.requestAnimationFrame(moveCritter);
            return;
        }

        critterEl.classList.remove('critter--perched');

        var dx = state.tx - state.x;
        var dy = state.ty - state.y;
        var distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 2.5) {
            if (!state.dismissing) {
                var arrivedPerch = state.perch;

                if (arrivedPerch) {
                    critterEl.classList.add('critter--perched');
                }

                state.pauseUntil = now + (arrivedPerch
                    ? 1500 + Math.random() * 1500
                    : 150 + Math.random() * 400);
                pickTarget(state);
            }
        } else {
            var heading = Math.atan2(dy, dx);
            var step = Math.min(distance, state.speed * dt);

            state.x += Math.cos(heading) * step;
            state.y += Math.sin(heading) * step;

            var targetAngle = (heading * 180) / Math.PI + 90;
            var turn = ((targetAngle - state.angle + 540) % 360) - 180;

            state.angle += turn * Math.min(1, dt / 130);
        }

        var renderX = state.x;
        var renderY = state.y;

        if (state.bob) {
            renderX += Math.sin(now / state.bob.sx) * state.bob.x;
            renderY += Math.sin(now / state.bob.sy) * state.bob.y;
        }

        var rotate = state.rotate === false ? 0 : state.angle;
        var flip = state.flip && Math.cos((state.angle - 90) * Math.PI / 180) < 0 ? -1 : 1;

        critterEl.style.transform = 'translate3d(' + renderX.toFixed(1) + 'px,'
            + renderY.toFixed(1) + 'px,0) rotate(' + rotate.toFixed(1) + 'deg)'
            + (state.flip ? ' scaleX(' + flip + ')' : '');

        if (state.shadow) {
            var groundY = state.area.maxY + state.size.height;

            state.shadow.style.transform = 'translate3d('
                + (renderX + state.size.width / 2 - 11).toFixed(1) + 'px,' + groundY + 'px,0)';
            state.shadow.style.opacity = renderY >= state.area.minY ? '1' : '0';
        }

        state.raf = window.requestAnimationFrame(moveCritter);
    }

    function eyesLater(state, delay, callback) {
        state.timers.push(window.setTimeout(function () {
            callback();
        }, delay));
    }

    function setEyesClosed(state, closed) {
        for (var i = 0; i < state.lids.length; i++) {
            state.lids[i].classList.toggle('eye-lid--open', !closed);
        }
    }

    function moveEyes(state) {
        var spot = critterSpot(state.area, state.size);
        var tries = 0;

        while (Math.abs(spot.x - state.px) < 90
            && Math.abs(spot.y - state.py) < 8
            && tries < 6) {
            spot = critterSpot(state.area, state.size);
            tries += 1;
        }

        state.px = spot.x;
        state.py = spot.y;
        critterEl.style.transform = 'translate3d('
            + spot.x.toFixed(1) + 'px,' + spot.y.toFixed(1) + 'px,0)';
    }

    function runEyesCycle(state) {
        if (critterState !== state || !critterEl) {
            return;
        }

        if (state.blinks > 0) {
            state.blinks -= 1;
            setEyesClosed(state, true);

            eyesLater(state, 150, function () {
                if (critterState !== state) {
                    return;
                }

                setEyesClosed(state, false);
                eyesLater(state, 450 + Math.random() * 800, function () {
                    runEyesCycle(state);
                });
            });
        } else {
            // Поморгал — закрываем, переносим и открываем уже на новом месте.
            setEyesClosed(state, true);

            eyesLater(state, 260, function () {
                if (critterState !== state) {
                    return;
                }

                moveEyes(state);

                eyesLater(state, 380, function () {
                    if (critterState !== state) {
                        return;
                    }

                    setEyesClosed(state, false);
                    state.blinks = 3 + Math.floor(Math.random() * 2);
                    eyesLater(state, 900 + Math.random() * 700, function () {
                        runEyesCycle(state);
                    });
                });
            });
        }
    }

    function stepEyes(state) {
        if (critterState !== state) {
            return;
        }

        var now = Date.now();

        if (now >= state.nextSaccade && now - state.lastPointerAt > 900) {
            state.tx = Math.random() * 4.8 - 2.4;
            state.ty = Math.random() * 3.2 - 1.6;
            state.nextSaccade = now + 1200 + Math.random() * 1600;
        }

        state.x += (state.tx - state.x) * 0.3;
        state.y += (state.ty - state.y) * 0.3;

        var transform = 'translate(' + state.x.toFixed(2) + 'px,' + state.y.toFixed(2) + 'px)';

        for (var i = 0; i < state.pupils.length; i++) {
            state.pupils[i].style.transform = transform;
        }
    }

    function trackPupils(event) {
        var state = critterState;

        if (!state || !state.pupils || !critterEl) {
            return;
        }

        var rect = critterEl.getBoundingClientRect();
        var x = (event.clientX - (rect.left + rect.width / 2)) / 40;
        var y = (event.clientY - (rect.top + rect.height / 2)) / 40;

        state.tx = clamp(x, -2.4, 2.4);
        state.ty = clamp(y, -1.6, 1.6);
        state.lastPointerAt = Date.now();
    }

    function dismissCritter() {
        if (!critterEl || !critterState || critterState.dismissing) {
            return;
        }

        var state = critterState;

        state.dismissing = true;

        if (state.pupils) {
            critterEl.classList.add('critter--closing');
            window.setTimeout(removeCritter, 220);
            return;
        }

        if (state.hopMode) {
            // Финальный прыжок — исчезает при приземлении.
            state.dismissing = true;
            state.leaving = true;
            state.pauseUntil = 0;
            state.hop = true;
            state.hopFrom = { x: state.x, y: state.y };
            state.hopTo = {
                x: clamp(state.x + state.dir * (40 + Math.random() * 20),
                    state.area.minX, state.area.maxX),
                y: state.groundY
            };
            state.hopStart = performance.now();
            state.hopDuration = 380;
            state.hopHeight = 9;
            state.facing = state.hopTo.x < state.x ? -1 : 1;

            critterEl.classList.remove('critter--eating', 'critter--looking');
            critterEl.classList.add('critter--jumping');

            // Страховка, если приземление не случится.
            window.setTimeout(function () {
                if (critterEl) {
                    removeCritter();
                }
            }, 1000);
            return;
        }

        // Улетает: ускоряется и уходит за ближайший верхний край.
        state.bob = null;
        state.pauseUntil = 0;
        state.speed = Math.max(state.speed * 8, 0.9);
        state.tx = state.x < (state.area.minX + state.area.maxX) / 2
            ? state.area.minX - 140
            : state.area.maxX + 140;
        state.ty = state.area.minY - 80;
        state.last = 0;

        window.setTimeout(removeCritter, 420);
    }

    function removeCritter() {
        if (critterState && critterState.raf) {
            window.cancelAnimationFrame(critterState.raf);
        }
        if (critterState && critterState.timer) {
            window.clearInterval(critterState.timer);
        }
        if (critterState && critterState.timers) {
            for (var i = 0; i < critterState.timers.length; i++) {
                window.clearTimeout(critterState.timers[i]);
            }
        }

        if (critterState && critterState.prints) {
            for (var p = 0; p < critterState.prints.length; p++) {
                if (critterState.prints[p].parentNode) {
                    critterState.prints[p].parentNode.removeChild(critterState.prints[p]);
                }
            }
        }

        if (critterState && critterState.shadow && critterState.shadow.parentNode) {
            critterState.shadow.parentNode.removeChild(critterState.shadow);
        }

        critterState = null;

        if (critterEl && critterEl.parentNode) {
            critterEl.parentNode.removeChild(critterEl);
        }

        critterEl = null;
        lastActivityAt = Date.now();
    }

    function spawnCritter(forcedKey) {
        if (!critterLayer || critterEl) {
            return;
        }

        var key = forcedKey || critterKey();
        var conf = CRITTERS[key];
        var area = critterArea(conf);

        var el = document.createElement('div');

        el.className = 'critter ' + conf.className;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = CRITTER_SPRITES[key];

        var spot = critterSpot(area, conf);
        var x = spot.x;
        var y = spot.y;
        var entryPerch = null;
        var diagTx = null;
        var diagTy = null;
        var fromLeft = false;

        if (key !== 'eyes') {
            entryPerch = Math.random() < 0.5
                ? perchTarget({ size: { width: conf.width, height: conf.height } })
                : null;

            y = area.minY - conf.height - 18;

            if (key === 'butterfly') {
                // Бабочка влетает по диагонали ~45° и потом выравнивается.
                entryPerch = null;
                fromLeft = Math.random() < 0.5;
                x = fromLeft ? area.minX - conf.width - 12 : header.clientWidth + 12;
                diagTy = area.maxY - 2;
                diagTx = fromLeft ? x + (diagTy - y) : x - (diagTy - y);
            } else if (entryPerch) {
                x = entryPerch.x;
            }
        }

        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';

        critterEl = el;
        critterLayer.appendChild(el);

        if (key !== 'eyes') {
            var shadow = document.createElement('span');

            shadow.className = 'critter-shadow';
            shadow.style.opacity = '0';
            critterLayer.insertBefore(shadow, el);

            if (conf.hop) {
                // Заяц появляется из-за бейджа или иконки темы и скачет по шапке.
                var headerRect = header.getBoundingClientRect();
                var fromBadge = Math.random() < 0.5;
                var startX = area.minX;

                if (fromBadge && badge) {
                    var badgeRect = badge.getBoundingClientRect();

                    startX = badgeRect.right - headerRect.left - 20;
                } else if (toggle) {
                    var toggleRect = toggle.getBoundingClientRect();

                    startX = toggleRect.left - headerRect.left - conf.width + 20;
                }

                var startY = area.maxY + Math.round(conf.height * 0.14) + 2;
                var startFacing = fromBadge ? 1 : -1;

                el.style.transform = 'translate3d(' + startX.toFixed(1) + 'px,'
                    + startY.toFixed(1) + 'px,0)'
                    + (startFacing < 0 ? ' scaleX(-1)' : '');

                critterState = {
                    x: startX,
                    y: startY,
                    tx: startX,
                    ty: startY,
                    area: area,
                    size: { width: conf.width, height: conf.height },
                    shadow: shadow,
                    hopMode: true,
                    groundY: startY,
                    hop: false,
                    hopFrom: { x: startX, y: startY },
                    hopTo: { x: startX, y: startY },
                    hopStart: 0,
                    hopDuration: 400,
                    hopHeight: 20,
                    facing: startFacing,
                    dir: startFacing,
                    prints: [],
                    pauseUntil: performance.now() + 250,
                    last: 0,
                    raf: 0
                };

                el.classList.add('critter--pop');
                window.setTimeout(function () {
                    if (critterEl) {
                        critterEl.classList.remove('critter--pop');
                    }
                }, 320);

                critterState.raf = window.requestAnimationFrame(moveHare);
            } else {
                critterState = {
                    x: x,
                    y: y,
                    tx: x,
                    ty: y,
                    angle: 0,
                    speed: conf.speed,
                    area: area,
                    size: { width: conf.width, height: conf.height },
                    shadow: shadow,
                    bob: key === 'butterfly'
                        ? { x: 3, y: 2, sx: 420, sy: 210 }
                        : { x: 0.8, y: 1.4, sx: 700, sy: 200 },
                    rotate: conf.rotate !== false,
                    flip: !!conf.flip,
                    entering: false,
                    perch: false,
                    pauseUntil: 0,
                    last: 0,
                    raf: 0
                };

                // Первая цель: иногда сразу садится на элемент, иначе входит сверху.
                if (entryPerch) {
                    critterState.perch = true;
                    critterState.tx = entryPerch.x;
                    critterState.ty = entryPerch.y;
                } else if (key === 'butterfly') {
                    critterState.perch = false;
                    critterState.entering = true;
                    critterState.tx = diagTx;
                    critterState.ty = diagTy;
                } else {
                    critterState.perch = false;
                    critterState.tx = Math.min(area.maxX, Math.max(area.minX, x + (Math.random() * 60 - 30)));
                    critterState.ty = area.minY + 4;
                }

                critterState.raf = window.requestAnimationFrame(moveCritter);
            }
        } else {
            var eyeState = {
                pupils: el.querySelectorAll('.pupil'),
                lids: el.querySelectorAll('.eye-lid'),
                area: area,
                size: { width: conf.width, height: conf.height },
                px: x,
                py: y,
                blinks: 3 + Math.floor(Math.random() * 2),
                timers: [],
                x: 0,
                y: 0,
                tx: 0,
                ty: 0,
                lastPointerAt: Date.now(),
                nextSaccade: Date.now() + 1200 + Math.random() * 1500,
                timer: 0
            };

            critterState = eyeState;
            eyeState.timer = window.setInterval(function () {
                stepEyes(eyeState);
            }, 90);

            // Появляются закрытыми и открываются на месте.
            eyesLater(eyeState, 140, function () {
                if (critterState !== eyeState) {
                    return;
                }

                setEyesClosed(eyeState, false);
                eyesLater(eyeState, 900 + Math.random() * 700, function () {
                    runEyesCycle(eyeState);
                });
            });
        }

        cooldownUntil = Date.now() + CRITTER_COOLDOWN_MS;
    }

    function checkCritters() {
        if (!critterLayer || critterEl) {
            return;
        }
        if (document.hidden || reduceMotion.matches) {
            return;
        }
        if (window.innerWidth < 600) {
            return;
        }

        var now = Date.now();

        if (now < cooldownUntil || now - lastActivityAt < CRITTER_IDLE_MS) {
            return;
        }

        var modal = document.querySelector('.modal-overlay');

        if (modal && window.getComputedStyle(modal).display !== 'none') {
            return;
        }

        spawnCritter();
    }

    function startCritters() {
        if (!critterLayer) {
            return;
        }

        window.addEventListener('pointermove', function (event) {
            lastActivityAt = Date.now();
            trackPupils(event);
        }, { passive: true });

        // Любое действие (клик по фильтрам, кнопкам, смена темы) — гость улетает.
        document.addEventListener('pointerdown', function () {
            if (critterEl) {
                dismissCritter();
            }
        }, true);

        document.addEventListener('keydown', function () {
            if (critterEl) {
                dismissCritter();
            }
        }, true);

        ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (name) {
            window.addEventListener(name, function () {
                lastActivityAt = Date.now();
            }, { passive: true });
        });

        window.setInterval(checkCritters, CRITTER_TICK_MS);
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

        critterLayer = document.createElement('div');
        critterLayer.className = 'critter-layer';
        critterLayer.setAttribute('aria-hidden', 'true');
        header.appendChild(critterLayer);
        startCritters();

        // Для проверки без ожидания: ?critter или ?critter=hare|butterfly|eyes.
        var forcedCritter = critterFromQuery();

        if (forcedCritter) {
            window.setTimeout(function () {
                spawnCritter(forcedCritter);
            }, 300);
        }

        badge.addEventListener('click', onBadgeClick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
