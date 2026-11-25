# Énekelj! / Sing It! 🎤

🇬🇧 **English:** a party game – the app deals a random word (or two, or three), and you have to sing a song that contains it. Switch to English with the **EN** button at the top of the start screen. Every word is actually sung in at least one song on the [random chill](https://open.spotify.com/playlist/4Kcl4WIGu4h1YTqYN8midO) playlist; when time runs out, the app shows that song with the lyric line and a Spotify player.

Two games: **🔤 Words** (sing a song with the word) and **🎵 Finish it!** (a song plays, stops before a line, and you sing how it goes on; when time's up the lyrics appear and you can hear the rest). Both can be played **🎤 taking turns** or as a **⚡ speed race** (fastest singer scores, first to 3/5/10 points wins).

Songs play on **YouTube** (full song from any point, no login), the **Spotify** embed (30 s preview unless the browser is logged in), or **★ Spotify Premium** (log in once; every song plays in full from exactly the right line – in the browser on a computer, or through the Spotify app on a phone). If YouTube can't play a video, the app switches to Spotify by itself; if the browser blocks autoplay, tap the video and it jumps to the right spot; if no audio plays at all, *Finish it!* shows the lead-in as text so the round still works. Playback stops whenever the next round starts.

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
6. **Lejátszó:**
   - **▶ YouTube:** teljes dal, bárhonnan, bejelentkezés nélkül. Ha a böngésző nem engedi elindítani (főleg telefonon), koppints a videóra – magától a jó helyre ugrik.
   - **● Spotify:** beágyazott lejátszó – bejelentkezett böngészőben teljes dal, különben 30 mp-es előnézet.
   - **★ Spotify Premium:** egyszeri bejelentkezés után minden dal teljes hosszban, pontosan a kért sortól. Számítógépen magában a böngészőben szól, telefonon a Spotify-appot vezérli (annak nyitva kell lennie) – bármilyen Spotify-eszközt választhatsz (telefon, hangfal, TV).
   
   Ha egy YouTube-videó nem játszható le, az app magától Spotify-ra vált; ha egyáltalán nem szól semmi, a *Fejezd be!* szövegként mutatja a dal elejét. Új körnél a zene mindig leáll.

## Futtatás

Nincs build és nincs függőség: elég megnyitni az `index.html`-t böngészőben, vagy kirakni bármilyen statikus tárhelyre (pl. GitHub Pages).

## Spotify Premium beállítása (egyszer)

A Spotify-bejelentkezéshez kell egy saját (ingyenes) Spotify-app – ezt csak a Spotify-fiók tulajdonosa tudja létrehozni:

1. Nyisd meg: <https://developer.spotify.com/dashboard> → **Create app**.
2. **Redirect URI:** `https://szbaliint.github.io/enekelj/` (pontosan így, `/`-rel a végén).
3. **Which API/SDKs:** pipáld be a **Web API**-t és a **Web Playback SDK**-t → Save.
4. Másold ki a **Client ID**-t, és vagy írd be a `js/config.js`-be (`spotifyClientId`), vagy add meg az oldalon (Lejátszó → ★ Premium).
5. Fejlesztői módban az app csak azoknak működik, akiket a Dashboardon a **User Management** alatt hozzáadsz (Spotify-fiókjuk e-mail-címével, legfeljebb 25 fő) – add hozzá magadat és a barátaidat.

A Client ID nem titkos; a bejelentkezés PKCE-vel megy, szerver és jelszó nélkül. A tokenek csak a böngészőben tárolódnak.

## Fájlok

- `data/words-hu.json`, `data/words-en.json`: a jelölt szavak nehézség szerint. Ide írhatsz új szavakat.
- `data/tracks-hu.json`, `data/tracks-en.json`: a playlistek dalai (cím, előadó, Spotify-azonosító, hossz).
- `js/data-hu.js`, `js/data-en.js`: **generált** fájlok – csak azok a szavak, amelyek tényleg elhangzanak valamelyik dalban, a dalokkal együtt.
- `js/player.js`: a YouTube-, Spotify- és Premium-lejátszó közös felülete (indítás adott másodperctől, megállás adott ponton, automatikus váltás).
- `js/spotify.js`: Spotify Premium – bejelentkezés (PKCE), Web Playback SDK, Spotify Connect.
- `js/config.js`: a Spotify Client ID helye.
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
sh tools/bump-version.sh       # új verziójel, hogy a telefonok ne a régi, cache-elt fájlokat futtassák
```
