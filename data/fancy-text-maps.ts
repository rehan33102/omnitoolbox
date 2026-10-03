export interface FancyStyle { id: string; label: string; transform: (s: string) => string; }

const off = (ch: string, base: number, start: number) => String.fromCodePoint(base + (ch.codePointAt(0)! - start));

function offsetMap(upper: number, lower: number, digits?: number) {
  return (s: string) =>
    [...s].map((c) => {
      if (c >= "A" && c <= "Z") return off(c, upper, 65);
      if (c >= "a" && c <= "z") return off(c, lower, 97);
      if (digits !== undefined && c >= "0" && c <= "9") return off(c, digits, 48);
      return c;
    }).join("");
}

const DS_EXCEPT: Record<string, string> = { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" };
const doubleStruck = (s: string) =>
  [...s].map((c) => {
    if (DS_EXCEPT[c]) return DS_EXCEPT[c];
    if (c >= "A" && c <= "Z") return off(c, 0x1d538, 65);
    if (c >= "a" && c <= "z") return off(c, 0x1d552, 97);
    if (c >= "0" && c <= "9") return off(c, 0x1d7d8, 48);
    return c;
  }).join("");

const circled = (s: string) =>
  [...s].map((c) => {
    if (c >= "A" && c <= "Z") return off(c, 0x24b6, 65);
    if (c >= "a" && c <= "z") return off(c, 0x24d0, 97);
    if (c >= "1" && c <= "9") return off(c, 0x2460, 49);
    if (c === "0") return "⓪";
    return c;
  }).join("");

const SMALL: Record<string, string> = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ғ", g: "ɢ", h: "ʜ", i: "ɪ",
  j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ",
  s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
};

const FLIP: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ",
  j: "ɾ", k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ",
  s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", E: "Ǝ", H: "H", I: "I", M: "W", N: "N", O: "O", S: "S",
  T: "┴", U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", ".": "˙", ",": "'",
  "!": "¡", "?": "¿", "(": ")", ")": "(", "[": "]", "]": "[",
};

const SCRIPT: Record<string, string> = {
  A: "𝒜", B: "ℬ", C: "𝒞", D: "𝒟", E: "ℰ", F: "ℱ", G: "𝒢", H: "ℋ", I: "ℐ",
  J: "𝒥", K: "𝒦", L: "ℒ", M: "ℳ", N: "𝒩", O: "𝒪", P: "𝒫", Q: "𝒬", R: "ℛ",
  S: "𝒮", T: "𝒯", U: "𝒰", V: "𝒱", W: "𝒲", X: "𝒳", Y: "𝒴", Z: "𝒵",
  a: "𝒶", b: "𝒷", c: "𝒸", d: "𝒹", e: "ℯ", f: "𝒻", g: "ℊ", h: "𝒽", i: "𝒾",
  j: "𝒿", k: "𝓀", l: "𝓁", m: "𝓂", n: "𝓃", o: "ℴ", p: "𝓅", q: "𝓆", r: "𝓇",
  s: "𝓈", t: "𝓉", u: "𝓊", v: "𝓋", w: "𝓌", x: "𝓍", y: "𝓎", z: "𝓏",
};

export const FANCY_STYLES: FancyStyle[] = [
  { id: "bold", label: "Bold", transform: offsetMap(0x1d400, 0x1d41a, 0x1d7ce) },
  { id: "italic", label: "Italic", transform: offsetMap(0x1d434, 0x1d44e) },
  { id: "bolditalic", label: "Bold Italic", transform: offsetMap(0x1d468, 0x1d482) },
  { id: "mono", label: "Monospace", transform: offsetMap(0x1d670, 0x1d68a, 0x1d7f6) },
  { id: "doublestruck", label: "Double-struck", transform: doubleStruck },
  { id: "circled", label: "Circled", transform: circled },
  { id: "fullwidth", label: "Ｗｉｄｅ", transform: (s) => [...s].map((c) => { const n = c.codePointAt(0)!; return n >= 0x21 && n <= 0x7e ? String.fromCodePoint(n + 0xfee0) : c === " " ? "　" : c; }).join("") },
  { id: "smallcaps", label: "Small Caps", transform: (s) => [...s].map((c) => SMALL[c] ?? c).join("") },
  { id: "flip", label: "Upside Down", transform: (s) => [...s].reverse().map((c) => FLIP[c] ?? c).join("") },
  { id: "script", label: "Script", transform: (s) => [...s].map((c) => SCRIPT[c] ?? c).join("") },
  { id: "strike", label: "Strikethrough", transform: (s) => [...s].map((c) => c + "̶").join("") },
  { id: "underline", label: "Underline", transform: (s) => [...s].map((c) => c + "̲").join("") },
];
