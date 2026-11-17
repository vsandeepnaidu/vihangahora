/* Vihanga Hora teaching site: theme, navigation, and the live tools. */
(function () {
  'use strict';
  var doc = document.documentElement, ROOT = doc.dataset.root || '', P = window.Pakshi;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var store = {
    get: function (k, d) { try { return localStorage.getItem('fb.' + k) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('fb.' + k, v); } catch (e) { /* private mode */ } }
  };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ---- theme and navigation ----
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = doc.dataset.theme === 'dark' ? 'light' : 'dark';
      doc.dataset.theme = next; store.set('theme', next);
    });
  });
  var menu = $('.menu-btn'), nav = $('.nav');
  if (menu) menu.addEventListener('click', function () {
    var open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', open);
  });
  var top = $('.top');
  // The course menu starts closed on phones, where it sits above the lesson.
  if (window.matchMedia('(max-width: 900px)').matches) $$('.side details').forEach(function (d) { d.open = false; });
  var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  } else { $$('.reveal').forEach(function (el) { el.classList.add('in'); }); }

  // ---- tabs: <div data-tabs> with buttons[data-show] and [data-panel] ----
  $$('[data-tabs]').forEach(function (box) {
    var btns = $$('[data-show]', box), panels = $$('[data-panel]', box);
    var show = function (id) {
      btns.forEach(function (b) { b.setAttribute('aria-selected', b.dataset.show === id); });
      panels.forEach(function (p) { p.hidden = p.dataset.panel !== id; });
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.show); }); });
    show(btns[0].dataset.show);
  });

  // ---- lesson progress: a tick beside each lesson whose question was answered ----
  var done = {};
  try { done = JSON.parse(store.get('done', '{}')) || {}; } catch (e) { done = {}; }
  var markDone = function () {
    $$('a[data-lesson]').forEach(function (a) {
      if (done[a.dataset.lesson]) { a.classList.add('done'); a.setAttribute('title', 'Completed'); }
    });
  };
  markDone();

  // ---- quiz: <div data-quiz> with buttons[data-ok] and a [data-fb] line ----
  $$('[data-quiz]').forEach(function (box) {
    var fb = $('[data-fb]', box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ok]'); if (!b) return;
      var ok = b.dataset.ok === '1';
      $$('button', box).forEach(function (x) { x.classList.remove('right', 'wrong'); x.setAttribute('aria-pressed', x === b); });
      b.classList.add(ok ? 'right' : 'wrong');
      fb.hidden = false; fb.className = 'fb ' + (ok ? 'right' : 'wrong');
      fb.textContent = ok ? box.dataset.why : 'Not quite. Have another look and try again.';
      if (ok && box.dataset.quiz) { done[box.dataset.quiz] = 1; store.set('done', JSON.stringify(done)); markDone(); }
    });
  });

  if (!P) return;
  var T = P.tables;
  var img = function (kind, bird, act) { return ROOT + 'assets/img/' + kind + '/' + bird.toLowerCase() + '_' + act + '.webp'; };

  // ---- time helpers ----
  function fmt(sec) {
    var s = ((sec % 86400) + 86400) % 86400, h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return ((h + 11) % 12 + 1) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function hm(v) { var p = v.split(':'); return p[0] * 3600 + p[1] * 60; }
  function settings() {
    return {
      bird: store.get('bird', 'Peacock'), mode: store.get('mode', 'six'),
      rise: store.get('rise', '06:00'), set: store.get('set', '18:00'), half: store.get('half', 'auto'),
      lat: store.get('lat', ''), lon: store.get('lon', '')
    };
  }
  // ponytail: tomorrow's sunrise is taken as today's plus 24 h, and clock
  // changes (DST) inside a day are ignored. The app uses real frames.
  function dayFor(civil, bird, s) {
    var rise = 21600, set = 64800, end = 0, mode = 'six';
    if (s.mode === 'custom' && hm(s.set) > hm(s.rise)) { rise = hm(s.rise); set = hm(s.set); mode = 'custom'; }
    if (s.mode === 'place' && s.lat !== '') {
      var st = P.sunTimes(civil, +s.lat, +s.lon);
      var nx = P.sunTimes(new Date(civil.getFullYear(), civil.getMonth(), civil.getDate() + 1), +s.lat, +s.lon);
      if (st && nx) { rise = st.rise; set = st.set; end = nx.rise + 86400; mode = 'place'; }
    }
    var moon = P.moonHalf(new Date(civil.getTime() + rise * 1000));
    var paksha = s.half === 'auto' ? moon.paksha : s.half;
    var wd = P.jsWeekdays[civil.getDay()];
    return {
      civil: civil, rise: rise, set: set, end: end || rise + 86400, mode: mode, paksha: paksha, moon: moon, wd: wd,
      rows: P.birdDay(paksha, wd, bird, rise, set, end || rise + 86400)
    };
  }
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function nowFor(bird, s) {
    var now = new Date(), civil = midnight(now), sec = Math.floor((now - civil) / 1000);
    var d = dayFor(civil, bird, s);
    if (sec < d.rise) { // before sunrise: still the previous day's night
      civil = new Date(civil.getFullYear(), civil.getMonth(), civil.getDate() - 1);
      d = dayFor(civil, bird, s); sec += 86400;
    }
    d.sec = sec;
    d.cur = d.rows.filter(function (r) { return r.start <= sec && sec < r.end; })[0];
    return d;
  }
  var WEEKDAY = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
  var REL = { own: 'Own turn', friend: 'Friend', enemy: 'Enemy', unknown: 'Neutral' };

  // ---- the Now card ----
  function nowCard(d, bird) {
    var c = d.cur; if (!c) return '';
    var slot = d.rows.filter(function (r) { return r.part === c.part && r.yama === c.yama; });
    var left = Math.max(1, Math.ceil((c.end - d.sec) / 60));
    var strip = slot.map(function (r) {
      var on = r === c, pos = on ? Math.round(100 * (d.sec - r.start) / (r.end - r.start)) : 0;
      return '<i data-act="' + r.activity + '" class="' + (on ? 'now' : '') + '" style="flex:' + (r.end - r.start) + '"' +
        ' title="' + cap(r.activity) + ' turn, ' + fmt(r.start) + ' to ' + fmt(r.end) + '">' + (on ? '<b style="left:' + pos + '%"></b>' : '') + '</i>';
    }).join('');
    var share = c.relation === 'own'
      ? '<span class="chip frost">Your own turn</span>'
      : '<img src="' + img('avatars', c.lord, c.activity) + '" alt="" width="28" height="28"><span class="chip frost">with ' + c.lord + '</span>' +
        '<span class="chip ' + c.relation + '">' + REL[c.relation] + '</span>';
    var day = c.dayStatus === 'ruling' ? '<span class="chip rule">Ruling ' + c.part + '</span>'
      : c.dayStatus === 'death' ? '<span class="chip death">Death day</span>' : '';
    return '<article class="now-card" data-act="' + c.main + '" aria-live="polite">' +
      '<div class="now-top"><img class="now-art" src="' + img('birds', bird, c.main) + '" width="132" height="132" alt="' + bird + ', ' + c.main + '">' +
      '<div><p class="eyebrow">Now · ' + bird + '</p><h3>' + cap(c.main) + ' slot</h3>' +
      '<p class="slotline">Slot ' + c.yama + ' of the ' + c.part + ' · until ' + fmt(slot[4].end) + '</p></div></div>' +
      '<div class="turnstrip" role="img" aria-label="The five turns of this slot">' + strip + '</div>' +
      '<p class="turnline"><span>Turn ' + c.sub + ' of 5 · ' + cap(c.activity) + '</span><span class="tnum">' + left + ' min left</span></p>' +
      '<div class="now-chips">' + share + '<span class="chip ' + c.grade + '">' + cap(c.grade) + '</span>' + day + '</div></article>';
  }
  function picker(bird) {
    return '<div class="picker" role="group" aria-label="Choose a bird">' + P.birds.map(function (b) {
      return '<button type="button" data-bird="' + b + '" aria-pressed="' + (b === bird) + '"><img src="' + img('avatars', b, 'ruling') + '" alt="" width="32" height="32">' + b + '</button>';
    }).join('') + '</div>';
  }
  function basis(d, s) {
    return cap(d.paksha) + ' half' + (s.half === 'auto' ? ' (estimated)' : '') + ' · ' + WEEKDAY[d.wd] +
      ' · ' + (d.mode === 'six' ? '6-to-6 reckoning' : 'sunrise ' + fmt(d.rise));
  }

  $$('[data-now]').forEach(function (box) {
    var draw = function () {
      var s = settings(), d = nowFor(s.bird, s);
      box.innerHTML = picker(s.bird) + nowCard(d, s.bird) +
        '<p class="now-note">' + basis(d, s) + '. <a href="' + ROOT + 'today.html">Set sunrise and see the whole day</a></p>';
    };
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bird]'); if (!b) return;
      store.set('bird', b.dataset.bird); draw();
    });
    draw(); setInterval(draw, 30000);
  });

  // ---- the Today tool ----
  $$('[data-tool]').forEach(function (box) {
    var out = $('[data-out]', box), dateIn = $('#t-date', box), riseIn = $('#t-rise', box), setIn = $('#t-set', box);
    var iso = function (d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
    var s0 = settings();
    dateIn.value = iso(new Date()); riseIn.value = s0.rise; setIn.value = s0.set;

    function slots(d, part, live) {
      var html = '';
      for (var y = 1; y <= 5; y++) {
        var rows = d.rows.filter(function (r) { return r.part === part && r.yama === y; });
        var isNow = live && rows.indexOf(live) >= 0;
        html += '<details data-act="' + rows[0].main + '"' + (isNow ? ' open class="now"' : '') + '><summary><b>' + cap(rows[0].main) +
          (isNow ? ' <span class="chip">Now</span>' : '') + '</b><span>Slot ' + y + ' · ' + fmt(rows[0].start) + ' – ' + fmt(rows[4].end) + '</span>' +
          '<div class="ministrip">' + rows.map(function (r) { return '<i data-act="' + r.activity + '" style="flex:' + (r.end - r.start) + '"></i>'; }).join('') + '</div></summary><ol class="turns">' +
          rows.map(function (r) {
            return '<li class="' + (r === live ? 'now' : '') + '"><span class="t">' + fmt(r.start) + ' – ' + fmt(r.end) + '</span>' +
              '<span><span class="act act-' + r.subCode + '">' + cap(r.activity) + '</span><em>' +
              (r.relation === 'own' ? 'own turn' : 'with ' + r.lord + (r.relation === 'unknown' ? '' : ', ' + r.relation)) + '</em></span>' +
              '<span class="chip ' + r.grade + '">' + cap(r.grade) + '</span></li>';
          }).join('') + '</ol></details>';
      }
      return '<div class="slotlist">' + html + '</div>';
    }
    function status(d, bird) {
      var day = P.dayStatus(d.paksha, 'day', d.wd, bird), night = P.dayStatus(d.paksha, 'night', d.wd, bird);
      var parts = [];
      if (day.status === 'death') return '<p class="status death">' + WEEKDAY[d.wd] + ' is the ' + bird + '’s death day in the ' + d.paksha + ' half. Tradition keeps the whole day and night light, whatever the slots show.</p>';
      if (day.status === 'ruling') parts.push('rules the day');
      if (night.status === 'ruling') parts.push('rules the night');
      if (parts.length) return '<p class="status ruling">The ' + bird + ' ' + parts.join(' and ') + ' this ' + WEEKDAY[d.wd] + '. Its good turns count for more.</p>';
      if (day.neutral || night.neutral) return '<p class="status">The ' + bird + ' both rules and has its death day here, so the two cancel and the day is read as ordinary.</p>';
      return '<p class="status">An ordinary day for the ' + bird + ': neither a ruling day nor a death day. Day ruler: ' +
        P.ruler(d.paksha, 'day', d.wd) + '. Night ruler: ' + P.ruler(d.paksha, 'night', d.wd) + '. Death day of: ' + P.deathBird(d.paksha, d.wd) + '.</p>';
    }
    function mirror(s) {
      return '<h3>All five birds now</h3><p class="muted small">No two birds share an activity at the same moment.</p><div class="mirror">' + P.birds.map(function (b) {
        var c = nowFor(b, s).cur;
        return '<div data-act="' + c.main + '"><img src="' + img('birds', b, c.main) + '" alt="" width="64" height="64">' + b + '<small>' + cap(c.main) + ' slot</small><small>' + cap(c.activity) + ' turn</small></div>';
      }).join('') + '</div>';
    }
    function sky(d, s) {
      var t = d.moon.tithi, n = t <= 15 ? t : t - 15, auto = s.half === 'auto';
      var moon = auto ? 'tithi/' + (t <= 15 ? 'shukla_' : 'krishna_') + (n < 10 ? '0' : '') + n : 'celestial/' + (d.paksha === 'bright' ? 'shukla' : 'krishna') + '_paksha';
      return '<div class="sky"><div><img src="' + ROOT + 'assets/img/' + moon + '.webp" alt="" width="40" height="40"><span><b>' + cap(d.paksha) + ' half</b>' +
        (auto ? 'Lunar day ' + n + ', estimated' : 'Set by hand') + '</span></div>' +
        '<div><img src="' + ROOT + 'assets/img/celestial/sunrise.webp" alt="" width="40" height="40"><span><b class="tnum">' + fmt(d.rise) + ' – ' + fmt(d.set) + '</b>' +
        (d.mode === 'six' ? '6-to-6 reckoning' : d.mode === 'place' ? 'Sunrise and sunset at your location' : 'Your sunrise and sunset') + '</span></div></div>';
    }
    function good(d, today, bird) {
      if (P.dayStatus(d.paksha, 'day', d.wd, bird).status === 'death') return ''; // the banner already says to keep the day light
      var rows = d.rows.filter(function (r) {
        var clock = r.start % 86400;
        return r.grade === 'good' && clock >= 5 * 3600 && clock < 23 * 3600 && (!today || r.end > d.sec);
      });
      var title = today ? 'Good turns left today' : 'Good turns on this day';
      if (!rows.length) return '<h3>' + title + '</h3><p class="muted">None between 5 AM and 11 PM' + (today ? ' from now on' : '') + '.</p>';
      return '<h3>' + title + '</h3><ul class="goodlist">' + rows.map(function (r) {
        return '<li data-act="' + r.activity + '"><span class="tnum">' + fmt(r.start) + ' – ' + fmt(r.end) + '</span><span>' + cap(r.activity) +
          ' turn · ' + cap(r.main) + ' slot</span><span class="muted tnum">' + Math.round((r.end - r.start) / 60) + ' min</span></li>';
      }).join('') + '</ul><p class="cap">Between 5 AM and 11 PM. Good means a Ruling or Eating turn in a Ruling, Eating or Walking slot, not shared with an enemy.</p>';
    }
    function draw() {
      var s = settings(), parts = dateIn.value.split('-');
      var civil = parts.length === 3 ? new Date(+parts[0], parts[1] - 1, +parts[2]) : midnight(new Date());
      var live = nowFor(s.bird, s), today = live.civil.getTime() === civil.getTime();
      var d = today ? live : dayFor(civil, s.bird, s);
      $('[data-picker]', box).innerHTML = picker(s.bird);
      $$('[data-set]', box).forEach(function (b) { b.setAttribute('aria-pressed', store.get(b.dataset.set, b.dataset.set === 'mode' ? 'six' : 'auto') === b.dataset.val); });
      $('[data-custom]', box).hidden = s.mode !== 'custom';
      var note = $('[data-place-note]', box);
      note.hidden = s.mode !== 'place';
      if (s.mode === 'place') note.textContent = d.mode === 'place'
        ? 'Sunrise ' + fmt(d.rise) + ', sunset ' + fmt(d.set) + ' for your location on this date. Worked out on this device; your location is not sent anywhere.'
        : 'The Sun does not rise or set at your location on this date, so the 6-to-6 reckoning is used.';
      var near = s.half === 'auto' && d.moon.nearChange
        ? '<p class="status ruling">The Moon is close to New or Full on this day, so the half changes around now. Check a calendar (pañcāṅgam) and set the half by hand if needed.</p>' : '';
      out.innerHTML = '<p class="eyebrow">' + WEEKDAY[d.wd] + ', sunrise to sunrise</p>' + sky(d, s) + near +
        (today ? nowCard(d, s.bird) : '') + status(d, s.bird) + good(d, today, s.bird) +(today ? mirror(s) : '') +
        '<h3 style="margin-top:36px">Day · ' + fmt(d.rise) + ' – ' + fmt(d.set) + '</h3>' + slots(d, 'day', today ? d.cur : null) +
        '<h3>Night · ' + fmt(d.set) + ' – ' + fmt(d.end) + '</h3>' + slots(d, 'night', today ? d.cur : null);
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-bird]'), v = e.target.closest('[data-set]');
      if (b) { store.set('bird', b.dataset.bird); draw(); }
      if (v && v.dataset.val === 'place') { locate(); return; }
      if (v) { store.set(v.dataset.set, v.dataset.val); draw(); }
    });
    function locate() {
      var note = $('[data-place-note]', box);
      note.hidden = false;
      if (!navigator.geolocation) { note.textContent = 'This browser cannot share a location. Set the times by hand instead.'; return; }
      note.textContent = 'Asking your browser for your location…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        // Rounded to about 1 km: plenty for sunrise, and less to keep.
        store.set('lat', pos.coords.latitude.toFixed(2)); store.set('lon', pos.coords.longitude.toFixed(2));
        store.set('mode', 'place'); draw();
      }, function () {
        note.textContent = 'Location was not shared. Set sunrise and sunset by hand, or keep 6 AM to 6 PM.';
      }, { maximumAge: 3600000, timeout: 15000 });
    }
    dateIn.addEventListener('change', draw);
    riseIn.addEventListener('change', function () { store.set('rise', riseIn.value); draw(); });
    setIn.addEventListener('change', function () { store.set('set', setIn.value); draw(); });
    draw(); setInterval(function () { if (!$('details:focus-within', out)) draw(); }, 60000);
  });

  // ---- lesson explorers: <div data-explore="mirror|turns"> with buttons[data-k][data-v] ----
  $$('[data-explore]').forEach(function (box) {
    var kind = box.dataset.explore, out = $('[data-view]', box), sel = $('select', box);
    var st = { paksha: 'bright', part: 'day', main: 'R' };
    var chip = function (code, short) {
      var n = cap(P.names[code]);
      return '<span class="act act-' + code + '">' + (short ? '<span>' + n.charAt(0) + '<span>' + n.slice(1) + '</span></span>' : n) + '</span>';
    };
    var draw = function () {
      var key = st.paksha + '_' + st.part, seq = T.sequence[key], mins = T.subPeriodMinutes6to6[key];
      $$('[data-k]', box).forEach(function (b) { b.setAttribute('aria-pressed', st[b.dataset.k] === b.dataset.v); });
      if (kind === 'mirror') {
        var ys = P.yamas(st.paksha, st.part, sel.value);
        out.innerHTML = '<div class="tablewrap"><table class="grid-acts"><thead><tr><th></th>' + [1, 2, 3, 4, 5].map(function (n) { return '<th scope="col">Slot ' + n + '</th>'; }).join('') +
          '</tr></thead><tbody>' + P.birds.map(function (b) {
            return '<tr><th scope="row">' + b + '</th>' + ys.map(function (y) { return '<td>' + chip(y[b], true) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table></div><p class="cap">Rules the ' + st.part + ': ' + P.ruler(st.paksha, st.part, sel.value) +
          '. Death day of: ' + P.deathBird(st.paksha, sel.value) + '.</p>';
      } else {
        var i = seq.indexOf(st.main), cum = 0, strip = '', list = '';
        for (var k = 0; k < 5; k++) {
          var c = seq[(i + k) % 5];
          strip += '<i data-act="' + P.names[c] + '" style="flex:' + mins[c] + '"></i>';
          list += '<li><span class="t">+' + cum + ' to +' + (cum + mins[c]) + ' min</span><span>' + chip(c) + (k ? '' : '<em>your own turn</em>') + '</span><span class="muted tnum">' + mins[c] + ' min</span></li>';
          cum += mins[c];
        }
        out.innerHTML = '<div class="turnstrip big">' + strip + '</div><ol class="turns" style="padding:8px 0 0">' + list + '</ol>';
      }
    };
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) { st[b.dataset.k] = b.dataset.v; draw(); } });
    if (sel) sel.addEventListener('change', draw);
    draw();
  });

  // ---- a bird's next seven days (bird pages) ----
  $$('[data-week]').forEach(function (box) {
    var bird = box.dataset.week, s = settings(), t0 = midnight(new Date()), html = '';
    var MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (var i = 0; i < 7; i++) {
      var civil = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i), d = dayFor(civil, bird, s);
      var day = P.dayStatus(d.paksha, 'day', d.wd, bird), night = P.dayStatus(d.paksha, 'night', d.wd, bird);
      var cls = day.status === 'death' ? 'death' : (day.status === 'ruling' || night.status === 'ruling') ? 'ruling' : '';
      var chip = day.status === 'death' ? '<span class="chip death">Death day</span>'
        : (day.status === 'ruling' ? '<span class="chip rule">Rules the day</span>' : '') +
          (night.status === 'ruling' ? '<span class="chip rule">Rules the night</span>' : '');
      html += '<div class="' + cls + (i ? '' : ' today') + '"><b>' + (i ? WEEKDAY[d.wd].slice(0, 3) : 'Today') + '</b><small>' +
        civil.getDate() + ' ' + MONTH[civil.getMonth()] + ' · ' + d.paksha + (d.moon.nearChange ? '?' : '') + '</small>' +
        (chip || '<span class="chip">Ordinary</span>') + '</div>';
    }
    box.innerHTML = html;
  });

  // ---- find your bird ----
  $$('[data-finder]').forEach(function (box) {
    var kind = box.dataset.finder, sel = $('select', box), res = $('[data-result]', box), half = 'bright';
    var draw = function () {
      var bird = kind === 'star' ? T.starToBird[sel.value][half] : T.nameVowelToBird[sel.value][half];
      res.innerHTML = '<img src="' + img('avatars', bird, 'ruling') + '" alt="" width="64" height="64"><div><span class="muted small">' +
        (kind === 'star' ? 'Born under ' + esc(T.starToBird[sel.value].star) + ' in the ' + half + ' half' : 'In the ' + half + ' half this sound belongs to the') +
        '</span><b>' + bird + '</b><a class="small" href="' + ROOT + 'birds/' + bird.toLowerCase() + '.html">Open the ' + bird + ' page</a></div>';
      $$('[data-half]', box).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.half === half); });
    };
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-half]'); if (b) { half = b.dataset.half; draw(); } });
    sel.addEventListener('change', draw); draw();
  });
})();
