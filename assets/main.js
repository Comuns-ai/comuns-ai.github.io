/* Comuns landing page: scroll reveals and the hero mesh. No dependencies, no network. */
(function () {
  'use strict';

  // Without matchMedia, treat motion as allowed and subscribe to nothing.
  var reduceMotion = { matches: false };
  try {
    if (typeof window.matchMedia === 'function') {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)') || reduceMotion;
    }
  } catch (err) { /* keep the default */ }

  // Mark that scripts run: the CSS hides reveal targets only under .js.
  document.documentElement.classList.add('js');

  // Subscribe to the reduced-motion query where the browser allows it; .matches is read at load either way.
  function onMotionChange(fn) {
    try {
      if (typeof reduceMotion.addEventListener === 'function') {
        reduceMotion.addEventListener('change', fn);
      } else if (typeof reduceMotion.addListener === 'function') {
        reduceMotion.addListener(fn);
      }
    } catch (err) { /* no subscription; the load-time value stands */ }
  }

  /* ---------------------------------------------------------------------
   * Scroll reveals: add .is-visible once, when an element enters the view.
   * ------------------------------------------------------------------- */
  function setupReveals() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    function showAll() {
      items.forEach(function (el) { el.classList.add('is-visible'); });
    }
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      showAll();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
    onMotionChange(function (e) {
      if (e.matches) { io.disconnect(); showAll(); }
    });
  }

  /* ---------------------------------------------------------------------
   * Hero mesh: wallets on the left, relays in the middle, nodes on the right.
   * Encrypted prompts travel wallet -> relay -> node; sealed answers return.
   * ------------------------------------------------------------------- */
  function setupHero() {
    var canvas = document.getElementById('hero-canvas');
    if (!canvas || !canvas.getContext) { return; }
    var ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    var COLOR_LINK = '11, 95, 110';     // teal
    var COLOR_PROMPT = '127, 208, 220'; // teal tint: encrypted prompt
    var COLOR_ANSWER = '242, 230, 200'; // warm paper: sealed answer
    var FRAME_MS = 1000 / 48;           // frame-rate cap

    var width = 0, height = 0, dpr = 1;
    var wallets = [], relays = [], servers = [], all = [], links = [], packets = [];
    var running = false, pageVisible = !document.hidden, inView = true;
    var rafId = 0, lastTime = 0, clock = 0, spawnTimer = 0;
    var seedRand = mulberry32(20261012);

    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function rand(min, max) { return min + seedRand() * (max - min); }

    function makeNode(kind, xMin, xMax) {
      return {
        kind: kind,
        hx: rand(xMin, xMax) * width,
        hy: rand(0.08, 0.92) * height,
        x: 0, y: 0,
        amp: rand(4, 11),
        speed: rand(0.00012, 0.00028),
        phase: rand(0, Math.PI * 2),
        radius: kind === 'wallet' ? rand(2, 3) : kind === 'relay' ? rand(3.5, 4.5) : rand(5, 7),
        glow: 0
      };
    }

    function nearest(node, pool, count) {
      return pool.slice().sort(function (a, b) {
        return dist2(node, a) - dist2(node, b);
      }).slice(0, count);
    }
    function dist2(a, b) { var dx = a.hx - b.hx, dy = a.hy - b.hy; return dx * dx + dy * dy; }

    function build() {
      seedRand = mulberry32(20261012);
      var total = Math.max(16, Math.min(64, Math.round(width * height / 17000)));
      var nWallet = Math.round(total * 0.4);
      var nRelay = Math.max(3, Math.round(total * 0.22));
      var nServer = Math.max(4, total - nWallet - nRelay);
      wallets = []; relays = []; servers = []; links = []; packets = [];
      var i;
      for (i = 0; i < nWallet; i++) { wallets.push(makeNode('wallet', 0.03, 0.34)); }
      for (i = 0; i < nRelay; i++) { relays.push(makeNode('relay', 0.42, 0.60)); }
      for (i = 0; i < nServer; i++) { servers.push(makeNode('server', 0.68, 0.98)); }
      all = wallets.concat(relays, servers);

      wallets.forEach(function (w) {
        w.routes = nearest(w, relays, 2);
        w.routes.forEach(function (r) { links.push({ a: w, b: r, strong: true }); });
      });
      relays.forEach(function (r) {
        r.routes = nearest(r, servers, 3);
        r.routes.forEach(function (s) { links.push({ a: r, b: s, strong: true }); });
      });
      // A faint mesh among neighbours of the same column, for texture.
      [wallets, relays, servers].forEach(function (group) {
        group.forEach(function (n) {
          nearest(n, group.filter(function (m) { return m !== n; }), 2).forEach(function (m) {
            links.push({ a: n, b: m, strong: false });
          });
        });
      });
      all.forEach(function (n) { n.x = n.hx; n.y = n.hy; });
      // Pre-seed a few packets so the first frame is not empty.
      for (i = 0; i < Math.max(2, Math.round(total / 8)); i++) {
        var p = spawn();
        if (p) { p.t = seedRand(); p.leg = Math.floor(seedRand() * 3); }
      }
    }

    function spawn() {
      if (!wallets.length) { return null; }
      var w = wallets[Math.floor(seedRand() * wallets.length)];
      var r = w.routes[Math.floor(seedRand() * w.routes.length)];
      if (!r || !r.routes.length) { return null; }
      var s = r.routes[Math.floor(seedRand() * r.routes.length)];
      var p = {
        path: [w, r, s],
        leg: 0,          // 0: wallet->relay, 1: relay->server, 2: hold, 3: server->relay, 4: relay->wallet
        t: 0,
        speed: rand(0.00055, 0.0009),
        hold: rand(500, 1100),
        answer: false
      };
      packets.push(p);
      return p;
    }

    function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function update(dt) {
      clock += dt;
      var i, n;
      for (i = 0; i < all.length; i++) {
        n = all[i];
        n.x = n.hx + Math.sin(clock * n.speed + n.phase) * n.amp;
        n.y = n.hy + Math.cos(clock * n.speed * 0.8 + n.phase) * n.amp;
        if (n.glow > 0) { n.glow = Math.max(0, n.glow - dt / 700); }
      }
      spawnTimer -= dt;
      var target = Math.max(2, Math.round(all.length / 7));
      if (spawnTimer <= 0 && packets.length < target) {
        spawn();
        spawnTimer = rand(250, 700);
      }
      for (i = packets.length - 1; i >= 0; i--) {
        var p = packets[i];
        if (p.leg === 2) {
          p.t += dt;
          if (p.t >= p.hold) { p.leg = 3; p.t = 0; p.answer = true; }
          continue;
        }
        p.t += dt * p.speed;
        if (p.t >= 1) {
          p.t = 0;
          var arrived = legEnd(p);
          arrived.glow = 1;
          p.leg += 1;
          if (p.leg === 2) { p.t = 0; }
          if (p.leg > 4) { packets.splice(i, 1); }
        }
      }
    }

    function legEnd(p) {
      switch (p.leg) {
        case 0: return p.path[1];
        case 1: return p.path[2];
        case 3: return p.path[1];
        default: return p.path[0];
      }
    }
    function legStart(p) {
      switch (p.leg) {
        case 0: return p.path[0];
        case 1: return p.path[1];
        case 3: return p.path[2];
        default: return p.path[1];
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      var i;
      // Links
      ctx.lineWidth = 1;
      for (i = 0; i < links.length; i++) {
        var l = links[i];
        ctx.strokeStyle = 'rgba(' + COLOR_LINK + ', ' + (l.strong ? 0.42 : 0.16) + ')';
        ctx.beginPath();
        ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.b.x, l.b.y);
        ctx.stroke();
      }
      // Nodes
      for (i = 0; i < all.length; i++) {
        var n = all[i];
        if (n.glow > 0) {
          ctx.fillStyle = 'rgba(' + COLOR_PROMPT + ', ' + (0.28 * n.glow) + ')';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 9 * n.glow, 0, Math.PI * 2);
          ctx.fill();
        }
        if (n.kind === 'relay') {
          ctx.strokeStyle = 'rgba(' + COLOR_PROMPT + ', 0.85)';
          ctx.lineWidth = 1.5;
          ctx.fillStyle = 'rgba(11, 20, 24, 1)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (n.kind === 'server') {
          ctx.fillStyle = 'rgba(' + COLOR_LINK + ', 0.95)';
          ctx.strokeStyle = 'rgba(' + COLOR_PROMPT + ', 0.9)';
          ctx.lineWidth = 1.5;
          roundRect(n.x - n.radius, n.y - n.radius, n.radius * 2, n.radius * 2, 2.5);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(' + COLOR_PROMPT + ', 0.7)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Packets
      for (i = 0; i < packets.length; i++) {
        var p = packets[i];
        if (p.leg === 2) { continue; }
        var a = legStart(p), b = legEnd(p), t = ease(Math.min(1, p.t));
        var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        var col = p.answer ? COLOR_ANSWER : COLOR_PROMPT;
        // Trail
        var tx = a.x + (b.x - a.x) * Math.max(0, t - 0.1), ty = a.y + (b.y - a.y) * Math.max(0, t - 0.1);
        ctx.strokeStyle = 'rgba(' + col + ', 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        // Glow
        ctx.fillStyle = 'rgba(' + col + ', 0.18)';
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(' + col + ', 0.45)';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        // Core: a small sealed square
        ctx.fillStyle = 'rgba(' + col + ', 1)';
        roundRect(x - 2.5, y - 2.5, 5, 5, 1);
        ctx.fill();
      }
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function frame(now) {
      if (!running) { return; }
      rafId = window.requestAnimationFrame(frame);
      if (now - lastTime < FRAME_MS) { return; }
      var dt = Math.min(now - lastTime, 80);
      lastTime = now;
      update(dt);
      draw();
    }

    function stillFrame() {
      // One static frame for reduced motion: advance a little so packets sit mid-path.
      update(16);
      draw();
    }

    function start() {
      if (running) { return; }
      running = true;
      lastTime = window.performance.now();
      rafId = window.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
    }
    // Pause/play control (WCAG 2.2.2). Created here so it never appears without scripts.
    var hasObserver = 'IntersectionObserver' in window;
    var userPaused = false;
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'hero-toggle';
    toggle.textContent = 'Pause animation';
    toggle.addEventListener('click', function () {
      userPaused = !userPaused;
      sync();
    });
    canvas.parentNode.appendChild(toggle);

    function updateToggle() {
      // Nothing moves under reduced motion or without an observer, so there is nothing to control.
      toggle.hidden = reduceMotion.matches || !hasObserver;
      toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    }

    function sync() {
      updateToggle();
      if (reduceMotion.matches || !hasObserver || userPaused) { stop(); stillFrame(); return; }
      if (pageVisible && inView) { start(); } else { stop(); }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === width && h === height && canvas.width === Math.round(w * dpr)) { return; }
      width = w; height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (!running) { stillFrame(); }
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 120);
    });
    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
      sync();
    });
    if (hasObserver) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0.05 }).observe(canvas);
    }
    onMotionChange(sync);

    resize();
    sync();
  }

  function init() {
    try { setupReveals(); } catch (err) { /* the CSS shows everything without .is-visible only when .js is absent; so uncover now */
      document.documentElement.classList.remove('js');
    }
    try { setupHero(); } catch (err) { /* the hero text stands on its own */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
