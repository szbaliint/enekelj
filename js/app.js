(function () {
  "use strict";

  const LEVEL_NAMES = { konnyu: "Könnyű", kozepes: "Közepes", nehez: "Nehéz" };
  const LEVELS = Object.keys(LEVEL_NAMES);
  const STORAGE_KEY = "enekelj:v1";

  // ---------- Állapot ----------
  const settings = { difficulty: "vegyes", count: "1", time: "30" };
  let players = []; // { name, score }
  let turnIndex = 0;
  let turnsPlayed = 0;
  let current = []; // [{ word, level }]
  let resolved = false;
  const decks = {};

  let timerId = null;
  let deadline = 0;

  const $ = (id) => document.getElementById(id);

  // ---------- Tárolás (csak kényelmi funkció) ----------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      Object.assign(settings, saved.settings || {});
      players = (saved.players || []).map((name) => ({ name, score: 0 }));
    } catch (_) { /* privát mód, tiltott tárhely – nem baj */ }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        settings, players: players.map((p) => p.name),
      }));
    } catch (_) { /* nem baj */ }
  }

  // ---------- Pakli: ismétlés nélküli húzás ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function draw(level, exclude) {
    for (let tries = 0; tries < 5; tries++) {
      if (!decks[level] || decks[level].length === 0) decks[level] = shuffle(window.WORDS[level]);
      const w = decks[level].pop();
      if (!exclude.includes(w)) return w;
    }
    return decks[level].pop() || window.WORDS[level][0];
  }
  function drawRound() {
    const n = Number(settings.count);
    const out = [];
    for (let i = 0; i < n; i++) {
      const level = settings.difficulty === "vegyes"
        ? LEVELS[Math.floor(Math.random() * LEVELS.length)]
        : settings.difficulty;
      out.push({ word: draw(level, out.map((x) => x.word)), level });
    }
    return out;
  }

  // ---------- Tipp a playlistről ----------
  function commonPrefix(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }
  function matches(word, titleWord) {
    if (word.length < 3) return word === titleWord;
    // rövid szavaknál csak rag fér a végére (autó → autók), különben hamis találat lenne (ház → házibuli)
    const maxSuffix = word.length <= 4 ? 2 : 5;
    if (titleWord.startsWith(word) && titleWord.length - word.length <= maxSuffix) return true;
    if (word.length >= 5 && titleWord.includes(word)) return true;
    const cp = commonPrefix(word, titleWord);
    return cp >= 6 && cp >= Math.max(word.length, titleWord.length) - 3;
  }
  function hintsFor(word) {
    const parts = word.toLowerCase().split(/\s+/);
    return window.PLAYLIST.filter((song) => {
      const titleWords = song.t.toLowerCase().split(/[^\p{L}\d]+/u).filter(Boolean);
      return parts.some((p) => titleWords.some((tw) => matches(p, tw)));
    });
  }

  // ---------- Hang ----------
  let audioCtx = null;
  function beep(freq, dur) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (_) { /* nincs hang – nem baj */ }
  }

  // ---------- Időzítő ----------
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }
  function startTimer() {
    stopTimer();
    const total = Number(settings.time);
    $("timer").hidden = total === 0;
    if (!total) return;
    deadline = Date.now() + total * 1000;
    let lastBeep = null;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      const secs = Math.ceil(left / 1000);
      const ratio = left / (total * 1000);
      const fill = $("timer-fill");
      fill.style.width = (ratio * 100) + "%";
      fill.className = ratio < 0.2 ? "danger" : ratio < 0.5 ? "warn" : "";
      $("timer-text").textContent = secs;
      if (secs <= 3 && secs > 0 && secs !== lastBeep) { lastBeep = secs; beep(660, 0.12); }
      if (left === 0) {
        stopTimer();
        beep(220, 0.5);
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        $("card").classList.add("timeout");
        $("timer-text").textContent = "Lejárt!";
      }
    };
    tick();
    timerId = setInterval(tick, 200);
  }

  // ---------- Képernyők ----------
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- Beállítás képernyő ----------
  function renderPlayers() {
    const list = $("player-list");
    list.innerHTML = "";
    players.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "✕";
      del.setAttribute("aria-label", p.name + " törlése");
      del.onclick = () => { players.splice(i, 1); save(); renderPlayers(); };
      li.appendChild(del);
      list.appendChild(li);
    });
    $("player-hint").hidden = players.length > 0;
  }
  function renderSettings() {
    document.querySelectorAll(".seg").forEach((seg) => {
      const key = seg.dataset.setting;
      seg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-checked", String(b.dataset.value === settings[key]));
      });
    });
  }

  // ---------- Játék képernyő ----------
  function renderWords() {
    const box = $("words");
    box.innerHTML = "";
    current.forEach((c) => {
      const el = document.createElement("div");
      el.className = "word";
      el.textContent = c.word;
      box.appendChild(el);
    });
    const lvl = document.createElement("div");
    lvl.className = "level";
    lvl.textContent = [...new Set(current.map((c) => LEVEL_NAMES[c.level]))].join(" · ");
    box.appendChild(lvl);
  }

  function renderTurn() {
    const turn = $("turn");
    if (players.length) {
      turn.innerHTML = "";
      turn.append("Te jössz, ");
      const s = document.createElement("strong");
      s.textContent = players[turnIndex].name;
      turn.append(s, "!");
      $("round-label").textContent = (Math.floor(turnsPlayed / players.length) + 1) + ". kör";
    } else {
      turn.textContent = current.length > 1 ? "Egy dal, amiben mind benne van:" : "Énekelj egy dalt ezzel a szóval:";
      $("round-label").textContent = "";
    }
  }

  function renderActions() {
    const box = $("actions");
    box.innerHTML = "";
    const mk = (label, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + cls;
      b.textContent = label;
      b.onclick = fn;
      box.appendChild(b);
      return b;
    };
    if (!players.length) {
      mk("Következő szó →", "btn-primary full", nextTurn);
    } else if (resolved) {
      mk("Következő játékos →", "btn-primary full", nextTurn);
    } else {
      mk("✗ Nem ment", "btn-bad", () => resolve(false));
      mk("✓ Elénekelte!", "btn-good", () => resolve(true));
    }
  }

  function renderScoreboard() {
    const ol = $("scoreboard");
    ol.innerHTML = "";
    players.forEach((p, i) => {
      const li = document.createElement("li");
      if (i === turnIndex) li.className = "current";
      const name = document.createElement("span");
      name.textContent = p.name;
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = p.score;
      li.append(name, pts);
      ol.appendChild(li);
    });
  }

  function renderHint() {
    const box = $("hint-box");
    box.innerHTML = "";
    let any = false;
    current.forEach((c) => {
      const songs = hintsFor(c.word);
      if (!songs.length) return;
      any = true;
      const p = document.createElement("div");
      const b = document.createElement("strong");
      b.textContent = c.word;
      p.append("A playlistről – ", b, ":");
      const ul = document.createElement("ul");
      songs.slice(0, 5).forEach((s) => {
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.className = "artist";
        a.textContent = " – " + s.a;
        li.append(s.t, a);
        ul.appendChild(li);
      });
      box.append(p, ul);
    });
    if (!any) {
      box.textContent = "Erre nincs dal a playlistről. Jöhet népdal, gyerekdal, sláger – vagy improvizálj!";
    }
    box.hidden = false;
  }

  function newWords() {
    current = drawRound();
    resolved = false;
    $("card").classList.remove("timeout", "success");
    $("hint-box").hidden = true;
    renderWords();
    renderTurn();
    renderActions();
    startTimer();
  }

  function resolve(ok) {
    stopTimer();
    resolved = true;
    if (ok) {
      players[turnIndex].score += current.length;
      $("card").classList.add("success");
      beep(880, 0.15);
      setTimeout(() => beep(1320, 0.2), 120);
    }
    renderScoreboard();
    renderActions();
  }

  function nextTurn() {
    if (players.length) {
      turnsPlayed++;
      turnIndex = (turnIndex + 1) % players.length;
    }
    newWords();
    renderScoreboard();
  }

  function startGame() {
    players.forEach((p) => { p.score = 0; });
    turnIndex = 0;
    turnsPlayed = 0;
    save();
    show("screen-game");
    newWords();
    renderScoreboard();
  }

  function endGame() {
    stopTimer();
    if (!players.length) { show("screen-setup"); return; }
    const ranked = players.slice().sort((a, b) => b.score - a.score);
    const top = ranked[0].score;
    const winners = ranked.filter((p) => p.score === top).map((p) => p.name);
    $("winner").textContent = top === 0
      ? "Senki nem szerzett pontot. Legközelebb hangosabban! 🎶"
      : (winners.length > 1 ? "Holtverseny: " + winners.join(", ") : "Győztes: " + winners[0]) + " 🏆";
    const ol = $("final-board");
    ol.innerHTML = "";
    ranked.forEach((p) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = p.name;
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = p.score + " pont";
      li.append(name, pts);
      ol.appendChild(li);
    });
    show("screen-results");
  }

  // ---------- Események ----------
  function init() {
    load();
    renderPlayers();
    renderSettings();
    $("playlist-link").href = window.PLAYLIST_URL;

    $("player-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("player-input");
      const name = input.value.trim();
      if (name && !players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        players.push({ name, score: 0 });
        save();
        renderPlayers();
      }
      input.value = "";
      input.focus();
    });

    document.querySelectorAll(".seg").forEach((seg) => {
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        settings[seg.dataset.setting] = b.dataset.value;
        save();
        renderSettings();
      });
    });

    $("start-btn").addEventListener("click", startGame);
    $("quit-btn").addEventListener("click", endGame);
    $("again-btn").addEventListener("click", () => show("screen-setup"));
    $("reroll-btn").addEventListener("click", () => { if (!resolved) newWords(); });
    $("hint-btn").addEventListener("click", () => {
      const box = $("hint-box");
      if (box.hidden) renderHint(); else box.hidden = true;
    });
  }

  init();
})();
