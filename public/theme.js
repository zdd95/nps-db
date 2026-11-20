/* ============================================================
   Темы NPS Survey Data: light → dark → matrix
   + фон «матрица» на canvas (адаптация шаблона matrix-background)
   ============================================================ */

(function () {
    'use strict';

    var STORAGE_KEY = 'nps-theme';
    var ORDER = ['light', 'dark', 'matrix'];
    var TOOLTIPS = {
        light: 'Тёмная тема',
        dark: 'Матрица',
        matrix: 'Светлая тема'
    };
    var THEME_COLORS = {
        light: '#f8fafc',
        dark: '#020617',
        matrix: '#020617'
    };

    var root = document.documentElement;

    function readMode() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored && ORDER.indexOf(stored) !== -1) {
                return stored;
            }
        } catch (e) {}

        return 'light';
    }

    function currentMode() {
        if (root.classList.contains('matrix')) {
            return 'matrix';
        }
        if (root.classList.contains('dark')) {
            return 'dark';
        }

        return 'light';
    }

    function syncTooltip() {
        var toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.setAttribute('title', TOOLTIPS[currentMode()]);
        }

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', THEME_COLORS[currentMode()]);
        }
    }

    function applyMode(mode) {
        root.classList.toggle('dark', mode !== 'light');
        root.classList.toggle('matrix', mode === 'matrix');
        syncTooltip();

        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch (e) {}

        if (mode === 'matrix') {
            matrix.start();
        } else {
            matrix.stop();
        }
    }

    /* ---------------- фон-матрица ---------------- */

    var matrix = (function () {
        var holder = null;
        var canvas = null;
        var ctx = null;

        var GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
        var FONT_SIZE = 16;
        var BASE_FONT = FONT_SIZE + "px 'IBM Plex Mono', ui-monospace, monospace";
        var FRAME_INTERVAL = 1000 / 30;

        var FADE_COLOR = 'rgba(2, 6, 23, 0.12)';
        var HEAD_COLOR = '#d9fbe4';
        var BODY_COLOR = '#22c55e';
        var CENTER_STRENGTH = 0.18;
        var EDGE_BAND = 420;

        var LANE_TEXTS = ['NPS'];
        var LANE_FONT_SIZE = 18;
        var LANE_LETTER_STEP = 15;
        var LANE_FONT = LANE_FONT_SIZE + "px 'IBM Plex Mono', ui-monospace, monospace";
        var LANE_MARGIN_X = 32;
        var LANE_ENTER_Y = 56;
        var LANE_HOLD_MS = 2800;
        var LANE_WAIT_MS = 900;
        var LANE_MOVE_SPEED = 0.17;

        var DOLLAR_MAX = 4;
        var DOLLAR_FONT_SIZE = 26;
        var DOLLAR_FONT = DOLLAR_FONT_SIZE + "px 'IBM Plex Mono', ui-monospace, monospace";
        var DOLLAR_COLOR = '#a7f3d0';
        var DOLLAR_SPAWN_MS = 700;
        var DOLLAR_SPAWN_RANGE_MS = 800;
        var DOLLAR_SPIN = 0.0026;
        var DOLLAR_MIN_SPEED = 0.055;
        var DOLLAR_SPEED_RANGE = 0.065;

        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        var width = 0;
        var height = 0;
        var columns = 0;
        var drops = [];
        var speeds = [];
        var blankColumns = [];
        var lanes = [];
        var dollars = [];
        var nextDollarAt = 0;
        var dollarFromLeft = true;
        var lastFrame = 0;
        var frameID = 0;
        var running = false;
        var ready = false;

        function randomGlyph() {
            return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
        }

        function resetDrop(i, aboveScreen) {
            drops[i] = Math.random() * (aboveScreen ? -40 : -20);
            speeds[i] = 0.25 + Math.random() * 0.55;
        }

        function columnStrength(x) {
            var band = Math.min(EDGE_BAND, width * 0.35);
            var edgeDistance = Math.min(x, width - x - FONT_SIZE);

            if (edgeDistance >= band) {
                return CENTER_STRENGTH;
            }

            var factor = 1 - edgeDistance / band;

            return CENTER_STRENGTH + (1 - CENTER_STRENGTH) * factor * factor;
        }

        function fitLaneStep(text) {
            var maxHeight = Math.max(height * 0.5, 240);

            return Math.min(LANE_LETTER_STEP, maxHeight / text.length);
        }

        function startLane(lane, now) {
            lane.text = LANE_TEXTS[Math.floor(Math.random() * LANE_TEXTS.length)];
            lane.step = fitLaneStep(lane.text);
            lane.height = lane.text.length * lane.step;
            lane.y = -lane.height - 16;
            lane.phase = 'in';
            lane.phaseStart = now;
        }

        function updateLane(lane, now, dt) {
            if (lane.phase === 'wait') {
                if (now - lane.phaseStart >= LANE_WAIT_MS) {
                    startLane(lane, now);
                }
                return;
            }

            if (lane.phase === 'in') {
                lane.y += LANE_MOVE_SPEED * dt;

                if (lane.y >= LANE_ENTER_Y) {
                    lane.y = LANE_ENTER_Y;
                    lane.phase = 'hold';
                    lane.phaseStart = now;
                }
                return;
            }

            if (lane.phase === 'hold') {
                if (now - lane.phaseStart >= LANE_HOLD_MS) {
                    lane.phase = 'out';
                    lane.phaseStart = now;
                }
                return;
            }

            lane.y += LANE_MOVE_SPEED * dt;

            if (lane.y > height + 16) {
                lane.text = '';
                lane.phase = 'wait';
                lane.phaseStart = now;
            }
        }

        function spawnDollar(now) {
            if (dollars.length >= DOLLAR_MAX) {
                return;
            }

            var band = Math.min(EDGE_BAND, width * 0.3);
            var maxOffset = Math.max(17, band - 32);
            var offset = 16 + Math.random() * (maxOffset - 16);
            var x = dollarFromLeft ? offset : width - offset - DOLLAR_FONT_SIZE;

            dollarFromLeft = !dollarFromLeft;

            dollars.push({
                x: x,
                y: -DOLLAR_FONT_SIZE,
                speed: DOLLAR_MIN_SPEED + Math.random() * DOLLAR_SPEED_RANGE,
                angle: Math.random() * Math.PI * 2
            });

            nextDollarAt = now + DOLLAR_SPAWN_MS + Math.random() * DOLLAR_SPAWN_RANGE_MS;
        }

        function updateDollars(now, dt) {
            if (now >= nextDollarAt) {
                spawnDollar(now);
            }

            for (var i = dollars.length - 1; i >= 0; i--) {
                var dollar = dollars[i];
                dollar.y += dollar.speed * dt;
                dollar.angle += DOLLAR_SPIN * dt;

                if (dollar.y > height + DOLLAR_FONT_SIZE) {
                    dollars.splice(i, 1);
                }
            }
        }

        function drawRain(animate) {
            ctx.font = BASE_FONT;

            for (var i = 0; i < columns; i++) {
                var x = i * FONT_SIZE;
                var y = drops[i] * FONT_SIZE;

                if (!blankColumns[i] && y >= -FONT_SIZE && y <= height) {
                    ctx.globalAlpha = columnStrength(x);
                    ctx.fillStyle = Math.random() < 0.08 ? HEAD_COLOR : BODY_COLOR;
                    ctx.fillText(randomGlyph(), x, y);
                }

                if (!animate) {
                    continue;
                }

                drops[i] += speeds[i];

                if (y > height && Math.random() > 0.97) {
                    resetDrop(i, false);
                }
            }

            ctx.globalAlpha = 1;
        }

        function drawLanes() {
            ctx.font = LANE_FONT;

            for (var l = 0; l < lanes.length; l++) {
                var lane = lanes[l];
                if (!lane.text) {
                    continue;
                }

                ctx.globalAlpha = columnStrength(lane.x) * 0.95;

                for (var k = 0; k < lane.text.length; k++) {
                    ctx.fillStyle = BODY_COLOR;
                    ctx.fillText(lane.text.charAt(k), lane.x, lane.y + k * lane.step);
                }
            }

            ctx.font = BASE_FONT;
            ctx.globalAlpha = 1;
        }

        function drawDollars() {
            ctx.font = DOLLAR_FONT;
            ctx.textAlign = 'center';

            for (var i = 0; i < dollars.length; i++) {
                var dollar = dollars[i];
                var scaleX = Math.cos(dollar.angle);
                var strength = columnStrength(dollar.x);

                if (strength < 0.6) {
                    strength = 0.6;
                }

                ctx.save();
                ctx.translate(dollar.x + DOLLAR_FONT_SIZE / 2, dollar.y);
                ctx.scale(Math.abs(scaleX) < 0.12 ? 0.12 : scaleX, 1);
                ctx.globalAlpha = strength * (0.85 + 0.15 * Math.abs(scaleX));
                ctx.fillStyle = DOLLAR_COLOR;
                ctx.fillText('$', 0, 0);
                ctx.restore();
            }

            ctx.textAlign = 'start';
            ctx.globalAlpha = 1;
        }

        function drawFrame() {
            ctx.fillStyle = FADE_COLOR;
            ctx.fillRect(0, 0, width, height);

            drawRain(true);
            drawDollars();
            drawLanes();
        }

        function drawStaticFrame() {
            ctx.clearRect(0, 0, width, height);
            ctx.font = BASE_FONT;

            for (var i = 0; i < columns; i++) {
                var x = i * FONT_SIZE;
                var strength = columnStrength(x);

                if (blankColumns[i]) {
                    continue;
                }

                for (var j = 0; j < 12; j++) {
                    var alpha = (0.08 + Math.random() * 0.35) * strength;
                    ctx.fillStyle = 'rgba(34, 197, 94, ' + alpha.toFixed(2) + ')';
                    ctx.fillText(randomGlyph(), x, Math.random() * height);
                }
            }

            ctx.font = DOLLAR_FONT;
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = DOLLAR_COLOR;
            ctx.fillText('$', width * 0.08, height * 0.35);
            ctx.fillText('$', width * 0.92, height * 0.62);
            ctx.textAlign = 'start';
            ctx.globalAlpha = 1;

            drawLanes();
        }

        function markLaneColumns() {
            for (var i = 0; i < columns; i++) {
                blankColumns[i] = false;
            }

            for (var l = 0; l < lanes.length; l++) {
                var lane = lanes[l];

                for (var i = 0; i < columns; i++) {
                    var x = i * FONT_SIZE;

                    if (x + FONT_SIZE > lane.x - 6 && x < lane.x + LANE_FONT_SIZE + 6) {
                        blankColumns[i] = true;
                    }
                }
            }
        }

        function resetLanes(now) {
            lanes = [
                { x: LANE_MARGIN_X, text: '', phase: 'wait', phaseStart: 0, y: 0, step: LANE_LETTER_STEP, height: 0 },
                { x: width - LANE_MARGIN_X - LANE_FONT_SIZE, text: '', phase: 'wait', phaseStart: 0, y: 0, step: LANE_LETTER_STEP, height: 0 }
            ];

            for (var l = 0; l < lanes.length; l++) {
                lanes[l].phaseStart = now - LANE_WAIT_MS + l * 1200;
            }
        }

        function prepareStaticLanes(now) {
            for (var l = 0; l < lanes.length; l++) {
                var lane = lanes[l];
                lane.text = LANE_TEXTS[l % LANE_TEXTS.length];
                lane.step = fitLaneStep(lane.text);
                lane.height = lane.text.length * lane.step;
                lane.y = LANE_ENTER_Y;
                lane.phase = 'hold';
                lane.phaseStart = now;
            }
        }

        function resize() {
            if (!ctx) {
                return;
            }

            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;

            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.font = BASE_FONT;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'start';

            columns = Math.ceil(width / FONT_SIZE);
            drops = new Array(columns);
            speeds = new Array(columns);
            blankColumns = new Array(columns);

            for (var i = 0; i < columns; i++) {
                resetDrop(i, true);
            }

            resetLanes(performance.now());
            markLaneColumns();

            dollars = [];
            nextDollarAt = performance.now() + 600;

            ctx.clearRect(0, 0, width, height);

            if (reduceMotion.matches) {
                prepareStaticLanes(performance.now());
                drawStaticFrame();
            } else if (running) {
                drawFrame();
            }
        }

        function tick(now) {
            if (!running) {
                return;
            }

            frameID = window.requestAnimationFrame(tick);

            if (document.hidden) {
                return;
            }

            if (now - lastFrame < FRAME_INTERVAL) {
                return;
            }

            var dt = lastFrame ? now - lastFrame : FRAME_INTERVAL;
            lastFrame = now;

            for (var l = 0; l < lanes.length; l++) {
                updateLane(lanes[l], now, dt);
            }

            updateDollars(now, dt);
            drawFrame();
        }

        function ensureCanvas() {
            if (ready) {
                return true;
            }

            holder = document.getElementById('matrixBackground');
            canvas = document.getElementById('matrixCanvas');

            if (!holder || !canvas) {
                return false;
            }

            ctx = canvas.getContext('2d');

            if (!ctx) {
                return false;
            }

            ready = true;
            resize();
            window.addEventListener('resize', resize);

            return true;
        }

        function start() {
            if (!ensureCanvas()) {
                return;
            }

            window.cancelAnimationFrame(frameID);
            lastFrame = 0;

            if (reduceMotion.matches) {
                prepareStaticLanes(performance.now());
                drawStaticFrame();
                return;
            }

            running = true;
            resize();
            frameID = window.requestAnimationFrame(tick);
        }

        function stop() {
            running = false;
            window.cancelAnimationFrame(frameID);
        }

        return { start: start, stop: stop };
    })();

    /* ---------------- переключатель темы ---------------- */

    function initToggle() {
        var toggle = document.getElementById('theme-toggle');

        if (!toggle) {
            return;
        }

        toggle.addEventListener('click', function () {
            var index = ORDER.indexOf(currentMode());
            applyMode(ORDER[(index + 1) % ORDER.length]);
        });

        syncTooltip();
    }

    document.addEventListener('DOMContentLoaded', function () {
        initToggle();

        if (currentMode() === 'matrix') {
            matrix.start();
        }
    });

    // Начальное состояние — сразу, до отрисовки страницы.
    var initialMode = readMode();
    root.classList.toggle('dark', initialMode !== 'light');
    root.classList.toggle('matrix', initialMode === 'matrix');
    syncTooltip();
})();
