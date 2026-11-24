(function () {
  "use strict";

  const LEVELS = ["konnyu", "kozepes", "nehez"];
  const STORAGE_KEY = "enekelj:v1";
  const LRCLIB = "https://lrclib.net/api/get/";

  // ---------- Állapot / state ----------
  const browserLang = (navigator.language || "").toLowerCase().startsWith("hu") ? "hu" : "en";
  const settings = { lang: browserLang, mode: "kor", goal: "5", difficulty: "vegyes", count: "1", time: "30" };
  const t = (key) => key.split(".").reduce((o, k) => o[k], window.I18N[settings.lang]);
  const data = () => window.GAME_DATA[settings.lang];
  const isSpeed = () => settings.mode === "gyors";

  let players = []; // { name, score, times: [] }
  let turnIndex = 0;
  let turnsPlayed = 0;
  let current = []; // [{ word, level, songs: [index, ...] }]
  let resolved = false;
  let gameOver = false;
  let lastFast = null; // { name, secs } – gyorsasági mód kör-győztese / speed race round winner
  const decks = {};

  let timerId = null;
  let roundStart = 0;

  const $ = (id) => document.getElementById(id);
  const fmtSecs = (s) => s.toFixed(1).replace(".", settings.lang === "hu" ? "," : ".");

  // ---------- Tárolás (csak kényelmi funkció) / storage (convenience only) ----------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return;
      Object.assign(settings, saved.settings || {});
      if (!window.I18N[settings.lang]) settings.lang = browserLang;
      players = (saved.players || []).map((name) => ({ name, score: 0, times: [] }));
    } catch (_) { /* privát mód, tiltott tárhely – nem baj */ }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, players: players.map((p) => p.name) }));
    } catch (_) { /* nem baj */ }
  }

  // ---------- Pakli: ismétlés nélküli húzás / deck: draw without repeats ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function draw(level, exclude) {
    const key = settings.lang + ":" + level;
    for (let tries = 0; tries < 5; tries++) {
      if (!decks[key] || decks[key].length === 0) decks[key] = shuffle(data().words[level]);
      const [word, songs] = decks[key].pop();
      if (!exclude.includes(word)) return { word, level, songs };
    }
    const [word, songs] = data().words[level][0];
    return { word, level, songs };
  }
  function drawRound() {
    const out = [];
    for (let i = 0; i < Number(settings.count); i++) {
      const level = settings.difficulty === "vegyes"
        ? LEVELS[Math.floor(Math.random() * LEVELS.length)]
        : settings.difficulty;
      out.push(draw(level, out.map((x) => x.word)));
    }
    return out;
  }

  // ---------- Hang / sound ----------
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
  function cheer() {
    beep(880, 0.15);
    setTimeout(() => beep(1320, 0.2), 120);
  }

  // ---------- Időzítő / timer ----------
  // Időlimit nélkül gyorsasági módban stopperként számol felfelé.
  // With no time limit, speed race shows a stopwatch counting up.
  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }
  function elapsed() {
    return (Date.now() - roundStart) / 1000;
  }
  function startTimer() {
    stopTimer();
    roundStart = Date.now();
    const total = Number(settings.time);
    const stopwatch = !total && isSpeed();
    $("timer").hidden = !total && !stopwatch;
    $("timer").querySelector(".timer-bar").hidden = stopwatch;
    $("timer").classList.toggle("stopwatch", stopwatch);
    if (!total && !stopwatch) return;
    let lastBeep = null;
    const tick = () => {
      if (stopwatch) { $("timer-text").textContent = fmtSecs(elapsed()); return; }
      const left = Math.max(0, total * 1000 - (Date.now() - roundStart));
      const secs = Math.ceil(left / 1000);
      const ratio = left / (total * 1000);
      const fill = $("timer-fill");
      fill.style.width = (ratio * 100) + "%";
      fill.className = ratio < 0.2 ? "danger" : ratio < 0.5 ? "warn" : "";
      $("timer-text").textContent = secs;
      if (secs <= 3 && secs > 0 && secs !== lastBeep) { lastBeep = secs; beep(660, 0.12); }
      if (left === 0) onTimeUp();
    };
    tick();
    timerId = setInterval(tick, stopwatch ? 100 : 200);
  }
  function onTimeUp() {
    stopTimer();
    beep(220, 0.5);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    $("card").classList.add("timeout");
    $("timer-text").textContent = t("timeUp");
    // Gyorsasági módban lejárt idő = senki nem nyert; körönként a többiek még dönthetnek.
    // Speed race: time's up means nobody won. Take turns: the group can still judge.
    if (isSpeed()) { resolved = true; renderActions(); }
    renderReveal();
  }

  // ---------- Képernyők / screens ----------
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- Beállítás képernyő / setup screen ----------
  function renderPlayers() {
    const list = $("player-list");
    list.innerHTML = "";
    players.forEach((p, i) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "✕";
      del.setAttribute("aria-label", t("remove")(p.name));
      del.onclick = () => { players.splice(i, 1); save(); renderPlayers(); };
      li.appendChild(del);
      list.appendChild(li);
    });
    $("player-hint").hidden = players.length > 0;
    $("start-error").hidden = true;
  }
  function renderSettings() {
    document.querySelectorAll(".seg").forEach((seg) => {
      const key = seg.dataset.setting;
      seg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-checked", String(b.dataset.value === settings[key]));
      });
    });
    $("goal-row").hidden = !isSpeed();
    $("mode-desc").textContent = t("modeDesc." + settings.mode);
    $("start-error").hidden = true;
  }

  // Felület nyelvének beállítása / apply UI language
  function applyLang() {
    document.documentElement.lang = settings.lang;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-secs]").forEach((el) => { el.textContent = el.dataset.secs + " " + t("seconds"); });
    const input = $("player-input");
    input.placeholder = t("namePlaceholder");
    input.setAttribute("aria-label", t("nameLabel"));
    $("mode-desc").textContent = t("modeDesc." + settings.mode);
    const ol = $("rules-list");
    ol.innerHTML = "";
    t("rules").forEach((text) => {
      const li = document.createElement("li");
      const [pre, post] = text.split("{link}");
      li.append(pre);
      if (post !== undefined) {
        const a = document.createElement("a");
        a.href = data().url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = (settings.lang === "hu" ? "„" : "“") + data().name + "”";
        li.append(a, post);
      }
      ol.appendChild(li);
    });
  }

  // ---------- Játék képernyő / game screen ----------
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
    lvl.textContent = [...new Set(current.map((c) => t("levels." + c.level)))].join(" · ");
    box.appendChild(lvl);
  }

  function renderTurn() {
    const turn = $("turn");
    turn.innerHTML = "";
    $("round-label").textContent = "";
    if (isSpeed()) {
      if (lastFast) {
        const s = document.createElement("span");
        s.className = "fast";
        s.textContent = t("fastest")(lastFast.name, fmtSecs(lastFast.secs));
        turn.append(s);
      } else {
        turn.textContent = t("singEveryone");
      }
      $("round-label").textContent = t("round")(turnsPlayed + 1);
    } else if (players.length) {
      const [before, after] = t("yourTurn");
      const s = document.createElement("strong");
      s.textContent = players[turnIndex].name;
      turn.append(before, s, after);
      $("round-label").textContent = t("round")(Math.floor(turnsPlayed / players.length) + 1);
    } else {
      turn.textContent = current.length > 1 ? t("singMany") : t("singOne");
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
    if (gameOver) {
      mk(t("results"), "btn-primary full", endGame);
    } else if (!players.length) {
      mk(t("nextWord"), "btn-primary full", nextTurn);
    } else if (resolved) {
      mk(isSpeed() ? t("nextWord") : t("nextPlayer"), "btn-primary full", nextTurn);
    } else if (isSpeed()) {
      const p = document.createElement("p");
      p.className = "prompt";
      p.textContent = t("whoFirst");
      box.appendChild(p);
      players.forEach((pl, i) => mk(pl.name, "buzzer", () => resolveSpeed(i)));
      if (players.length % 2) box.lastChild.classList.add("full");
      mk(t("nobodyBtn"), "btn-bad full", () => resolveSpeed(-1));
    } else {
      mk(t("fail"), "btn-bad", () => resolve(false));
      mk(t("success"), "btn-good", () => resolve(true));
    }
  }

  function avgTime(p) {
    return p.times.length ? p.times.reduce((a, b) => a + b, 0) / p.times.length : Infinity;
  }

  function renderScoreboard() {
    const ol = $("scoreboard");
    ol.innerHTML = "";
    players.forEach((p, i) => {
      const li = document.createElement("li");
      if (i === turnIndex && !isSpeed()) li.className = "current";
      const name = document.createElement("span");
      name.textContent = p.name;
      if (isSpeed() && p.times.length) {
        const sub = document.createElement("span");
        sub.className = "sub";
        sub.textContent = t("avg")(fmtSecs(avgTime(p)));
        name.appendChild(sub);
      }
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = isSpeed() ? p.score + " / " + settings.goal : p.score;
      li.append(name, pts);
      ol.appendChild(li);
    });
  }

  // ---------- Tipp: mely dalokban hangzik el / hint: which songs contain the word ----------
  function renderHint() {
    const box = $("hint-box");
    box.innerHTML = "";
    current.forEach((c) => {
      const p = document.createElement("div");
      const b = document.createElement("strong");
      b.textContent = c.word;
      p.append(t("hintFrom"), b, ":");
      const ul = document.createElement("ul");
      c.songs.slice(0, 4).forEach((idx) => {
        const s = data().songs[idx];
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.className = "artist";
        a.textContent = " – " + s.a;
        li.append(s.t, a);
        ul.appendChild(li);
      });
      box.append(p, ul);
    });
    box.hidden = false;
  }

  // ---------- Megoldás: dal, dalszöveg-sor, Spotify lejátszó / answer: song, lyric line, Spotify player ----------
  // A dalszöveget futás közben kérjük le az lrclib.net-ről (a repóban nincs dalszöveg).
  // Lyrics are fetched at runtime from lrclib.net (none are stored in the repo).
  const lyricsCache = new Map();
  function fetchLyrics(lrcId) {
    if (!lyricsCache.has(lrcId)) {
      lyricsCache.set(lrcId, fetch(LRCLIB + lrcId)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.plainLyrics) || null)
        .catch(() => null));
    }
    return lyricsCache.get(lrcId);
  }

  // A sorban kiemeli a keresett szót / highlights the word inside the line
  function highlightLine(el, line, word) {
    const parts = window.Match.tokens(word);
    line.split(/([^\p{L}\d'’-]+)/u).forEach((piece) => {
      const tok = piece.toLowerCase().replace(/^['’-]+|['’-]+$/g, "");
      if (tok && parts.some((p) => window.Match.tokenMatches(p, tok, settings.lang))) {
        const m = document.createElement("mark");
        m.textContent = piece;
        el.appendChild(m);
      } else {
        el.append(piece);
      }
    });
  }

  // Több szónál, ha van olyan dal, amiben mind benne van, azt mutatjuk.
  // With several words, prefer one song that contains all of them.
  function pickSongs() {
    if (current.length > 1) {
      const common = current[0].songs.filter((s) => current.every((c) => c.songs.includes(s)));
      if (common.length) {
        const song = common[Math.floor(Math.random() * common.length)];
        return [{ song, words: current.map((c) => c.word) }];
      }
    }
    return current.map((c) => ({ song: c.songs[Math.floor(Math.random() * c.songs.length)], words: [c.word] }));
  }

  function renderReveal() {
    const box = $("reveal");
    if (!box.hidden && box.dataset.round === String(turnsPlayed)) return; // már látszik / already shown
    box.innerHTML = "";
    box.dataset.round = String(turnsPlayed);
    $("hint-box").hidden = true;
    pickSongs().forEach(({ song: idx, words }) => {
      const s = data().songs[idx];
      const item = document.createElement("div");
      item.className = "reveal-item";
      const h = document.createElement("h3");
      h.textContent = words.join(" · ") + " – " + t("revealTitle");
      const title = document.createElement("div");
      title.className = "song";
      const artist = document.createElement("span");
      artist.className = "artist";
      artist.textContent = " – " + s.a;
      title.append(s.t, artist);

      const lines = document.createElement("div");
      words.forEach((word) => {
        const line = document.createElement("p");
        line.className = "line loading";
        line.textContent = t("loadingLine");
        lines.appendChild(line);
        fetchLyrics(s.lrc).then((lyrics) => {
          const found = lyrics && window.Match.findLine(word, lyrics, settings.lang);
          if (!found) { line.remove(); return; }
          line.className = "line";
          line.textContent = "";
          const [open, close] = settings.lang === "hu" ? ["„", "”"] : ["“", "”"];
          highlightLine(line, open + found.trim() + close, word);
        });
      });

      const iframe = document.createElement("iframe");
      iframe.src = "https://open.spotify.com/embed/track/" + encodeURIComponent(s.id) + "?utm_source=generator";
      iframe.title = s.t + " – " + s.a + " (Spotify)";
      iframe.loading = "lazy";
      iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

      item.append(h, title, lines, iframe);
      box.appendChild(item);
    });
    box.hidden = false;
  }

  // ---------- Körök / rounds ----------
  function newWords() {
    current = drawRound();
    resolved = false;
    $("card").classList.remove("timeout", "success");
    $("hint-box").hidden = true;
    $("reveal").hidden = true;
    renderWords();
    renderTurn();
    renderActions();
    startTimer();
  }

  // Körönkénti mód / take turns
  function resolve(ok) {
    stopTimer();
    resolved = true;
    if (ok) {
      players[turnIndex].score += current.length;
      $("card").classList.add("success");
      cheer();
    } else {
      renderReveal();
    }
    renderScoreboard();
    renderActions();
  }

  // Gyorsasági mód: i = a leggyorsabb játékos indexe, -1 = senki
  // Speed race: i = index of the fastest player, -1 = nobody
  function resolveSpeed(i) {
    stopTimer();
    resolved = true;
    if (i >= 0) {
      const p = players[i];
      const secs = elapsed();
      p.score += current.length;
      p.times.push(secs);
      lastFast = { name: p.name, secs };
      $("card").classList.add("success");
      cheer();
      if (p.score >= Number(settings.goal)) gameOver = true;
    } else {
      lastFast = null;
      renderReveal();
    }
    renderTurn();
    if (i < 0) $("turn").textContent = t("nobodyBtn").replace(/^✗\s*/, "");
    renderScoreboard();
    renderActions();
  }

  function nextTurn() {
    if (players.length) {
      turnsPlayed++;
      if (!isSpeed()) turnIndex = (turnIndex + 1) % players.length;
    }
    lastFast = null;
    newWords();
    renderScoreboard();
  }

  function startGame() {
    if (isSpeed() && players.length < 2) {
      const err = $("start-error");
      err.textContent = t("speedNeedsPlayers");
      err.hidden = false;
      $("player-input").focus();
      return;
    }
    players.forEach((p) => { p.score = 0; p.times = []; });
    turnIndex = 0;
    turnsPlayed = 0;
    gameOver = false;
    lastFast = null;
    save();
    show("screen-game");
    newWords();
    renderScoreboard();
  }

  function endGame() {
    stopTimer();
    if (!players.length) { show("screen-setup"); return; }
    // Pontszám szerint, holtversenynél a gyorsabb átlagidő nyer (gyorsasági mód).
    // By score; in speed race a faster average time breaks ties.
    const ranked = players.slice().sort((a, b) => b.score - a.score || (isSpeed() ? avgTime(a) - avgTime(b) : 0));
    const top = ranked[0];
    const tied = ranked.filter((p) => p.score === top.score && (!isSpeed() || avgTime(p) === avgTime(top)));
    $("winner").textContent = top.score === 0
      ? t("nobody")
      : (tied.length > 1 ? t("tie") + tied.map((p) => p.name).join(", ") : t("winner") + top.name) + " 🏆";
    const ol = $("final-board");
    ol.innerHTML = "";
    ranked.forEach((p) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = p.name;
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = t("points")(p.score);
      if (isSpeed() && p.times.length) {
        const sub = document.createElement("span");
        sub.className = "sub";
        sub.textContent = t("avg")(fmtSecs(avgTime(p)));
        pts.appendChild(sub);
      }
      li.append(name, pts);
      ol.appendChild(li);
    });
    show("screen-results");
  }

  // ---------- Események / events ----------
  function init() {
    load();
    renderPlayers();
    renderSettings();
    applyLang();

    $("player-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("player-input");
      const name = input.value.trim();
      if (name && !players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        players.push({ name, score: 0, times: [] });
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
        if (seg.dataset.setting === "lang") { applyLang(); renderPlayers(); }
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
    $("reveal-btn").addEventListener("click", renderReveal);
  }

  init();
})();
