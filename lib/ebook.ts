/**
 * Ebook Maker — pure EPUB 3 builder (no backend, no DOM).
 *
 * buildEpub(book) produces a REAL, valid EPUB 3 file:
 *   - "mimetype" stored FIRST and UNCOMPRESSED (EPUB requirement)
 *   - META-INF/container.xml
 *   - OEBPS/content.opf (metadata + manifest + spine + cover guide item)
 *   - OEBPS/nav.xhtml (EPUB 3 table of contents)
 *   - OEBPS/toc.ncx (legacy NCX for older readers)
 *   - OEBPS/cover.xhtml (cover page — uploaded image, or a styled title page)
 *   - OEBPS/ch1.xhtml, ch2.xhtml, ... (one XHTML file per chapter)
 *   - OEBPS/images/*.jpg|png (embedded images, incl. cover art)
 *   - OEBPS/style.css
 */
import JSZip from "jszip";
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";

export type EbookBlock =
  | { kind: "text"; text: string }
  | { kind: "image"; imageData: ArrayBuffer; mimeType: "image/jpeg" | "image/png" | "image/webp"; caption?: string };

export interface EbookChapter {
  id: string;
  title: string;
  blocks: EbookBlock[];
}

export interface EbookCover {
  /** Uploaded cover art (embedded as the book's cover image). */
  imageData?: ArrayBuffer;
  imageMime?: "image/jpeg" | "image/png" | "image/webp";
  /** Gradient used when there is no uploaded cover art. */
  gradientFrom: string;
  gradientTo: string;
}

export interface BookData {
  title: string;
  author: string;
  language: string;
  cover: EbookCover;
  chapters: EbookChapter[];
}

export interface EpubResult {
  blob: Blob;
  filename: string;
}

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

export async function buildEpub(book: BookData): Promise<EpubResult> {
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

  // 3) CSS
  const css = [
    "body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; margin: 5%; }",
    "h1, h2 { line-height: 1.25; }",
    "h1.chapter-title { font-size: 1.6em; margin-bottom: 1em; }",
    "p { margin: 0 0 1em 0; text-align: justify; }",
    "img { max-width: 100%; height: auto; }",
    "figure { margin: 1.5em 0; text-align: center; }",
    "figcaption { font-size: 0.85em; color: #555; margin-top: 0.5em; }",
    ".cover { text-align: center; }",
    ".cover img { max-width: 100%; max-height: 95vh; }",
    ".cover-title { margin-top: 20vh; text-align: center; }",
    ".cover-title h1 { font-size: 2.2em; }",
    ".cover-title p.author { font-size: 1.2em; color: #444; }",
    "nav#toc ol { list-style: none; padding-left: 0; }",
    "nav#toc li { margin: 0.4em 0; }",
  ].join("\n");
  zip.file("OEBPS/style.css", css);

  // 4) images (chapter images + optional cover art)
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  let imgCounter = 0;

  const addImage = (data: ArrayBuffer, mime: string): string => {
    imgCounter += 1;
    const ext = imageExt(mime);
    const href = `images/img${imgCounter}.${ext}`;
    zip.file(`OEBPS/${href}`, data, { compression: "DEFLATE" });
    manifestItems.push(
      `    <item id="img${imgCounter}" href="${href}" media-type="${mime}"/>`
    );
    return href;
  };

  // cover art (embedded + referenced from OPF properties="cover-image")
  let coverImageHref: string | null = null;
  let coverItemId: string | null = null;
  if (book.cover.imageData) {
    coverImageHref = addImage(book.cover.imageData, book.cover.imageMime || "image/jpeg");
    coverItemId = `img${imgCounter}`;
    // mark as cover image
    const idx = manifestItems.length - 1;
    manifestItems[idx] =
      `    <item id="${coverItemId}" href="${coverImageHref}" media-type="${book.cover.imageMime || "image/jpeg"}" properties="cover-image"/>`;
  }

  // 5) cover page
  const coverXhtml = coverImageHref
    ? `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE html>\n` +
      `<html xmlns="http://www.w3.org/1999/xhtml">\n` +
      `<head><title>${escapeXml(book.title)} — cover</title>` +
      `<link rel="stylesheet" type="text/css" href="style.css"/></head>\n` +
      `<body class="cover"><img src="${coverImageHref}" alt="Cover art"/></body>\n</html>`
    : `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE html>\n` +
      `<html xmlns="http://www.w3.org/1999/xhtml">\n` +
      `<head><title>${escapeXml(book.title)} — cover</title>` +
      `<link rel="stylesheet" type="text/css" href="style.css"/></head>\n` +
      `<body><div class="cover-title">` +
      `<h1>${escapeXml(book.title)}</h1>` +
      (book.author ? `<p class="author">${escapeXml(book.author)}</p>` : ``) +
      `</div></body>\n</html>`;
  zip.file("OEBPS/cover.xhtml", coverXhtml);
  manifestItems.push(`    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
  spineItems.push(`    <itemref idref="cover"/>`);

  // 6) chapters
  const navEntries: string[] = [];
  const ncxEntries: string[] = [];
  book.chapters.forEach((ch, i) => {
    const n = i + 1;
    let body = `<h1 class="chapter-title">${escapeXml(ch.title || `Chapter ${n}`)}</h1>\n`;
    for (const b of ch.blocks) {
      if (b.kind === "text") {
        body += renderTextParagraphs(b.text) + "\n";
      } else {
        const href = addImage(b.imageData, b.mimeType);
        body +=
          `  <figure><img src="${href}" alt="${escapeXml(b.caption || "")}"/>` +
          (b.caption ? `<figcaption>${escapeXml(b.caption)}</figcaption>` : ``) +
          `</figure>\n`;
      }
    }
    const xhtml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE html>\n` +
      `<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">\n` +
      `<head><title>${escapeXml(ch.title || `Chapter ${n}`)}</title>` +
      `<link rel="stylesheet" type="text/css" href="style.css"/></head>\n` +
      `<body>\n${body}</body>\n</html>`;
    zip.file(`OEBPS/ch${n}.xhtml`, xhtml);
    manifestItems.push(`    <item id="ch${n}" href="ch${n}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="ch${n}"/>`);
    navEntries.push(`      <li><a href="ch${n}.xhtml">${escapeXml(ch.title || `Chapter ${n}`)}</a></li>`);
    ncxEntries.push(
      `    <navPoint id="navPoint-${n}" playOrder="${n + 1}">\n` +
        `      <navLabel><text>${escapeXml(ch.title || `Chapter ${n}`)}</text></navLabel>\n` +
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

  const safeTitle = (book.title || "ebook").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ebook";
  return { blob, filename: `${safeTitle}.epub` };
}

// ---------------------------------------------------------------------------
// PDF builder (pdf-lib, pure — no DOM)
// ---------------------------------------------------------------------------

const PDF_MARGIN = 56;
const PDF_LINE = 1.55;

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
  width: number;
  height: number;
}

function pdfNewPage(ctx: PdfCtx) {
  ctx.page = ctx.doc.addPage([595.28, 841.89]);
  ctx.width = 595.28; ctx.height = 841.89;
  ctx.y = 841.89 - PDF_MARGIN;
}

function pdfEnsure(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < PDF_MARGIN) pdfNewPage(ctx);
}

export async function buildPdf(book: BookData): Promise<Blob> {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfCtx = { doc, body, bold, page: doc.addPage([595.28, 841.89]), y: 841.89 - PDF_MARGIN, width: 595.28, height: 841.89 };
  const maxW = ctx.width - PDF_MARGIN * 2;

  // --- cover page ---
  if (book.cover.imageData) {
    try {
      const img = book.cover.imageMime === "image/png"
        ? await doc.embedPng(book.cover.imageData as ArrayBuffer)
        : await doc.embedJpg(book.cover.imageData as ArrayBuffer);
      const s = Math.min(maxW / img.width, (ctx.height - PDF_MARGIN * 2 - 140) / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.page.drawImage(img, { x: (ctx.width - w) / 2, y: ctx.height - PDF_MARGIN - 80 - h, width: w, height: h });
    } catch { /* fall through to text cover */ }
  }
  const title = book.title || "Untitled";
  const titleSize = Math.min(30, Math.max(18, 340 / Math.max(title.length, 8)));
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  ctx.page.drawText(title, { x: (ctx.width - Math.min(titleW, maxW)) / 2, y: 200, size: titleSize, font: bold, color: rgb(0.1, 0.1, 0.1), maxWidth: maxW, lineHeight: titleSize * 1.25 });
  if (book.author) {
    const aSize = 14;
    const aW = body.widthOfTextAtSize(book.author, aSize);
    ctx.page.drawText(book.author, { x: (ctx.width - Math.min(aW, maxW)) / 2, y: 170, size: aSize, font: body, color: rgb(0.3, 0.3, 0.3), maxWidth: maxW });
  }

  // --- chapters ---
  for (const ch of book.chapters) {
    pdfNewPage(ctx);
    const head = ch.title || "Untitled chapter";
    const hSize = 20;
    for (const line of wrapText(head, bold, hSize, maxW)) {
      pdfEnsure(ctx, hSize * 1.3);
      ctx.page.drawText(line, { x: PDF_MARGIN, y: ctx.y - hSize, size: hSize, font: bold, color: rgb(0.1, 0.1, 0.1) });
      ctx.y -= hSize * 1.35;
    }
    ctx.y -= 10;

    for (const b of ch.blocks) {
      if (b.kind === "text") {
        const size = 11.5;
        for (const line of wrapText(b.text, body, size, maxW)) {
          pdfEnsure(ctx, size * PDF_LINE);
          ctx.page.drawText(line, { x: PDF_MARGIN, y: ctx.y - size, size, font: body, color: rgb(0.15, 0.15, 0.15) });
          ctx.y -= size * PDF_LINE;
        }
        ctx.y -= 6;
      } else {
        try {
          const mime = b.mimeType;
          const img = mime === "image/png"
            ? await doc.embedPng(b.imageData as ArrayBuffer)
            : await doc.embedJpg(b.imageData as ArrayBuffer);
          const s = Math.min(maxW / img.width, 380 / img.height, 1);
          const w = img.width * s, h = img.height * s;
          pdfEnsure(ctx, h + 14);
          ctx.page.drawImage(img, { x: PDF_MARGIN, y: ctx.y - h, width: w, height: h });
          ctx.y -= h + 6;
          if (b.caption) {
            const cSize = 9.5;
            const capW = body.widthOfTextAtSize(b.caption, cSize);
            pdfEnsure(ctx, cSize * 1.5);
            ctx.page.drawText(b.caption.slice(0, 120), {
              x: (ctx.width - Math.min(capW, maxW)) / 2, y: ctx.y - cSize, size: cSize, font: body, color: rgb(0.4, 0.4, 0.4),
            });
            ctx.y -= cSize * 1.6;
          }
          ctx.y -= 8;
        } catch { /* skip broken images */ }
      }
    }
  }

  const bytes = await doc.save();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const safeTitle = (book.title || "ebook").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ebook";
  return new Blob([ab], { type: "application/pdf" });
}

export function pdfFilename(book: BookData): string {
  const safeTitle = (book.title || "ebook").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ebook";
  return `${safeTitle}.pdf`;
}
