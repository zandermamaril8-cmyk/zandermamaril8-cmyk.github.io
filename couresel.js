/* Circular carousel, plain-JS port of CircularCarousel.jsx
   Usage: CircularCarousel(element, items, options) */
(function () {
  var PRESETS = {
    cylinder: { axis: 'y', tilt: -5, perspective: 2500, curve: 1, spread: 1, inward: false, billboard: false, backfaces: true, window: 0 },
    orbit:    { axis: 'y', tilt: -16, perspective: 1500, curve: 0, spread: 1.45, inward: false, billboard: true, backfaces: false, window: 0 },
    wheel:    { axis: 'x', tilt: 0, perspective: 1800, curve: 0, spread: 1, inward: false, billboard: false, backfaces: true, window: 1.7 },
    panorama: { axis: 'y', tilt: 0, perspective: 0, curve: 1, spread: 1, inward: true, billboard: false, backfaces: false, window: 0 }
  };
  var INTRO_LENGTH = { assemble: 1500, rise: 1400, spin: 1800, none: 0 };
  var TILES = 8, OVERLAP = 2.5, DRAG_THRESHOLD = 5, SPRING = 118, SETTLE_SPEED = 9, TO_RAD = Math.PI / 180;

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var wrap = function (d) { return ((((d + 180) % 360) + 360) % 360) - 180; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
  var easeOutQuint = function (t) { return 1 - Math.pow(1 - t, 5); };
  function rotateX(p, deg) { var r = deg * TO_RAD, c = Math.cos(r), s = Math.sin(r); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotateY(p, deg) { var r = deg * TO_RAD, c = Math.cos(r), s = Math.sin(r); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function el(tag, cls, style) { var e = document.createElement(tag); if (cls) e.className = cls; if (style) for (var k in style) e.style[k] = style[k]; return e; }

  window.CircularCarousel = function (root, items, opts) {
    var o = Object.assign({
      preset: 'panorama', intro: 'rise', cardWidth: 220, aspectRatio: 0.75, gap: 25,
      curve: undefined, tilt: undefined, perspective: undefined,
      autoplay: 'drift', speed: 14, interval: 3, direction: 'left', momentum: 0.6,
      snap: true, pauseOnHover: true, focusOnClick: true, parallax: 0.3, stretch: 0.5,
      depthFade: 0.55, fadeColor: '#000000', innerShade: 0.6, cornerRadius: 12,
      onChange: null, onItemClick: null
    }, opts || {});

    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var shape = PRESETS[o.preset] ? o.preset : 'cylinder';
    var layout = PRESETS[shape], axis = layout.axis;
    var count = items.length, step = 360 / count;
    var tiltValue = o.tilt != null ? o.tilt : layout.tilt;
    var curveValue = layout.billboard ? 0 : clamp(o.curve != null ? o.curve : layout.curve, 0, 1);
    var cardW = Math.max(40, o.cardWidth), cardH = cardW / clamp(o.aspectRatio, 0.2, 5);
    var along = axis === 'x' ? cardH : cardW;

    var n = Math.max(count, 3), pitch = (along + o.gap) * layout.spread;
    var chord = pitch / (2 * Math.sin(Math.PI / n)), arc = (n * pitch) / (2 * Math.PI);
    var radius = Math.max(chord + (arc - chord) * curveValue, along * 0.6);

    var s = {
      count: count, step: step, radius: radius, layout: layout, axis: axis, tilt: tiltValue,
      perspective: layout.inward ? radius : (o.perspective != null ? o.perspective : layout.perspective),
      cardW: cardW, cardH: cardH,
      intro: reduced ? 'none' : (o.intro in INTRO_LENGTH ? o.intro : 'rise'),
      autoplay: reduced ? 'off' : o.autoplay, speed: o.speed, interval: Math.max(0.5, o.interval),
      momentum: clamp(o.momentum, 0, 1), snap: o.snap, pauseOnHover: o.pauseOnHover,
      parallax: reduced ? 0 : clamp(o.parallax, 0, 1), stretch: reduced ? 0 : clamp(o.stretch, 0, 1),
      depthFade: clamp(o.depthFade, 0, 1)
    };

    /* tiles (curved strips) */
    var total = curveValue > 0.001 ? TILES : 1, tlen = along / total;
    var bend = curveValue > 0.001 ? radius / curveValue : 0;
    var tiles = [];
    for (var ti = 0; ti < total; ti++) {
      var start = ti * tlen - (ti > 0 ? OVERLAP / 2 : 0);
      var end = (ti + 1) * tlen + (ti < total - 1 ? OVERLAP / 2 : 0);
      var center = (start + end) / 2 - along / 2;
      var alpha = bend ? center / bend : 0;
      var shift = bend ? bend * Math.sin(alpha) : center;
      var sink = bend ? bend * (1 - Math.cos(alpha)) : 0;
      var depth = layout.inward ? sink : -sink;
      var turn = ((layout.inward ? -alpha : alpha) * 180) / Math.PI;
      var move = axis === 'x'
        ? 'translate3d(0px,' + shift + 'px,' + depth + 'px) rotateX(' + (-turn) + 'deg)'
        : 'translate3d(' + shift + 'px,0px,' + depth + 'px) rotateY(' + turn + 'deg)';
      tiles.push({ index: ti, total: total, start: start, end: end, size: end - start, move: move });
    }

    /* DOM */
    root.classList.add('circular-carousel');
    root.style.setProperty('--cc-fade', o.fadeColor);
    root.style.setProperty('--cc-radius', Math.max(0, o.cornerRadius) + 'px');
    root.style.setProperty('--cc-inner', (1 - clamp(o.innerShade, 0, 1)).toFixed(3));
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Family and friends carousel');
    root.tabIndex = 0;
    root.dataset.axis = axis; root.dataset.shape = shape;
    if (!reduced || true) root.setAttribute('data-draggable', '');
    root.innerHTML = '';
    var view = el('div', 'circular-carousel__view'), stage = el('div', 'circular-carousel__stage');
    var camera = el('div', 'circular-carousel__camera'), ring = el('div', 'circular-carousel__ring');
    root.appendChild(view); view.appendChild(stage); stage.appendChild(camera); camera.appendChild(ring);

    function renderTile(item, tile, back) {
      var strip = back ? tile.total - 1 - tile.index : tile.index;
      var first = strip === 0, last = strip === tile.total - 1, r = 'var(--cc-radius)';
      var fr = axis === 'x'
        ? (first ? r : 0) + ' ' + (first ? r : 0) + ' ' + (last ? r : 0) + ' ' + (last ? r : 0)
        : (first ? r : 0) + ' ' + (last ? r : 0) + ' ' + (last ? r : 0) + ' ' + (first ? r : 0);
      fr = fr.replace(/ 0/g, ' 0px').replace(/^0 /, '0px ');
      var offset = back ? along - tile.end : tile.start, size = tile.size;
      var box = axis === 'x'
        ? { left: -cardW / 2 + 'px', top: -size / 2 + 'px', width: cardW + 'px', height: size + 'px' }
        : { left: -size / 2 + 'px', top: -cardH / 2 + 'px', width: size + 'px', height: cardH + 'px' };
      box.transform = tile.move + (back ? (axis === 'x' ? ' rotateX(180deg)' : ' rotateY(180deg)') : '');
      var t = el('div', 'circular-carousel__tile', box);
      t.setAttribute('aria-hidden', 'true');
      var frame = el('div', 'circular-carousel__frame', { height: (axis === 'x' ? size : cardH) + 'px', borderRadius: fr });
      var img = el('img', 'circular-carousel__photo', axis === 'x'
        ? { left: '0px', top: -offset + 'px', width: cardW + 'px', height: cardH + 'px' }
        : { left: -offset + 'px', top: '0px', width: cardW + 'px', height: cardH + 'px' });
      img.src = item.src; img.alt = ''; img.draggable = false; img.decoding = 'async';
      if (item.position) img.style.objectPosition = item.position;
      frame.appendChild(img);
      if (back) frame.appendChild(el('div', 'circular-carousel__inner'));
      frame.appendChild(el('div', 'circular-carousel__shade'));
      t.appendChild(frame);
      return t;
    }

    var cards = items.map(function (item, index) {
      var c = el('div', 'circular-carousel__card');
      c.dataset.ccIndex = index;
      c.setAttribute('role', 'group');
      c.setAttribute('aria-label', (item.title || item.alt || 'Image') + ', ' + (index + 1) + ' of ' + count);
      tiles.forEach(function (t) { c.appendChild(renderTile(item, t, false)); });
      if (layout.backfaces) tiles.forEach(function (t) { c.appendChild(renderTile(item, t, true)); });
      ring.appendChild(c);
      return c;
    });

    /* state */
    var st = {
      angle: 0, velocity: 0, target: null, dir: (o.direction === 'right' ? 1 : -1) * (layout.inward ? -1 : 1),
      press: null, drag: false, hover: false, pointer: { inside: false, x: 0, y: 0 }, yaw: 0, pitch: 0,
      intro: null, introDone: false, holdUntil: 0, stepAt: 0, suppressClick: false, wheelTimer: 0,
      fit: 1, shift: 0, drop: 0, last: 0
    };
    var ready = false, raf = 0, visible = true, activeIdx = 0;
    var nearest = function (a) { return Math.round(a / step) * step; };

    function measure() {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var width = rect.width * 0.94, height = rect.height * 0.92, P = s.perspective;
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      if (layout.inward) {
        minX = -width / 2; maxX = width / 2; minY = -cardH / 2; maxY = cardH / 2;
      } else {
        var corners = [[-cardW / 2, -cardH / 2], [cardW / 2, -cardH / 2], [-cardW / 2, cardH / 2], [cardW / 2, cardH / 2]];
        var limit = layout.window ? layout.window * step : 180;
        for (var a = -limit; a <= limit; a += limit / 24) {
          for (var ci = 0; ci < 4; ci++) {
            var cx = corners[ci][0], cy = corners[ci][1], p;
            if (axis === 'x') p = rotateY(rotateX([cx, cy, radius], -a), tiltValue);
            else if (layout.billboard) { var c = rotateY([0, 0, radius], a); p = rotateX([c[0] + cx, cy, c[2]], tiltValue); }
            else p = rotateX(rotateY([cx, cy, radius], a), tiltValue);
            p = [p[0], p[1], p[2] - radius];
            if (p[2] >= P * 0.95) continue;
            var k = P / (P - p[2]);
            minX = Math.min(minX, p[0] * k); maxX = Math.max(maxX, p[0] * k);
            minY = Math.min(minY, p[1] * k); maxY = Math.max(maxY, p[1] * k);
          }
        }
      }
      var spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
      var fit = Math.min(1, width / spanX, height / spanY);
      st.fit = fit;
      st.shift = -((minY + maxY) / 2) * fit;
      st.drop = axis === 'x' ? (rect.width / fit) * 0.55 + cardW : (rect.height / fit) * 0.55 + cardH;
      stage.style.perspective = P + 'px';
      stage.style.transform = 'translate3d(0,' + st.shift + 'px,0) scale(' + fit + ')';
    }

    function introCard(elapsed, landing) {
      if (!st.intro) return { radius: 1, lift: 0 };
      var type = st.intro.type, reach = Math.abs(wrap(landing + st.angle)), p;
      if (type === 'assemble') { p = easeOut(clamp((elapsed - (reach / 180) * 420) / 1080, 0, 1)); return { radius: 1 + 0.6 * (1 - p), lift: 0 }; }
      if (type === 'rise') { p = easeOutQuint(clamp((elapsed - (reach / 180) * 480) / 900, 0, 1)); return { radius: 1, lift: (1 - p) * st.drop }; }
      if (type === 'spin') { p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1)); return { radius: 1 + 0.28 * (1 - p), lift: 0 }; }
      return { radius: 1, lift: 0 };
    }

    function advance(dt, now) {
      if (!st.introDone && ready) {
        if (!st.intro) {
          if (s.intro === 'none') st.introDone = true; else st.intro = { type: s.intro, start: now };
        }
        if (st.intro && now - st.intro.start >= INTRO_LENGTH[st.intro.type]) { st.intro = null; st.introDone = true; }
      }
      var paused = (s.pauseOnHover && st.hover) || st.drag || now < st.holdUntil;
      var cruise = s.autoplay === 'drift' && !paused && !st.intro ? s.speed * st.dir : 0;
      var busy = Boolean(st.intro) || st.drag;

      if (st.drag || st.intro) {
        st.velocity = st.drag ? st.velocity : 0;
      } else if (st.target !== null) {
        var remaining = dt, damping = 2 * Math.sqrt(SPRING);
        while (remaining > 0) {
          var h = Math.min(remaining, 1 / 240);
          st.velocity += (SPRING * (st.target - st.angle) - damping * st.velocity) * h;
          st.angle += st.velocity * h;
          remaining -= h;
        }
        if (Math.abs(st.target - st.angle) < 0.004 && Math.abs(st.velocity) < 0.03) { st.angle = st.target; st.velocity = 0; st.target = null; }
        busy = true;
      } else {
        var tau = 0.18 + s.momentum * 1.5;
        st.velocity += (cruise - st.velocity) * (1 - Math.exp(-dt / tau));
        st.angle += st.velocity * dt;
        if (cruise === 0 && s.snap && Math.abs(st.velocity) < SETTLE_SPEED) st.target = nearest(st.angle);
        busy = busy || cruise !== 0 || Math.abs(st.velocity) > 0.01 || st.target !== null;
      }

      if (s.autoplay === 'step' && !paused && !st.intro && st.introDone) {
        if (!st.stepAt) st.stepAt = now + s.interval * 1000;
        if (now >= st.stepAt) {
          st.target = (st.target !== null ? st.target : nearest(st.angle)) + step * st.dir;
          st.stepAt = now + s.interval * 1000;
        }
        busy = true;
      } else st.stepAt = 0;

      if (now < st.holdUntil) busy = true;

      var ease = 1 - Math.exp(-dt / 0.35);
      var aimYaw = st.pointer.inside ? st.pointer.x * s.parallax * 9 : 0;
      var aimPitch = st.pointer.inside ? -st.pointer.y * s.parallax * 6 : 0;
      st.yaw += (aimYaw - st.yaw) * ease;
      st.pitch += (aimPitch - st.pitch) * ease;
      if (Math.abs(aimYaw - st.yaw) > 0.01 || Math.abs(aimPitch - st.pitch) > 0.01) busy = true;
      return busy;
    }

    function render(now) {
      var elapsed = st.intro ? now - st.intro.start : 0;
      var swell = 1 + s.stretch * 0.12 * Math.min(1, Math.abs(st.velocity) / 420);
      var spinOffset = 0, p;
      if (st.intro && st.intro.type === 'spin') { p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1)); spinOffset = -300 * st.dir * (1 - p); }
      else if (st.intro && st.intro.type === 'assemble') { p = easeOut(clamp(elapsed / INTRO_LENGTH.assemble, 0, 1)); spinOffset = -32 * st.dir * (1 - p); }
      var angle = st.angle + spinOffset, R = radius * swell;

      if (axis === 'x') {
        camera.style.transform = 'translate3d(0,0,' + (-R) + 'px) rotateY(' + (tiltValue + st.yaw) + 'deg) rotateX(' + st.pitch + 'deg)';
        ring.style.transform = 'rotateX(' + (-angle) + 'deg)';
      } else if (layout.inward) {
        camera.style.transform = 'translate3d(0,0,' + (s.perspective - 1) + 'px) rotateX(' + (tiltValue + st.pitch) + 'deg) rotateY(' + st.yaw + 'deg)';
        ring.style.transform = 'rotateY(' + angle + 'deg)';
      } else {
        camera.style.transform = 'translate3d(0,0,' + (-R) + 'px) rotateX(' + (tiltValue + st.pitch) + 'deg) rotateY(' + st.yaw + 'deg)';
        ring.style.transform = 'rotateY(' + angle + 'deg)';
      }

      for (var i = 0; i < count; i++) {
        var card = cards[i], base = i * step, mod = introCard(elapsed, base), r = R * mod.radius, tr;
        if (axis === 'x') tr = 'rotateX(' + (-base) + 'deg) translateZ(' + r + 'px)';
        else if (layout.inward) tr = 'rotateY(' + base + 'deg) translateZ(' + (-r) + 'px)';
        else {
          tr = 'rotateY(' + base + 'deg) translateZ(' + r + 'px)';
          if (layout.billboard) tr += ' rotateY(' + (-(base + angle)) + 'deg)';
        }
        if (mod.lift) tr += axis === 'x' ? ' translateX(' + mod.lift + 'px)' : ' translateY(' + mod.lift + 'px)';
        card.style.transform = tr;
        var world = wrap(base + angle), facing = Math.cos(world * TO_RAD);
        if (layout.inward) card.style.visibility = Math.abs(world) > 86 ? 'hidden' : '';
        card.style.setProperty('--cc-depth', (s.depthFade * Math.pow((1 - facing) / 2, 1.25)).toFixed(3));
      }

      var idx = ((Math.round(-st.angle / step) % count) + count) % count || 0;
      if (idx !== activeIdx) { activeIdx = idx; if (o.onChange) o.onChange(idx, items[idx]); }
    }

    function frame(now) {
      raf = 0;
      var dt = st.last ? Math.min((now - st.last) / 1000, 0.05) : 1 / 60;
      st.last = now;
      var busy = advance(dt, now);
      render(now);
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame); else st.last = 0;
    }
    function wake() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }

    new ResizeObserver(function () { measure(); wake(); }).observe(root);
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; st.last = 0; }
    }).observe(root);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; st.last = 0; } else wake();
    });

    root.addEventListener('wheel', function (e) {
      var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (!delta) return;
      e.preventDefault();
      var perPixel = 180 / (Math.PI * radius * st.fit), sg = layout.inward ? -1 : 1;
      st.target = null;
      st.angle -= delta * perPixel * sg;
      st.velocity = -delta * perPixel * sg * 30;
      st.holdUntil = performance.now() + 1600;
      clearTimeout(st.wheelTimer);
      st.wheelTimer = setTimeout(function () {
        if (s.snap) st.target = nearest(st.angle + st.velocity * 0.12);
        wake();
      }, 140);
      wake();
    }, { passive: false });

    function focusIndex(index) {
      var target = -index * step;
      target += 360 * Math.round((st.angle - target) / 360);
      st.target = target; st.holdUntil = performance.now() + 2800; wake();
    }
    function stepBy(d) {
      var base = st.target !== null ? st.target : nearest(st.angle);
      st.target = base - d * step * (layout.inward ? -1 : 1);
      st.holdUntil = performance.now() + 2800; wake();
    }

    root.addEventListener('pointerdown', function (e) {
      st.suppressClick = false;
      if (e.button !== 0) return;
      st.press = { id: e.pointerId, x: e.clientX, y: e.clientY, angle: st.angle, moved: false, origin: 0, samples: [{ time: performance.now(), angle: st.angle }] };
    });
    root.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') {
        st.pointer.inside = true;
        var rect = root.getBoundingClientRect();
        st.pointer.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
        st.pointer.y = clamp(((e.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      }
      var press = st.press;
      if (!press || press.id !== e.pointerId) { wake(); return; }
      var delta = axis === 'x' ? e.clientY - press.y : e.clientX - press.x;
      var cross = axis === 'x' ? e.clientX - press.x : e.clientY - press.y;
      if (!press.moved) {
        if (Math.abs(delta) < DRAG_THRESHOLD) return;
        if (Math.abs(cross) > Math.abs(delta) * 1.2 && e.pointerType !== 'mouse') { st.press = null; return; }
        press.moved = true; press.origin = delta; st.drag = true; st.target = null; st.velocity = 0;
        root.setAttribute('data-dragging', '');
        try { root.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var perPixel = 180 / (Math.PI * radius * st.fit);
      st.angle = press.angle + (delta - press.origin) * perPixel * (layout.inward ? -1 : 1);
      var now = performance.now();
      press.samples.push({ time: now, angle: st.angle });
      while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift();
      wake();
    });
    function release(e) {
      var press = st.press;
      if (!press || press.id !== e.pointerId) return;
      st.press = null;
      if (!press.moved) return;
      st.drag = false; root.removeAttribute('data-dragging'); st.suppressClick = true;
      var first = press.samples[0], last = press.samples[press.samples.length - 1];
      var span = (last.time - first.time) / 1000;
      var v = span > 0.008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0;
      st.velocity = v;
      if (Math.abs(v) > 60) st.dir = Math.sign(v);
      var coasting = s.autoplay === 'drift' && !(s.pauseOnHover && st.hover && e.pointerType === 'mouse');
      if (s.snap && !coasting) st.target = Math.round((st.angle + v * (0.18 + s.momentum * 1.5) * 0.55) / step) * step;
      wake();
    }
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { st.hover = true; wake(); } });
    root.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse') { st.hover = false; st.pointer.inside = false; }
      wake();
    });
    root.addEventListener('click', function (e) {
      if (st.suppressClick) { st.suppressClick = false; return; }
      var card = e.target.closest && e.target.closest('[data-cc-index]');
      if (!card) return;
      var index = Number(card.getAttribute('data-cc-index'));
      if (o.focusOnClick) focusIndex(index);
      if (o.onItemClick) o.onItemClick(items[index], index);
    });
    root.addEventListener('keydown', function (e) {
      var fwd = axis === 'x' ? 'ArrowDown' : 'ArrowRight', back = axis === 'x' ? 'ArrowUp' : 'ArrowLeft';
      if (e.key === fwd) stepBy(1); else if (e.key === back) stepBy(-1);
      else if (e.key === 'Home') focusIndex(0); else if (e.key === 'End') focusIndex(count - 1);
      else return;
      e.preventDefault();
    });

    /* preload photos, then fade in and play the intro */
    function load(src) {
      return new Promise(function (res) { var im = new Image(); im.onload = res; im.onerror = res; im.src = src; });
    }
    Promise.race([Promise.all(items.map(function (i) { return load(i.src); })), new Promise(function (r) { setTimeout(r, 2400); })])
      .then(function () { ready = true; root.setAttribute('data-ready', ''); measure(); wake(); });

    measure(); render(performance.now()); wake();

    return { focus: focusIndex, next: function () { stepBy(1); }, prev: function () { stepBy(-1); }, wake: function () { measure(); wake(); }, restartIntro: function () { st.introDone = false; st.intro = null; wake(); } };
  };
})();
