# Énekelj! 🎤

Társasjáték telefonra vagy laptopra: az app dob egy random magyar szót (vagy kettőt, hármat), a soron következő játékosnak pedig el kell énekelnie egy dalt, amiben a szó elhangzik.

## Játék

1. Add hozzá a játékosokat (nem kötelező; nélkülük csak szavakat dob, pontozás nélkül).
2. Válassz nehézséget (Könnyű / Közepes / Nehéz / Vegyes), hogy hány szó legyen körönként, és mennyi idő jár.
3. Ha a játékos az idő lejárta előtt elénekel egy sort egy dalból, amiben a szó benne van: **✓ Elénekelte!** (szavanként 1 pont). Ha nem: **✗ Nem ment**.
4. **💡 Tipp**: dalokat mutat a referencia-playlistről ([magyar chill pt2](https://open.spotify.com/playlist/5QrmfO0XziaHFTL4wr8XNW)), amelyek címében szerepel a szó.

## Futtatás

Nincs build és nincs függőség: elég megnyitni az `index.html`-t böngészőben, vagy kirakni bármilyen statikus tárhelyre (pl. GitHub Pages).

## Fájlok

- `js/words.js`: a szólisták nehézség szerint. Ide írhatsz új szavakat.
- `js/playlist.js`: a referencia-playlist 100 dala (cím és előadó), a tippekhez.
- `js/app.js`: a játék logikája.
- `styles.css`: a megjelenés.
