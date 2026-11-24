// Lejátszó-réteg: YouTube (teljes dal, bárhonnan, bejelentkezés nélkül) vagy Spotify (bejelentkezve teljes dal,
// különben 30 mp-es előnézet). Mindkettő ugyanazt tudja: play(from, until), stop(), destroy().
// Playback layer: YouTube (full song from any second, no login) or Spotify (full song when logged in,
// otherwise a 30 s preview). Both expose the same interface: play(from, until), stop(), destroy().
(function (root) {
  "use strict";

  const active = new Set();

  // ---- külső API-k betöltése egyszer / load the external APIs once ----
  let ytReady = null;
  function loadYouTube() {
    if (!ytReady) {
      ytReady = new Promise((resolve, reject) => {
        if (root.YT && root.YT.Player) return resolve(root.YT);
        const prev = root.onYouTubeIframeAPIReady;
        root.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(root.YT); };
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.onerror = () => { ytReady = null; reject(new Error("youtube")); };
        document.head.appendChild(s);
      });
    }
    return ytReady;
  }

  let spReady = null;
  function loadSpotify() {
    if (!spReady) {
      spReady = new Promise((resolve, reject) => {
        root.onSpotifyIframeApiReady = (api) => resolve(api);
        const s = document.createElement("script");
        s.src = "https://open.spotify.com/embed/iframe-api/v1";
        s.onerror = () => { spReady = null; reject(new Error("spotify")); };
        document.head.appendChild(s);
      });
    }
    return spReady;
  }

  // ---- YouTube ----
  function youtube(container, videoId) {
    const el = document.createElement("div");
    container.appendChild(el);
    let player = null;
    let destroyed = false;
    let watch = null;
    let onEnd = null;
    const ready = loadYouTube().then((YT) => new Promise((resolve, reject) => {
      if (destroyed) return reject(new Error("destroyed"));
      player = new YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => resolve(player),
          onError: () => { reject(new Error("youtube-error")); fail(); },
        },
      });
    }));

    // Ha a videó nem indul el (letiltva, nem elérhető), szólunk a hívónak.
    // If the video never starts (blocked, unavailable), tell the caller.
    let failTimer = null;
    function fail() {
      clearTimeout(failTimer);
      if (!destroyed && api.onFail) { const f = api.onFail; api.onFail = null; f(); }
    }
    ready.catch(fail);

    const api = {
      kind: "youtube",
      ready,
      onFail: null,
      // from: másodperc; until: itt megáll (opcionális); done: hívódik, amikor megállt
      // from: seconds; until: pause here (optional); done: called when it stopped there
      play(from, until, done) {
        return ready.then((p) => {
          if (destroyed) return;
          clearInterval(watch);
          onEnd = done || null;
          p.seekTo(Math.max(0, from || 0), true);
          p.playVideo();
          clearTimeout(failTimer);
          failTimer = setTimeout(() => {
            if (destroyed) return;
            const st = p.getPlayerState ? p.getPlayerState() : -1;
            // 1 = lejátszás, 2 = szünet, 0 = vége / playing, paused, ended
            if (![0, 1, 2].includes(st) || p.getCurrentTime() < (from || 0) + 0.2) fail();
          }, 7000);
          if (until != null) {
            watch = setInterval(() => {
              if (destroyed) return clearInterval(watch);
              if (p.getCurrentTime() >= until) {
                p.pauseVideo();
                clearInterval(watch);
                if (onEnd) { const f = onEnd; onEnd = null; f(); }
              }
            }, 100);
          }
        });
      },
      stop() {
        clearInterval(watch);
        onEnd = null;
        try { if (player && player.pauseVideo) player.pauseVideo(); } catch (_) { /* nem baj */ }
      },
      time() {
        try { return player && player.getCurrentTime ? player.getCurrentTime() : 0; } catch (_) { return 0; }
      },
      destroy() {
        destroyed = true;
        clearTimeout(failTimer);
        api.stop();
        try { if (player && player.destroy) player.destroy(); } catch (_) { /* nem baj */ }
        container.innerHTML = "";
        active.delete(api);
      },
    };
    active.add(api);
    return api;
  }

  // ---- Spotify ----
  function spotify(container, trackId) {
    const el = document.createElement("div");
    container.appendChild(el);
    let controller = null;
    let destroyed = false;
    let position = 0;
    let playing = false;
    let until = null;
    let onEnd = null;
    const ready = loadSpotify().then((IFrameAPI) => new Promise((resolve, reject) => {
      if (destroyed) return reject(new Error("destroyed"));
      IFrameAPI.createController(el, { uri: "spotify:track:" + trackId, width: "100%", height: 80 }, (c) => {
        controller = c;
        c.addListener("playback_update", (e) => {
          position = e.data.position / 1000;
          playing = !e.data.isPaused;
          if (until != null && !e.data.isPaused && position >= until) {
            until = null;
            c.pause();
            if (onEnd) { const f = onEnd; onEnd = null; f(); }
          }
        });
        c.addListener("ready", () => resolve(c));
      });
    }));

    const api = {
      kind: "spotify",
      ready,
      play(from, stopAt, done) {
        return ready.then((c) => {
          if (destroyed) return;
          until = stopAt == null ? null : stopAt;
          onEnd = done || null;
          c.play();
          if (from) setTimeout(() => { if (!destroyed) c.seek(from); }, 400);
        });
      },
      stop() {
        until = null;
        onEnd = null;
        // csak ha tényleg szól – különben a Spotify-beágyazás hibát dob
        // only when actually playing – otherwise the Spotify embed throws
        try { if (controller && playing) controller.pause(); } catch (_) { /* nem baj */ }
      },
      time() { return position; },
      destroy() {
        destroyed = true;
        api.stop();
        try { if (controller) controller.destroy(); } catch (_) { /* nem baj */ }
        container.innerHTML = "";
        active.delete(api);
      },
    };
    active.add(api);
    return api;
  }

  // Rugalmas lejátszó: YouTube-bal indul (ha van videó és azt kérték), és ha az nem szól,
  // magától átvált Spotify-ra ugyanott, és megismétli az utolsó lejátszási kérést.
  // Adaptive player: starts with YouTube (if there's a video and it was asked for); if that never
  // plays, it switches to Spotify in the same spot and repeats the last play request.
  // song: { yt, id }; onSwitch(kind): called when the source changes
  function smart(container, song, preferYouTube, onSwitch) {
    let impl = null;
    let lastPlay = null;
    let resolveReady;
    const ready = new Promise((res) => { resolveReady = res; });
    const api = {
      kind: null,
      ready,
      play(from, until, done) {
        lastPlay = [from, until, done];
        return impl.ready.then(() => impl.play(from, until, done)).catch(() => {});
      },
      stop() { if (impl) impl.stop(); },
      time() { return impl ? impl.time() : 0; },
      destroy() { if (impl) impl.destroy(); },
    };
    function use(kind) {
      if (impl) impl.destroy();
      impl = kind === "youtube" ? youtube(container, song.yt) : spotify(container, song.id);
      api.kind = kind;
      if (onSwitch) onSwitch(kind);
      if (kind === "youtube") {
        impl.onFail = () => {
          use("spotify");
          if (lastPlay) api.play(...lastPlay);
        };
      }
      impl.ready.then(() => resolveReady(api), () => { if (kind === "spotify") resolveReady(api); });
    }
    use(preferYouTube && song.yt ? "youtube" : "spotify");
    return api;
  }

  // Minden lejátszás leállítása és a lejátszók eltávolítása (pl. új kör / új dal)
  // Stop all playback and remove all players (e.g. next round / next song)
  function destroyAll() {
    [...active].forEach((p) => p.destroy());
  }

  // Időzített dalszöveg feldolgozása: "[mm:ss.xx] szöveg" → [{ time, text }]
  // Parse synced lyrics: "[mm:ss.xx] text" → [{ time, text }]
  function parseSynced(lrc) {
    const out = [];
    (lrc || "").split("\n").forEach((row) => {
      const m = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
      if (m) out.push({ time: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() });
    });
    return out;
  }

  root.Player = { youtube, spotify, smart, destroyAll, parseSynced, list: () => [...active] };
})(window);
