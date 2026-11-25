// Spotify Premium: bejelentkezés (PKCE, szerver nélkül) és lejátszás teljes dalokkal.
//  - számítógépen: Web Playback SDK – a böngészőfül maga lesz egy Spotify-eszköz;
//  - telefonon (ahol az SDK nem működik): Spotify Connect – a telefonos Spotify-appot vezéreljük.
// Spotify Premium: login (PKCE, no server needed) and full-track playback.
//  - desktop: Web Playback SDK – the browser tab itself becomes a Spotify device;
//  - phones (where the SDK isn't supported): Spotify Connect – we drive the Spotify app.
(function (root) {
  "use strict";

  const AUTH = "https://accounts.spotify.com/authorize";
  const TOKEN = "https://accounts.spotify.com/api/token";
  const API = "https://api.spotify.com/v1";
  const SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";
  const KEY = "enekelj:spotify";
  const BROWSER = "browser"; // az SDK-eszköz jele / marker for the SDK device

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* nem baj */ } },
  };

  const state = {
    clientId: "",
    profile: null,      // { name, premium }
    sdkPlayer: null,
    sdkDeviceId: null,
    sdkError: null,     // pl. "initialization_error" mobilon / e.g. on phones
    listeners: new Set(),
  };
  const emit = () => state.listeners.forEach((f) => { try { f(); } catch (_) { /* nem baj */ } });

  function redirectUri() {
    return location.origin + location.pathname;
  }
  function clientId() {
    return (root.APP_CONFIG && root.APP_CONFIG.spotifyClientId) || store.get().clientId || "";
  }

  // ---- PKCE ----
  function randomString(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join("");
  }
  async function challenge(verifier) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function login(id) {
    const cid = id || clientId();
    if (!cid) throw new Error("no-client-id");
    const verifier = randomString(64);
    const st = randomString(16);
    store.set({ ...store.get(), clientId: cid, verifier, state: st });
    const q = new URLSearchParams({
      response_type: "code",
      client_id: cid,
      scope: SCOPES,
      redirect_uri: redirectUri(),
      code_challenge_method: "S256",
      code_challenge: await challenge(verifier),
      state: st,
    });
    location.href = AUTH + "?" + q.toString();
  }

  async function tokenRequest(body) {
    const r = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    if (!r.ok) throw new Error("token " + r.status);
    const j = await r.json();
    const s = store.get();
    store.set({
      ...s,
      access: j.access_token,
      refresh: j.refresh_token || s.refresh,
      expires: Date.now() + (j.expires_in - 60) * 1000,
    });
  }

  // Visszatérés a Spotify bejelentkezésből (?code=...) / returning from the Spotify login
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    const code = q.get("code");
    if (!code && !q.get("error")) return false;
    const s = store.get();
    history.replaceState(null, "", redirectUri());
    if (!code || q.get("state") !== s.state) return false;
    await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: s.clientId,
      code_verifier: s.verifier,
    });
    return true;
  }

  async function token() {
    const s = store.get();
    if (!s.access) return null;
    if (Date.now() < s.expires) return s.access;
    if (!s.refresh) return null;
    try {
      await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refresh, client_id: s.clientId });
      return store.get().access;
    } catch (_) {
      logout();
      return null;
    }
  }

  async function api(method, path, body) {
    const tk = await token();
    if (!tk) throw new Error("not-logged-in");
    const r = await fetch(API + path, {
      method,
      headers: { Authorization: "Bearer " + tk, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204 || r.status === 202) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error((j && j.error && (j.error.reason || j.error.message)) || "http " + r.status);
      err.status = r.status;
      throw err;
    }
    return j;
  }

  function logout() {
    const s = store.get();
    store.set({ clientId: s.clientId });
    state.profile = null;
    if (state.sdkPlayer) { try { state.sdkPlayer.disconnect(); } catch (_) { /* nem baj */ } }
    state.sdkPlayer = null;
    state.sdkDeviceId = null;
    emit();
  }

  // ---- Web Playback SDK (számítógépen) / (desktop) ----
  function initSdk() {
    if (state.sdkPlayer || state.sdkError) return;
    root.onSpotifyWebPlaybackSDKReady = () => {
      const p = new root.Spotify.Player({
        name: "Énekelj!",
        getOAuthToken: (cb) => { token().then((tk) => tk && cb(tk)); },
        volume: 0.9,
      });
      p.addListener("ready", ({ device_id }) => { state.sdkDeviceId = device_id; emit(); });
      p.addListener("not_ready", () => { state.sdkDeviceId = null; emit(); });
      ["initialization_error", "authentication_error", "account_error"].forEach((ev) =>
        p.addListener(ev, () => { state.sdkError = ev; state.sdkDeviceId = null; emit(); }));
      p.connect();
      state.sdkPlayer = p;
    };
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    s.onerror = () => { state.sdkError = "load"; emit(); };
    document.head.appendChild(s);
  }

  // A böngésző automatikus lejátszás-tiltását egy koppintásnál fel kell oldani.
  // Browsers' autoplay block must be lifted during a tap.
  function activate() {
    if (state.sdkPlayer && state.sdkPlayer.activateElement) {
      try { state.sdkPlayer.activateElement(); } catch (_) { /* nem baj */ }
    }
  }

  async function init() {
    state.clientId = clientId();
    try { await handleRedirect(); } catch (_) { /* hibás visszatérés – nem baj */ }
    if (!(await token())) { emit(); return; }
    try {
      const me = await api("GET", "/me");
      state.profile = { name: me.display_name || me.id, premium: me.product === "premium" };
    } catch (_) {
      logout();
      return;
    }
    if (state.profile.premium) initSdk();
    emit();
  }

  // Elérhető eszközök: ez a böngésző (ha az SDK működik) + a Spotify Connect eszközök
  // Available devices: this browser (if the SDK works) + Spotify Connect devices
  async function devices() {
    const out = [];
    if (state.sdkDeviceId) out.push({ id: BROWSER, name: null, type: "browser" });
    try {
      const j = await api("GET", "/me/player/devices");
      (j.devices || []).forEach((d) => {
        if (d.id !== state.sdkDeviceId && !d.is_restricted) out.push({ id: d.id, name: d.name, type: d.type.toLowerCase() });
      });
    } catch (_) { /* nem baj */ }
    return out;
  }

  const deviceIdFor = (dev) => (dev === BROWSER ? state.sdkDeviceId : dev);

  async function play(dev, trackId, fromSec) {
    const id = deviceIdFor(dev);
    if (!id) throw Object.assign(new Error("no-device"), { status: 404 });
    activate();
    await api("PUT", "/me/player/play?device_id=" + encodeURIComponent(id), {
      uris: ["spotify:track:" + trackId],
      position_ms: Math.max(0, Math.round((fromSec || 0) * 1000)),
    });
  }
  // Ugrás a dal adott pontjára. Kell, mert a Spotify a lejátszás indításakor gyakran figyelmen
  // kívül hagyja a position_ms-t (főleg egy eszköz első lejátszásánál), és 0:00-ról indul.
  // Seek to a point in the track. Needed because Spotify often ignores position_ms when starting
  // playback (especially the first play on a device) and starts at 0:00.
  async function seek(dev, sec) {
    const ms = Math.max(0, Math.round(sec * 1000));
    if (dev === BROWSER && state.sdkPlayer) {
      try { await state.sdkPlayer.seek(ms); return; } catch (_) { /* jöhet az API / fall back to the API */ }
    }
    const id = deviceIdFor(dev);
    if (!id) return;
    await api("PUT", "/me/player/seek?position_ms=" + ms + "&device_id=" + encodeURIComponent(id));
  }

  async function pause(dev) {
    const id = deviceIdFor(dev);
    if (!id) return;
    try { await api("PUT", "/me/player/pause?device_id=" + encodeURIComponent(id)); } catch (_) { /* már áll / already paused */ }
  }
  // Pontos pozíció: SDK-nál közvetlenül, Connect-nél a /me/player-ből
  // Exact position: straight from the SDK, or from /me/player for Connect
  async function position(dev) {
    if (dev === BROWSER && state.sdkPlayer) {
      const s = await state.sdkPlayer.getCurrentState();
      return s ? s.position / 1000 : null;
    }
    try {
      const j = await api("GET", "/me/player");
      return j && j.progress_ms != null ? j.progress_ms / 1000 : null;
    } catch (_) { return null; }
  }

  // A lejátszó valós állapota: melyik dal szól, hol tart, megy-e
  // Real player state: which track, where it is, whether it's playing
  async function playerState(dev) {
    if (dev === BROWSER && state.sdkPlayer) {
      const s = await state.sdkPlayer.getCurrentState();
      if (!s) return null;
      const tr = s.track_window && s.track_window.current_track;
      return { track: tr && (tr.linked_from && tr.linked_from.id || tr.id), alt: tr && tr.id, pos: s.position / 1000, playing: !s.paused };
    }
    try {
      const j = await api("GET", "/me/player?_=" + Date.now());
      if (!j || !j.item) return null;
      return {
        track: (j.item.linked_from && j.item.linked_from.id) || j.item.id,
        alt: j.item.id,
        device: j.device && j.device.id,
        pos: (j.progress_ms || 0) / 1000,
        playing: Boolean(j.is_playing),
      };
    } catch (_) { return null; }
  }

  root.SpotifyPremium = {
    BROWSER,
    init, login, logout, devices, play, pause, seek, position, playerState, activate,
    redirectUri, clientId, deviceIdFor,
    setClientId(id) { store.set({ ...store.get(), clientId: id.trim() }); state.clientId = id.trim(); emit(); },
    loggedIn: () => Boolean(state.profile),
    profile: () => state.profile,
    sdkReady: () => Boolean(state.sdkDeviceId),
    sdkError: () => state.sdkError,
    onChange(f) { state.listeners.add(f); },
  };
})(window);
