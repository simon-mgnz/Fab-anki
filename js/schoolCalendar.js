/**
 * Calendrier scolaire Zone B (Grand Est : Nancy-Metz, Reims, Strasbourg…)
 * Semaines de cours numérotées 1–36 ; vacances d'hiver/printemps sur cycle 3 ans.
 */
(function (global) {
  'use strict';

  const TEACHING_WEEKS = 36;
  const PREPA_YEAR_KEY = 'fabanki:prepa_year';

  /** Cycle Zone B : hiver & printemps (mois 1-indexés, année civile y1 = rentrée+1) */
  const ZONE_B_CYCLE = [
    { hiver: [[2, 20], [3, 8]], printemps: [[4, 17], [5, 3]] },
    { hiver: [[2, 22], [3, 10]], printemps: [[4, 19], [5, 5]] },
    { hiver: [[2, 14], [3, 2]], printemps: [[4, 11], [4, 27]] },
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function atDate(y, m, d) {
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  function getMonday(d) {
    const x = new Date(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /** Année scolaire = septembre N → juillet N+1 */
  function getSchoolYearStartYear(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  }

  function getRentree(startYear) {
    const d = atDate(startYear, 9, 1);
    if (d.getDay() === 0) d.setDate(2);
    if (d.getDay() === 6) d.setDate(3);
    return d;
  }

  /**
   * Vacances Zone B : `end` = date de reprise (exclusive pour le lundi).
   * Été : à partir du premier samedi de juillet (≈ 3–5 juil. selon l'arrêté).
   */
  function getHolidayPeriods(startYear) {
    const y1 = startYear + 1;
    const cycle = ZONE_B_CYCLE[startYear % 3];
    const hiverS = cycle.hiver[0];
    const hiverE = cycle.hiver[1];
    const printS = cycle.printemps[0];
    const printE = cycle.printemps[1];
    const eteStart = atDate(y1, 7, 1);
    while (eteStart.getDay() !== 6) eteStart.setDate(eteStart.getDate() + 1);
    return [
      { start: atDate(startYear, 10, 18), end: atDate(startYear, 11, 3) },
      { start: atDate(startYear, 12, 20), end: atDate(y1, 1, 5) },
      { start: atDate(y1, hiverS[0], hiverS[1]), end: atDate(y1, hiverE[0], hiverE[1]) },
      { start: atDate(y1, printS[0], printS[1]), end: atDate(y1, printE[0], printE[1]) },
      { start: eteStart, end: atDate(y1, 8, 31) },
    ];
  }

  /** Lundi de vacances : pas de cours ce lundi (reprise = `end`, non incluse). */
  function isMondayInHoliday(monday, holidays) {
    return holidays.some((h) => monday >= h.start && monday < h.end);
  }

  function parseDeckTime(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().replace(',', '.');
    const m = s.match(/^([12])\.(\d{1,2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > TEACHING_WEEKS) return null;
    return { year, week };
  }

  function formatDeckTime(year, week) {
    const y = Number(year);
    const w = Number(week);
    if (!Number.isFinite(y) || (y !== 1 && y !== 2)) return '';
    if (!Number.isFinite(w) || w < 1 || w > TEACHING_WEEKS) return '';
    return `${y}.${pad2(w)}`;
  }

  function computeScolarWeek(date) {
    const d = date instanceof Date ? new Date(date) : new Date(date);
    d.setHours(12, 0, 0, 0);
    let startYear = getSchoolYearStartYear(d);
    let rentree = getRentree(startYear);
    if (d < rentree) {
      startYear -= 1;
      rentree = getRentree(startYear);
    }
    const holidays = getHolidayPeriods(startYear);
    const rentreeMon = getMonday(rentree);
    const currentMon = getMonday(d);
    let weekNum = 0;
    let activeWeek = 1;
    let wStart = new Date(rentreeMon);

    while (wStart <= currentMon && weekNum < TEACHING_WEEKS) {
      if (!isMondayInHoliday(wStart, holidays)) {
        weekNum += 1;
        activeWeek = weekNum;
      }
      wStart.setDate(wStart.getDate() + 7);
    }

    if (weekNum === 0) activeWeek = 1;
    return {
      week: Math.min(activeWeek, TEACHING_WEEKS),
      maxWeekReached: Math.min(weekNum, TEACHING_WEEKS),
      schoolYearStartYear: startYear,
      rentree,
      label: `S${pad2(activeWeek)}`,
    };
  }

  function getPrepaYear() {
    try {
      return localStorage.getItem(PREPA_YEAR_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setPrepaYear(value) {
    const v = String(value || '').trim();
    if (v !== '1' && v !== '2' && v !== 'finished') return false;
    try {
      localStorage.setItem(PREPA_YEAR_KEY, v);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getPrepaYearLabel(value) {
    const v = value != null ? String(value) : getPrepaYear();
    if (v === '1') return '1ère année';
    if (v === '2') return '2ème année';
    if (v === 'finished') return 'Classe terminée';
    return 'Non défini';
  }

  function isDeckReleasedForUser(entry, prepaYear, weekInfo) {
    const time = parseDeckTime(entry && entry.time);
    if (!time) return true;
    const py = prepaYear != null ? String(prepaYear) : getPrepaYear();
    if (py === 'finished' || !py) return true;
    const userYear = Number(py);
    const wk = weekInfo || computeScolarWeek(new Date());

    if (userYear === 2 && time.year === 1) return true;
    if (userYear === 1 && time.year === 2) return false;
    if (time.year === userYear) return wk.week >= time.week;
    return false;
  }

  /** Deck 1ère affiché comme rappel pour un·e élève de 2nde année (tout 1.xx débloqué). */
  function isYear1ReferenceForSecondYear(entry, prepaYear) {
    const time = parseDeckTime(entry && entry.time);
    if (!time || time.year !== 1) return false;
    return String(prepaYear != null ? prepaYear : getPrepaYear()) === '2';
  }

  function isDeckNewThisWeek(entry, prepaYear, weekInfo) {
    const time = parseDeckTime(entry && entry.time);
    if (!time) return false;
    const py = prepaYear != null ? String(prepaYear) : getPrepaYear();
    if (py !== '1' && py !== '2') return false;
    const userYear = Number(py);
    if (time.year !== userYear) return false;
    const wk = weekInfo || computeScolarWeek(new Date());
    return time.week === wk.week;
  }

  function getDeckTimeBadgeKinds(entry, prepaYear) {
    const kinds = [];
    const time = parseDeckTime(entry && entry.time);
    if (!time) return kinds;
    const py = prepaYear != null ? String(prepaYear) : getPrepaYear();
    if (py === '2' && time.year === 1) kinds.push('prepa1-ref');
    else if (py === '1' && time.year === 1) kinds.push('prepa1');
    else if (py === '2' && time.year === 2) kinds.push('prepa2');
    kinds.push('time');
    return kinds;
  }

  function getDefaultDeckWeek() {
    return computeScolarWeek(new Date()).week;
  }

  function getScolarWeekKey(weekInfo) {
    const wk = weekInfo || computeScolarWeek(new Date());
    return `${wk.schoolYearStartYear}-S${pad2(wk.week)}`;
  }

  /** Lundi de début de la semaine de cours n (1–36). */
  function getMondayForTeachingWeek(schoolYearStartYear, weekNum) {
    const holidays = getHolidayPeriods(schoolYearStartYear);
    const rentreeMon = getMonday(getRentree(schoolYearStartYear));
    let wStart = new Date(rentreeMon);
    let n = 0;
    while (n < TEACHING_WEEKS) {
      if (!isMondayInHoliday(wStart, holidays)) {
        n += 1;
        if (n === weekNum) return new Date(wStart);
      }
      wStart.setDate(wStart.getDate() + 7);
    }
    return null;
  }

  function formatUnlockDate(monday) {
    if (!monday) return '';
    try {
      return monday.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  function isDeckUnlockingNextWeek(entry, prepaYear, weekInfo) {
    const time = parseDeckTime(entry && entry.time);
    if (!time) return false;
    const py = prepaYear != null ? String(prepaYear) : getPrepaYear();
    if (py !== '1' && py !== '2') return false;
    const userYear = Number(py);
    if (time.year !== userYear) return false;
    const wk = weekInfo || computeScolarWeek(new Date());
    if (time.week !== wk.week + 1) return false;
    return !isDeckReleasedForUser(entry, prepaYear, wk);
  }

  function compareDeckTime(a, b) {
    const ta = parseDeckTime(a && a.time);
    const tb = parseDeckTime(b && b.time);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    if (ta.year !== tb.year) return ta.year - tb.year;
    if (ta.week !== tb.week) return ta.week - tb.week;
    return 0;
  }

  function listManifestDecksForWeek(decks, targetYear, targetWeek) {
    const y = Number(targetYear);
    const w = Number(targetWeek);
    return (decks || []).filter((entry) => {
      const t = parseDeckTime(entry && entry.time);
      return t && t.year === y && t.week === w;
    });
  }

  function showPrepaYearDialog(callback) {
    try {
      if (document.getElementById('fabankiPrepaYearOverlay')) return;
      const ov = document.createElement('div');
      ov.id = 'fabankiPrepaYearOverlay';
      ov.className = 'modal-overlay fab-prepayear-overlay';
      ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10001;';

      const m = document.createElement('div');
      m.className = 'modal fab-prepayear-modal';
      m.style.maxWidth = '440px';
      m.innerHTML = `
        <h3 style="margin:0 0 10px 0;">Votre année de prépa</h3>
        <p style="color:var(--muted);margin:0 0 16px 0;line-height:1.45;font-size:0.92rem;">
          Les decks sont débloqués semaine par semaine (calendrier Zone B — Grand Est).
          Choisissez votre année pour afficher les bons contenus.
        </p>
        <div class="fab-prepayear-options">
          <button type="button" class="fab-prepayear-opt" data-py="1">
            <strong>1ère année</strong>
            <span>Decks débloqués au fil des semaines</span>
          </button>
          <button type="button" class="fab-prepayear-opt" data-py="2">
            <strong>2ème année</strong>
            <span>Decks 2.xx au fil des semaines + tout le programme 1.xx en rappel</span>
          </button>
          <button type="button" class="fab-prepayear-opt" data-py="finished">
            <strong>Classe terminée</strong>
            <span>Tous les decks visibles</span>
          </button>
        </div>
        <p class="fab-prepayear-hint">Semaine scolaire actuelle : <strong id="fabPrepaWeekHint">…</strong></p>
      `;
      ov.appendChild(m);
      document.body.appendChild(ov);
      ov.classList.add('open');
      m.classList.add('open');

      const wk = computeScolarWeek(new Date());
      const hint = m.querySelector('#fabPrepaWeekHint');
      if (hint) hint.textContent = `S${pad2(wk.week)} · rentrée ${wk.schoolYearStartYear}`;

      m.querySelectorAll('.fab-prepayear-opt').forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-py');
          setPrepaYear(val);
          ov.remove();
          if (typeof callback === 'function') callback(val);
        });
      });
    } catch (e) {
      console.warn('[prepa-year] dialog error', e);
      if (typeof callback === 'function') callback(null);
    }
  }

  const api = {
    TEACHING_WEEKS,
    PREPA_YEAR_KEY,
    parseDeckTime,
    formatDeckTime,
    computeScolarWeek,
    getSchoolYearStartYear,
    getHolidayPeriods,
    getRentree,
    getPrepaYear,
    setPrepaYear,
    getPrepaYearLabel,
    isDeckReleasedForUser,
    isYear1ReferenceForSecondYear,
    isDeckNewThisWeek,
    getDeckTimeBadgeKinds,
    getDefaultDeckWeek,
    getScolarWeekKey,
    getMondayForTeachingWeek,
    formatUnlockDate,
    isDeckUnlockingNextWeek,
    compareDeckTime,
    listManifestDecksForWeek,
    showPrepaYearDialog,
  };

  global.FabankiSchool = api;
})(typeof window !== 'undefined' ? window : globalThis);
