// Minden playlist-dalhoz keres egy beágyazható YouTube-videót, aminek a hossza egyezik a Spotify-számmal
// (így az lrclib időbélyegei pontosan stimmelnek), és lekéri, van-e időzített dalszöveg.
// Finds an embeddable YouTube upload for each track whose length matches the Spotify track
// (so lrclib's timestamps line up), and checks whether lrclib has synced lyrics.
// Results go to .cache/ (not committed). Usage: NODE_USE_ENV_PROXY=1 node tools/fetch-youtube.mjs
import { readFile, writeFile, mkdir, access } from "node:fs/promises";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const clean = (t) => t.replace(/\s*[([](feat\.|with |from )[^)\]]*[)\]]/gi, "").replace(/\s+-\s+.*remix.*$/i, "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
      if (r.ok) return { status: r.status, text: await r.text() };
      if (r.status < 500) return { status: r.status, text: "" };
    } catch (_) { /* retry */ }
    await sleep(1000 * (i + 1));
  }
  return { status: 0, text: "" };
}

const toSecs = (s) => s.split(":").reduce((a, b) => a * 60 + Number(b), 0);

function parseResults(html) {
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (o.videoRenderer && o.videoRenderer.lengthText) {
      const v = o.videoRenderer;
      out.push({
        id: v.videoId,
        title: (v.title.runs || []).map((r) => r.text).join(""),
        channel: ((v.ownerText || {}).runs || []).map((r) => r.text).join(""),
        dur: toSecs(v.lengthText.simpleText || "0"),
      });
      return;
    }
    for (const k in o) walk(o[k]);
  })(JSON.parse(m[1]));
  return out;
}

// Előnyben: "- Topic" csatorna (automatikus, pontos hanganyag), "audio"; kerülendő: live, remix, cover…
// Prefer "- Topic" channels (exact studio audio) and "audio" uploads; avoid live/remix/cover/sped up.
function score(v, track) {
  const t = (v.title + " " + v.channel).toLowerCase();
  let s = -Math.abs(v.dur - track.d) * 3;
  if (/- topic$/i.test(v.channel)) s += 20;
  if (/audio/.test(t)) s += 8;
  if (/official/.test(t)) s += 3;
  if (/\b(live|koncert|remix|cover|sped up|slowed|karaoke|instrumental|8d|reverb)\b/.test(t)) s -= 30;
  const title = clean(track.t).toLowerCase().normalize("NFC");
  if (t.includes(title)) s += 5;
  return s;
}

async function embeddable(id) {
  const r = await fetchText(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`);
  return r.status === 200;
}

for (const lang of ["hu", "en"]) {
  const tracks = JSON.parse(await readFile(`data/tracks-${lang}.json`, "utf8"));
  await mkdir(`.cache/youtube/${lang}`, { recursive: true });
  let found = 0;
  for (const tr of tracks) {
    const file = `.cache/youtube/${lang}/${tr.id}.json`;
    try { await access(file); found += JSON.parse(await readFile(file, "utf8")).yt ? 1 : 0; continue; } catch (_) { /* not cached */ }

    // időzített dalszöveg az lrclib-ről / synced lyrics from lrclib
    let synced = false;
    try {
      const ly = JSON.parse(await readFile(`.cache/lyrics/${lang}/${tr.id}.json`, "utf8"));
      if (ly.lrclib) {
        const r = await fetchText(`https://lrclib.net/api/get/${ly.lrclib}`);
        synced = r.status === 200 && Boolean(JSON.parse(r.text).syncedLyrics);
      }
    } catch (_) { /* no lyrics */ }

    const q = encodeURIComponent(`${tr.a.split(",")[0]} ${clean(tr.t)} audio`);
    const { text } = await fetchText(`https://www.youtube.com/results?search_query=${q}`);
    const candidates = parseResults(text)
      .filter((v) => Math.abs(v.dur - tr.d) <= 3)
      .sort((a, b) => score(b, tr) - score(a, tr));
    let pick = null;
    for (const v of candidates.slice(0, 4)) {
      if (score(v, tr) < -20) break;
      if (await embeddable(v.id)) { pick = v; break; }
    }
    await writeFile(file, JSON.stringify({ yt: pick ? pick.id : null, ytTitle: pick ? `${pick.title} — ${pick.channel}` : null, synced }));
    if (pick) found++; else console.log(`  ✗ ${lang}: ${tr.t} — ${tr.a}`);
    await sleep(400);
  }
  console.log(`${lang}: ${found}/${tracks.length} with a matching YouTube video`);
}
