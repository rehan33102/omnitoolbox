/**
 * Ebook Maker — pure EPUB 3 + PDF builder (no backend, no DOM).
 *
 * buildEpub(book) produces a REAL, valid EPUB 3 file:
 *   - "mimetype" stored FIRST and UNCOMPRESSED (EPUB requirement)
 *   - META-INF/container.xml
 *   - OEBPS/content.opf (metadata + manifest + spine + cover guide item)
 *   - OEBPS/nav.xhtml (EPUB 3 table of contents)
 *   - OEBPS/toc.ncx (legacy NCX for older readers)
 *   - OEBPS/cover.xhtml (designed cover page — uploaded art or template)
 *   - OEBPS/ch1.xhtml, ch2.xhtml, ... (one XHTML file per chapter)
 *   - OEBPS/images/*.jpg|png (embedded images, incl. cover art)
 *   - OEBPS/style.css (selected interior theme)
 *
 * Defensive by design: any image that fails to embed is SKIPPED and counted
 * in the returned warnings — the export always succeeds anyway.
 */
import JSZip from "jszip";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EbookBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; imageData: ArrayBuffer; mimeType: "image/jpeg" | "image/png" | "image/webp"; caption?: string };

export interface EbookChapter {
  id: string;
  title: string;
  blocks: EbookBlock[];
}

export type CoverTemplate = "centered" | "top-band" | "minimal" | "bold";

export interface EbookCover {
  /** Uploaded cover art (embedded as the book's cover image). */
  imageData?: ArrayBuffer;
  imageMime?: "image/jpeg" | "image/png" | "image/webp";
  /** Gradient used when there is no uploaded cover art. */
  gradientFrom: string;
  gradientTo: string;
  /** Layout template for the designed cover. */
  template: CoverTemplate;
}

export interface BookData {
  title: string;
  author: string;
  language: string;
  themeId: string;
  cover: EbookCover;
  chapters: EbookChapter[];
}

export interface EpubResult {
  blob: Blob;
  filename: string;
  warnings: string[];
}

export interface PdfResult {
  blob: Blob;
  filename: string;
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Interior themes (EPUB CSS + PDF style params share one registry)     */
/* ------------------------------------------------------------------ */

export interface EbookTheme {
  id: string;
  name: string;
  tagline: string;
  /** EPUB 3 stylesheet (single-line rules; used verbatim + scoped for preview). */
  css: string;
  pdf: {
    serif: boolean;
    bodySize: number;
    lineHeight: number;
    titleSize: number;
    headingSize: number;
    headingColor: [number, number, number];
    bodyColor: [number, number, number];
    captionColor: [number, number, number];
    accent: [number, number, number];
    pageBg?: [number, number, number];
    justify: boolean;
  };
}

const CLASSIC_CSS = [
  "body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.75; margin: 6%; color: #1a1a1a; }",
  "h1, h2 { line-height: 1.25; font-weight: bold; }",
  "h1.chapter-title { font-size: 1.7em; margin: 0 0 1.2em 0; text-align: center; letter-spacing: 0.04em; color: #5b1a1a; }",
  "p { margin: 0 0 0 0; text-align: justify; text-indent: 1.5em; }",
  "p:first-of-type { text-indent: 0; }",
  ".chapter-body p:first-of-type::first-letter { font-size: 3.2em; float: left; line-height: 0.9; padding-right: 0.08em; color: #5b1a1a; font-weight: bold; }",
  "img { max-width: 100%; height: auto; }",
  "figure { margin: 1.8em 0; text-align: center; }",
  "figcaption { font-size: 0.85em; color: #666; margin-top: 0.5em; font-style: italic; }",
  ".cover { text-align: center; }",
  ".cover img { max-width: 100%; max-height: 95vh; }",
  "nav#toc ol { list-style: none; padding-left: 0; }",
  "nav#toc li { margin: 0.5em 0; }",
  "nav#toc a { color: #5b1a1a; text-decoration: none; }",
].join("\n");

const MODERN_CSS = [
  "body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.7; margin: 5%; color: #111827; }",
  "h1, h2 { line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; }",
  "h1.chapter-title { font-size: 1.9em; margin: 0 0 0.15em 0; color: #1e3a8a; }",
  ".chapter-kicker { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.18em; color: #6b7280; margin-bottom: 1.6em; }",
  "p { margin: 0 0 1.1em 0; text-align: left; }",
  "img { max-width: 100%; height: auto; border-radius: 6px; }",
  "figure { margin: 1.6em 0; text-align: center; }",
  "figcaption { font-size: 0.85em; color: #6b7280; margin-top: 0.5em; }",
  ".cover { text-align: center; }",
  ".cover img { max-width: 100%; max-height: 95vh; border-radius: 8px; }",
  "nav#toc ol { list-style: none; padding-left: 0; }",
  "nav#toc li { margin: 0.45em 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.45em; }",
  "nav#toc a { color: #1e3a8a; text-decoration: none; font-weight: 600; }",
].join("\n");

const DARK_CSS = [
  "body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; margin: 6%; color: #e8e4d8; background: #14161c; }",
  "h1, h2 { line-height: 1.3; }",
  "h1.chapter-title { font-size: 1.8em; margin: 0 0 1.2em 0; text-align: center; color: #d4af37; letter-spacing: 0.06em; }",
  "p { margin: 0 0 1em 0; text-align: justify; }",
  "img { max-width: 100%; height: auto; }",
  "figure { margin: 1.6em 0; text-align: center; }",
  "figcaption { font-size: 0.85em; color: #9a958a; margin-top: 0.5em; font-style: italic; }",
  ".cover { text-align: center; }",
  ".cover img { max-width: 100%; max-height: 95vh; }",
  "nav#toc ol { list-style: none; padding-left: 0; }",
  "nav#toc li { margin: 0.5em 0; }",
  "nav#toc a { color: #d4af37; text-decoration: none; }",
].join("\n");

const MINIMAL_CSS = [
  "body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 2; margin: 8%; color: #262626; font-size: 0.95em; }",
  "h1, h2 { line-height: 1.4; font-weight: 400; }",
  "h1.chapter-title { font-size: 1.3em; margin: 0 0 2em 0; color: #525252; letter-spacing: 0.02em; }",
  ".chapter-rule { border: none; border-top: 1px solid #d4d4d4; width: 3em; margin: 0 0 2em 0; }",
  "p { margin: 0 0 1.4em 0; text-align: left; }",
  "img { max-width: 100%; height: auto; }",
  "figure { margin: 2em 0; text-align: center; }",
  "figcaption { font-size: 0.8em; color: #a3a3a3; margin-top: 0.6em; letter-spacing: 0.04em; }",
  ".cover { text-align: center; }",
  ".cover img { max-width: 100%; max-height: 95vh; }",
  "nav#toc ol { list-style: none; padding-left: 0; }",
  "nav#toc li { margin: 0.6em 0; }",
  "nav#toc a { color: #525252; text-decoration: none; }",
].join("\n");

export const EBOOK_THEMES: EbookTheme[] = [
  {
    id: "classic", name: "Classic Serif", tagline: "Timeless book feel — justified text, drop caps",
    css: CLASSIC_CSS,
    pdf: { serif: true, bodySize: 11.5, lineHeight: 1.75, titleSize: 22, headingSize: 19, headingColor: [0.36, 0.1, 0.1], bodyColor: [0.1, 0.1, 0.1], captionColor: [0.4, 0.4, 0.4], accent: [0.36, 0.1, 0.1], justify: true },
  },
  {
    id: "modern", name: "Modern Clean", tagline: "Crisp sans-serif — blue headings, airy layout",
    css: MODERN_CSS,
    pdf: { serif: false, bodySize: 11.5, lineHeight: 1.7, titleSize: 24, headingSize: 20, headingColor: [0.12, 0.23, 0.54], bodyColor: [0.07, 0.09, 0.15], captionColor: [0.42, 0.45, 0.5], accent: [0.12, 0.23, 0.54], justify: false },
  },
  {
    id: "dark", name: "Dark Elegant", tagline: "Midnight pages — gold headings, premium night read",
    css: DARK_CSS,
    pdf: { serif: true, bodySize: 11.5, lineHeight: 1.7, titleSize: 22, headingSize: 19, headingColor: [0.83, 0.69, 0.22], bodyColor: [0.91, 0.89, 0.85], captionColor: [0.6, 0.58, 0.54], accent: [0.83, 0.69, 0.22], pageBg: [0.08, 0.09, 0.11], justify: true },
  },
  {
    id: "minimal", name: "Minimal", tagline: "Quiet luxury — wide leading, whisper-soft headings",
    css: MINIMAL_CSS,
    pdf: { serif: false, bodySize: 11, lineHeight: 2.0, titleSize: 18, headingSize: 15, headingColor: [0.32, 0.32, 0.32], bodyColor: [0.15, 0.15, 0.15], captionColor: [0.64, 0.64, 0.64], accent: [0.32, 0.32, 0.32], justify: false },
  },
];

export function themeById(id: string | undefined): EbookTheme {
  return EBOOK_THEMES.find((t) => t.id === id) ?? EBOOK_THEMES[0];
}

export const COVER_TEMPLATES: { id: CoverTemplate; name: string; tagline: string }[] = [
  { id: "centered", name: "Centered", tagline: "Title in the middle, author beneath" },
  { id: "top-band", name: "Top Band", tagline: "Bold band across the top" },
  { id: "minimal", name: "Minimal", tagline: "Small title, quiet and classy" },
  { id: "bold", name: "Bold Statement", tagline: "Huge title anchored at the bottom" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Escape a string for XML/XHTML text content. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderTextParagraphs(text: string): string {
  const paras = text.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return "";
  return paras
    .map((p) => `  <p>${escapeXml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function imageExt(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Cheap magic-byte sanity check (pure, no decoder). Catches garbage early. */
function looksLikeImage(data: ArrayBuffer, mime: string): boolean {
  if (!data || data.byteLength < 12) return false;
  const b = new Uint8Array(data);
  if (mime === "image/png") {
    return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  }
  if (mime === "image/jpeg") {
    return b[0] === 0xff && b[1] === 0xd8;
  }
  if (mime === "image/webp") {
    return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  }
  return true;
}

function safeFilename(title: string, ext: string): string {
  const safe = (title || "ebook").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ebook";
  return `${safe}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* EPUB builder                                                        */
/* ------------------------------------------------------------------ */

export async function buildEpub(book: BookData): Promise<EpubResult> {
  const warnings: string[] = [];
  const theme = themeById(book.themeId);
  const zip = new JSZip();
  const bookId = uid();
  const lang = (book.language || "en").slice(0, 5).toLowerCase() || "en";

  // 1) mimetype MUST be the first entry and MUST be stored uncompressed.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2) container
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n` +
      `  <rootfiles>\n` +
      `    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n` +
      `  </rootfiles>\n` +
      `</container>`
  );

  // 3) theme CSS
  zip.file("OEBPS/style.css", theme.css);

  // 4) images (chapter images + optional cover art) — defensive: a bad
  //    image is skipped, never fatal.
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  let imgCounter = 0;

  const addImage = (data: ArrayBuffer, mime: string, label: string): string | null => {
    try {
      if (!data || data.byteLength === 0) throw new Error("empty image data");
      if (!looksLikeImage(data, mime)) throw new Error("not a decodable image");
      imgCounter += 1;
      const ext = imageExt(mime);
      const href = `images/img${imgCounter}.${ext}`;
      zip.file(`OEBPS/${href}`, data, { compression: "DEFLATE" });
      manifestItems.push(`    <item id="img${imgCounter}" href="${href}" media-type="${mime}"/>`);
      return href;
    } catch (e) {
      warnings.push(`${label}: couldn't be embedded and was skipped`);
      return null;
    }
  };

  // cover art (embedded + referenced from OPF properties="cover-image")
  let coverImageHref: string | null = null;
  let coverItemId: string | null = null;
  if (book.cover.imageData) {
    coverImageHref = addImage(book.cover.imageData, book.cover.imageMime || "image/jpeg", "Cover image");
    if (coverImageHref) {
      coverItemId = `img${imgCounter}`;
      const idx = manifestItems.length - 1;
      manifestItems[idx] =
        `    <item id="${coverItemId}" href="${coverImageHref}" media-type="${book.cover.imageMime || "image/jpeg"}" properties="cover-image"/>`;
    }
  }

  // 5) cover page — designed cover per template, or uploaded art
  const t = book.cover.template || "centered";
  const gf = escapeXml(book.cover.gradientFrom || "#312e81");
  const gt = escapeXml(book.cover.gradientTo || "#0f172a");
  const titleEsc = escapeXml(book.title || "Untitled");
  const authorEsc = escapeXml(book.author || "");
  const gradBg = `background: linear-gradient(160deg, ${gf}, ${gt});`;

  let coverBody: string;
  if (coverImageHref) {
    coverBody = `<div class="cover"><img src="${coverImageHref}" alt="Cover art"/></div>`;
  } else if (t === "top-band") {
    coverBody =
      `<div style="${gradBg} height: 34vh; display: flex; align-items: center; justify-content: center; padding: 2em; box-sizing: border-box;">` +
      `<h1 style="color: #fff; font-size: 2em; margin: 0; text-align: center; line-height: 1.25;">${titleEsc}</h1></div>` +
      (authorEsc ? `<p style="text-align: center; font-size: 1.1em; color: #444; margin-top: 2em;">${authorEsc}</p>` : ``);
  } else if (t === "minimal") {
    coverBody =
      `<div style="margin-top: 55vh; padding: 0 2em;">` +
      `<div style="width: 3em; border-top: 3px solid ${gf}; margin-bottom: 1.2em;"></div>` +
      `<h1 style="font-size: 1.5em; font-weight: normal; color: #222; margin: 0; line-height: 1.4;">${titleEsc}</h1>` +
      (authorEsc ? `<p style="font-size: 0.95em; color: #777; margin-top: 0.8em;">${authorEsc}</p>` : ``) +
      `</div>`;
  } else if (t === "bold") {
    coverBody =
      `<div style="${gradBg} min-height: 96vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 2.2em; box-sizing: border-box;">` +
      `<h1 style="color: #fff; font-size: 2.6em; margin: 0; line-height: 1.15; font-weight: 800;">${titleEsc}</h1>` +
      (authorEsc ? `<p style="color: rgba(255,255,255,0.85); font-size: 1em; margin: 0.9em 0 0 0; text-transform: uppercase; letter-spacing: 0.2em;">${authorEsc}</p>` : ``) +
      `</div>`;
  } else {
    // centered
    coverBody =
      `<div style="${gradBg} min-height: 96vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2em; box-sizing: border-box; text-align: center;">` +
      `<h1 style="color: #fff; font-size: 2.2em; margin: 0; line-height: 1.25;">${titleEsc}</h1>` +
      (authorEsc ? `<p style="color: rgba(255,255,255,0.85); font-size: 1.15em; margin-top: 1em;">${authorEsc}</p>` : ``) +
      `</div>`;
  }

  const coverXhtml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE html>\n` +
    `<html xmlns="http://www.w3.org/1999/xhtml">\n` +
    `<head><title>${titleEsc} — cover</title>` +
    `<link rel="stylesheet" type="text/css" href="style.css"/></head>\n` +
    `<body style="margin: 0;">\n${coverBody}\n</body>\n</html>`;
  zip.file("OEBPS/cover.xhtml", coverXhtml);
  manifestItems.push(`    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
  spineItems.push(`    <itemref idref="cover"/>`);

  // 6) chapters
  const navEntries: string[] = [];
  const ncxEntries: string[] = [];
  book.chapters.forEach((ch, i) => {
    const n = i + 1;
    const chTitle = ch.title || `Chapter ${n}`;
    const kicker = theme.id === "modern"
      ? `<div class="chapter-kicker">Chapter ${n}</div>\n`
      : theme.id === "minimal"
        ? `<hr class="chapter-rule"/>\n`
        : ``;
    let body = `${kicker}<h1 class="chapter-title">${escapeXml(chTitle)}</h1>\n`;
    body += `<div class="chapter-body">\n`;
    for (const b of ch.blocks) {
      if (b.kind === "text") {
        body += renderTextParagraphs(b.text) + "\n";
      } else {
        const href = addImage(b.imageData, b.mimeType, `Image in "${chTitle}"`);
        if (href) {
          body +=
            `  <figure><img src="${href}" alt="${escapeXml(b.caption || "")}"/>` +
            (b.caption ? `<figcaption>${escapeXml(b.caption)}</figcaption>` : ``) +
            `</figure>\n`;
        }
      }
    }
    body += `</div>\n`;
    const xhtml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE html>\n` +
      `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">\n` +
      `<head><title>${escapeXml(chTitle)}</title>` +
      `<link rel="stylesheet" type="text/css" href="style.css"/></head>\n` +
      `<body>\n${body}</body>\n</html>`;
    zip.file(`OEBPS/ch${n}.xhtml`, xhtml);
    manifestItems.push(`    <item id="ch${n}" href="ch${n}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="ch${n}"/>`);
    navEntries.push(`      <li><a href="ch${n}.xhtml">${escapeXml(chTitle)}</a></li>`);
    ncxEntries.push(
      `    <navPoint id="navPoint-${n}" playOrder="${n + 1}">\n` +
        `      <navLabel><text>${escapeXml(chTitle)}</text></navLabel>\n` +
        `      <content src="ch${n}.xhtml"/>\n` +
        `    </navPoint>`
    );
  });

  // 7) EPUB 3 nav
  const navXhtml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE html>\n` +
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n` +
    `<head><title>Table of Contents</title>` +
    `<link rel="stylesheet" type="text/css" href="style.css"/></head>\n` +
    `<body>\n<nav id="toc" epub:type="toc">\n<h1>Contents</h1>\n<ol>\n` +
    navEntries.join("\n") +
    `\n</ol>\n</nav>\n</body>\n</html>`;
  zip.file("OEBPS/nav.xhtml", navXhtml);
  manifestItems.push(`    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);

  // 8) legacy NCX
  const ncx =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n` +
    `  <head>\n` +
    `    <meta name="dtb:uid" content="${escapeXml(bookId)}"/>\n` +
    `    <meta name="dtb:depth" content="1"/>\n` +
    `    <meta name="dtb:totalPageCount" content="0"/>\n` +
    `    <meta name="dtb:maxPageNumber" content="0"/>\n` +
    `  </head>\n` +
    `  <docTitle><text>${escapeXml(book.title)}</text></docTitle>\n` +
    `  <navMap>\n` +
    `    <navPoint id="navPoint-0" playOrder="1">\n` +
    `      <navLabel><text>Cover</text></navLabel>\n` +
    `      <content src="cover.xhtml"/>\n` +
    `    </navPoint>\n` +
    ncxEntries.join("\n") +
    `\n  </navMap>\n</ncx>`;
  zip.file("OEBPS/toc.ncx", ncx);
  manifestItems.push(`    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

  // 9) content.opf
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const opf =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">\n` +
    `  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `    <dc:identifier id="bookid">urn:uuid:${escapeXml(bookId)}</dc:identifier>\n` +
    `    <dc:title>${escapeXml(book.title)}</dc:title>\n` +
    (book.author ? `    <dc:creator>${escapeXml(book.author)}</dc:creator>\n` : ``) +
    `    <dc:language>${escapeXml(lang)}</dc:language>\n` +
    `    <meta property="dcterms:modified">${escapeXml(modified)}</meta>\n` +
    `    <meta name="cover" content="${coverItemId ?? "cover"}"/>\n` +
    `  </metadata>\n` +
    `  <manifest>\n` +
    manifestItems.join("\n") +
    `\n  </manifest>\n` +
    `  <spine>\n` +
    spineItems.join("\n") +
    `\n  </spine>\n` +
    `  <guide>\n` +
    `    <reference type="cover" title="Cover" href="cover.xhtml"/>\n` +
    `    <reference type="toc" title="Table of Contents" href="nav.xhtml"/>\n` +
    `  </guide>\n` +
    `</package>`;
  zip.file("OEBPS/content.opf", opf);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });

  return { blob, filename: safeFilename(book.title, "epub"), warnings };
}

/* ------------------------------------------------------------------ */
/* PDF builder (pdf-lib, pure — no DOM)                                 */
/* ------------------------------------------------------------------ */

const PDF_MARGIN = 56;
const PAGE_W = 595.28;
const PAGE_H = 841.89;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawPara of text.split(/\n/)) {
    const para = rawPara.trim();
    if (!para) { lines.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
        // hard-break a single overlong word
        while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
          let i = line.length - 1;
          while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > maxWidth) i -= 1;
          lines.push(line.slice(0, i));
          line = line.slice(i);
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface PdfCtx {
  doc: PDFDocument;
  body: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  theme: EbookTheme["pdf"];
  warnings: string[];
}

function pdfFillPageBg(ctx: PdfCtx) {
  if (ctx.theme.pageBg) {
    const [r, g, b] = ctx.theme.pageBg;
    ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(r, g, b) });
  }
}

function pdfNewPage(ctx: PdfCtx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  pdfFillPageBg(ctx);
  ctx.y = PAGE_H - PDF_MARGIN;
}

function pdfEnsure(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < PDF_MARGIN) pdfNewPage(ctx);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** pdf-lib has no gradient support; fake a vertical gradient with thin bands. */
function drawVerticalGradient(ctx: PdfCtx, from: string, to: string, x: number, y: number, w: number, h: number) {
  const a = hexToRgb(from), b = hexToRgb(to);
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const f = i / (steps - 1);
    ctx.page.drawRectangle({
      x, y: y + (h * i) / steps, width: w, height: h / steps + 0.5,
      color: rgb(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f),
    });
  }
}

async function embedPdfImage(ctx: PdfCtx, data: ArrayBuffer, mime: string): Promise<{ img: any; w: number; h: number } | null> {
  try {
    if (!data || data.byteLength === 0) throw new Error("empty image");
    const img = mime === "image/png" ? await ctx.doc.embedPng(data) : await ctx.doc.embedJpg(data);
    return { img, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

export async function buildPdf(book: BookData): Promise<PdfResult> {
  const warnings: string[] = [];
  const theme = themeById(book.themeId).pdf;
  const doc = await PDFDocument.create();
  const bodyFontName = theme.serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica;
  const boldFontName = theme.serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold;
  const body = await doc.embedFont(bodyFontName);
  const bold = await doc.embedFont(boldFontName);
  const ctx: PdfCtx = { doc, body, bold, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - PDF_MARGIN, theme, warnings };
  pdfFillPageBg(ctx);
  const maxW = PAGE_W - PDF_MARGIN * 2;
  const t = book.cover.template || "centered";

  // --- cover page ---
  let artDrawn = false;
  if (book.cover.imageData) {
    const e = await embedPdfImage(ctx, book.cover.imageData, book.cover.imageMime || "image/jpeg");
    if (e) {
      const s = Math.min(maxW / e.w, (PAGE_H - PDF_MARGIN * 2 - 160) / e.h);
      const w = e.w * s, h = e.h * s;
      ctx.page.drawImage(e.img, { x: (PAGE_W - w) / 2, y: PAGE_H - PDF_MARGIN - 60 - h, width: w, height: h });
      artDrawn = true;
    } else {
      warnings.push("Cover image: couldn't be embedded and was skipped");
    }
  }
  if (!artDrawn) {
    const gf = book.cover.gradientFrom || "#312e81";
    const gt = book.cover.gradientTo || "#0f172a";
    const title = book.title || "Untitled";
    const white = rgb(1, 1, 1);
    const drawCentered = (text: string, yPos: number, size: number, font: PDFFont, color: any, spacing?: number) => {
      const w = font.widthOfTextAtSize(text, size);
      ctx.page.drawText(text, { x: (PAGE_W - Math.min(w, maxW)) / 2, y: yPos, size, font, color, maxWidth: maxW });
      void spacing;
    };
    if (t === "top-band") {
      drawVerticalGradient(ctx, gf, gt, 0, PAGE_H - 300, PAGE_W, 300);
      const titleSize = Math.min(26, Math.max(16, 300 / Math.max(title.length, 8)));
      drawCentered(title, PAGE_H - 190, titleSize, bold, white);
      if (book.author) {
        ctx.page.drawText(book.author, { x: (PAGE_W - Math.min(body.widthOfTextAtSize(book.author, 13), maxW)) / 2, y: 120, size: 13, font: body, color: rgb(0.3, 0.3, 0.3), maxWidth: maxW });
      }
    } else if (t === "minimal") {
      const [r, g, b] = hexToRgb(gf);
      ctx.page.drawRectangle({ x: PDF_MARGIN, y: 330, width: 44, height: 3.5, color: rgb(r, g, b) });
      const titleSize = Math.min(20, Math.max(14, 220 / Math.max(title.length, 8)));
      for (const [i, line] of wrapText(title, body, titleSize, maxW).slice(0, 3).entries()) {
        ctx.page.drawText(line, { x: PDF_MARGIN, y: 300 - i * titleSize * 1.35, size: titleSize, font: body, color: rgb(0.15, 0.15, 0.15) });
      }
      if (book.author) ctx.page.drawText(book.author, { x: PDF_MARGIN, y: 240, size: 12, font: body, color: rgb(0.45, 0.45, 0.45) });
    } else if (t === "bold") {
      drawVerticalGradient(ctx, gf, gt, 0, 0, PAGE_W, PAGE_H);
      const titleSize = Math.min(34, Math.max(20, 420 / Math.max(title.length, 8)));
      for (const [i, line] of wrapText(title, bold, titleSize, maxW).slice(0, 4).entries()) {
        ctx.page.drawText(line, { x: PDF_MARGIN, y: 260 - i * titleSize * 1.2, size: titleSize, font: bold, color: white, maxWidth: maxW });
      }
      if (book.author) {
        const a = book.author.toUpperCase();
        ctx.page.drawText(a, { x: PDF_MARGIN, y: 190, size: 11, font: body, color: rgb(1, 1, 1), opacity: 0.85, maxWidth: maxW });
      }
    } else {
      drawVerticalGradient(ctx, gf, gt, 0, 0, PAGE_W, PAGE_H);
      const titleSize = Math.min(30, Math.max(18, 340 / Math.max(title.length, 8)));
      const lines = wrapText(title, bold, titleSize, maxW).slice(0, 4);
      const startY = PAGE_H / 2 + ((lines.length - 1) * titleSize * 1.25) / 2;
      lines.forEach((line, i) => {
        const w = bold.widthOfTextAtSize(line, titleSize);
        ctx.page.drawText(line, { x: (PAGE_W - Math.min(w, maxW)) / 2, y: startY - i * titleSize * 1.25, size: titleSize, font: bold, color: white, maxWidth: maxW });
      });
      if (book.author) {
        const aW = body.widthOfTextAtSize(book.author, 14);
        ctx.page.drawText(book.author, { x: (PAGE_W - Math.min(aW, maxW)) / 2, y: startY - lines.length * titleSize * 1.25 - 24, size: 14, font: body, color: rgb(1, 1, 1), opacity: 0.85, maxWidth: maxW });
      }
    }
  }

  // --- chapters ---
  for (const ch of book.chapters) {
    pdfNewPage(ctx);
    const head = ch.title || "Untitled chapter";
    const hSize = theme.headingSize;
    const [hr, hg, hb] = theme.headingColor;
    for (const line of wrapText(head, bold, hSize, maxW)) {
      pdfEnsure(ctx, hSize * 1.3);
      ctx.page.drawText(line, { x: PDF_MARGIN, y: ctx.y - hSize, size: hSize, font: bold, color: rgb(hr, hg, hb) });
      ctx.y -= hSize * 1.35;
    }
    // accent rule under heading
    const [ar, ag, ab] = theme.accent;
    pdfEnsure(ctx, 14);
    ctx.page.drawRectangle({ x: PDF_MARGIN, y: ctx.y - 2, width: 44, height: 2.5, color: rgb(ar, ag, ab) });
    ctx.y -= 16;

    const size = theme.bodySize;
    const [br, bg, bc] = theme.bodyColor;
    const lh = size * theme.lineHeight;
    for (const b of ch.blocks) {
      if (b.kind === "text") {
        for (const line of wrapText(b.text, body, size, maxW)) {
          pdfEnsure(ctx, lh);
          ctx.page.drawText(line, { x: PDF_MARGIN, y: ctx.y - size, size, font: body, color: rgb(br, bg, bc) });
          ctx.y -= lh;
        }
        ctx.y -= 6;
      } else {
        const e = await embedPdfImage(ctx, b.imageData, b.mimeType);
        if (!e) {
          warnings.push(`An image in "${head}" couldn't be embedded and was skipped`);
          continue;
        }
        const s = Math.min(maxW / e.w, 380 / e.h, 1);
        const w = e.w * s, h = e.h * s;
        pdfEnsure(ctx, h + 14);
        ctx.page.drawImage(e.img, { x: PDF_MARGIN, y: ctx.y - h, width: w, height: h });
        ctx.y -= h + 6;
        if (b.caption) {
          const cSize = 9.5;
          const [cr, cg, cb] = theme.captionColor;
          const capW = body.widthOfTextAtSize(b.caption, cSize);
          pdfEnsure(ctx, cSize * 1.5);
          ctx.page.drawText(b.caption.slice(0, 120), {
            x: (PAGE_W - Math.min(capW, maxW)) / 2, y: ctx.y - cSize, size: cSize, font: body, color: rgb(cr, cg, cb),
          });
          ctx.y -= cSize * 1.6;
        }
        ctx.y -= 8;
      }
    }
  }

  const bytes = await doc.save();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { blob: new Blob([ab], { type: "application/pdf" }), filename: safeFilename(book.title, "pdf"), warnings };
}

export function pdfFilename(book: BookData): string {
  return safeFilename(book.title, "pdf");
}

/** Scope single-line theme CSS rules under a preview class (live preview pane).
 *  The `body` rule maps onto the scope element itself. */
export function scopedThemeCss(css: string, scope: string): string {
  return css
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)([^{}@\n]+?)\s*\{\s*([^{}]*)\}\s*$/);
      if (!m) return line;
      const sel = m[2].trim();
      if (!sel) return line;
      const scoped = sel === "body" ? scope : `${scope} ${sel}`;
      return `${m[1]}${scoped} { ${m[3].trim()} }`;
    })
    .join("\n");
}
