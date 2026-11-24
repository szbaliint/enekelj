# Énekelj! / Sing It! 🎤

🇬🇧 **English:** a party game – the app deals a random word (or two, or three), and you have to sing a song that contains it. Switch to English with the **EN** button at the top of the start screen. Every word is actually sung in at least one song on the [random chill](https://open.spotify.com/playlist/4Kcl4WIGu4h1YTqYN8midO) playlist; when time runs out, the app shows that song with the lyric line and a Spotify player.

Two modes: **🎤 Take turns** (everyone gets their own word) and **⚡ Speed race** (everyone gets the same word, the fastest singer scores, first to 3/5/10 points wins).

🇭🇺 **Magyar:**

Társasjáték telefonra vagy laptopra: az app dob egy random magyar szót (vagy kettőt, hármat), a soron következő játékosnak pedig el kell énekelnie egy dalt, amiben a szó elhangzik.

## Játék

1. Válassz játékmódot:
   - **🎤 Körönként:** sorban jöttök, mindenki a saját szavát kapja.
   - **⚡ Gyorsasági:** mindenki ugyanazt a szót kapja; koppints annak a nevére, aki elsőként elénekelt egy dalt vele. Az nyer, aki elsőként eléri a 3/5/10 pontot (holtversenynél a gyorsabb átlagidő).
2. Válassz nyelvet (🇭🇺 HU / 🇬🇧 EN), és add hozzá a játékosokat (nem kötelező; nélkülük csak szavakat dob, pontozás nélkül).
3. Válassz nehézséget (Könnyű / Közepes / Nehéz / Vegyes), hogy hány szó legyen körönként, és mennyi idő jár.
4. Ha a játékos az idő lejárta előtt elénekel egy sort egy dalból, amiben a szó benne van: **✓ Elénekelte!** (szavanként 1 pont). Ha nem: **✗ Nem ment**.
5. Minden szó **tényleg elhangzik** legalább egy dalban a referencia-playlistről ([magyar chill pt2](https://open.spotify.com/playlist/5QrmfO0XziaHFTL4wr8XNW)).
   - **💡 Tipp**: megmutatja, mely dalokban.
   - **🎧 Megoldás**: ha lejár az idő (vagy senkinek sem ment), magától megjelenik a dal, a dalszöveg sora kiemelt szóval, és egy Spotify-lejátszó.

## Futtatás

Nincs build és nincs függőség: elég megnyitni az `index.html`-t böngészőben, vagy kirakni bármilyen statikus tárhelyre (pl. GitHub Pages).

## Fájlok

- `data/words-hu.json`, `data/words-en.json`: a jelölt szavak nehézség szerint. Ide írhatsz új szavakat.
- `data/tracks-hu.json`, `data/tracks-en.json`: a playlistek dalai (cím, előadó, Spotify-azonosító).
- `js/data-hu.js`, `js/data-en.js`: **generált** fájlok – csak azok a szavak, amelyek tényleg elhangzanak valamelyik dalban, a dalokkal együtt.
- `js/match.js`: a szóegyeztetés (ragozott alakokkal: szív → szívem, pálinka → pálinkát).
- `js/i18n.js`: a felület szövegei mindkét nyelven.
- `js/app.js`: a játék logikája.
- `styles.css`: a megjelenés.

## Szólista frissítése

A dalszövegeket az [lrclib.net](https://lrclib.net) adja. A repóban **nincs dalszöveg**: a build csak arra használja őket, hogy kiszűrje a szavakat, a játék pedig futás közben kéri le az adott sort.

```bash
node tools/fetch-lyrics.mjs   # dalszövegek letöltése a .cache/ mappába (proxy mögött: NODE_USE_ENV_PROXY=1)
node tools/build.mjs          # js/data-*.js újragenerálása; kiírja, mely szavak estek ki
```
