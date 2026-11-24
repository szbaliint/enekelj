# Énekelj! / Sing It! 🎤

🇬🇧 **English:** a party game – the app deals a random word (or two, or three), and you have to sing a song that contains it. Switch to English with the **EN** button at the top of the start screen. Every word is actually sung in at least one song on the [random chill](https://open.spotify.com/playlist/4Kcl4WIGu4h1YTqYN8midO) playlist; when time runs out, the app shows that song with the lyric line and a Spotify player.

Two games: **🔤 Words** (sing a song with the word) and **🎵 Finish it!** (a song plays, stops before a line, and you sing how it goes on; when time's up the lyrics appear and you can hear the rest). Both can be played **🎤 taking turns** or as a **⚡ speed race** (fastest singer scores, first to 3/5/10 points wins).

Songs play on **YouTube** (full song from any point, no login) or **Spotify** (full song when logged in, otherwise a 30 s preview); if YouTube can't play a video, the app switches to Spotify by itself, and if no audio plays at all, *Finish it!* shows the lead-in as text so the round still works. Playback stops whenever the next round starts.

🇭🇺 **Magyar:**

Társasjáték telefonra vagy laptopra: az app dob egy random magyar szót (vagy kettőt, hármat), a soron következő játékosnak pedig el kell énekelnie egy dalt, amiben a szó elhangzik.

## Játék

1. Válassz játékot:
   - **🔤 Szavak:** kapsz egy szót, és el kell énekelned egy dalt, amiben elhangzik.
   - **🎵 Fejezd be!:** elindul egy dal a playlistről, majd egy sor előtt elhallgat – énekeld el, hogyan folytatódik! Ha lejár az idő, megjelenik a szöveg, és meghallgathatjátok a folytatást. A nehézség azt dönti el, mennyit hallasz előtte (könnyű: 3 sor + cím + előző sor szövege, közepes: 2 sor + cím, nehéz: 1 sor).
   
   És hogy hogyan játszotok:
   - **🎤 Körönként:** sorban jöttök, mindenki a saját körét kapja.
   - **⚡ Gyorsasági:** mindenki egyszerre játszik ugyanarra; koppints annak a nevére, aki elsőként elénekelte. Az nyer, aki elsőként eléri a 3/5/10 pontot (holtversenynél a gyorsabb átlagidő).
2. Válassz nyelvet (🇭🇺 HU / 🇬🇧 EN), és add hozzá a játékosokat (nem kötelező; nélkülük csak szavakat dob, pontozás nélkül).
3. Válassz nehézséget (Könnyű / Közepes / Nehéz / Vegyes), hogy hány szó legyen körönként, és mennyi idő jár.
4. Ha a játékos az idő lejárta előtt elénekel egy sort egy dalból, amiben a szó benne van: **✓ Elénekelte!** (szavanként 1 pont). Ha nem: **✗ Nem ment**.
5. Minden szó **tényleg elhangzik** legalább egy dalban a referencia-playlistről ([magyar chill pt2](https://open.spotify.com/playlist/5QrmfO0XziaHFTL4wr8XNW)).
   - **💡 Tipp**: megmutatja, mely dalokban.
   - **🎧 Megoldás**: ha lejár az idő (vagy senkinek sem ment), magától megjelenik a dal, a dalszöveg sora kiemelt szóval, és egy lejátszó. A **▶ Lejátszás innen** gomb pont attól a sortól indítja a dalt.
6. **Lejátszó:** YouTube (teljes dal, bárhonnan, bejelentkezés nélkül) vagy Spotify (bejelentkezve teljes dal, különben 30 mp-es előnézet). Ha egy YouTube-videó nem játszható le, az app magától Spotify-ra vált; ha egyáltalán nem szól semmi, a *Fejezd be!* szövegként mutatja a dal elejét. Új körnél a zene mindig leáll.

## Futtatás

Nincs build és nincs függőség: elég megnyitni az `index.html`-t böngészőben, vagy kirakni bármilyen statikus tárhelyre (pl. GitHub Pages).

## Fájlok

- `data/words-hu.json`, `data/words-en.json`: a jelölt szavak nehézség szerint. Ide írhatsz új szavakat.
- `data/tracks-hu.json`, `data/tracks-en.json`: a playlistek dalai (cím, előadó, Spotify-azonosító, hossz).
- `js/data-hu.js`, `js/data-en.js`: **generált** fájlok – csak azok a szavak, amelyek tényleg elhangzanak valamelyik dalban, a dalokkal együtt.
- `js/player.js`: a YouTube- és Spotify-lejátszó közös felülete (indítás adott másodperctől, megállás adott ponton, automatikus váltás).
- `js/match.js`: a szóegyeztetés (ragozott alakokkal: szív → szívem, pálinka → pálinkát).
- `js/i18n.js`: a felület szövegei mindkét nyelven.
- `js/app.js`: a játék logikája.
- `styles.css`: a megjelenés.

## Szólista frissítése

A dalszövegeket (időzítéssel együtt) az [lrclib.net](https://lrclib.net) adja. A repóban **nincs dalszöveg**: a build csak arra használja őket, hogy kiszűrje a szavakat, a játék pedig futás közben kéri le az adott sort.

```bash
node tools/fetch-lyrics.mjs    # dalszövegek letöltése a .cache/ mappába (proxy mögött: NODE_USE_ENV_PROXY=1)
node tools/fetch-youtube.mjs   # minden dalhoz egy beágyazható, pontosan egyező hosszúságú YouTube-videó
node tools/build.mjs           # js/data-*.js újragenerálása; kiírja, mely szavak estek ki
```
