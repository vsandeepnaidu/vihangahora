/* Vihanga Hora — small browser engine for the teaching site.
 *
 * A port of tools/reference/pakshi_ref.py (engine contract docs/02). It reads
 * the rule tables from globalThis.PAKSHI_TABLES (assets/js/data.js, generated
 * from specs/data/pakshi_tables.v1.json) and holds no rule data of its own.
 *
 * Times are integer seconds from local midnight of the civil date; the night
 * runs past 86400. Intervals are start-inclusive and end-exclusive.
 * Checked by website/check_engine.js against the golden fixture.
 */
(function (g) {
  'use strict';
  var T = g.PAKSHI_TABLES;
  var NAME = T.codes.activities; // R -> ruling
  var BIRDS = T.birds;
  var JS_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Date.getDay()

  /** Five maps bird -> main activity code, one per slot of a half-day. */
  function yamas(paksha, part, wd) {
    var k = paksha + '_' + part, seq = T.sequence[k];
    var cur = T.firstYama[k][String(T.weekdayGroups[k][wd])], out = [cur];
    for (var i = 0; i < 4; i++) {
      var next = {};
      for (var b in cur) next[b] = seq[(seq.indexOf(cur[b]) + 1) % 5];
      cur = next; out.push(cur);
    }
    return out;
  }

  /** The bird that eats in slot 1 rules that day or night. */
  function ruler(paksha, part, wd) {
    var y = yamas(paksha, part, wd)[0];
    for (var b in y) if (y[b] === 'E') return b;
  }

  function deathBird(paksha, wd) { return T.deathDay[paksha][wd]; }

  /** 'ruling' | 'death' | 'normal'; a bird that both rules and dies is neutral. */
  function dayStatus(paksha, part, wd, bird) {
    var r = ruler(paksha, part, wd) === bird, d = deathBird(paksha, wd) === bird;
    if (r && d) return { status: 'normal', neutral: true };
    return { status: r ? 'ruling' : d ? 'death' : 'normal', neutral: false };
  }

  function relation(paksha, me, other) {
    if (me === other) return 'own';
    var fe = T.friendEnemy[paksha][me];
    if (fe.friends.indexOf(other) >= 0) return 'friend';
    if (fe.enemies.indexOf(other) >= 0) return 'enemy';
    return 'unknown';
  }

  function grade(main, sub, rel) {
    if (sub === 'S' || sub === 'D') return 'bad';
    if (sub === 'W') return 'medium';
    if (main === 'S' || main === 'D') return 'medium';
    if (rel === 'enemy') return 'medium';
    return 'good';
  }

  // Boundary k of slot j: start + round_half_up(n * L / 720), in integers.
  function cut(a, n, len) { return a + Math.floor((2 * n * len + 720) / 1440); }

  /** All 50 turns of one reckoning day for a bird. */
  function birdDay(paksha, wd, bird, dayStart, nightStart, nightEnd) {
    var out = [];
    [['day', dayStart, nightStart], ['night', nightStart, nightEnd]].forEach(function (p) {
      var part = p[0], a = p[1], len = p[2] - p[1], k = paksha + '_' + part;
      var seq = T.sequence[k], dur = T.subPeriodMinutes6to6[k];
      var st = dayStatus(paksha, part, wd, bird);
      yamas(paksha, part, wd).forEach(function (y, j) {
        var main = y[bird], i = seq.indexOf(main), lords = {}, cum = 0;
        for (var b in y) lords[y[b]] = b;
        for (var s = 0; s < 5; s++) {
          var sub = seq[(i + s) % 5];
          var t0 = cut(a, j * 144 + cum, len); cum += dur[sub];
          var t1 = cut(a, j * 144 + cum, len);
          var rel = relation(paksha, bird, lords[sub]);
          out.push({
            part: part, yama: j + 1, sub: s + 1, start: t0, end: t1,
            mainCode: main, subCode: sub, main: NAME[main], activity: NAME[sub],
            lord: lords[sub], relation: rel, grade: grade(main, sub, rel),
            dayStatus: st.status, neutral: st.neutral
          });
        }
      });
    });
    return out;
  }

  // ---- The Moon's half -------------------------------------------------
  // ponytail: low-precision Sun and Moon (Astronomical Almanac series, about
  // 0.3 degrees), enough to name the half except within a few hours of New or
  // Full Moon. The site flags those hours instead of adding a full ephemeris.
  function rad(d) { return d * Math.PI / 180; }
  function norm(d) { return ((d % 360) + 360) % 360; }

  /** Moon minus Sun in degrees, 0..360, at a JS Date. */
  function elongation(date) {
    var t = (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525;
    var moon = 218.32 + 481267.881 * t
      + 6.29 * Math.sin(rad(135.0 + 477198.87 * t))
      - 1.27 * Math.sin(rad(259.3 - 413335.36 * t))
      + 0.66 * Math.sin(rad(235.7 + 890534.22 * t))
      + 0.21 * Math.sin(rad(269.9 + 954397.74 * t))
      - 0.19 * Math.sin(rad(357.5 + 35999.05 * t))
      - 0.11 * Math.sin(rad(186.5 + 966404.03 * t));
    var gs = 357.528 + 35999.050 * t;
    var sun = 280.460 + 36000.771 * t + 1.915 * Math.sin(rad(gs)) + 0.020 * Math.sin(rad(2 * gs));
    return norm(moon - sun);
  }

  /** { paksha, tithi (1..30), nearChange } for a JS Date. */
  function moonHalf(date) {
    var e = elongation(date);
    var toChange = Math.min(e % 180, 180 - (e % 180)); // degrees from New or Full Moon
    return {
      paksha: e < 180 ? 'bright' : 'dark',
      tithi: Math.floor(e / 12) + 1,
      nearChange: toChange < 6 // about half a day either side
    };
  }

  // ---- Sunrise and sunset ----------------------------------------------
  // ponytail: NOAA solar formulas with the standard -0.833 degree horizon,
  // good to about a minute at ordinary latitudes. The app uses Swiss
  // Ephemeris and its own rising definition, so times can differ slightly.
  function deg(r) { return r * 180 / Math.PI; }

  /** { rise, set } in seconds from local midnight of `civil`, or null where the Sun does not rise or set. */
  function sunTimes(civil, lat, lon) {
    var noonUtc = Date.UTC(civil.getFullYear(), civil.getMonth(), civil.getDate(), 12);
    var c = (noonUtc / 86400000 + 2440587.5 - 2451545.0) / 36525;
    var L = norm(280.46646 + c * (36000.76983 + c * 0.0003032));
    var M = 357.52911 + c * (35999.05029 - 0.0001537 * c);
    var ecc = 0.016708634 - c * (0.000042037 + 0.0000001267 * c);
    var C = Math.sin(rad(M)) * (1.914602 - c * (0.004817 + 0.000014 * c))
      + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * c) + Math.sin(rad(3 * M)) * 0.000289;
    var om = 125.04 - 1934.136 * c;
    var lam = L + C - 0.00569 - 0.00478 * Math.sin(rad(om));
    var eps = 23 + (26 + (21.448 - c * (46.815 + c * (0.00059 - c * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(rad(om));
    var decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lam)));
    var y = Math.pow(Math.tan(rad(eps / 2)), 2);
    var eot = 4 * deg(y * Math.sin(2 * rad(L)) - 2 * ecc * Math.sin(rad(M))
      + 4 * ecc * y * Math.sin(rad(M)) * Math.cos(2 * rad(L))
      - 0.5 * y * y * Math.sin(4 * rad(L)) - 1.25 * ecc * ecc * Math.sin(2 * rad(M))); // minutes
    var cosH = (Math.cos(rad(90.833)) - Math.sin(rad(lat)) * Math.sin(decl)) / (Math.cos(rad(lat)) * Math.cos(decl));
    if (cosH < -1 || cosH > 1) return null;
    var H = deg(Math.acos(cosH));
    var tz = -new Date(civil.getFullYear(), civil.getMonth(), civil.getDate(), 12).getTimezoneOffset();
    var noon = 720 - 4 * lon - eot + tz; // minutes after local midnight
    return { rise: Math.round((noon - 4 * H) * 60), set: Math.round((noon + 4 * H) * 60) };
  }

  g.Pakshi = {
    tables: T, birds: BIRDS, names: NAME, jsWeekdays: JS_WD,
    yamas: yamas, ruler: ruler, deathBird: deathBird, dayStatus: dayStatus,
    relation: relation, grade: grade, birdDay: birdDay,
    elongation: elongation, moonHalf: moonHalf, sunTimes: sunTimes
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
