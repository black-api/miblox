/* MIBLOX app shell — MIUI flavoured UI + game session glue */
(function () {
  'use strict';

  const ENGINE = window.MIBLOX_ENGINE;
  const STORE_KEY = 'miblox.profile.v1';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------- catalog */
  const EXPERIENCES = [
    {
      id: 'sky-obby', title: 'Sky Obby', tag: 'Obby', level: 'sky-obby',
      players: '12.4K', rating: '4.8', desc: 'Hop the floating islands. 10 coins.',
      grad: 'linear-gradient(150deg,#ffb347 0%,#ff5a3c 42%,#8b2fd6 100%)',
      art: ['#fff', '#ffd9a0', '#b06bff']
    },
    {
      id: 'coin-rush', title: 'Coin Rush', tag: 'Collect', level: 'coin-rush',
      players: '9.2K', rating: '4.7', desc: 'A ring of islands packed with coins.',
      grad: 'linear-gradient(150deg,#34e0b0 0%,#0f9bd7 55%,#0b4a8a 100%)',
      art: ['#eaffff', '#7ef2d6', '#22b8cf']
    },
    {
      id: 'neon-tower', title: 'Neon Tower', tag: 'Tower', level: 'neon-tower',
      players: '6.8K', rating: '4.9', desc: 'Climb the spiral. Don\u2019t look down.',
      grad: 'linear-gradient(150deg,#c084fc 0%,#7c3aed 45%,#2b1a63 100%)',
      art: ['#fbf5ff', '#d8b4fe', '#7dd3fc']
    },
    {
      id: 'lava-run', title: 'Lava Run', tag: 'Hard', level: 'lava-run',
      players: '4.1K', rating: '4.5', desc: 'Red-hot platforms, tight jumps.',
      grad: 'linear-gradient(150deg,#ffcf5c 0%,#ff5722 45%,#7f1d1d 100%)',
      art: ['#fff3e0', '#ffab91', '#ff7043']
    }
  ];

  const byId = {};
  EXPERIENCES.forEach(function (e) { byId[e.id] = e; });

  /* ---------------------------------------------------------------- storage */
  function defaults() {
    return {
      name: 'Player',
      credits: 250,
      coins: 0,
      clears: 0,
      look: { shirt: '#ff6900', pants: '#2b2f4a', skin: '#f2c9a0' },
      settings: { sound: true, shadows: true, haptics: true },
      progress: {}
    };
  }
  let profile = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      profile = Object.assign(defaults(), saved);
      profile.look = Object.assign(defaults().look, saved.look || {});
      profile.settings = Object.assign(defaults().settings, saved.settings || {});
      profile.progress = saved.progress || {};
    }
  } catch (e) { /* fresh profile */ }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(profile)); } catch (e) {}
  }

  /* ------------------------------------------------------------------ audio */
  const Sfx = {
    ctx: null,
    on: true,
    init: function () {
      if (!this.on) return;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.ctx = null; }
    },
    tone: function (from, to, dur, type, vol) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(from, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.09, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    coin: function () { this.tone(880, 1320, 0.12, 'triangle', 0.06); },
    jump: function () { this.tone(360, 640, 0.11, 'sawtooth', 0.035); },
    fall: function () { this.tone(320, 90, 0.3, 'sine', 0.07); },
    win: function () {
      const self = this;
      [0, 110, 220, 380].forEach(function (d, i) {
        setTimeout(function () { self.tone(520 + i * 160, 0, 0.18, 'triangle', 0.07); }, d);
      });
    }
  };
  Sfx.on = profile.settings.sound;

  function haptic(ms) {
    if (!profile.settings.haptics) return;
    if (navigator.vibrate) navigator.vibrate(ms || 12);
  }

  /* ------------------------------------------------------------------ toast */
  let toastT = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }
  let gToastT = 0;
  function gameToast(msg) {
    const el = $('#gameToast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(gToastT);
    gToastT = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }

  /* --------------------------------------------------------------- art bits */
  function artBlocks(exp, big) {
    const a = exp.art;
    const seed = exp.id.length + exp.title.length;
    const out = [];
    for (let i = 0; i < 5; i++) {
      const s = (big ? 54 : 34) + ((seed * (i + 3)) % 30);
      const x = ((seed * (i + 5)) % 70) + 6;
      const y = ((seed * (i + 2) * 7) % 55) - 4;
      out.push('<i style="width:' + s + 'px;height:' + s + 'px;left:' + x + '%;top:' + y + '%;background:' +
        a[i % a.length] + ';opacity:' + (0.2 + (i % 3) * 0.09) +
        ';transform:rotate(' + (18 + i * 13) + 'deg) skew(-6deg,-6deg)"></i>');
    }
    return out.join('');
  }

  function thumbHTML(exp, extraClass) {
    return '<div class="thumb ' + (extraClass || '') + '" style="background:' + exp.grad + '">' +
      '<div class="art">' + artBlocks(exp, false) + '</div>' +
      '<div class="shade"></div>' +
      '<span class="tag">' + exp.tag + '</span></div>';
  }

  /* ------------------------------------------------------------ home render */
  function renderHome() {
    const feat = byId['sky-obby'];
    $('#featuredCard').innerHTML =
      '<div class="featured" style="background:' + feat.grad + '">' +
        '<div class="art">' + artBlocks(feat, true) + '</div>' +
        '<div class="shade"></div>' +
        '<span class="badge">FEATURED TODAY</span>' +
        '<div class="meta"><span class="player-dots"><span></span>' + feat.players + ' playing</span>' +
          '<span>\u2605 ' + feat.rating + '</span></div>' +
        '<h3>' + feat.title + '</h3>' +
        '<p class="meta">' + feat.desc + '</p>' +
        '<div class="row">' +
          '<button class="play-pill" data-play="' + feat.id + '">' +
            '<svg viewBox="0 0 24 24"><path d="M7 4.5 20 12 7 19.5Z"/></svg>Play now</button>' +
          '<span class="meta small">' + feat.tag + ' \u00b7 Solo</span>' +
        '</div>' +
      '</div>';

    const others = EXPERIENCES.filter(function (e) { return e.id !== feat.id; });
    $('#continueRow').innerHTML = others.map(function (e) {
      const p = profile.progress[e.id] || 0;
      return '<button class="play-card" data-play="' + e.id + '">' +
        thumbHTML(e) +
        '<h4>' + e.title + '</h4>' +
        '<p>' + (p > 0 ? p + '% complete' : 'New \u00b7 not started') + '</p>' +
        (p > 0 ? '<div class="progress"><i style="width:' + p + '%"></i></div>' : '') +
        '</button>';
    }).join('');

    $('#topGrid').innerHTML = EXPERIENCES.map(function (e) {
      return '<button class="play-card" style="flex:1" data-play="' + e.id + '">' +
        thumbHTML(e) +
        '<h4>' + e.title + '</h4>' +
        '<p>\u2605 ' + e.rating + ' \u00b7 ' + e.players + '</p></button>';
    }).join('');

    $('#homeCredits').textContent = profile.credits;
  }

  function renderGames(filter, query) {
    const f = filter || 'all';
    const q = (query || '').toLowerCase().trim();
    const list = EXPERIENCES.filter(function (e) {
      const okTag = f === 'all' || e.tag.toLowerCase() === f;
      const okQ = !q || (e.title + ' ' + e.tag + ' ' + e.desc).toLowerCase().indexOf(q) >= 0;
      return okTag && okQ;
    });
    $('#allGames').innerHTML = list.length ? list.map(function (e) {
      const p = profile.progress[e.id] || 0;
      return '<button class="list-card" data-play="' + e.id + '">' +
        thumbHTML(e) +
        '<div class="lc-body"><h4>' + e.title + '</h4>' +
          '<div class="lc-meta"><span class="rat">\u2605 ' + e.rating + '</span>' +
          '<span>' + e.players + ' playing</span>' +
          (p ? '<span>' + p + '%</span>' : '') + '</div>' +
          '<p class="dim small" style="margin-top:5px">' + e.desc + '</p></div>' +
        '<div class="play-sm"><svg viewBox="0 0 24 24"><path d="M7 4.5 20 12 7 19.5Z"/></svg></div>' +
        '</button>';
    }).join('') : '<p class="dim" style="padding:22px 4px">Nothing matches that. Try another filter.</p>';
  }

  /* ---------------------------------------------------------- avatar render */
  const SHIRTS = ['#ff6900', '#22d3ee', '#8b5cf6', '#22c55e', '#f43f5e', '#f5f5f7', '#1f2937'];
  const PANTS = ['#2b2f4a', '#111827', '#4b2e83', '#0f766e', '#7c2d12', '#3f3f46'];
  const SKINS = ['#f2c9a0', '#d9a066', '#a86b3d', '#6b4226', '#ffd9b3', '#c68642'];

  function swatchRow(id, colors, key) {
    const wrap = $(id);
    wrap.innerHTML = colors.map(function (c) {
      return '<button class="sw ' + (profile.look[key] === c ? 'on' : '') + '" data-key="' + key +
        '" data-color="' + c + '" style="background:' + c + '"></button>';
    }).join('');
    wrap.onclick = function (ev) {
      const b = ev.target.closest('.sw');
      if (!b) return;
      profile.look[key] = b.dataset.color;
      $$('.sw', wrap).forEach(function (s) { s.classList.toggle('on', s === b); });
      if (preview) preview.setLook(profile.look);
      haptic(8);
    };
  }

  function renderAvatar() {
    swatchRow('#swShirt', SHIRTS, 'shirt');
    swatchRow('#swPants', PANTS, 'pants');
    swatchRow('#swSkin', SKINS, 'skin');
    $('#avCredits').textContent = profile.credits;
  }

  /* --------------------------------------------------------------- profile */
  function renderProfile() {
    $('#profileName').textContent = profile.name;
    $('#profileLvl').textContent = Math.max(1, Math.floor(profile.credits / 400) + 1);
    $('#statCredits').textContent = profile.credits;
    $('#statCoins').textContent = profile.coins;
    $('#statClears').textContent = profile.clears;
    syncToggles();
  }

  function syncToggles() {
    $('#tgSound').classList.toggle('on', !!profile.settings.sound);
    $('#tgShadows').classList.toggle('on', !!profile.settings.shadows);
    $('#tgHaptics').classList.toggle('on', !!profile.settings.haptics);
    $('#soundBtn').classList.toggle('muted', !profile.settings.sound);
  }

  /* ------------------------------------------------------------ navigation */
  let currentTab = 'home';
  function go(tab) {
    currentTab = tab;
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    const el = $('#screen-' + tab);
    if (el) el.classList.add('active');
    $$('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === tab); });
    $('#main').scrollTop = 0;
    if (tab === 'home') renderHome();
    if (tab === 'profile') renderProfile();
    if (tab === 'avatar') {
      renderAvatar();
      ensurePreview();
    }
  }

  let preview = null;
  function ensurePreview() {
    if (preview) { preview.setLook(profile.look); return; }
    try {
      preview = ENGINE.createAvatarPreview($('#avatarCanvas'), profile.look);
    } catch (e) {
      $('#avatarCanvas').style.display = 'none';
      toast('3D preview unavailable on this device');
    }
  }

  /* ------------------------------------------------------------- game flow */
  let game = null;
  let activeExp = null;
  let hudTimer = 0;
  let playing = false;

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function openGame(exp) {
    if (!exp || playing) return;
    Sfx.init();
    activeExp = exp;
    playing = true;
    $('#game').classList.remove('hidden');
    $('#result').classList.add('hidden');
    $('#worldName').textContent = exp.title;
    $('#hudCoins').textContent = '0';
    $('#hudTotal').textContent = '/ ' + (ENGINE.LEVELS[exp.level].coins || []).length;
    $('#hudTimer').textContent = '0:00';
    $$('.joy .knob').forEach(function (k) { k.style.transform = ''; });

    game = ENGINE.createGame($('#scene'), {
      levelId: exp.level,
      look: profile.look,
      shadows: profile.settings.shadows,
      onCoin: function (n, total) {
        Sfx.coin(); haptic(10);
        $('#hudCoins').textContent = n;
        if (n === total) gameToast('All coins!');
      },
      onFall: function () {
        Sfx.fall();
        gameToast('Watch your step');
      },
      onWin: function (res) {
        finishLevel(res);
      }
    });
    game.start();

    clearInterval(hudTimer);
    hudTimer = setInterval(function () {
      if (!game) return;
      const st = game.state();
      $('#hudCoins').textContent = st.coins;
      $('#hudTimer').textContent = fmt(st.time);
    }, 250);
  }

  function closeGame() {
    if (!playing) return;
    clearInterval(hudTimer);
    if (game) { game.stop(); game = null; }
    playing = false;
    activeExp = null;
    $('#game').classList.add('hidden');
    $('#result').classList.add('hidden');
    renderHome(); renderGames(activeFilter, $('#gameSearch').value);
  }

  function finishLevel(res) {
    if (!activeExp) return;
    const credits = Math.max(40, res.coins * 15 + Math.max(0, Math.floor(120 - res.time * 2)));
    profile.credits += credits;
    profile.coins += res.coins;
    profile.clears += 1;
    profile.progress[activeExp.id] = 100;
    save();
    renderProfile();
    Sfx.win(); haptic([18, 40, 22]);

    $('#resultEyebrow').textContent = 'WORLD CLEARED';
    $('#resultTitle').textContent = 'Nice run!';
    $('#resultSub').textContent = activeExp.title + ' \u00b7 every coin collected';
    $('#resCoins').textContent = res.coins;
    $('#resTime').textContent = fmt(res.time);
    $('#resCredits').textContent = '+' + credits;
    $('#result').classList.remove('hidden');
    $$('.joy .knob').forEach(function (k) { k.style.transform = ''; });
  }

  $('#againBtn').addEventListener('click', function () {
    const exp = activeExp;
    closeGame();
    setTimeout(function () { openGame(exp); }, 90);
  });
  $('#backBtn').addEventListener('click', closeGame);
  $('#exitGame').addEventListener('click', closeGame);
  $('#resetGame').addEventListener('click', function () {
    if (game) { game.respawn(); gameToast('Respawned'); }
  });

  /* --------------------------------------------------------------- controls */
  function bindJoystick() {
    const joy = $('#joy');
    const knob = $('.knob', joy);
    let id = null, cx = 0, cy = 0;
    const R = 44;

    joy.addEventListener('pointerdown', function (e) {
      if (!playing) return;
      id = e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      joy.setPointerCapture(id);
      move(e);
    });
    joy.addEventListener('pointermove', function (e) {
      if (id === e.pointerId) move(e);
    });
    function end(e) {
      if (id !== e.pointerId) return;
      id = null;
      knob.style.transform = '';
      if (game) game.setAxis(0, 0);
    }
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    function move(e) {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      if (game) game.setAxis(dx / R, -dy / R);
    }
  }

  function bindLook() {
    const c = $('#scene');
    let id = null, lx = 0, ly = 0;
    c.addEventListener('pointerdown', function (e) {
      id = e.pointerId; lx = e.clientX; ly = e.clientY;
      c.setPointerCapture(id);
    });
    c.addEventListener('pointermove', function (e) {
      if (id !== e.pointerId || !game) return;
      game.orbit(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
    });
    function up(e) { if (id === e.pointerId) id = null; }
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }

  function bindJump() {
    const b = $('#jumpBtn');
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!game) return;
      game.jump(); Sfx.jump(); haptic(14);
    });
  }

  function bindKeys() {
    const down = {};
    function apply() {
      if (!game) return;
      const x = (down['d'] || down['arrowright'] ? 1 : 0) - (down['a'] || down['arrowleft'] ? 1 : 0);
      const z = (down['w'] || down['arrowup'] ? 1 : 0) - (down['s'] || down['arrowdown'] ? 1 : 0);
      game.setAxis(x, z);
    }
    window.addEventListener('keydown', function (e) {
      if (!playing) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'spacebar') {
        e.preventDefault();
        if (game) { game.jump(); Sfx.jump(); }
        return;
      }
      if (k === 'escape') { closeGame(); return; }
      down[k] = true; apply();
    });
    window.addEventListener('keyup', function (e) {
      down[e.key.toLowerCase()] = false; apply();
    });
  }

  /* ------------------------------------------------------------ app events */
  let activeFilter = 'all';

  function bindUI() {
    $('#tabbar').addEventListener('click', function (e) {
      const t = e.target.closest('.tab');
      if (t) go(t.dataset.tab);
    });

    document.addEventListener('click', function (e) {
      const goto = e.target.closest('[data-goto]');
      if (goto) { go(goto.dataset.goto); return; }
      const play = e.target.closest('[data-play]');
      if (play) { openGame(byId[play.dataset.play]); return; }
    });

    $('#avatarBtn').addEventListener('click', function () { go('profile'); });
    $('#homeSearch').addEventListener('click', function () {
      go('games');
      setTimeout(function () { $('#gameSearch').focus(); }, 220);
    });

    $('#filterChips').addEventListener('click', function (e) {
      const c = e.target.closest('.chip');
      if (!c) return;
      activeFilter = c.dataset.filter;
      $$('.chip').forEach(function (x) { x.classList.toggle('on', x === c); });
      renderGames(activeFilter, $('#gameSearch').value);
    });
    $('#gameSearch').addEventListener('input', function (e) {
      renderGames(activeFilter, e.target.value);
    });

    $('#soundBtn').addEventListener('click', function () {
      profile.settings.sound = !profile.settings.sound;
      Sfx.on = profile.settings.sound;
      if (Sfx.on) { Sfx.init(); Sfx.coin(); }
      syncToggles(); save();
      toast(Sfx.on ? 'Sound on' : 'Sound off');
    });

    $('#tgSound').addEventListener('click', function () {
      profile.settings.sound = !profile.settings.sound;
      Sfx.on = profile.settings.sound;
      if (Sfx.on) { Sfx.init(); Sfx.coin(); }
      syncToggles(); save(); haptic(10);
    });
    $('#tgShadows').addEventListener('click', function () {
      profile.settings.shadows = !profile.settings.shadows;
      syncToggles(); save(); haptic(10);
      toast(profile.settings.shadows ? 'Shadows on' : 'Shadows off');
    });
    $('#tgHaptics').addEventListener('click', function () {
      profile.settings.haptics = !profile.settings.haptics;
      syncToggles(); save();
      if (profile.settings.haptics) haptic(16);
    });

    $('#saveLook').addEventListener('click', function () {
      save();
      toast('Look saved');
      Sfx.coin(); haptic(12);
    });

    $('#passBtn').addEventListener('click', function () {
      toast('Hyper Pass coming in the next build');
    });
  }

  /* ----------------------------------------------------------- android back */
  window.MIBLOX = {
    version: '1.0.0',
    state: function () { return game ? game.state() : null; },
    profile: function () { return profile; },
    onBack: function () {
      if (playing) {
        if (!$('#result').classList.contains('hidden')) { closeGame(); return true; }
        closeGame();
        return true;
      }
      if (currentTab !== 'home') { go('home'); return true; }
      return false;
    }
  };

  if (/[?&]debug=1/.test(location.search)) {
    window.MIBLOX.debugWin = function () {
      if (!playing || !activeExp) return false;
      finishLevel({ coins: 10, time: 42.5 });
      return true;
    };
    window.MIBLOX.debugState = function () { return game ? game.state() : null; };
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    renderHome();
    renderGames('all', '');
    renderAvatar();
    renderProfile();
    bindUI();
    bindJoystick();
    bindLook();
    bindJump();
    bindKeys();

    setTimeout(function () {
      $('#splash').classList.add('gone');
      $('#app').classList.add('ready');
    }, 1150);

    window.addEventListener('resize', function () {
      if (game) game.resize();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
