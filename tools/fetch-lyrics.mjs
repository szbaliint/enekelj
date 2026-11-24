// Lekéri a playlistek dalszövegeit az lrclib.net-ről a .cache/lyrics mappába (nincs a repóban).
// Fetches lyrics for every playlist track from lrclib.net into .cache/lyrics (not committed).
// Usage: node tools/fetch-lyrics.mjs   (behind a proxy: NODE_USE_ENV_PROXY=1 node ...)
import { readFile, writeFile, mkdir, access } from "node:fs/promises";

const API = "https://lrclib.net/api";
const UA = "enekelj-game (https://github.com/szbaliint/enekelj)";
const clean = (t) => t.replace(/\s*[([](feat\.|with |from )[^)\]]*[)\]]/gi, "").replace(/\s+-\s+.*remix.*$/i, "").trim();

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 404) return null;
      if (r.ok) return r.json();
    } catch (_) { /* retry */ }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

async function find(track) {
  const title = clean(track.t);
  const artist = track.a.split(",")[0].trim();
  const q = (o) => new URLSearchParams(o).toString();
  const exact = await get(`${API}/get?${q({ track_name: title, artist_name: artist, duration: track.d })}`);
  if (exact && exact.plainLyrics) return exact;
  const results = [
    ...((await get(`${API}/search?${q({ track_name: title, artist_name: artist })}`)) || []),
    // lazább, szabadszavas keresés / looser free-text search
    ...((await get(`${API}/search?${q({ q: title + " " + artist })}`)) || []),
    ...((await get(`${API}/search?${q({ q: title })}`)) || []).filter((r) =>
      norm(r.artistName).includes(norm(artist)) || norm(artist).includes(norm(r.artistName))),
  ];
  const withText = results.filter((r) => r.plainLyrics && Math.abs(r.duration - track.d) <= 15);
  withText.sort((a, b) => Math.abs(a.duration - track.d) - Math.abs(b.duration - track.d));
  return withText[0] || null;
}

for (const lang of ["hu", "en"]) {
  const tracks = JSON.parse(await readFile(`data/tracks-${lang}.json`, "utf8"));
  await mkdir(`.cache/lyrics/${lang}`, { recursive: true });
  let found = 0;
  for (const tr of tracks) {
    const file = `.cache/lyrics/${lang}/${tr.id}.json`;
    try { await access(file); found++; continue; } catch (_) { /* not cached */ }
    const hit = await find(tr);
    await writeFile(file, JSON.stringify(hit ? { lrclib: hit.id, lyrics: hit.plainLyrics } : { lrclib: null }));
    if (hit) found++; else console.log(`  ✗ ${lang}: ${tr.t} — ${tr.a}`);
  }
  console.log(`${lang}: ${found}/${tracks.length} with lyrics`);
}
