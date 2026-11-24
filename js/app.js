(function () {
  "use strict";

  const LEVELS = ["konnyu", "kozepes", "nehez"];
  const STORAGE_KEY = "enekelj:v1";
  const LRCLIB = "https://lrclib.net/api/get/";

  // ---------- Állapot / state ----------
  const browserLang = (navigator.language || "").toLowerCase().startsWith("hu") ? "hu" : "en";
  const settings = {
    lang: browserLang, game: "szo", mode: "kor", goal: "5",
    difficulty: "vegyes", count: "1", time: "30", player: "youtube",
  };
  const t = (key) => key.split(".").reduce((o, k) => o[k], window.I18N[settings.lang]);
  const data = () => window.GAME_DATA[settings.lang];
  const isSpeed = () => settings.mode === "gyors";
  const isLyrics = () => settings.game === "dal";

  let players = []; // { name, score, times: [] }
  let turnIndex = 0;
  let turnsPlayed = 0;
  let current = []; // [{ word, level, songs: [index, ...] }]
  let resolved = false;
  let gameOver = false;
  let lastFast = null; // { name, secs } – gyorsasági mód kör-győztese / speed race round winner
  // "Fejezd be!" kör / "Finish it!" round: { song, lines, i, from, until, phase, player }
  // phase: "loading" | "listening" | "answer"
  let lyr = null;
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
    revealAnswer();
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
    $("count-row").hidden = isLyrics();
    $("mode-desc").textContent = t("modeDesc." + settings.mode);
    $("game-desc").textContent = t("gameDesc." + settings.game);
    $("player-desc").textContent = t("playerDesc." + settings.player);
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
    $("game-desc").textContent = t("gameDesc." + settings.game);
    $("player-desc").textContent = t("playerDesc." + settings.player);
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
        turn.textContent = isLyrics() ? t("singEveryoneLyrics") : t("singEveryone");
      }
      $("round-label").textContent = t("round")(turnsPlayed + 1);
    } else if (players.length) {
      const [before, after] = t("yourTurn");
      const s = document.createElement("strong");
      s.textContent = players[turnIndex].name;
      turn.append(before, s, after);
      $("round-label").textContent = t("round")(Math.floor(turnsPlayed / players.length) + 1);
    } else if (!isLyrics()) {
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
    if (isLyrics() && !resolved && (!lyr || lyr.phase !== "answer") && players.length) {
      return; // még szól a dal / the song is still playing
    }
    if (gameOver) {
      mk(t("results"), "btn-primary full", endGame);
    } else if (!players.length) {
      mk(isLyrics() ? t("nextSong") : t("nextWord"), "btn-primary full", nextTurn);
    } else if (resolved) {
      mk(isSpeed() ? (isLyrics() ? t("nextSong") : t("nextWord")) : t("nextPlayer"), "btn-primary full", nextTurn);
    } else if (isSpeed()) {
      const p = document.createElement("p");
      p.className = "prompt";
      p.textContent = isLyrics() ? t("whoFirstLyrics") : t("whoFirst");
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

  // ---------- Tipp / hint ----------
  // Szavas játék: mely dalokban hangzik el. Fejezd be!: a hiányzó sor első szava.
  // Words: which songs contain the word. Finish it!: first word of the missing line.
  function renderHint() {
    const box = $("hint-box");
    box.innerHTML = "";
    if (isLyrics()) {
      if (!lyr || !lyr.lines) return;
      const first = lyr.lines[lyr.i].text.split(/\s+/)[0];
      box.textContent = t("firstWord")(first);
      box.hidden = false;
      return;
    }
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

  // ---------- Dalszöveg (futás közben az lrclib.net-ről) / lyrics (fetched at runtime from lrclib.net) ----------
  // A repóban nincs dalszöveg. / No lyrics are stored in the repo.
  // → { plain: "...", synced: [{ time, text }] }
  const lyricsCache = new Map();
  function fetchLyrics(lrcId) {
    if (!lyricsCache.has(lrcId)) {
      lyricsCache.set(lrcId, fetch(LRCLIB + lrcId)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.plainLyrics
          ? { plain: j.plainLyrics, synced: window.Player.parseSynced(j.syncedLyrics) }
          : null))
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
  const quote = (text) => (settings.lang === "hu" ? "„" : "“") + text + "”";

  // ---------- Lejátszó / player ----------
  // A beállított lejátszó; ha a dalhoz nincs YouTube-videó, Spotify.
  // The chosen player; falls back to Spotify when the song has no YouTube video.
  // Ha a YouTube nem szól, magától Spotify-ra vált (lásd Player.smart).
  // If YouTube doesn't play, it switches to Spotify by itself (see Player.smart).
  function makePlayer(container, song) {
    return window.Player.smart(container, song, settings.player === "youtube", (kind) => {
      container.classList.toggle("yt", kind === "youtube");
      container.classList.toggle("sp", kind === "spotify");
    });
  }
  function spotifyLink(song) {
    const a = document.createElement("a");
    a.className = "sp-link";
    a.href = "https://open.spotify.com/track/" + encodeURIComponent(song.id);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = t("openSpotify");
    return a;
  }

  // ---------- Megoldás a szavas játékban / answer in the word game ----------
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

  function revealAnswer() {
    if (isLyrics()) renderLyricsAnswer(); else renderReveal();
  }

  function renderReveal() {
    const box = $("reveal");
    if (!box.hidden && box.dataset.round === String(turnsPlayed)) return; // már látszik / already shown
    window.Player.destroyAll();
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

      const frame = document.createElement("div");
      frame.className = "player-frame " + (settings.player === "youtube" && s.yt ? "yt" : "sp");
      const player = makePlayer(frame, s);

      const lines = document.createElement("div");
      words.forEach((word) => {
        const row = document.createElement("div");
        row.className = "line-row";
        const line = document.createElement("p");
        line.className = "line loading";
        line.textContent = t("loadingLine");
        row.appendChild(line);
        lines.appendChild(row);
        fetchLyrics(s.lrc).then((ly) => {
          // időzített sor, ha van – onnan indítható a dal / synced line if available – playable from there
          const timed = ly && ly.synced.find((l) => window.Match.textMatches(word, l.text, settings.lang));
          const found = timed ? timed.text : ly && window.Match.findLine(word, ly.plain, settings.lang);
          if (!found) { row.remove(); return; }
          line.className = "line";
          line.textContent = "";
          highlightLine(line, quote(found.trim()), word);
          if (timed) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-ghost play-from";
            btn.textContent = t("playFrom");
            btn.onclick = () => player.play(Math.max(0, timed.time - 1.5));
            row.appendChild(btn);
          }
        });
      });

      item.append(h, title, lines, frame, spotifyLink(s));
      box.appendChild(item);
    });
    box.hidden = false;
  }

  // ---------- Fejezd be! / Finish it! ----------
  // Csak időzített dalszöveggel rendelkező dalok; YouTube-lejátszónál olyanok, amikhez van videó is.
  // Only songs with synced lyrics; with the YouTube player, only those that also have a video.
  function lyricsPool() {
    return data().songs
      .map((s, i) => i)
      .filter((i) => data().songs[i].s && (settings.player !== "youtube" || data().songs[i].yt));
  }
  function drawSong() {
    const key = settings.lang + ":songs:" + settings.player;
    if (!decks[key] || decks[key].length === 0) decks[key] = shuffle(lyricsPool());
    return decks[key].pop();
  }

  // Nehézség = mennyi előzményt hallasz: könnyű 3 sor, közepes 2, nehéz 1
  // Difficulty = how much lead-in you hear: easy 3 lines, medium 2, hard 1
  const CONTEXT = { konnyu: 3, kozepes: 2, nehez: 1 };

  function pickTarget(lines, ctx) {
    const ok = [];
    for (let i = ctx; i < lines.length - 1; i++) {
      const line = lines[i];
      const words = line.text.split(/\s+/).filter(Boolean);
      const lead = line.time - lines[i - ctx].time;
      if (words.length >= 3 && line.text !== lines[i - 1].text && line.time > 8 && lead >= 3 && lead <= 30 &&
          lines.slice(i - ctx, i).every((l) => l.text)) ok.push(i);
    }
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : -1;
  }

  function newLyricsRound(tries) {
    tries = tries || 0;
    current = [];
    const pool = lyricsPool();
    const box = $("words");
    box.innerHTML = "";
    if (!pool.length) { box.textContent = t("noSongs"); return; }

    const level = settings.difficulty === "vegyes"
      ? LEVELS[Math.floor(Math.random() * LEVELS.length)]
      : settings.difficulty;
    const song = data().songs[drawSong()];
    const round = { song, level, phase: "loading", lines: null, i: -1, player: null };
    lyr = round;

    const status = document.createElement("div");
    status.className = "lyr-status";
    status.textContent = t("loadingSong");
    const meta = document.createElement("div");
    meta.className = "lyr-meta";
    const context = document.createElement("div");
    context.className = "lyr-context";
    const frame = document.createElement("div");
    frame.className = "lyr-player";
    const inner = document.createElement("div");
    inner.className = "player-frame " + (settings.player === "youtube" && song.yt ? "yt" : "sp");
    const cover = document.createElement("div");
    cover.className = "lyr-cover";
    cover.textContent = "🎵";
    frame.append(inner, cover);
    const replay = document.createElement("button");
    replay.type = "button";
    replay.className = "btn btn-ghost lyr-replay";
    replay.textContent = t("replay");
    replay.hidden = true;
    const lvl = document.createElement("div");
    lvl.className = "level";
    lvl.textContent = t("levels." + level);
    box.append(status, meta, context, frame, replay, lvl);

    fetchLyrics(song.lrc).then((ly) => {
      if (lyr !== round) return; // közben új kör indult / a new round started meanwhile
      const lines = ly ? ly.synced.filter((l) => l.text) : [];
      const ctx = CONTEXT[level];
      const i = pickTarget(lines, ctx);
      if (i < 0) { if (tries < 5) newLyricsRound(tries + 1); else status.textContent = t("noSongs"); return; }
      round.lines = lines;
      round.i = i;
      round.from = Math.max(0, lines[i - ctx].time - 0.4);
      round.until = Math.max(round.from + 1, lines[i].time - 0.15);

      // könnyű: cím + előző sor; közepes: cím; nehéz: semmi (csak a megoldásnál)
      // easy: title + previous line; medium: title; hard: nothing until the answer
      if (level !== "nehez") meta.textContent = song.t + " – " + song.a;
      if (level === "konnyu") context.textContent = quote(lines[i - 1].text + " …");

      round.player = makePlayer(inner, song);

      // Biztonsági háló: ha a hang nem halad (letiltott videó, 30 mp-es Spotify-előnézet),
      // szövegként mutatjuk az előzményt, és megy tovább a játék.
      // Safety net: if the audio isn't progressing (blocked video, 30 s Spotify preview),
      // show the lead-in as text and carry on.
      const textFallback = () => {
        if (lyr !== round || round.phase !== "listening") return;
        round.player.stop();
        context.innerHTML = "";
        lines.slice(i - ctx, i).forEach((l) => {
          const p = document.createElement("div");
          p.textContent = l.text;
          context.appendChild(p);
        });
        const note = document.createElement("div");
        note.className = "lyr-note";
        note.textContent = t("audioFailed");
        context.appendChild(note);
        meta.textContent = song.t + " – " + song.a;
        round.phase = "answer";
        status.textContent = t("continueNow");
        renderActions();
        startTimer();
      };
      let lastPos = -1;
      let stuck = 0;
      const watchdog = setInterval(() => {
        if (lyr !== round || round.phase !== "listening") return clearInterval(watchdog);
        const pos = round.player.time();
        const inRange = pos >= round.from - 1 && pos <= round.until + 1;
        stuck = Math.abs(pos - lastPos) < 0.05 || !inRange ? stuck + 1 : 0;
        lastPos = pos;
        if (stuck >= 4) { clearInterval(watchdog); textFallback(); } // ~12 mp / ~12 s
      }, 3000);

      const listen = () => {
        status.textContent = t("listen");
        round.player.play(round.from, round.until, () => {
          if (lyr !== round) return;
          replay.hidden = false;
          if (round.phase === "listening") {
            round.phase = "answer";
            status.textContent = t("continueNow");
            renderActions();
            startTimer();
          } else {
            status.textContent = t("continueNow");
          }
        });
      };
      replay.onclick = listen;
      round.phase = "listening";
      round.player.ready.then(() => { if (lyr === round) listen(); }).catch(textFallback);
    });
  }

  // Megoldás: a hiányzó sor (+ a következő) és a folytatás lejátszása
  // Answer: the missing line (+ the next one) and playing on from there
  function renderLyricsAnswer() {
    const round = lyr;
    if (!round || !round.lines) return;
    const box = $("reveal");
    if (!box.hidden && box.dataset.round === String(turnsPlayed) + ":lyr") return;
    box.innerHTML = "";
    box.dataset.round = String(turnsPlayed) + ":lyr";
    $("hint-box").hidden = true;
    const card = $("words");
    const cover = card.querySelector(".lyr-cover");
    if (cover) cover.remove();
    card.querySelector(".lyr-meta").textContent = round.song.t + " – " + round.song.a;

    const item = document.createElement("div");
    item.className = "reveal-item";
    const h = document.createElement("h3");
    h.textContent = t("answerTitle");
    const lines = document.createElement("div");
    round.lines.slice(round.i - 1, round.i + 2).forEach((l, k) => {
      const p = document.createElement("p");
      p.className = "line" + (k === 0 ? " before" : "");
      if (k === 1) {
        const m = document.createElement("mark");
        m.textContent = l.text;
        p.appendChild(m);
      } else {
        p.textContent = l.text;
      }
      lines.appendChild(p);
    });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost play-from";
    btn.textContent = t("playOn");
    btn.onclick = () => { if (round.player) round.player.play(Math.max(0, round.lines[round.i].time - 0.3)); };
    item.append(h, lines, btn, spotifyLink(round.song));
    box.appendChild(item);
    box.hidden = false;
  }

  // ---------- Körök / rounds ----------
  function newRound() {
    window.Player.destroyAll(); // az előző dal leáll / the previous song stops
    stopTimer();
    resolved = false;
    lyr = null;
    $("card").classList.remove("timeout", "success");
    $("hint-box").hidden = true;
    $("reveal").hidden = true;
    $("reveal").innerHTML = "";
    $("timer").hidden = true;
    $("reroll-btn").textContent = isLyrics() ? t("otherSong") : t("reroll");
    if (isLyrics()) {
      newLyricsRound();
    } else {
      current = drawRound();
      renderWords();
      startTimer();
    }
    renderTurn();
    renderActions();
  }
  const roundPoints = () => (isLyrics() ? 1 : current.length);

  // Körönkénti mód / take turns
  function resolve(ok) {
    stopTimer();
    resolved = true;
    if (ok) {
      players[turnIndex].score += roundPoints();
      $("card").classList.add("success");
      cheer();
    } else {
      revealAnswer();
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
      p.score += roundPoints();
      p.times.push(secs);
      lastFast = { name: p.name, secs };
      $("card").classList.add("success");
      cheer();
      if (p.score >= Number(settings.goal)) gameOver = true;
    } else {
      lastFast = null;
      revealAnswer();
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
    newRound();
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
    newRound();
    renderScoreboard();
  }

  function endGame() {
    stopTimer();
    window.Player.destroyAll();
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
    $("reroll-btn").addEventListener("click", () => { if (!resolved) newRound(); });
    $("hint-btn").addEventListener("click", () => {
      const box = $("hint-box");
      if (box.hidden) renderHint(); else box.hidden = true;
    });
    $("reveal-btn").addEventListener("click", revealAnswer);
  }

  init();
})();
