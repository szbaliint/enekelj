// Szóegyeztetés dalszövegben – a böngésző és a build szkript (tools/build.mjs) is ezt használja.
// Word matching in lyrics – shared by the browser and the build script (tools/build.mjs).
(function (root) {
  "use strict";

  function tokens(text) {
    return text.toLowerCase().split(/[^\p{L}\d'’-]+/u)
      .map((t) => t.replace(/^['’-]+|['’-]+$/g, ""))
      .filter(Boolean);
  }

  // Egy dalszöveg-szó (token) megfelel-e a keresett szónak?
  // Magyarban ragozott alak is jó (szív → szívem), angolban csak többes szám / birtokos (dream → dreams).
  function tokenMatches(word, token, lang) {
    if (token === word) return true;
    let stem = word;
    // magyar tővégi magánhangzó-nyúlás: pálinka → pálinkát, kocsma → kocsmában
    if (lang === "hu" && word.length >= 4 && /[ae]$/.test(word) && !token.startsWith(word)) {
      stem = word.slice(0, -1) + (word.endsWith("a") ? "á" : "é");
    }
    if (!token.startsWith(stem)) return false;
    const suffix = token.slice(stem.length);
    if (lang === "en") return word.length >= 3 && /^(s|es|'s|’s)$/.test(suffix);
    if (word.length <= 3) return false;
    return suffix.length <= (word.length === 4 ? 2 : 4);
  }

  // Egy sor (vagy szöveg) tartalmazza-e a szót / kifejezést?
  function textMatches(word, text, lang) {
    const parts = tokens(word);
    const toks = tokens(text);
    if (parts.length === 1) return toks.some((t) => tokenMatches(parts[0], t, lang));
    // kifejezés: egymás után következő szavak / phrase: consecutive tokens
    for (let i = 0; i + parts.length <= toks.length; i++) {
      if (parts.every((p, j) => tokenMatches(p, toks[i + j], lang))) return true;
    }
    return false;
  }

  // Az első sor, amiben a szó elhangzik / first lyric line containing the word
  function findLine(word, lyrics, lang) {
    return lyrics.split("\n").find((line) => textMatches(word, line, lang)) || null;
  }

  root.Match = { tokens, tokenMatches, textMatches, findLine };
})(typeof window !== "undefined" ? window : globalThis);
