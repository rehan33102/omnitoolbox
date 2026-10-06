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

/* ---------- Fraktur (with Unicode exceptions) ---------- */
const FRAK_EXCEPT: Record<string, string> = { C: "𝔠", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" };
const fraktur = (s: string) =>
  [...s].map((c) => {
    if (FRAK_EXCEPT[c]) return FRAK_EXCEPT[c];
    if (c >= "A" && c <= "Z") return off(c, 0x1d504, 65);
    if (c >= "a" && c <= "z") return off(c, 0x1d51e, 97);
    return c;
  }).join("");

/* ---------- Squared / negative-circled / parenthesized ---------- */
const squared = (s: string) =>
  [...s].map((c) => {
    if (c >= "A" && c <= "P") return String.fromCodePoint(0x1f130 + (c.codePointAt(0)! - 65));
    if (c >= "Q" && c <= "Z") return String.fromCodePoint(0x1f140 + (c.codePointAt(0)! - 81));
    return c;
  }).join("");

const negativeCircled = (s: string) =>
  [...s].map((c) => {
    if (c >= "A" && c <= "Z") return String.fromCodePoint(0x1f150 + (c.codePointAt(0)! - 65));
    if (c >= "1" && c <= "9") return String.fromCodePoint(0x278a + (c.codePointAt(0)! - 49));
    return c;
  }).join("");

const parenthesized = (s: string) =>
  [...s].map((c) => {
    const l = c.toLowerCase();
    if (l >= "a" && l <= "z") return String.fromCodePoint(0x249c + (l.codePointAt(0)! - 97));
    if (c >= "1" && c <= "9") return String.fromCodePoint(0x2474 + (c.codePointAt(0)! - 49));
    return c;
  }).join("");

/* ---------- Superscript / subscript ---------- */
const SUPER: Record<string, string> = {
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ",
  j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ",
  s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
  A: "ᴬ", B: "ᴮ", C: "ᶜ", D: "ᴰ", E: "ᴱ", F: "ᶠ", G: "ᴳ", H: "ᴴ", I: "ᴵ",
  J: "ᴶ", K: "ᴷ", L: "ᴸ", M: "ᴹ", N: "ᴺ", O: "ᴼ", P: "ᴾ",
  R: "ᴿ", S: "ˢ", T: "ᵀ", U: "ᵁ", V: "ⱽ", W: "ᵂ", X: "ˣ", Y: "ʸ", Z: "ᶻ",
};
const superscript = (s: string) =>
  [...s].map((c) => {
    if (SUPER[c]) return SUPER[c];
    if (c >= "0" && c <= "9") {
      const n = c.codePointAt(0)! - 48;
      return ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"][n];
    }
    return c;
  }).join("");

const SUB: Record<string, string> = {
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ",
  n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};
const subscript = (s: string) =>
  [...s].map((c) => {
    if (SUB[c.toLowerCase()] && c === c.toLowerCase()) return SUB[c];
    if (c >= "0" && c <= "9") return off(c, 0x2080, 48);
    return c;
  }).join("");

/* ---------- Regional indicator (flag letters) ---------- */
const regional = (s: string) =>
  [...s.toUpperCase()].map((c) => (c >= "A" && c <= "Z" ? String.fromCodePoint(0x1f1e6 + (c.codePointAt(0)! - 65)) : c)).join("\u200b");

/* ---------- Morse / binary / hex / escapes ---------- */
const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
};
const morse = (s: string) => [...s.toUpperCase()].map((c) => (c === " " ? "/" : MORSE[c] ?? c)).join(" ");
const binary = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(2).padStart(8, "0")).join(" ");
const hexcode = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16).toUpperCase()).join(" ");
const unicodeEscape = (s: string) => [...s].map((c) => "\\u" + c.codePointAt(0)!.toString(16).padStart(4, "0")).join("");
const htmlEntity = (s: string) => [...s].map((c) => "&#x" + c.codePointAt(0)!.toString(16) + ";").join("");

/* ---------- Base64 (manual, no Node/browser globals) ---------- */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

/* ---------- Leet speak ---------- */
const LEET: Record<string, string> = {
  a: "4", b: "8", c: "(", d: "|)", e: "3", f: "|=", g: "6", h: "|-|", i: "1",
  j: "_|", k: "|<", l: "|_", m: "|\\/|", n: "|\\|", o: "0", p: "|*", q: "0,",
  r: "|2", s: "5", t: "7", u: "|_|", v: "\\/", w: "\\/\\/", x: "><", y: "`/", z: "2",
};
const leet = (s: string) => [...s].map((c) => LEET[c.toLowerCase()] ?? c).join("");

/* ---------- Zalgo glitch (deterministic) ---------- */
const ZALGO_UP = ["̀", "́", "̂", "̃", "̄", "̅", "̆", "̇", "̈", "̉", "̊", "̋", "̌", "̍", "̎", "̏", "̐", "̑", "̒", "̓", "̔", "̕", "̽", "͏"];
const ZALGO_DOWN = ["̖", "̗", "̘", "̙", "̚", "̛", "̜", "̝", "̞", "̟", "̠", "̡", "̢", "̣", "̤", "̥", "̦", "̧", "̨", "̩", "̪", "̫", "̬", "̭", "̮", "̯", "̰", "̱", "̲", "̳", "̴", "̵", "̶", "̷", "̸", "̹", "̺", "̻", "̼"];
const ZALGO_MID = ["͠", "͡", "͢", "ͣ", "ͤ", "ͥ", "ͦ", "ͧ", "ͨ", "ͩ", "ͪ", "ͫ", "ͬ", "ͭ", "ͮ", "ͯ"];
function seededRand(seed: number) {
  let x = seed;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}
const zalgo = (s: string) =>
  [...s].map((c, i) => {
    if (c === " ") return c;
    const r = seededRand(i * 97 + 13);
    const n = 2 + Math.floor(r() * 3);
    let out = c;
    for (let k = 0; k < n; k++) {
      const pool = r() < 0.4 ? ZALGO_UP : r() < 0.75 ? ZALGO_DOWN : ZALGO_MID;
      out += pool[Math.floor(r() * pool.length)];
    }
    return out;
  }).join("");

/* ---------- Greek lookalikes ---------- */
const GREEK: Record<string, string> = {
  A: "Α", B: "Β", C: "Ϲ", E: "Ε", H: "Η", I: "Ι", K: "Κ", M: "Μ", N: "Ν",
  O: "Ο", P: "Ρ", T: "Τ", X: "Χ", Y: "Υ", Z: "Ζ",
  c: "ϲ", o: "ο", p: "ρ", v: "ν", w: "ω", x: "χ",
};
const greek = (s: string) => [...s].map((c) => GREEK[c] ?? c).join("");

/* ---------- Mirror ---------- */
const MIRROR: Record<string, string> = { b: "d", d: "b", p: "q", q: "p", e: "ɘ" };
const mirror = (s: string) => [...s].map((c) => MIRROR[c] ?? c).join("");

/* ---------- Ciphers ---------- */
const rot13 = (s: string) =>
  [...s].map((c) => {
    if (c >= "A" && c <= "Z") return String.fromCharCode(((c.charCodeAt(0) - 65 + 13) % 26) + 65);
    if (c >= "a" && c <= "z") return String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97);
    return c;
  }).join("");
const atbash = (s: string) =>
  [...s].map((c) => {
    if (c >= "A" && c <= "Z") return String.fromCharCode(90 - (c.charCodeAt(0) - 65));
    if (c >= "a" && c <= "z") return String.fromCharCode(122 - (c.charCodeAt(0) - 97));
    return c;
  }).join("");

/* ---------- Playful text transforms ---------- */
const spongebob = (s: string) => {
  let i = 0;
  return [...s].map((c) => (/[a-zA-Z]/.test(c) ? (i++ % 2 === 0 ? c.toUpperCase() : c.toLowerCase()) : c)).join("");
};
const backwards = (s: string) => [...s].reverse().join("");
const clap = (s: string) => s.split(" ").join(" ");
const spaced = (s: string) => [...s].join(" ");
const vaporwave = (s: string) =>
  [...s].map((c) => { const n = c.codePointAt(0)!; return n >= 0x21 && n <= 0x7e ? String.fromCodePoint(n + 0xfee0) : c; }).join("　");
const piglatin = (s: string) =>
  s.split(/(\s+)/).map((w) => {
    if (!/^[A-Za-z]/.test(w)) return w;
    const m = w.match(/^([^aeiouAEIOU]+)(.*)$/);
    if (!m) return w + "way";
    return m[2] + m[1] + "ay";
  }).join("");

/* ---------- Combining decorations ---------- */
const combine = (mark: string) => (s: string) => [...s].map((c) => (c === " " ? c : c + mark)).join("");

/* ---------- Wrapper decorations ---------- */
const wrap = (pre: string, post: string) => (s: string) => `${pre}${s}${post}`;
const pre = (p: string) => (s: string) => `${p} ${s}`;

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

  /* ---- Mathematical alphanumeric ---- */
  { id: "sans", label: "Sans", transform: offsetMap(0x1d5a0, 0x1d5ba, 0x1d7e2) },
  { id: "boldsans", label: "Bold Sans", transform: offsetMap(0x1d5d4, 0x1d5ee, 0x1d7ec) },
  { id: "italicsans", label: "Italic Sans", transform: offsetMap(0x1d608, 0x1d622) },
  { id: "bolditalicsans", label: "Bold Italic Sans", transform: offsetMap(0x1d63c, 0x1d656) },
  { id: "boldscript", label: "Bold Script", transform: offsetMap(0x1d4d0, 0x1d4ea) },
  { id: "fraktur", label: "Fraktur", transform: fraktur },
  { id: "boldfraktur", label: "Bold Fraktur", transform: offsetMap(0x1d56c, 0x1d586) },
  { id: "squared", label: "Squared", transform: squared },
  { id: "negcircled", label: "Negative Circled", transform: negativeCircled },
  { id: "parenthesized", label: "Parenthesized", transform: parenthesized },
  { id: "superscript", label: "Superscript Tiny", transform: superscript },
  { id: "subscript", label: "Subscript", transform: subscript },
  { id: "regional", label: "Regional Indicator", transform: regional },

  /* ---- Codes & ciphers ---- */
  { id: "morse", label: "Morse Code", transform: morse },
  { id: "binary", label: "Binary", transform: binary },
  { id: "hex", label: "Hex Code", transform: hexcode },
  { id: "unicode", label: "Unicode Escape", transform: unicodeEscape },
  { id: "htmlentity", label: "HTML Entity", transform: htmlEntity },
  { id: "base64", label: "Base64", transform: base64Encode },
  { id: "leet", label: "Leet Speak", transform: leet },
  { id: "rot13", label: "ROT13", transform: rot13 },
  { id: "atbash", label: "Atbash", transform: atbash },
  { id: "piglatin", label: "Pig Latin", transform: piglatin },

  /* ---- Glitch & aesthetic ---- */
  { id: "zalgo", label: "Zalgo Glitch", transform: zalgo },
  { id: "vaporwave", label: "Vaporwave", transform: vaporwave },
  { id: "greek", label: "Greek Lookalike", transform: greek },
  { id: "mirror", label: "Mirror", transform: mirror },

  /* ---- Playful transforms ---- */
  { id: "spongebob", label: "SpongeBob Mock", transform: spongebob },
  { id: "backwards", label: "Backwards", transform: backwards },
  { id: "clap", label: "Clap ", transform: clap },
  { id: "spaced", label: "S p a c e d", transform: spaced },

  /* ---- Combining decorations ---- */
  { id: "dblunderline", label: "Double Underline", transform: combine("̳") },
  { id: "overline", label: "Overline", transform: combine("̅") },
  { id: "waveline", label: "Wavy Underline", transform: combine("̰") },
  { id: "dblstrike", label: "Double Strike", transform: combine("̶̶") },
  { id: "slashthrough", label: "Slash Through", transform: combine("̸") },

  /* ---- Decorative brackets ---- */
  { id: "deco-sqbracket", label: "【 Brackets 】", transform: wrap("【", "】") },
  { id: "deco-whitecorner", label: "『 Corners 』", transform: wrap("『", "』") },
  { id: "deco-dblangle", label: "《 Angles 》", transform: wrap("《", "》") },
  { id: "deco-tortoise", label: "〖 Tortoise 〗", transform: wrap("〖", "〗") },
  { id: "deco-corner", label: "「 Corner 」", transform: wrap("「", "」") },
  { id: "deco-ornparen", label: " Ornate Paren ", transform: wrap("", "") },
  { id: "deco-orncurl", label: " Ornate Curl ", transform: wrap("", "") },
  { id: "deco-mathangle", label: "⟪ Math Angle ⟫", transform: wrap("⟪", "⟫") },
  { id: "deco-whitesquare", label: "⟦ White Square ⟧", transform: wrap("⟦", "⟧") },
  { id: "deco-turtle", label: "⦃ Turtle ⦄", transform: wrap("⦃", "⦄") },
  { id: "deco-quote1", label: " Quote ", transform: wrap("", "") },
  { id: "deco-quote2", label: " Quote ", transform: wrap("", "") },

  /* ---- Arrows & pointers ---- */
  { id: "deco-arrows", label: "→ Arrows ←", transform: wrap("→ ", " ←") },
  { id: "deco-guillemet", label: "» Guillemets «", transform: wrap("» ", " «") },
  { id: "deco-fancyarrow", label: " Fancy Arrows ", transform: wrap(" ", " ") },
  { id: "deco-pointer", label: " Pointer ", transform: wrap(" ", " ") },

  /* ---- Stars & sparkles ---- */
  { id: "deco-stars", label: " Stars ", transform: wrap(" ", " ") },
  { id: "deco-stars2", label: " Hollow Stars ", transform: wrap(" ", " ") },
  { id: "deco-sparkle", label: " Sparkles ", transform: wrap("･ﾟ: *･ﾟ:", ":･ﾟ*:･ﾟ") },
  { id: "deco-cutestars", label: "｡･:*:･ﾟ Cute ﾟ･:*:･｡", transform: wrap("｡･:*:･ﾟ ", " ﾟ･:*:･｡") },
  { id: "deco-stardivider", label: "⋆ Star Divider ⋆", transform: wrap("⋆ ", " ⋆") },
  { id: "deco-plus", label: "₊˚ Plus ˚₊", transform: wrap("₊˚ ", " ˚₊") },

  /* ---- Hearts & love ---- */
  { id: "deco-hearts", label: " Hearts ", transform: wrap(" ", " ") },
  { id: "deco-hearts2", label: " Hollow Hearts ", transform: wrap(" ", " ") },
  { id: "deco-heartline", label: "── Line ──", transform: wrap("── ", " ──") },

  /* ---- Fire, energy, icons ---- */
  { id: "deco-fire", label: " Fire ", transform: wrap(" ", " ") },
  { id: "deco-bolt", label: " Lightning ", transform: wrap(" ", " ") },
  { id: "deco-crown", label: " Crown ", transform: wrap(" ", " ") },
  { id: "deco-music", label: " Music ", transform: wrap(" ", " ") },
  { id: "deco-music2", label: " Music ", transform: wrap(" ", " ") },
  { id: "deco-flower", label: " Flower ", transform: wrap(" ", " ") },
  { id: "deco-snow", label: " Snow ", transform: wrap(" ", " ") },
  { id: "deco-moon", label: " Moon ", transform: wrap(" ", " ") },
  { id: "deco-skull", label: " Skull ", transform: wrap(" ", " ") },
  { id: "deco-diamond", label: "◆ Diamond ◆", transform: wrap("◆ ", " ◆") },
  { id: "deco-diamond2", label: "◇ Hollow Diamond ◇", transform: wrap("◇ ", " ◇") },
  { id: "deco-spade", label: " Spade ", transform: wrap(" ", " ") },
  { id: "deco-club", label: " Club ", transform: wrap(" ", " ") },
  { id: "deco-check", label: " Check ", transform: wrap(" ", " ") },
  { id: "deco-cross", label: " Cross ", transform: wrap(" ", " ") },

  /* ---- Lines, waves, dots ---- */
  { id: "deco-wave", label: "〜 Wave 〜", transform: wrap("〜", "〜") },
  { id: "deco-wave2", label: "～ Wave ～", transform: wrap("～", "～") },
  { id: "deco-dots", label: "•● Dots ●•", transform: wrap("•● ", " ●•") },
  { id: "deco-lines", label: "─── Lines ───", transform: wrap("─── ", " ───") },
  { id: "deco-lines2", label: "═══ Double Lines ═══", transform: wrap("═══ ", " ═══") },
  { id: "deco-block", label: "░░░ Blocks ░░░", transform: wrap("░░░ ", " ░░░") },
  { id: "deco-block2", label: "▒▒▒ Blocks ▒▒▒", transform: wrap("▒▒▒ ", " ▒▒▒") },
  { id: "deco-block3", label: "▓▓▓ Blocks ▓▓▓", transform: wrap("▓▓▓ ", " ▓▓▓") },

  /* ---- Asian-style corners ---- */
  { id: "deco-javanese", label: "꧁ Javanese ꧂", transform: wrap("꧁", "꧂") },
  { id: "deco-javanese2", label: "꧁༒ Royal ༒꧂", transform: wrap("꧁༒ ", " ༒꧂") },
  { id: "deco-tibetan", label: "༺ Tibetan ༻", transform: wrap("༺ ", " ༻") },

  /* ---- Meme & kawaii ---- */
  { id: "deco-kawaii", label: "ʕ•ᴥ•ʔ Kawaii ʕ•ᴥ•ʔ", transform: wrap("ʕ•ᴥ•ʔ ", " ʕ•ᴥ•ʔ") },
  { id: "deco-lenny", label: "( ͡° ͜ʖ ͡°) Lenny", transform: wrap("( ͡° ͜ʖ ͡°) ", " ( ͡° ͜ʖ ͡°)") },
  { id: "deco-shrug", label: "¯\\_(ツ)_/¯ Shrug", transform: pre("¯\\_(ツ)_/¯") },
  { id: "deco-tableflip", label: "(╯°□°）╯ Table Flip", transform: pre("(╯°□°）╯︵") },
];
